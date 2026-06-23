import { describe, it, expect, vi } from 'vitest';
import { runInnerLoop } from '../src/inner-loop.js';
import type {
  InnerLoopJob,
  InnerLoopDeps,
  PhaseInput,
  PhaseOutput,
  GateResult,
} from '../src/inner-loop.js';
import type { Verdict, MustFix } from '../src/types.js';

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

  // 仅某一 phase 失败(其余成功)——钉住"在该 phase 即失败",而非靠后续 phase 兜底
  function failingRole(role: 'test' | 'dev' | 'review'): InnerLoopDeps['runPhase'] {
    const ids = { test: 'st', dev: 'sd', review: 'sr' } as const;
    return vi.fn(async (i: PhaseInput): Promise<PhaseOutput> => ({
      exitCode: i.role === role ? 1 : 0,
      sessionId: i.resumeSessionId ?? ids[i.role],
      resumed: false,
    }));
  }

  it('仅测试 phase 失败 → failed,reason 指明测试 phase', async () => {
    const r = await runInnerLoop(job, makeDeps({ runPhase: failingRole('test') }));
    expect(r.status).toBe('failed');
    expect(r.reason).toMatch(/测试 phase/);
  });

  it('仅开发 phase 失败 → failed,reason 指明开发 phase', async () => {
    const r = await runInnerLoop(job, makeDeps({ runPhase: failingRole('dev') }));
    expect(r.status).toBe('failed');
    expect(r.reason).toMatch(/开发 phase/);
  });

  it('仅评审 phase 失败 → failed,reason 指明评审 phase', async () => {
    const r = await runInnerLoop(job, makeDeps({ runPhase: failingRole('review') }));
    expect(r.status).toBe('failed');
    expect(r.reason).toMatch(/评审 phase/);
  });

  it('RED gate 不红时 reason 透传 gate summary', async () => {
    const deps = makeDeps({
      gates: { red: async () => ({ ok: false, summary: '越界:已存在实现' }), green: async () => ok, mutation: async () => ok },
    });
    const r = await runInnerLoop(job, deps);
    expect(r.reason).toContain('越界:已存在实现');
  });

  it('GREEN gate 一直失败 → 回修超限 blocked-escalated,残留归属开发,fixRounds 计数正确', async () => {
    const deps = makeDeps({
      gates: { red: async () => ok, green: async () => ({ ok: false, summary: 'tsc 报错' }), mutation: async () => ok },
    });
    const r = await runInnerLoop({ id: 'us1', maxFixRounds: 1 }, deps);
    expect(r.status).toBe('blocked-escalated');
    expect(r.reason).toMatch(/GREEN/);
    expect(r.residual?.[0]?.domain).toBe('impl');
    expect(r.residual?.[0]?.desc).toContain('tsc 报错'); // 残留 must-fix 透传 gate summary
    expect(r.fixRounds).toBe(1);
  });

  it('变异门一直不达标 → 回修超限 blocked-escalated,残留归属测试', async () => {
    const deps = makeDeps({
      gates: { red: async () => ok, green: async () => ok, mutation: async () => ({ ok: false, summary: '存活变异' }) },
    });
    const r = await runInnerLoop({ id: 'us1', maxFixRounds: 1 }, deps);
    expect(r.status).toBe('blocked-escalated');
    expect(r.reason).toMatch(/变异门/);
    expect(r.residual?.[0]?.domain).toBe('test');
    expect(r.residual?.[0]?.desc).toContain('存活变异'); // 残留 must-fix 透传变异门 summary
    expect(r.fixRounds).toBe(1);
  });

  it('开发回修 phase 非 0 退出 → failed', async () => {
    const runPhase = vi.fn(async (i: PhaseInput): Promise<PhaseOutput> => ({
      exitCode: i.resumeSessionId !== undefined ? 1 : 0, // 回修(带 resume)时失败
      sessionId: i.resumeSessionId ?? { test: 'st', dev: 'sd', review: 'sr' }[i.role]!,
    }));
    const verdict = async (): Promise<Verdict> => ({ decision: 'block', mustFix: [{ domain: 'impl', desc: 'x' }] });
    const r = await runInnerLoop(job, makeDeps({ runPhase, readVerdict: verdict }));
    expect(r.status).toBe('failed');
    expect(r.reason).toMatch(/开发回修/);
  });

  it('测试回修 phase 非 0 退出 → failed', async () => {
    const runPhase = vi.fn(async (i: PhaseInput): Promise<PhaseOutput> => ({
      exitCode: i.role === 'test' && i.resumeSessionId !== undefined ? 1 : 0,
      sessionId: i.resumeSessionId ?? { test: 'st', dev: 'sd', review: 'sr' }[i.role]!,
    }));
    const verdict = async (): Promise<Verdict> => ({ decision: 'block', mustFix: [{ domain: 'test', desc: 'x' }] });
    const r = await runInnerLoop(job, makeDeps({ runPhase, readVerdict: verdict }));
    expect(r.status).toBe('failed');
    expect(r.reason).toMatch(/测试回修/);
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
    const devFix = fixCalls.find((i) => i.role === 'dev' && i.resumeSessionId === 'sd');
    const testFix = fixCalls.find((i) => i.role === 'test' && i.resumeSessionId === 'st');
    // 按域精确切分:开发只拿 impl,测试只拿 test(钉住 filter 不被绕过)
    expect(devFix?.mustFix).toEqual([{ domain: 'impl', desc: '修 bug' }]);
    expect(testFix?.mustFix).toEqual([{ domain: 'test', desc: '补边界' }]);
  });

  it('仅 test 域 must-fix → 不触发开发回修(implFixes 为空不调开发)', async () => {
    const runPhase = phaseByRole({ test: 'st', dev: 'sd', review: 'sr' });
    const verdict = seq<Verdict>([
      { decision: 'block', mustFix: [{ domain: 'test', desc: '只补测试' }] },
      { decision: 'pass', mustFix: [] },
    ]);
    const r = await runInnerLoop(job, makeDeps({ runPhase, readVerdict: verdict }));
    expect(r.status).toBe('done');
    const resumedDev = (runPhase as ReturnType<typeof vi.fn>).mock.calls
      .map((c) => c[0] as PhaseInput)
      .some((i) => i.role === 'dev' && i.resumeSessionId !== undefined);
    expect(resumedDev).toBe(false); // 无 impl 域 → 开发不被 resume
  });

  it('GREEN 回修中开发 phase 非 0 退出 → failed', async () => {
    // green 先失败触发开发回修;该回修 phase 退出非 0
    const runPhase = vi.fn(async (i: PhaseInput): Promise<PhaseOutput> => ({
      exitCode: i.role === 'dev' && i.resumeSessionId !== undefined ? 1 : 0,
      sessionId: i.resumeSessionId ?? { test: 'st', dev: 'sd', review: 'sr' }[i.role]!,
    }));
    const deps = makeDeps({ runPhase, gates: { red: async () => ok, green: async () => ({ ok: false, summary: 'x' }), mutation: async () => ok } });
    const r = await runInnerLoop(job, deps);
    expect(r.status).toBe('failed');
    expect(r.reason).toMatch(/开发回修/);
  });

  it('变异门回修中测试 phase 非 0 退出 → failed', async () => {
    const runPhase = vi.fn(async (i: PhaseInput): Promise<PhaseOutput> => ({
      exitCode: i.role === 'test' && i.resumeSessionId !== undefined ? 1 : 0,
      sessionId: i.resumeSessionId ?? { test: 'st', dev: 'sd', review: 'sr' }[i.role]!,
    }));
    const deps = makeDeps({ runPhase, gates: { red: async () => ok, green: async () => ok, mutation: async () => ({ ok: false, summary: 'x' }) } });
    const r = await runInnerLoop(job, deps);
    expect(r.status).toBe('failed');
    expect(r.reason).toMatch(/测试回修/);
  });

  it('回修超限 → blocked-escalated,带残留 must-fix', async () => {
    const verdict = async (): Promise<Verdict> => ({ decision: 'block', mustFix: [{ domain: 'impl', desc: '总修不好' }] });
    const r = await runInnerLoop({ id: 'us1', maxFixRounds: 1 }, makeDeps({ readVerdict: verdict }));
    expect(r.status).toBe('blocked-escalated');
    expect(r.residual).toHaveLength(1);
    expect(r.residual?.[0]?.domain).toBe('impl');
    expect(r.reason).toMatch(/超限/);
    expect(r.fixRounds).toBe(1); // maxFixRounds=1 → 恰好 1 轮回修后超限(钉住止损阈值生效)
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

  describe('orchestrator 代修(编排层确定性修复,非 agent)', () => {
    const orchFix = (file: string): Verdict => ({
      decision: 'conditional',
      mustFix: [{ domain: 'orchestrator', desc: '登记 stryker.conf', action: { type: 'register-mutation-target', file } }],
    });

    it('review 提 orchestrator must-fix → orchestratorFix 代修成功 → 继续 → done', async () => {
      const orchestratorFix = vi.fn(async (fixes: MustFix[]) => {
        void fixes; // 参数仅为 mock.calls 类型推断,运行时不消费
        return ok;
      });
      const deps = makeDeps({
        readVerdict: seq<Verdict>([orchFix('src/x.ts'), { decision: 'pass', mustFix: [] }]),
        orchestratorFix,
      });
      const r = await runInnerLoop(job, deps);
      expect(r.status).toBe('done');
      expect(r.fixRounds).toBe(1);
      expect(orchestratorFix).toHaveBeenCalledTimes(1);
      expect(orchestratorFix.mock.calls[0]![0]).toEqual([
        { domain: 'orchestrator', desc: '登记 stryker.conf', action: { type: 'register-mutation-target', file: 'src/x.ts' } },
      ]);
    });

    it('orchestratorFix 代修失败(不识别/出错)→ blocked-escalated,residual 保留', async () => {
      const deps = makeDeps({
        readVerdict: async () => orchFix('src/x.ts'),
        orchestratorFix: async () => ({ ok: false, summary: '不识别的代修指令' }),
      });
      const r = await runInnerLoop(job, deps);
      expect(r.status).toBe('blocked-escalated');
      expect(r.reason).toMatch(/orchestrator/);
      expect(r.residual?.[0]?.domain).toBe('orchestrator');
    });

    it('遇 orchestrator must-fix 但未注入 orchestratorFix 能力 → escalated(向后兼容,不静默吞)', async () => {
      const deps = makeDeps({ readVerdict: async () => orchFix('src/x.ts') }); // 不注入 orchestratorFix
      const r = await runInnerLoop(job, deps);
      expect(r.status).toBe('blocked-escalated');
      expect(r.residual?.[0]?.domain).toBe('orchestrator');
    });

    it('orchestrator + test 混合域:代修与 agent 回修同轮,均成功 → done', async () => {
      const orchestratorFix = vi.fn(async (fixes: MustFix[]) => {
        void fixes; // 参数仅为 mock.calls 类型推断,运行时不消费
        return ok;
      });
      const runPhase = phaseByRole({ test: 'st', dev: 'sd', review: 'sr' });
      const deps = makeDeps({
        runPhase,
        readVerdict: seq<Verdict>([
          {
            decision: 'conditional',
            mustFix: [
              { domain: 'orchestrator', desc: '登记', action: { type: 'register-mutation-target', file: 'src/x.ts' } },
              { domain: 'test', desc: '补测试' },
            ],
          },
          { decision: 'pass', mustFix: [] },
        ]),
        orchestratorFix,
      });
      const r = await runInnerLoop(job, deps);
      expect(r.status).toBe('done');
      expect(orchestratorFix).toHaveBeenCalledTimes(1);
      const testResumed = (runPhase as ReturnType<typeof vi.fn>).mock.calls.some(
        (c) => (c[0] as PhaseInput).role === 'test' && (c[0] as PhaseInput).resumeSessionId === 'st',
      );
      expect(testResumed).toBe(true);
    });
  });
});
