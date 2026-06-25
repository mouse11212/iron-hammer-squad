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

describe('makeRunPhase 瞬时错误重试(②harness 硬化)', () => {
  const counterId = () => {
    let g = 0;
    return () => `id-${++g}`;
  };

  it('新会话瞬时错误 → 重试成功,且重试用不同 session-id', async () => {
    const phaseInvoke = vi
      .fn<(i: unknown) => Promise<PhaseInvokeResult>>()
      .mockResolvedValueOnce({ exitCode: 1, isError: true, result: 'API Error: socket closed unexpectedly' })
      .mockResolvedValueOnce({ exitCode: 0, isError: false, result: '', sessionId: 'ok' });
    const sleep = vi.fn(async () => {});
    const out = await makeRunPhase(deps({ phaseInvoke, genId: counterId(), sleep, maxRetries: 2 }))({ role: 'test' });
    expect(out.exitCode).toBe(0);
    expect(phaseInvoke).toHaveBeenCalledTimes(2);
    const id1 = (phaseInvoke.mock.calls[0]![0] as { sessionId: string }).sessionId;
    const id2 = (phaseInvoke.mock.calls[1]![0] as { sessionId: string }).sessionId;
    expect(id1).not.toBe(id2); // 每次重试换 fresh session-id
    expect(sleep).toHaveBeenCalled();
  });

  it('非瞬时错误 → 不重试', async () => {
    const phaseInvoke = vi.fn(async (): Promise<PhaseInvokeResult> => ({ exitCode: 1, isError: true, result: '测试断言失败' }));
    const out = await makeRunPhase(deps({ phaseInvoke, sleep: vi.fn(async () => {}), maxRetries: 2 }))({ role: 'test' });
    expect(out.exitCode).toBe(1);
    expect(phaseInvoke).toHaveBeenCalledTimes(1);
  });

  it('瞬时错误持续超上限 → 失败,不无限重试', async () => {
    const phaseInvoke = vi.fn(async (): Promise<PhaseInvokeResult> => ({ exitCode: 1, isError: true, result: 'socket closed' }));
    const out = await makeRunPhase(deps({ phaseInvoke, genId: counterId(), sleep: vi.fn(async () => {}), maxRetries: 2 }))({ role: 'test' });
    expect(out.exitCode).toBe(1);
    expect(phaseInvoke).toHaveBeenCalledTimes(3); // 1 + 2 重试
  });

  it('进程崩溃无 result(noResult,空文本)→ 也重试,且换 fresh session-id', async () => {
    // 复刻词灵岛 US-1 真实假失败:dev 进程 API 重试中途崩、无 type:result 收尾。
    const phaseInvoke = vi
      .fn<(i: unknown) => Promise<PhaseInvokeResult>>()
      .mockResolvedValueOnce({ exitCode: 1, isError: true, result: '', noResult: true })
      .mockResolvedValueOnce({ exitCode: 0, isError: false, result: '', sessionId: 'recovered' });
    const sleep = vi.fn(async () => {});
    const out = await makeRunPhase(deps({ phaseInvoke, genId: counterId(), sleep, maxRetries: 2 }))({ role: 'dev' });
    expect(out.exitCode).toBe(0);
    expect(phaseInvoke).toHaveBeenCalledTimes(2);
    const id1 = (phaseInvoke.mock.calls[0]![0] as { sessionId: string }).sessionId;
    const id2 = (phaseInvoke.mock.calls[1]![0] as { sessionId: string }).sessionId;
    expect(id1).not.toBe(id2);
    expect(sleep).toHaveBeenCalled();
  });

  it('进程崩溃持续无 result → 耗尽上限失败,不无限重试', async () => {
    const phaseInvoke = vi.fn(async (): Promise<PhaseInvokeResult> => ({ exitCode: 1, isError: true, result: '', noResult: true }));
    const out = await makeRunPhase(deps({ phaseInvoke, genId: counterId(), sleep: vi.fn(async () => {}), maxRetries: 2 }))({ role: 'dev' });
    expect(out.exitCode).toBe(1);
    expect(phaseInvoke).toHaveBeenCalledTimes(3); // 1 + 2 重试
  });

  it('真失败(有 result 文本、无瞬时信号、noResult 未置)→ 仍不重试(安全边界)', async () => {
    const phaseInvoke = vi.fn(async (): Promise<PhaseInvokeResult> => ({ exitCode: 1, isError: true, result: 'TypeError: x is not a function' }));
    const out = await makeRunPhase(deps({ phaseInvoke, sleep: vi.fn(async () => {}), maxRetries: 2 }))({ role: 'dev' });
    expect(out.exitCode).toBe(1);
    expect(phaseInvoke).toHaveBeenCalledTimes(1);
  });
});
