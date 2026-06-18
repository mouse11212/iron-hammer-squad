import { describe, it, expect, vi } from 'vitest';
import { runInnerLoop } from '../src/inner-loop.js';
import type {
  InnerLoopJob,
  InnerLoopDeps,
  PhaseInput,
  PhaseOutput,
  GateResult,
} from '../src/inner-loop.js';
import type { Verdict } from '../src/types.js';

const ok: GateResult = { ok: true };
const job: InnerLoopJob = { id: 'us1' };

/** 顺序返回:每次调用吐数组下一项,用尽后吐最后一项(便于"先失败后成功")。 */
function seq<T>(items: T[]): () => Promise<T> {
  let i = 0;
  return async () => items[Math.min(i++, items.length - 1)]!;
}

/** 据 role 路由 sessionId 的 runPhase 替身(模拟各角色独立会话)。 */
function phaseByRole(map: Record<string, string>, exitCode = 0): InnerLoopDeps['runPhase'] {
  return vi.fn(async (input: PhaseInput): Promise<PhaseOutput> => ({
    exitCode,
    sessionId: input.resumeSessionId ?? map[input.role]!,
    resumed: input.resumeSessionId !== undefined,
  }));
}

function makeDeps(over: Partial<InnerLoopDeps> = {}): InnerLoopDeps {
  return {
    runPhase: phaseByRole({ test: 'st', dev: 'sd', review: 'sr' }),
    gates: { red: async () => ok, green: async () => ok, mutation: async () => ok },
    readVerdict: async (): Promise<Verdict> => ({ decision: 'pass', mustFix: [] }),
    ...over,
  };
}

describe('runInnerLoop（纯编排状态机，注入全部 deps）', () => {
  it('happy path:测试→RED→开发→GREEN→评审干净→变异门→DONE', async () => {
    const deps = makeDeps();
    const r = await runInnerLoop(job, deps);
    expect(r.status).toBe('done');
    expect(r.fixRounds).toBe(0);
    expect(r.sessions.test).toBe('st');
    expect(r.sessions.dev).toBe('sd');
  });

  it('RED gate 不红 → blocked-escalated,不进开发 phase', async () => {
    const runPhase = phaseByRole({ test: 'st', dev: 'sd', review: 'sr' });
    const deps = makeDeps({ runPhase, gates: { red: async () => ({ ok: false, summary: '测试没失败' }), green: async () => ok, mutation: async () => ok } });
    const r = await runInnerLoop(job, deps);
    expect(r.status).toBe('blocked-escalated');
    expect(r.reason).toMatch(/RED/);
    const roles = (runPhase as ReturnType<typeof vi.fn>).mock.calls.map((c) => (c[0] as PhaseInput).role);
    expect(roles).not.toContain('dev');
  });

  it('某 phase 的 claude 非 0 退出 → failed', async () => {
    const deps = makeDeps({ runPhase: phaseByRole({ test: 'st', dev: 'sd', review: 'sr' }, 1) });
    const r = await runInnerLoop(job, deps);
    expect(r.status).toBe('failed');
  });

  it('GREEN 失败 → 回修(归属开发,resume dev session)→ 通过 → DONE', async () => {
    const runPhase = phaseByRole({ test: 'st', dev: 'sd', review: 'sr' });
    const deps = makeDeps({
      runPhase,
      gates: { red: async () => ok, green: seq([{ ok: false, summary: 'tsc 报错' }, ok]), mutation: async () => ok },
    });
    const r = await runInnerLoop(job, deps);
    expect(r.status).toBe('done');
    expect(r.fixRounds).toBe(1);
    const devFix = (runPhase as ReturnType<typeof vi.fn>).mock.calls
      .map((c) => c[0] as PhaseInput)
      .find((i) => i.role === 'dev' && i.resumeSessionId === 'sd');
    expect(devFix?.mustFix?.[0]?.domain).toBe('impl');
  });

  it('评审 must-fix → 按域 resume 回修(impl→dev, test→test)→ 干净 → DONE', async () => {
    const runPhase = phaseByRole({ test: 'st', dev: 'sd', review: 'sr' });
    const verdict = seq<Verdict>([
      { decision: 'block', mustFix: [{ domain: 'impl', desc: '修 bug' }, { domain: 'test', desc: '补边界' }] },
      { decision: 'pass', mustFix: [] },
    ]);
    const r = await runInnerLoop(job, makeDeps({ runPhase, readVerdict: verdict }));
    expect(r.status).toBe('done');
    expect(r.fixRounds).toBe(1);
    const fixCalls = (runPhase as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as PhaseInput);
    expect(fixCalls.some((i) => i.role === 'dev' && i.resumeSessionId === 'sd' && i.mustFix?.[0]?.domain === 'impl')).toBe(true);
    expect(fixCalls.some((i) => i.role === 'test' && i.resumeSessionId === 'st' && i.mustFix?.[0]?.domain === 'test')).toBe(true);
  });

  it('回修超限 → blocked-escalated,带残留 must-fix', async () => {
    const verdict = async (): Promise<Verdict> => ({ decision: 'block', mustFix: [{ domain: 'impl', desc: '总修不好' }] });
    const r = await runInnerLoop({ id: 'us1', maxFixRounds: 1 }, makeDeps({ readVerdict: verdict }));
    expect(r.status).toBe('blocked-escalated');
    expect(r.residual).toHaveLength(1);
    expect(r.residual?.[0]?.domain).toBe('impl');
  });

  it('变异门末轮:verdict 干净但变异门不达标 → 当测试缺口回修 → 达标 → DONE', async () => {
    const runPhase = phaseByRole({ test: 'st', dev: 'sd', review: 'sr' });
    const deps = makeDeps({
      runPhase,
      gates: { red: async () => ok, green: async () => ok, mutation: seq([{ ok: false, summary: '存活变异' }, ok]) },
    });
    const r = await runInnerLoop(job, deps);
    expect(r.status).toBe('done');
    expect(r.fixRounds).toBe(1);
    const testFix = (runPhase as ReturnType<typeof vi.fn>).mock.calls
      .map((c) => c[0] as PhaseInput)
      .find((i) => i.role === 'test' && i.resumeSessionId === 'st');
    expect(testFix?.mustFix?.[0]?.domain).toBe('test');
  });

  it('session 不可 resume 回退:runPhase 报 resumed=false → 用新 sessionId 续后续轮', async () => {
    // dev 回修时返回新 session（resumed=false 表示回退 fresh spawn）
    const runPhase = vi.fn(async (input: PhaseInput): Promise<PhaseOutput> => {
      if (input.role === 'dev' && input.resumeSessionId) return { exitCode: 0, sessionId: 'sd-new', resumed: false };
      return { exitCode: 0, sessionId: { test: 'st', dev: 'sd', review: 'sr' }[input.role]!, resumed: false };
    });
    const verdict = seq<Verdict>([
      { decision: 'block', mustFix: [{ domain: 'impl', desc: 'a' }] },
      { decision: 'block', mustFix: [{ domain: 'impl', desc: 'b' }] },
      { decision: 'pass', mustFix: [] },
    ]);
    const r = await runInnerLoop({ id: 'us1', maxFixRounds: 3 }, makeDeps({ runPhase, readVerdict: verdict }));
    expect(r.status).toBe('done');
    expect(r.sessions.dev).toBe('sd-new'); // 回退后新 session 被捕获并用于下一轮
  });
});
