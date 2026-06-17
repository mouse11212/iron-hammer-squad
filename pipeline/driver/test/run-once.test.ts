import { describe, it, expect, vi } from 'vitest';
import { runOnce } from '../src/run-once.js';
import type { Request, RunState, InvokeResult } from '../src/types.js';

const req: Request = { id: 'r1', kind: 'freeform', prompt: 'echo hi', createdAt: '2026-06-17T00:00:00.000Z' };
const stubInvoke = (res: InvokeResult) => vi.fn(async () => res);

describe('runOnce（注入 invoke 替身，确定性）', () => {
  it('成功执行 → done，调用了一次 claude 边界', async () => {
    const invoke = stubInvoke({ exitCode: 0, stdout: 'hi', stderr: '' });
    const saved: RunState[] = [];
    const out = await runOnce(req, undefined, invoke, (s) => saved.push({ ...s }));
    expect(out.status).toBe('done');
    expect(invoke).toHaveBeenCalledOnce();
    expect(invoke).toHaveBeenCalledWith('echo hi');
    // 至少经历 running 再 done
    expect(saved.map((s) => s.status)).toContain('running');
    expect(saved.at(-1)!.status).toBe('done');
  });

  it('执行失败 → failed，不抛出', async () => {
    const invoke = stubInvoke({ exitCode: 1, stdout: '', stderr: 'err' });
    const out = await runOnce(req, undefined, invoke, () => {});
    expect(out.status).toBe('failed');
  });

  it('幂等：已 done 的请求跳过，不调用 claude', async () => {
    const invoke = stubInvoke({ exitCode: 0, stdout: '', stderr: '' });
    const prior: RunState = { id: 'r1', status: 'done', exitCode: 0 };
    const out = await runOnce(req, prior, invoke, () => {});
    expect(out.status).toBe('done');
    expect(invoke).not.toHaveBeenCalled();
  });
});
