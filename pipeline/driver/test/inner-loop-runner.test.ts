import { describe, it, expect, vi } from 'vitest';
import { makeRunPhase } from '../src/inner-loop-runner.js';
import type { RunPhaseDeps } from '../src/inner-loop-runner.js';
import type { PhaseInvokeResult } from '../src/invoke.js';

function deps(over: Partial<RunPhaseDeps> = {}): RunPhaseDeps {
  let n = 0;
  return {
    phaseInvoke: vi.fn(
      async (): Promise<PhaseInvokeResult> => ({ exitCode: 0, isError: false, result: '', sessionId: `s${++n}` }),
    ),
    loadRoleDoc: (role) => `角色:${role}`,
    conventionsDoc: '约定',
    context: { specSlice: 'WHEN x THEN y' },
    genId: () => 'gen-id',
    ...over,
  };
}

describe('makeRunPhase（装配 prompt + phaseInvoke + resume 回退）', () => {
  it('新会话:resume=false,sessionId 来自 phaseInvoke 结果', async () => {
    const d = deps();
    const runPhase = makeRunPhase(d);
    const out = await runPhase({ role: 'test' });
    expect(out.exitCode).toBe(0);
    expect(out.sessionId).toBe('s1');
    const call = (d.phaseInvoke as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(call.resume).toBe(false);
  });

  it('回修:resumeSessionId 给定 → phaseInvoke resume=true 续接该 session', async () => {
    const d = deps();
    const runPhase = makeRunPhase(d);
    await runPhase({ role: 'dev', resumeSessionId: 'old-sd', mustFix: [{ domain: 'impl', desc: '修 bug' }] });
    const call = (d.phaseInvoke as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(call.resume).toBe(true);
    expect(call.sessionId).toBe('old-sd');
    expect(call.prompt).toContain('修 bug'); // must-fix 注入 prompt
  });

  it('resume 失败 → 回退 fresh spawn,返回新 sessionId,resumed=false', async () => {
    const phaseInvoke = vi
      .fn<(i: unknown) => Promise<PhaseInvokeResult>>()
      .mockResolvedValueOnce({ exitCode: 1, isError: true, result: 'session 过期', sessionId: undefined })
      .mockResolvedValueOnce({ exitCode: 0, isError: false, result: '', sessionId: 'fresh-9' });
    const d = deps({ phaseInvoke });
    const out = await makeRunPhase(d)({ role: 'dev', resumeSessionId: 'dead' });
    expect(out.sessionId).toBe('fresh-9');
    expect(out.resumed).toBe(false);
    expect(out.exitCode).toBe(0);
    expect(phaseInvoke).toHaveBeenCalledTimes(2);
    expect((phaseInvoke.mock.calls[1]![0] as { resume: boolean }).resume).toBe(false);
  });
});
