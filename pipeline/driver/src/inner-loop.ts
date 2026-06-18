import type { MustFix, Verdict } from './types.js';

// inner-loop 编排器(M5/PEV):driver 当高层状态机,按 测试→开发→评审 串起内循环,
// 阶段间跑确定性 gate,must-fix 自动回修(按域 resume 角色 session),止损超限升级人类。
// 纯逻辑:claude 边界、gate、verdict 读取全部注入,自身不做 IO(便于确定性测试)。
//
// 变异门策略:挪到"verdict 干净、准备进 DONE"的检查点跑 → 中间回修轮天然跳过、末轮必跑;
// 变异门不达标即当作一条测试缺口 must-fix 再修一轮。

export type PhaseRole = 'test' | 'dev' | 'review';

/** 一次角色 phase 的输入(回修时带 resume + 注入的 must-fix)。 */
export interface PhaseInput {
  role: PhaseRole;
  /** 回修时续接对应角色的会话(热上下文);不给=新会话。 */
  resumeSessionId?: string;
  /** 注入的 must-fix(回修时)。 */
  mustFix?: MustFix[];
}

/** 一次角色 phase 的输出。 */
export interface PhaseOutput {
  exitCode: number;
  /** 本次会话 id(供后续回修 resume)。 */
  sessionId: string;
  /** 是否成功 resume;false=目标 session 不可 resume 已回退 fresh spawn。 */
  resumed?: boolean;
  /** 本 phase 的 claude 调用成本(USD);用于可度量聚合,编排逻辑不消费。 */
  costUsd?: number;
}

/** 确定性 gate 结果。 */
export interface GateResult {
  ok: boolean;
  summary?: string;
}

/** inner-loop 作业。 */
export interface InnerLoopJob {
  id: string;
  /** 回修止损上限(默认 2)。 */
  maxFixRounds?: number;
}

/** 注入依赖(全部可替身)。 */
export interface InnerLoopDeps {
  runPhase: (input: PhaseInput) => Promise<PhaseOutput>;
  gates: {
    red: () => Promise<GateResult>;
    green: () => Promise<GateResult>;
    mutation: () => Promise<GateResult>;
  };
  readVerdict: () => Promise<Verdict>;
}

export type InnerLoopStatus = 'done' | 'failed' | 'blocked-escalated';

export interface InnerLoopResult {
  status: InnerLoopStatus;
  fixRounds: number;
  reason?: string;
  sessions: { test?: string; dev?: string };
  residual?: MustFix[];
}

const DEFAULT_MAX_FIX_ROUNDS = 2;

/** 跑一个角色 phase 链 + 回修止损,返回终态结果。 */
export async function runInnerLoop(job: InnerLoopJob, deps: InnerLoopDeps): Promise<InnerLoopResult> {
  const maxFixRounds = job.maxFixRounds ?? DEFAULT_MAX_FIX_ROUNDS;
  const sessions: InnerLoopResult['sessions'] = {};

  const fail = (reason: string, fixRounds: number): InnerLoopResult => ({
    status: 'failed',
    fixRounds,
    reason,
    sessions,
  });

  // ── TEST phase ──
  const test = await deps.runPhase({ role: 'test' });
  sessions.test = test.sessionId;
  if (test.exitCode !== 0) return fail(`测试 phase 非 0 退出(${test.exitCode})`, 0);

  // ── RED gate:测试必须先红,否则升级(测试越界/无效) ──
  const red = await deps.gates.red();
  if (!red.ok) {
    return { status: 'blocked-escalated', fixRounds: 0, reason: `RED gate 未通过:${red.summary ?? '测试未失败'}`, sessions };
  }

  // ── DEV phase ──
  const dev = await deps.runPhase({ role: 'dev' });
  sessions.dev = dev.sessionId;
  if (dev.exitCode !== 0) return fail(`开发 phase 非 0 退出(${dev.exitCode})`, 0);

  // ── 回修循环:GREEN gate → 评审 → verdict → (末轮变异门) ──
  let round = 0;
  for (;;) {
    const green = await deps.gates.green();
    if (!green.ok) {
      // GREEN 未过 = 归属开发的 must-fix
      const fixes: MustFix[] = [{ domain: 'impl', desc: `GREEN gate 未过:${green.summary ?? ''}` }];
      if (round >= maxFixRounds) return { status: 'blocked-escalated', fixRounds: round, reason: 'GREEN gate 回修超限', sessions, residual: fixes };
      round++;
      const r = await deps.runPhase({ role: 'dev', resumeSessionId: sessions.dev, mustFix: fixes });
      sessions.dev = r.sessionId;
      if (r.exitCode !== 0) return fail(`开发回修 phase 非 0 退出(${r.exitCode})`, round);
      continue;
    }

    // ── REVIEW phase ──
    const review = await deps.runPhase({ role: 'review' });
    if (review.exitCode !== 0) return fail(`评审 phase 非 0 退出(${review.exitCode})`, round);
    const verdict = await deps.readVerdict();

    if (verdict.mustFix.length === 0) {
      // 准备 DONE → 末轮变异门
      const mut = await deps.gates.mutation();
      if (mut.ok) return { status: 'done', fixRounds: round, sessions };
      // 变异门不达标 = 测试缺口 must-fix
      const fixes: MustFix[] = [{ domain: 'test', desc: `变异门未达标:${mut.summary ?? ''}` }];
      if (round >= maxFixRounds) return { status: 'blocked-escalated', fixRounds: round, reason: '变异门回修超限', sessions, residual: fixes };
      round++;
      const r = await deps.runPhase({ role: 'test', resumeSessionId: sessions.test, mustFix: fixes });
      sessions.test = r.sessionId;
      if (r.exitCode !== 0) return fail(`测试回修 phase 非 0 退出(${r.exitCode})`, round);
      continue;
    }

    // ── 有 must-fix:超限则升级,否则按域 resume 回修 ──
    if (round >= maxFixRounds) {
      return { status: 'blocked-escalated', fixRounds: round, reason: 'must-fix 回修超限', sessions, residual: verdict.mustFix };
    }
    round++;
    const testFixes = verdict.mustFix.filter((m) => m.domain === 'test');
    const implFixes = verdict.mustFix.filter((m) => m.domain === 'impl');
    if (testFixes.length > 0) {
      const r = await deps.runPhase({ role: 'test', resumeSessionId: sessions.test, mustFix: testFixes });
      sessions.test = r.sessionId;
      if (r.exitCode !== 0) return fail(`测试回修 phase 非 0 退出(${r.exitCode})`, round);
    }
    if (implFixes.length > 0) {
      const r = await deps.runPhase({ role: 'dev', resumeSessionId: sessions.dev, mustFix: implFixes });
      sessions.dev = r.sessionId;
      if (r.exitCode !== 0) return fail(`开发回修 phase 非 0 退出(${r.exitCode})`, round);
    }
  }
}
