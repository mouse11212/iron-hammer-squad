import { describe, it, expect, vi } from 'vitest';
import { makeWorktreeManager } from '../src/worktree.js';
import type { CmdResult } from '../src/gates.js';

const ok: CmdResult = { exitCode: 0, stdout: '', stderr: '' };
const repoRoot = '/repo';
const opts = { integrationBranch: 'integration', baseRef: 'main', intWorktree: '/int' };

/**
 * 注入 runner:
 * - `rev-parse --verify refs/heads/...` → 按 branchExists 决定 exit(分支存在判别)
 * - `rev-parse HEAD` → 递增 sha
 * - 指定分支的 merge --squash → 冲突
 */
function mkRun(conflictBranches: string[] = [], branchExists = false) {
  let head = 0;
  return vi.fn(async (_cmd: string, args: string[]): Promise<CmdResult> => {
    if (args.includes('--verify')) return { exitCode: branchExists ? 0 : 1, stdout: '', stderr: '' };
    if (args.includes('rev-parse')) return { exitCode: 0, stdout: `sha-${head++}`, stderr: '' };
    if (args.includes('merge') && args.includes('--squash')) {
      const branch = args[args.length - 1]!;
      if (conflictBranches.includes(branch)) return { exitCode: 1, stdout: '', stderr: 'CONFLICT' };
    }
    return ok;
  });
}
const calls = (run: ReturnType<typeof mkRun>) => run.mock.calls.map((c) => (c[1] as string[]).join(' '));

describe('batchIntegrate（N 分支集成 + 冲突回滚升级,不动 main）', () => {
  it('多个无冲突且全绿 → 全部 merged,held 空,ready 真,无回滚', async () => {
    const run = mkRun();
    const r = await makeWorktreeManager(run, { repoRoot }).batchIntegrate(['a', 'b', 'c'], opts, async () => ({ ok: true }));
    expect(r.merged).toEqual(['a', 'b', 'c']);
    expect(r.held).toEqual([]);
    expect(r.ready).toBe(true);
    expect(calls(run).some((c) => /reset --hard/.test(c))).toBe(false);
    // 每个 feature:记录 HEAD → squash-merge → commit
    expect(run).toHaveBeenCalledWith('git', ['-C', '/int', 'rev-parse', 'HEAD'], repoRoot);
    expect(run).toHaveBeenCalledWith('git', ['-C', '/int', 'merge', '--squash', 'a'], repoRoot);
    expect(run).toHaveBeenCalledWith('git', ['-C', '/int', 'commit', '-m', 'integrate a'], repoRoot);
  });

  it('gatePerFeature 收到对应 feature 分支(供按项目路由)', async () => {
    const run = mkRun();
    const seen: string[] = [];
    await makeWorktreeManager(run, { repoRoot }).batchIntegrate(['a', 'b'], opts, async (branch) => {
      seen.push(branch);
      return { ok: true };
    });
    expect(seen).toEqual(['a', 'b']);
  });

  it('空 feature 列表 → ready 假,merged/held 空', async () => {
    const r = await makeWorktreeManager(mkRun(), { repoRoot }).batchIntegrate([], opts, async () => ({ ok: true }));
    expect(r).toEqual({ ready: false, merged: [], held: [] });
  });

  it('某 feature 冲突 → 回滚(reset+clean)+ held(conflict),不阻塞其它', async () => {
    const run = mkRun(['bad']);
    const r = await makeWorktreeManager(run, { repoRoot }).batchIntegrate(['a', 'bad', 'c'], opts, async () => ({ ok: true }));
    expect(r.merged).toEqual(['a', 'c']);
    expect(r.held).toEqual([{ branch: 'bad', reason: 'conflict' }]);
    expect(r.ready).toBe(false);
    // 冲突回滚:reset --hard 到合前 HEAD + clean -fd,均在 integration worktree
    const reset = run.mock.calls.find((c) => (c[1] as string[]).includes('reset') && (c[1] as string[]).includes('--hard'));
    expect(reset![1]).toEqual(['-C', '/int', 'reset', '--hard', expect.stringMatching(/^sha-/)]);
    expect(run).toHaveBeenCalledWith('git', ['-C', '/int', 'clean', '-fd'], repoRoot);
  });

  it('某 feature 合入后 gate 红 → 回滚 + held(gate)', async () => {
    const run = mkRun();
    let n = 0;
    const gate = vi.fn(async () => ({ ok: ++n !== 2 })); // 第 2 个 feature gate 红
    const r = await makeWorktreeManager(run, { repoRoot }).batchIntegrate(['a', 'b', 'c'], opts, gate);
    expect(r.held).toEqual([{ branch: 'b', reason: 'gate' }]);
    expect(r.merged).toEqual(['a', 'c']);
    expect(r.ready).toBe(false);
    // gate 红也回滚(reset --hard),但不 clean(无冲突残留)
    expect(calls(run).some((c) => /reset --hard/.test(c))).toBe(true);
  });

  it('未注入 sensitiveCheck → 行为照旧(全 merged,无 sensitive held)', async () => {
    const run = mkRun();
    const r = await makeWorktreeManager(run, { repoRoot }).batchIntegrate(['a', 'b'], opts, async () => ({ ok: true }));
    expect(r.merged).toEqual(['a', 'b']);
    expect(r.held).toEqual([]);
  });

  it('注入 sensitiveCheck:命中 → held(sensitive,categories)不自动合,不触 merge', async () => {
    const run = mkRun();
    const sensitive = async (branch: string) => (branch === 'b' ? ['ci'] : []);
    const r = await makeWorktreeManager(run, { repoRoot }).batchIntegrate(['a', 'b', 'c'], opts, async () => ({ ok: true }), sensitive);
    expect(r.merged).toEqual(['a', 'c']);
    expect(r.held).toEqual([{ branch: 'b', reason: 'sensitive', categories: ['ci'] }]);
    expect(r.ready).toBe(false);
    // 敏感分支跳过 merge(不对 b 做 squash-merge)
    expect(run).not.toHaveBeenCalledWith('git', ['-C', '/int', 'merge', '--squash', 'b'], repoRoot);
  });

  it('敏感 held 与 conflict held 并存,干净普通照常合', async () => {
    const run = mkRun(['bad']); // bad 冲突
    const sensitive = async (branch: string) => (branch === 'sec' ? ['auth'] : []);
    const r = await makeWorktreeManager(run, { repoRoot }).batchIntegrate(['sec', 'bad', 'c'], opts, async () => ({ ok: true }), sensitive);
    expect(r.merged).toEqual(['c']);
    expect(r.held).toEqual([
      { branch: 'sec', reason: 'sensitive', categories: ['auth'] },
      { branch: 'bad', reason: 'conflict' },
    ]);
  });

  it('首批(integration 不存在)→ 从 base 创建(worktree add -b,不动主检出)', async () => {
    const run = mkRun([], false); // 分支不存在
    await makeWorktreeManager(run, { repoRoot }).batchIntegrate(['a'], opts, async () => ({ ok: true }));
    expect(run).toHaveBeenCalledWith('git', ['worktree', 'add', '-f', '-b', 'integration', '/int', 'main'], repoRoot);
  });

  it('后批(integration 已存在)→ 复用累积分支,不重置到 base', async () => {
    const run = mkRun([], true); // 分支已存在
    await makeWorktreeManager(run, { repoRoot }).batchIntegrate(['c'], opts, async () => ({ ok: true }));
    // 复用:checkout 已有 integration,无 -b/-B,无 base
    expect(run).toHaveBeenCalledWith('git', ['worktree', 'add', '-f', '/int', 'integration'], repoRoot);
    const cs = calls(run);
    expect(cs.some((c) => /worktree add.*-[bB]/.test(c))).toBe(false); // 不创建/不重置
    expect(cs.some((c) => /worktree add.*\bmain\b/.test(c))).toBe(false); // 不回 base
    // 仍合入本批 feature
    expect(run).toHaveBeenCalledWith('git', ['-C', '/int', 'merge', '--squash', 'c'], repoRoot);
  });

  it('绝不对 main 做写操作', async () => {
    const run = mkRun(['x']);
    await makeWorktreeManager(run, { repoRoot }).batchIntegrate(['x', 'y'], opts, async () => ({ ok: true }));
    expect(calls(run).some((c) => /checkout main|merge.*\bmain\b|push/.test(c))).toBe(false);
  });
});
