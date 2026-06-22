import { describe, it, expect, vi } from 'vitest';
import { openQueue } from '../src/queue-sqlite.js';
import { drainBatchIsolated, type BatchDrainDeps } from '../src/inner-loop-runner.js';
import type { IsolatedResult } from '../src/inner-loop-runner.js';

const spec = (projectDir = '/repo/x') => JSON.stringify({ specSlice: 's', targetPaths: ['src/a.ts'], projectDir });

function deps(over: Partial<BatchDrainDeps> = {}): BatchDrainDeps {
  return {
    runOne: vi.fn(
      async (jobId: string): Promise<IsolatedResult> =>
        jobId === 'j2'
          ? { result: { status: 'failed', fixRounds: 0, sessions: {} }, committed: false }
          : { result: { status: 'done', fixRounds: 0, sessions: {} }, branch: 'agent/' + jobId, committed: true },
    ),
    // 真实 batchIntegrate 会对每个分支调 gate;stub 也照做以驱动 per-branch 路由
    batchIntegrate: vi.fn(async (branches: string[], _o, gate: (b: string) => Promise<{ ok: boolean }>) => {
      for (const b of branches) await gate(b);
      return { ready: true, merged: branches, held: [] };
    }),
    integrationGate: async () => ({ ok: true }),
    linkDeps: async () => {},
    repoRoot: '/repo',
    runtimeDir: '/rt',
    concurrency: 1,
    onHandoff: vi.fn(),
    ...over,
  };
}

describe('drainBatchIsolated（并行隔离 drain + 批后集成）', () => {
  it('done 的产分支并 ack、failed 的 fail;仅成功分支进 batchIntegrate', async () => {
    const q = openQueue(':memory:');
    for (const id of ['j1', 'j2', 'j3']) q.enqueue({ id, kind: 'inner-loop', prompt: spec() });
    const d = deps();
    const r = await drainBatchIsolated(q, d);
    expect(r.handled).toBe(3);
    expect(q.status('j1')).toBe('done');
    expect(q.status('j2')).toBe('failed');
    expect(q.status('j3')).toBe('done');
    expect((d.batchIntegrate as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toEqual(['agent/j1', 'agent/j3']);
    expect(r.integration?.ready).toBe(true);
    q.close();
  });

  it('一批全非 done → 跳过 batchIntegrate,integration 为 null', async () => {
    const q = openQueue(':memory:');
    q.enqueue({ id: 'jx', kind: 'inner-loop', prompt: spec() });
    const d = deps({
      runOne: vi.fn(async () => ({ result: { status: 'failed' as const, fixRounds: 0, sessions: {} }, committed: false })),
    });
    const r = await drainBatchIsolated(q, d);
    expect(r.handled).toBe(1);
    expect(d.batchIntegrate).not.toHaveBeenCalled();
    expect(r.integration).toBeNull();
    q.close();
  });

  it('空队列 → handled 0,不集成', async () => {
    const q = openQueue(':memory:');
    const r = await drainBatchIsolated(q, deps());
    expect(r.handled).toBe(0);
    q.close();
  });

  it('批后触发 onHandoff,收到本批集成结果(HITL 交接)', async () => {
    const q = openQueue(':memory:');
    for (const id of ['j1', 'j3']) q.enqueue({ id, kind: 'inner-loop', prompt: spec() });
    const onHandoff = vi.fn();
    await drainBatchIsolated(q, deps({ onHandoff }));
    expect(onHandoff).toHaveBeenCalledTimes(1);
    expect(onHandoff.mock.calls[0]![0]).toMatchObject({ merged: ['agent/j1', 'agent/j3'] });
    q.close();
  });

  it('空队列(无 job)不触发 onHandoff', async () => {
    const q = openQueue(':memory:');
    const onHandoff = vi.fn();
    await drainBatchIsolated(q, deps({ onHandoff }));
    expect(onHandoff).not.toHaveBeenCalled();
    q.close();
  });

  it('多项目混批:各 feature 的集成 gate/linkDeps 在各自项目目录跑', async () => {
    const q = openQueue(':memory:');
    q.enqueue({ id: 'jA', kind: 'inner-loop', prompt: spec('/repo/projA') });
    q.enqueue({ id: 'jB', kind: 'inner-loop', prompt: spec('/repo/projB') });
    const gatedDirs: string[] = [];
    const linkedDirs: Array<[string, string]> = [];
    const d = deps({
      runOne: vi.fn(async (jobId: string) => ({
        result: { status: 'done' as const, fixRounds: 0, sessions: {} },
        branch: 'agent/' + jobId,
        committed: true,
      })),
      integrationGate: vi.fn(async (pd: string) => {
        gatedDirs.push(pd);
        return { ok: true };
      }),
      linkDeps: vi.fn(async (wt: string, rel: string) => {
        linkedDirs.push([wt, rel]);
      }),
    });
    await drainBatchIsolated(q, d);
    // 据各 job 的 projectDir 推导:projA / projB,而非共用一个目录
    expect(gatedDirs).toContain('/rt/_integration/projA');
    expect(gatedDirs).toContain('/rt/_integration/projB');
    expect(linkedDirs).toContainEqual(['/rt/_integration', 'projA']);
    expect(linkedDirs).toContainEqual(['/rt/_integration', 'projB']);
    q.close();
  });
});
