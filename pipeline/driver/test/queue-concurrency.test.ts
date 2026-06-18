import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openQueue } from '../src/queue-sqlite.js';

const workerScript = fileURLToPath(new URL('./fixtures/claim-worker.ts', import.meta.url));
const driverRoot = fileURLToPath(new URL('..', import.meta.url));

/** 起一个真实子进程消费者,返回它认领到的 id 列表。 */
function runConsumer(dbPath: string, name: string): Promise<{ ids: string[]; code: number; err: string }> {
  return new Promise((resolve, reject) => {
    // 用 node --import tsx 跑 .ts worker(免 npx 解析开销);cwd=driver 以 resolve tsx。
    const p = spawn(process.execPath, ['--import', 'tsx', workerScript, dbPath, name], {
      cwd: driverRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (code) => {
      let ids: string[] = [];
      try {
        ids = out.trim() ? (JSON.parse(out) as string[]) : [];
      } catch {
        /* 解析失败留空,由断言暴露 */
      }
      resolve({ ids, code: code ?? -1, err });
    });
  });
}

describe('并发认领零双领(多进程真实竞争)', () => {
  it(
    'N 个进程并发认领 M 条 → 总认领数==M 且无任何 id 被双领',
    async () => {
      const dir = mkdtempSync(join(tmpdir(), 'ihq-q-'));
      const dbPath = join(dir, 'q.db');
      const M = 500;
      const N = 4;
      try {
        const q = openQueue(dbPath);
        for (let i = 0; i < M; i++) q.enqueue({ id: `r${i}`, kind: 'inner-loop', prompt: 'x' });
        q.close();

        // 几乎同时启动 N 个消费者进程,制造真实写锁竞争
        const results = await Promise.all(
          Array.from({ length: N }, (_, k) => runConsumer(dbPath, `w${k}`)),
        );

        // 所有子进程正常退出(无 database is locked 崩溃)
        for (const r of results) {
          expect(r.code, `worker 退出码异常: ${r.err}`).toBe(0);
        }

        const all = results.flatMap((r) => r.ids);
        // 1) 零双领:无重复
        expect(new Set(all).size).toBe(all.length);
        // 2) 不丢不溢:总认领数恰好 == M,且正是入队的全集
        expect(all.length).toBe(M);
        expect(new Set(all)).toEqual(new Set(Array.from({ length: M }, (_, i) => `r${i}`)));

        // 3) 验证确有并发瓜分(不是一个进程独吞)——至少 2 个进程认领到 > 0
        const workersWithClaims = results.filter((r) => r.ids.length > 0).length;
        expect(workersWithClaims).toBeGreaterThanOrEqual(2);

        // 终态:db 中无 queued 残留,全部 running(worker 进程未 ack,仅认领)
        const check = openQueue(dbPath);
        expect(check.counts().queued).toBe(0);
        check.close();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    30_000,
  );
});
