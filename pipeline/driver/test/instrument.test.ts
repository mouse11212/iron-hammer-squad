import { describe, it, expect } from 'vitest';
import {
  instrumentRunPhase,
  instrumentGateCmd,
  instrumentOrchestratorFix,
  emitSquash,
  emitIntegrate,
  type InstrumentCtx,
} from '../src/instrument.js';
import type { Event } from '../src/events.js';
import type { PhaseOutput } from '../src/inner-loop.js';
import type { CmdResult } from '../src/gates.js';

/** 步进时钟:每次 +1000ms（→ 一对 start/end 调用得 durationMs=1000）。 */
function ctx(traceId = 'job-1'): { c: InstrumentCtx; events: Event[] } {
  let t = 0;
  const events: Event[] = [];
  return { c: { traceId, emit: (e) => events.push(e), clock: () => (t += 1000) }, events };
}

describe('instrumentRunPhase（包装 runPhase 发 phase 事件，per-role attempt 计数）', () => {
  it('发一条 phase 事件:status=ok、durationMs 来自时钟、payload 含 attempt/resumed/exitCode/costUsd；透传输出', async () => {
    const { c, events } = ctx();
    const inner = async (): Promise<PhaseOutput> => ({ exitCode: 0, sessionId: 's1', resumed: false, costUsd: 0.5 });
    const out = await instrumentRunPhase(inner, c)({ role: 'dev' });
    expect(out.sessionId).toBe('s1'); // 透传
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      ts: '1970-01-01T00:00:01.000Z',
      traceId: 'job-1',
      op: 'phase',
      phase: 'dev',
      status: 'ok',
      durationMs: 1000,
    });
    expect(events[0]!.payload).toEqual({ attempt: 0, resumed: false, exitCode: 0, costUsd: 0.5 });
  });

  it('exitCode≠0 → status=error；同角色第二次 attempt 递增；resumed 缺省=false、costUsd 缺省不入 payload', async () => {
    const { c, events } = ctx();
    const wrapped = instrumentRunPhase(async (): Promise<PhaseOutput> => ({ exitCode: 1, sessionId: 's' }), c);
    await wrapped({ role: 'test' });
    await wrapped({ role: 'test' });
    expect(events[0]!.status).toBe('error');
    const p0 = events[0]!.payload as Record<string, unknown>;
    expect(p0.attempt).toBe(0);
    expect(p0.resumed).toBe(false); // out.resumed 未给 → 严格 false(钉死 ?? false)
    expect('costUsd' in p0).toBe(false); // 缺省不臆造 costUsd 键(钉死 !==undefined 守卫)
    expect((events[1]!.payload as { attempt: number }).attempt).toBe(1);
  });
});

describe('instrumentGateCmd（包装 CmdRunner 发 gate 事件，补 exitCode/durationMs）', () => {
  it('发 gate 事件含 cmd/args/exitCode，status 随退出码；透传命令结果', async () => {
    const { c, events } = ctx();
    const inner = async (): Promise<CmdResult> => ({ exitCode: 0, stdout: 'out', stderr: '' });
    const res = await instrumentGateCmd(inner, c)('npm', ['run', 'test'], '/proj');
    expect(res.stdout).toBe('out'); // 透传
    expect(events[0]).toMatchObject({ op: 'gate', status: 'ok', durationMs: 1000, traceId: 'job-1' });
    expect(events[0]!.payload).toEqual({ cmd: 'npm', args: ['run', 'test'], exitCode: 0 });
  });

  it('命令非 0 → status=error', async () => {
    const { c, events } = ctx();
    await instrumentGateCmd(async (): Promise<CmdResult> => ({ exitCode: 2, stdout: '', stderr: 'x' }), c)('tsc', [], '/p');
    expect(events[0]!.status).toBe('error');
  });
});

describe('instrumentOrchestratorFix（包装代修发 orchestrator-fix 事件）', () => {
  it('发事件含 actions/ok，status 随 ok；透传结果', async () => {
    const { c, events } = ctx();
    const inner = async () => ({ ok: true, summary: '登记 src/b.ts' });
    const r = await instrumentOrchestratorFix(inner, c)([
      { domain: 'orchestrator', desc: 'x', action: { type: 'register-mutation-target', file: 'src/b.ts' } },
    ]);
    expect(r.ok).toBe(true); // 透传
    expect(events[0]).toMatchObject({ op: 'orchestrator-fix', status: 'ok', durationMs: 1000 }); // durationMs=end-start
    expect(events[0]!.payload).toEqual({
      actions: [{ action: 'register-mutation-target', target: 'src/b.ts' }],
      ok: true,
    });
  });

  it('代修失败 → status=failed', async () => {
    const { c, events } = ctx();
    await instrumentOrchestratorFix(async () => ({ ok: false, summary: '不识别' }), c)([{ domain: 'orchestrator', desc: 'x' }]);
    expect(events[0]!.status).toBe('failed');
  });
});

describe('emitSquash / emitIntegrate（单点发射）', () => {
  it('squash committed=true → status=done 含 branch', () => {
    const { c, events } = ctx();
    emitSquash(c, { committed: true, branch: 'agent/job-1' });
    expect(events[0]).toMatchObject({ op: 'squash', status: 'done', traceId: 'job-1' });
    expect(events[0]!.payload).toEqual({ committed: true, branch: 'agent/job-1' });
  });

  it('squash committed=false → status=skip 不含 branch', () => {
    const { c, events } = ctx();
    emitSquash(c, { committed: false });
    expect(events[0]!.status).toBe('skip');
    expect(events[0]!.payload).toEqual({ committed: false });
    expect('branch' in (events[0]!.payload as object)).toBe(false); // 钉死 branch 守卫(undefined 不入键)
  });

  it('integrate merged → traceId 由分支名 agent/<jobId> 反推；无 reason 键', () => {
    const events: Event[] = [];
    let t = 0;
    emitIntegrate((e) => events.push(e), () => (t += 5), { branch: 'agent/job-9', status: 'merged' });
    expect(events[0]).toMatchObject({ op: 'integrate', status: 'merged', traceId: 'job-9' });
    expect(events[0]!.payload).toEqual({ branch: 'agent/job-9' });
    expect('reason' in (events[0]!.payload as object)).toBe(false); // merged 无 reason(钉死 reason 守卫)
  });

  it('integrate 仅剥前缀 agent/(钉死 ^ 锚点:中间的 agent/ 不剥)', () => {
    const events: Event[] = [];
    emitIntegrate((e) => events.push(e), () => 0, { branch: 'feat/agent/x', status: 'merged' });
    expect(events[0]!.traceId).toBe('feat/agent/x'); // 非前缀的 agent/ 不被剥
  });

  it('integrate held → 含 reason', () => {
    const events: Event[] = [];
    emitIntegrate((e) => events.push(e), () => 0, { branch: 'agent/job-2', status: 'held', reason: 'conflict' });
    expect(events[0]!.payload).toEqual({ branch: 'agent/job-2', reason: 'conflict' });
  });
});
