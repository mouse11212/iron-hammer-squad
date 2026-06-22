import { describe, it, expect, vi } from 'vitest';
import { branchName, makeWorktreeManager } from '../src/worktree.js';
import type { CmdResult } from '../src/gates.js';

const ok: CmdResult = { exitCode: 0, stdout: '', stderr: '' };
const recRun = () => vi.fn(async (): Promise<CmdResult> => ok);
const repoRoot = '/repo';

describe('branchName', () => {
  it('agent/<jobId>', () => expect(branchName('j1')).toBe('agent/j1'));
});

describe('makeWorktreeManager（注入 runner，断言 git 命令序列）', () => {
  it('create:git worktree add -b agent/j1 <runtime path> <base>', async () => {
    const run = recRun();
    const wt = await makeWorktreeManager(run, { repoRoot }).create('j1', 'main');
    expect(wt.branch).toBe('agent/j1');
    expect(wt.path).toBe('/repo/pipeline/.runtime/worktrees/j1');
    expect(run).toHaveBeenCalledWith(
      'git',
      ['worktree', 'add', '-b', 'agent/j1', '/repo/pipeline/.runtime/worktrees/j1', 'main'],
      repoRoot,
    );
  });

  it('linkDeps:ln -sfn 主检出 node_modules → worktree 工程内 node_modules', async () => {
    const run = recRun();
    await makeWorktreeManager(run, { repoRoot }).linkDeps('/wt', 'iron-hammer-output/fincards');
    expect(run).toHaveBeenCalledWith(
      'ln',
      ['-sfn', '/repo/iron-hammer-output/fincards/node_modules', '/wt/iron-hammer-output/fincards/node_modules'],
      repoRoot,
    );
  });

  it('squashCommit:add 指定切片文件 + commit(不盲加 -A),exit0 → true', async () => {
    const run = recRun();
    const done = await makeWorktreeManager(run, { repoRoot }).squashCommit('/wt', ['src/a.ts', 'test/a.test.ts'], 'msg');
    expect(done).toBe(true);
    expect(run).toHaveBeenCalledWith('git', ['-C', '/wt', 'add', 'src/a.ts', 'test/a.test.ts'], repoRoot);
    expect(run).toHaveBeenCalledWith('git', ['-C', '/wt', 'commit', '-m', 'msg'], repoRoot);
  });

  it('squashCommit:commit 非 0(无改动)→ false', async () => {
    const run = vi.fn(async (_c: string, a: string[]): Promise<CmdResult> =>
      a.includes('commit') ? { exitCode: 1, stdout: '', stderr: 'nothing to commit' } : ok,
    );
    expect(await makeWorktreeManager(run, { repoRoot }).squashCommit('/wt', ['src/a.ts'], 'm')).toBe(false);
  });

  it('remove:git worktree remove --force', async () => {
    const run = recRun();
    await makeWorktreeManager(run, { repoRoot }).remove('/wt');
    expect(run).toHaveBeenCalledWith('git', ['worktree', 'remove', '--force', '/wt'], repoRoot);
  });

  it('integrate:全绿 → ready,跑 merge --squash + commit + 集成 gate', async () => {
    const run = recRun();
    const gate = vi.fn(async () => ({ ok: true, summary: 'all green' }));
    const r = await makeWorktreeManager(run, { repoRoot }).integrate(
      'agent/j1',
      { integrationBranch: 'integration', baseRef: 'main', intWorktree: '/int' },
      gate,
    );
    expect(r.ready).toBe(true);
    // 创建/重置 integration worktree 到 base(不动 main 检出)
    expect(run).toHaveBeenCalledWith('git', ['worktree', 'add', '-f', '-B', 'integration', '/int', 'main'], repoRoot);
    expect(run).toHaveBeenCalledWith('git', ['-C', '/int', 'merge', '--squash', 'agent/j1'], repoRoot);
    expect(run).toHaveBeenCalledWith('git', ['-C', '/int', 'commit', '-m', 'integrate agent/j1'], repoRoot);
    expect(gate).toHaveBeenCalled();
  });

  it('integrate:集成 gate 不绿 → 不 ready(兜底:不推进 main)', async () => {
    const run = recRun();
    const r = await makeWorktreeManager(run, { repoRoot }).integrate(
      'agent/j1',
      { integrationBranch: 'integration', baseRef: 'main', intWorktree: '/int' },
      async () => ({ ok: false, summary: 'red' }),
    );
    expect(r.ready).toBe(false);
    expect(r.ok).toBe(false);
  });

  it('integrate:绝不对 main 做写操作', async () => {
    const run = recRun();
    await makeWorktreeManager(run, { repoRoot }).integrate(
      'agent/j1',
      { integrationBranch: 'integration', baseRef: 'main', intWorktree: '/int' },
      async () => ({ ok: true }),
    );
    // 不得有任何切到 main 或 push/merge 到 main 的命令
    const calls = (run as ReturnType<typeof vi.fn>).mock.calls.map((c) => (c[1] as string[]).join(' '));
    expect(calls.some((c) => /checkout main|merge.*\bmain\b|push/.test(c))).toBe(false);
  });
});
