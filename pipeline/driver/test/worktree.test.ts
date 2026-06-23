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

  it('squashCommit:动态据 git status 捕获实际改动(不依赖外部 targetPaths),剥 prefix 成工程相对 add + commit → true', async () => {
    const fincards = '/wt/iron-hammer-output/fincards';
    const run = vi.fn(async (_c: string, a: string[]): Promise<CmdResult> => {
      if (a.includes('--show-prefix')) return { exitCode: 0, stdout: 'iron-hammer-output/fincards/\n', stderr: '' };
      if (a.includes('status'))
        return {
          exitCode: 0,
          // agent 实际写在 test/(项目约定),命名自定——动态捕获,不要求外部预测
          stdout: '?? iron-hammer-output/fincards/src/formatCompactNumber.ts\n?? iron-hammer-output/fincards/test/formatCompactNumber.test.ts\n',
          stderr: '',
        };
      return ok;
    });
    const done = await makeWorktreeManager(run, { repoRoot }).squashCommit(fincards, 'msg');
    expect(done).toBe(true);
    // 动态捕获三步:show-prefix 取工程相对前缀 → status 列改动 → add 实际改动 → commit
    expect(run).toHaveBeenCalledWith('git', ['-C', fincards, 'rev-parse', '--show-prefix'], repoRoot);
    expect(run).toHaveBeenCalledWith('git', ['-C', fincards, 'status', '--porcelain'], repoRoot);
    expect(run).toHaveBeenCalledWith(
      'git',
      ['-C', fincards, 'add', 'src/formatCompactNumber.ts', 'test/formatCompactNumber.test.ts'],
      repoRoot,
    );
    expect(run).toHaveBeenCalledWith('git', ['-C', fincards, 'commit', '-m', 'msg'], repoRoot);
  });

  it('squashCommit:无改动(status 空)→ 跳过 commit → false(不空提交)', async () => {
    const run = vi.fn(async (_c: string, a: string[]): Promise<CmdResult> =>
      a.includes('status') ? { exitCode: 0, stdout: '', stderr: '' } : ok,
    );
    expect(await makeWorktreeManager(run, { repoRoot }).squashCommit('/wt', 'm')).toBe(false);
    expect(run).not.toHaveBeenCalledWith('git', expect.arrayContaining(['commit']), repoRoot);
  });

  it('squashCommit:有改动但 commit 非 0 → false', async () => {
    const run = vi.fn(async (_c: string, a: string[]): Promise<CmdResult> => {
      if (a.includes('status')) return { exitCode: 0, stdout: '?? src/a.ts\n', stderr: '' };
      if (a.includes('commit')) return { exitCode: 1, stdout: '', stderr: 'fail' };
      return ok;
    });
    expect(await makeWorktreeManager(run, { repoRoot }).squashCommit('/wt', 'm')).toBe(false);
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
