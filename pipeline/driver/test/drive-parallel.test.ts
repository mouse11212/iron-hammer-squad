import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openQueue } from '../src/queue-sqlite.js';
import { driveParallelOnce } from '../src/drive-parallel.js';
import type { InvokeResult } from '../src/types.js';

function tmpDb(): { dir: string; dbPath: string } {
  const dir = mkdtempSync(join(tmpdir(), 'ihq-dp-'));
  return { dir, dbPath: join(dir, 'q.db') };
}

describe('driveParallelOnce(并行 worker pool,注入替身)', () => {
  it('2 个并行 worker 消费同一队列:全部 done、无重复执行、确有并发', async () => {
    const { dir, dbPath } = tmpDb();
    try {
      const M = 6;
      const q = openQueue(dbPath);
      for (let i = 0; i < M; i++) q.enqueue({ id: `r${i}`, kind: 'inner-loop', prompt: `p${i}` });
      q.close();

      const calls: string[] = [];
      let active = 0;
      let maxActive = 0;
      const invoke = async (prompt: string): Promise<InvokeResult> => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 10));
        calls.push(prompt);
        active--;
        return { exitCode: 0, stdout: 'ok', stderr: '' };
      };

      const handled = await driveParallelOnce(dbPath, invoke, 2);
      expect(handled).toBe(M);

      const check = openQueue(dbPath);
      expect(check.counts()).toMatchObject({ done: M, queued: 0, running: 0, failed: 0 });
      check.close();

      expect(new Set(calls).size).toBe(M); // 无重复执行
      expect(maxActive).toBe(2); // 确有 2 路并发(对齐 M5 DoD)
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('invoke 非零退出 → fail;抛错 → fail', async () => {
    const { dir, dbPath } = tmpDb();
    try {
      const q = openQueue(dbPath);
      q.enqueue({ id: 'ok', kind: 'x', prompt: 'good' });
      q.enqueue({ id: 'bad', kind: 'x', prompt: 'nonzero' });
      q.enqueue({ id: 'boom', kind: 'x', prompt: 'throw' });
      q.close();

      const invoke = async (prompt: string): Promise<InvokeResult> => {
        if (prompt === 'throw') throw new Error('kaboom');
        if (prompt === 'nonzero') return { exitCode: 2, stdout: '', stderr: 'failed' };
        return { exitCode: 0, stdout: 'ok', stderr: '' };
      };

      await driveParallelOnce(dbPath, invoke, 2);
      const check = openQueue(dbPath);
      expect(check.status('ok')).toBe('done');
      expect(check.status('bad')).toBe('failed');
      expect(check.status('boom')).toBe('failed');
      check.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('启动 recover:残留 running 被回收并重新消费完成', async () => {
    const { dir, dbPath } = tmpDb();
    try {
      const q = openQueue(dbPath);
      q.enqueue({ id: 'r1', kind: 'x', prompt: 'p' });
      q.claim('dead-worker'); // 模拟上次崩溃:r1 卡在 running
      expect(q.counts().running).toBe(1);
      q.close();

      const invoke = async (): Promise<InvokeResult> => ({ exitCode: 0, stdout: '', stderr: '' });
      const handled = await driveParallelOnce(dbPath, invoke, 2);
      expect(handled).toBe(1); // recover 后被重新认领执行

      const check = openQueue(dbPath);
      expect(check.status('r1')).toBe('done');
      check.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
