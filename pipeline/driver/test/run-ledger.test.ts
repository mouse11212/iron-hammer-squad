import { describe, it, expect } from 'vitest';
import { runLedgerRecord } from '../src/run-ledger.js';
import type { InnerLoopResult } from '../src/inner-loop.js';

describe('runLedgerRecord（纯:InnerLoopResult → slim ledger 记录,丢 sessions/residual 噪声）', () => {
  it('done result → slim 记录(只 jobId/status/fixRounds/costUsd/ts)', () => {
    const result: InnerLoopResult = { status: 'done', fixRounds: 1, sessions: { dev: 'sess-1', test: 'sess-2' } };
    expect(runLedgerRecord('job-x', result, 0.57, '2026-06-24T00:00:00Z')).toEqual({
      jobId: 'job-x',
      status: 'done',
      fixRounds: 1,
      costUsd: 0.57,
      ts: '2026-06-24T00:00:00Z',
    });
  });

  it('escalated result(带 residual/reason)→ 仍只 slim 字段', () => {
    const result: InnerLoopResult = {
      status: 'blocked-escalated',
      fixRounds: 2,
      sessions: {},
      reason: 'must-fix 回修超限',
      residual: [{ domain: 'test', desc: 'x' }],
    };
    const rec = runLedgerRecord('job-e', result, 1.2, 'ts');
    expect(rec).toEqual({ jobId: 'job-e', status: 'blocked-escalated', fixRounds: 2, costUsd: 1.2, ts: 'ts' });
    expect(rec).not.toHaveProperty('residual');
    expect(rec).not.toHaveProperty('sessions');
    expect(rec).not.toHaveProperty('reason');
  });
});
