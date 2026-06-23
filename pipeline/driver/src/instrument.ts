import { makeEvent, type EventSink } from './events.js';
import type { PhaseInput, PhaseOutput, GateResult, PhaseRole } from './inner-loop.js';
import type { CmdResult, CmdRunner } from './gates.js';
import type { MustFix } from './types.js';

// 埋点包装器:把现有操作(phase/gate/orchestrator-fix/squash/integrate)路由进统一事件 sink。
// 每个包装器纯逻辑 + 注入 emit/clock(确定可测,KB guides-and-sensors:可观测=computational sensor)。
// 真 IO 装配(runInnerLoopJob/runIsolated/drainBatchIsolated)线进这些包装器,由 e2e 覆盖。

/** 注入上下文:traceId(=jobId)、事件 sink、时钟(epoch ms)。 */
export interface InstrumentCtx {
  traceId: string;
  emit: EventSink;
  /** epoch ms;注入便于确定性测 durationMs。 */
  clock: () => number;
}

const iso = (ms: number): string => new Date(ms).toISOString();

/** 包装 runPhase:每次调用后发一条 phase 事件;内部维护 per-role attempt 计数(回修轮递增)。 */
export function instrumentRunPhase(
  inner: (i: PhaseInput) => Promise<PhaseOutput>,
  ctx: InstrumentCtx,
): (i: PhaseInput) => Promise<PhaseOutput> {
  const attempts = new Map<PhaseRole, number>();
  return async (input) => {
    const start = ctx.clock();
    const out = await inner(input);
    const end = ctx.clock();
    const attempt = attempts.get(input.role) ?? 0;
    attempts.set(input.role, attempt + 1);
    const payload: Record<string, unknown> = { attempt, resumed: out.resumed ?? false, exitCode: out.exitCode };
    if (out.costUsd !== undefined) payload.costUsd = out.costUsd;
    ctx.emit(
      makeEvent({
        ts: iso(start),
        traceId: ctx.traceId,
        op: 'phase',
        phase: input.role,
        status: out.exitCode === 0 ? 'ok' : 'error',
        durationMs: end - start,
        payload,
      }),
    );
    return out;
  };
}

/** 包装 gate CmdRunner:每条命令后发一条 gate 事件(补 exitCode/durationMs,取代仅记 {cmd,args} 的旧 gates.jsonl)。 */
export function instrumentGateCmd(inner: CmdRunner, ctx: InstrumentCtx): CmdRunner {
  return async (cmd, args, cwd) => {
    const start = ctx.clock();
    const res: CmdResult = await inner(cmd, args, cwd);
    const end = ctx.clock();
    ctx.emit(
      makeEvent({
        ts: iso(start),
        traceId: ctx.traceId,
        op: 'gate',
        status: res.exitCode === 0 ? 'ok' : 'error',
        durationMs: end - start,
        payload: { cmd, args, exitCode: res.exitCode },
      }),
    );
    return res;
  };
}

/** 包装 orchestratorFix:代修后发一条 orchestrator-fix 事件(记 actions/ok,可审计)。 */
export function instrumentOrchestratorFix(
  inner: (fixes: MustFix[]) => Promise<GateResult>,
  ctx: InstrumentCtx,
): (fixes: MustFix[]) => Promise<GateResult> {
  return async (fixes) => {
    const start = ctx.clock();
    const r = await inner(fixes);
    const end = ctx.clock();
    ctx.emit(
      makeEvent({
        ts: iso(start),
        traceId: ctx.traceId,
        op: 'orchestrator-fix',
        status: r.ok ? 'ok' : 'failed',
        durationMs: end - start,
        payload: { actions: fixes.map((f) => ({ action: f.action?.type, target: f.action?.file })), ok: r.ok },
      }),
    );
    return r;
  };
}

/** 单点发 squash 事件(squash 在 runIsolated 内单次调用,非包装)。 */
export function emitSquash(ctx: InstrumentCtx, info: { committed: boolean; branch?: string }): void {
  const payload: Record<string, unknown> = { committed: info.committed };
  if (info.branch !== undefined) payload.branch = info.branch;
  ctx.emit(
    makeEvent({
      ts: iso(ctx.clock()),
      traceId: ctx.traceId,
      op: 'squash',
      status: info.committed ? 'done' : 'skip',
      payload,
    }),
  );
}

/** 单点发 integrate 事件(每分支一条);traceId 由分支名 agent/<jobId> 反推回该 US。 */
export function emitIntegrate(
  emit: EventSink,
  clock: () => number,
  rec: { branch: string; status: 'merged' | 'held'; reason?: string },
): void {
  const traceId = rec.branch.replace(/^agent\//, '');
  const payload: Record<string, unknown> = { branch: rec.branch };
  if (rec.reason !== undefined) payload.reason = rec.reason;
  emit(makeEvent({ ts: iso(clock()), traceId, op: 'integrate', status: rec.status, payload }));
}
