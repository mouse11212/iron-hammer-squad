import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readRunLedger } from '../src/run-ledger.js';

function withLedger(lines: string[], fn: (path: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'runledger-'));
  const path = join(dir, 'runs-ledger.jsonl');
  writeFileSync(path, lines.join('\n') + '\n');
  try {
    fn(path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const rec = (jobId: string, status: string, fixRounds: number, costUsd: number): string =>
  JSON.stringify({ jobId, status, fixRounds, costUsd, ts: 'ts' });

describe('readRunLedger（薄 IO:逐行 parse + 按 jobId 去重 + 跳畸形）', () => {
  it('多条 → InnerLoopRunRecord[]', () => {
    withLedger([rec('j1', 'done', 0, 0.1), rec('j2', 'blocked-escalated', 2, 0.5)], (p) => {
      const out = readRunLedger(p);
      expect(out).toHaveLength(2);
      expect(out.map((r) => r.jobId).sort()).toEqual(['j1', 'j2']);
    });
  });

  it('同 jobId 重复 → 后写覆盖(幂等,只留最新)', () => {
    withLedger([rec('j1', 'failed', 0, 0), rec('j1', 'done', 1, 0.3)], (p) => {
      const out = readRunLedger(p);
      expect(out).toHaveLength(1);
      expect(out[0]?.status).toBe('done');
      expect(out[0]?.fixRounds).toBe(1);
    });
  });

  it('跳畸形行', () => {
    withLedger([rec('j1', 'done', 0, 0), '{畸形 json', rec('j2', 'done', 0, 0)], (p) => {
      expect(readRunLedger(p)).toHaveLength(2);
    });
  });

  it('缺文件 → []', () => {
    expect(readRunLedger('/nonexistent/runs-ledger.jsonl')).toEqual([]);
  });
});
