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
    repoRoot: '/repo',
    ...over,
  };
}

describe('runIsolated（隔离只产 feature 分支,不集成）', () => {
  it('done:create→linkDeps→worktree 内跑→squash 产分支;不 integrate,回收', async () => {
    const d = deps();
    const r = await runIsolated('j1', spec, d);
    expect(d.wt.create).toHaveBeenCalledWith('j1', expect.any(String));
    expect(d.wt.linkDeps).toHaveBeenCalledWith('/wt/j1', 'iron-hammer-output/fincards');
    expect(d.runJob).toHaveBeenCalledWith('j1', expect.objectContaining({ projectDir: '/wt/j1/iron-hammer-output/fincards' }));
    expect(d.wt.squashCommit).toHaveBeenCalledWith('/wt/j1/iron-hammer-output/fincards', spec.targetPaths, expect.any(String));
    expect(r.committed).toBe(true);
    expect(r.branch).toBe('agent/j1');
    expect(d.wt.integrate).not.toHaveBeenCalled(); // 集成移到批后
    expect(d.wt.remove).toHaveBeenCalledWith('/wt/j1');
  });

  it('非 done:不 squash,committed=false,无 branch,仍回收', async () => {
    const d = deps({ runJob: vi.fn(async () => ({ status: 'failed' as const, fixRounds: 0, sessions: {} })) });
    const r = await runIsolated('j1', spec, d);
    expect(d.wt.squashCommit).not.toHaveBeenCalled();
    expect(r.committed).toBe(false);
    expect(r.branch).toBeUndefined();
    expect(d.wt.remove).toHaveBeenCalledWith('/wt/j1');
  });

  it('squash 无改动(false):committed=false,无 branch', async () => {
    const d = deps({ wt: stubWt({ squashCommit: vi.fn(async () => false) }) });
    const r = await runIsolated('j1', spec, d);
    expect(r.committed).toBe(false);
    expect(r.branch).toBeUndefined();
  });

  it('runJob 抛错也回收 worktree(finally)', async () => {
    const d = deps({ runJob: vi.fn(async () => { throw new Error('boom'); }) });
    await expect(runIsolated('j1', spec, d)).rejects.toThrow('boom');
    expect(d.wt.remove).toHaveBeenCalledWith('/wt/j1');
  });
});
