import { describe, it, expect, vi } from 'vitest';
import { openQueue } from '../src/queue-sqlite.js';
import { drainBatchIsolated, type BatchDrainDeps } from '../src/inner-loop-runner.js';
import type { IsolatedResult } from '../src/inner-loop-runner.js';

const specJson = JSON.stringify({ specSlice: 's', targetPaths: ['src/a.ts'], projectDir: '/repo/x' });

function deps(over: Partial<BatchDrainDeps> = {}): BatchDrainDeps {
  return {
    runOne: vi.fn(
      async (jobId: string): Promise<IsolatedResult> =>
        jobId === 'j2'
          ? { result: { status: 'failed', fixRounds: 0, sessions: {} }, committed: false }
          : { result: { status: 'done', fixRounds: 0, sessions: {} }, branch: 'agent/' + jobId, committed: true },
    ),
    batchIntegrate: vi.fn(async (branches: string[]) => ({ ready: true, merged: branches, held: [] })),
    integrationGate: async () => ({ ok: true }),
    linkDeps: async () => {},
    repoRoot: '/repo',
    runtimeDir: '/rt',
    relProjectDir: 'x',
    concurrency: 1,
    ...over,
  };
}

describe('drainBatchIsolated（并行隔离 drain + 批后集成）', () => {
  it('done 的产分支并 ack、failed 的 fail;仅成功分支进 batchIntegrate', async () => {
    const q = openQueue(':memory:');
    for (const id of ['j1', 'j2', 'j3']) q.enqueue({ id, kind: 'inner-loop', prompt: specJson });
    const d = deps();
    const r = await drainBatchIsolated(q, d);

    expect(r.handled).toBe(3);
    expect(q.status('j1')).toBe('done');
    expect(q.status('j2')).toBe('failed');
    expect(q.status('j3')).toBe('done');
    // j2 失败不产分支 → 仅 j1/j3 进集成
    expect(d.batchIntegrate).toHaveBeenCalledTimes(1);
    expect((d.batchIntegrate as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toEqual(['agent/j1', 'agent/j3']);
    expect(r.integration?.ready).toBe(true);
    q.close();
  });

  it('一批全非 done → 跳过 batchIntegrate,integration 为 null', async () => {
    const q = openQueue(':memory:');
    q.enqueue({ id: 'jx', kind: 'inner-loop', prompt: specJson });
    const d = deps({
      runOne: vi.fn(async () => ({ result: { status: 'failed' as const, fixRounds: 0, sessions: {} }, committed: false })),
    });
    const r = await drainBatchIsolated(q, d);
    expect(r.handled).toBe(1);
    expect(d.batchIntegrate).not.toHaveBeenCalled();
    expect(r.integration).toBeNull();
    expect(q.status('jx')).toBe('failed');
    q.close();
  });

  it('空队列 → handled 0,不集成', async () => {
    const q = openQueue(':memory:');
    const d = deps();
    const r = await drainBatchIsolated(q, d);
    expect(r.handled).toBe(0);
    expect(d.batchIntegrate).not.toHaveBeenCalled();
    q.close();
  });
});
