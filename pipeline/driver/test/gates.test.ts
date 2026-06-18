import { describe, it, expect, vi } from 'vitest';
import { makeGates } from '../src/gates.js';
import type { CmdResult } from '../src/gates.js';

const okRes: CmdResult = { exitCode: 0, stdout: '', stderr: '' };
const failRes = (stderr: string): CmdResult => ({ exitCode: 1, stdout: '', stderr });

/** 据命令字符串(cmd + args 拼接)映射结果的 runner 替身。 */
function runnerByCmd(map: Record<string, CmdResult>) {
  return vi.fn(async (cmd: string, args: string[]): Promise<CmdResult> => {
    const key = [cmd, ...args].join(' ');
    return map[key] ?? okRes;
  });
}

describe('makeGates（注入命令执行器，确定性判定）', () => {
  it('GREEN gate:lint/tsc/test 全 0 → ok', async () => {
    const gates = makeGates(runnerByCmd({}), { cwd: '/x' });
    expect((await gates.green()).ok).toBe(true);
  });

  it('GREEN gate:任一命令非 0 → 不 ok,summary 指出失败命令', async () => {
    const gates = makeGates(runnerByCmd({ 'npm run typecheck': failRes('tsc 报错') }), { cwd: '/x' });
    const r = await gates.green();
    expect(r.ok).toBe(false);
    expect(r.summary).toMatch(/typecheck/);
  });

  it('RED gate:测试非 0(如期红)→ ok', async () => {
    const gates = makeGates(runnerByCmd({ 'npm test': failRes('1 failed') }), { cwd: '/x' });
    expect((await gates.red()).ok).toBe(true);
  });

  it('RED gate:测试却通过(没红)→ 不 ok', async () => {
    const gates = makeGates(runnerByCmd({}), { cwd: '/x' }); // 默认全 0 → test 通过
    expect((await gates.red()).ok).toBe(false);
  });

  it('变异门:stryker exit 0(达阈值)→ ok', async () => {
    const gates = makeGates(runnerByCmd({}), { cwd: '/x' });
    expect((await gates.mutation()).ok).toBe(true);
  });

  it('变异门:stryker 非 0(--break 未达标)→ 不 ok', async () => {
    const gates = makeGates(runnerByCmd({ 'npm run mutation': failRes('below threshold') }), { cwd: '/x' });
    expect((await gates.mutation()).ok).toBe(false);
  });

  it('在注入的 cwd 下执行命令', async () => {
    const run = runnerByCmd({});
    const gates = makeGates(run, { cwd: '/proj' });
    await gates.green();
    expect(run).toHaveBeenCalledWith('npm', expect.arrayContaining(['run', 'lint']), '/proj');
  });

  it('GREEN 依次跑默认三步:npm run lint / npm run typecheck / npm test', async () => {
    const run = runnerByCmd({});
    await makeGates(run, { cwd: '/x' }).green();
    const calls = run.mock.calls.map((c) => [c[0], (c[1] as string[]).join(' ')].join(' '));
    expect(calls).toEqual(['npm run lint', 'npm run typecheck', 'npm test']);
  });

  it('GREEN summary 透传失败命令的输出(brief)', async () => {
    const gates = makeGates(runnerByCmd({ 'npm run typecheck': failRes('tsc 报错 TS1234') }), { cwd: '/x' });
    expect((await gates.green()).summary).toContain('tsc 报错 TS1234');
  });

  it('RED 用默认 npm test;如期红时 summary 标注 RED', async () => {
    const run = runnerByCmd({ 'npm test': failRes('1 failed') });
    const r = await makeGates(run, { cwd: '/x' }).red();
    expect(run).toHaveBeenCalledWith('npm', ['test'], '/x');
    expect(r.summary).toContain('RED');
  });

  it('RED 没红时 summary 提示测试无效/越界', async () => {
    const r = await makeGates(runnerByCmd({}), { cwd: '/x' }).red();
    expect(r.summary).toMatch(/越界|无效|未失败/);
  });

  it('变异门用默认 npm run mutation;不达标时 summary 透传输出', async () => {
    const run = runnerByCmd({ 'npm run mutation': failRes('2 survived') });
    const r = await makeGates(run, { cwd: '/x' }).mutation();
    expect(run).toHaveBeenCalledWith('npm', ['run', 'mutation'], '/x');
    expect(r.summary).toContain('2 survived');
  });

  it('brief 在无输出时回落到 exit 码', async () => {
    const gates = makeGates(runnerByCmd({ 'npm run lint': { exitCode: 7, stdout: '', stderr: '' } }), { cwd: '/x' });
    expect((await gates.green()).summary).toContain('exit 7');
  });
});
