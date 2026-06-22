import { describe, it, expect, vi } from 'vitest';
import { runIsolated } from '../src/inner-loop-runner.js';
import type { IsolatedDeps } from '../src/inner-loop-runner.js';
import type { InnerLoopResult } from '../src/inner-loop.js';

const spec = {
  specSlice: 's',
  targetPaths: ['src/a.ts', 'test/a.test.ts'],
  projectDir: '/repo/iron-hammer-output/fincards',
};

function stubWt(over: Partial<IsolatedDeps['wt']> = {}): IsolatedDeps['wt'] {
  return {
    create: vi.fn(async (id: string) => ({ path: '/wt/' + id, branch: 'agent/' + id })),
    linkDeps: vi.fn(async () => {}),
    squashCommit: vi.fn(async () => true),
    remove: vi.fn(async () => {}),
    integrate: vi.fn(async () => ({ ok: true, ready: true })),
    batchIntegrate: vi.fn(async () => ({ ready: false, merged: [], held: [] })),
    ...over,
  };
}

function deps(over: Partial<IsolatedDeps> = {}): IsolatedDeps {
  return {
    wt: stubWt(),
    runJob: vi.fn(async (): Promise<InnerLoopResult> => ({ status: 'done', fixRounds: 0, sessions: {} })),
    integrationGate: async () => ({ ok: true }),
    repoRoot: '/repo',
    runtimeDir: '/repo/pipeline/.runtime/worktrees',
    ...over,
  };
}

describe('runIsolated（worktree 隔离编排）', () => {
  it('done:create→linkDeps→在 worktree 内跑→squash→integrate→remove,ready 反映集成', async () => {
    const d = deps();
    const r = await runIsolated('j1', spec, d);
    expect(d.wt.create).toHaveBeenCalledWith('j1', expect.any(String));
    expect(d.wt.linkDeps).toHaveBeenCalledWith('/wt/j1', 'iron-hammer-output/fincards');
    // inner-loop 的 projectDir 指向 worktree 内子路径
    expect(d.runJob).toHaveBeenCalledWith('j1', expect.objectContaining({ projectDir: '/wt/j1/iron-hammer-output/fincards' }));
    expect(d.wt.squashCommit).toHaveBeenCalledWith('/wt/j1/iron-hammer-output/fincards', spec.targetPaths, expect.any(String));
    expect(d.wt.integrate).toHaveBeenCalled();
    expect(d.wt.remove).toHaveBeenCalledWith('/wt/j1');
    expect(r.ready).toBe(true);
    expect(r.result.status).toBe('done');
  });

  it('非 done(failed):不 squash 不 integrate,但仍回收 worktree', async () => {
    const d = deps({ runJob: vi.fn(async () => ({ status: 'failed' as const, fixRounds: 0, sessions: {} })) });
    const r = await runIsolated('j1', spec, d);
    expect(d.wt.squashCommit).not.toHaveBeenCalled();
    expect(d.wt.integrate).not.toHaveBeenCalled();
    expect(d.wt.remove).toHaveBeenCalledWith('/wt/j1');
    expect(r.ready).toBe(false);
  });

  it('squash 无改动(false):不 integrate,ready=false', async () => {
    const d = deps({ wt: stubWt({ squashCommit: vi.fn(async () => false) }) });
    const r = await runIsolated('j1', spec, d);
    expect(d.wt.integrate).not.toHaveBeenCalled();
    expect(r.ready).toBe(false);
  });

  it('集成不全绿:ready=false,worktree 仍回收', async () => {
    const d = deps({ wt: stubWt({ integrate: vi.fn(async () => ({ ok: false, ready: false })) }) });
    const r = await runIsolated('j1', spec, d);
    expect(r.ready).toBe(false);
    expect(d.wt.remove).toHaveBeenCalled();
  });

  it('runJob 抛错也回收 worktree(finally)', async () => {
    const d = deps({ runJob: vi.fn(async () => { throw new Error('boom'); }) });
    await expect(runIsolated('j1', spec, d)).rejects.toThrow('boom');
    expect(d.wt.remove).toHaveBeenCalledWith('/wt/j1');
  });
});
