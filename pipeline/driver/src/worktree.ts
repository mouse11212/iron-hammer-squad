import { join } from 'node:path';
import type { CmdRunner } from './gates.js';
import type { GateResult } from './inner-loop.js';

// M5-B(V4 §9 军规 3/8):inner-loop 的 git worktree 隔离 + 集成分支兜底 + squash。
// 全部 git/ln 操作走注入的 CmdRunner(可确定性测命令序列);真实 git 行为由廉价真集成验证。
// 边界:绝不对 main 做写操作(军规 1/2,main 合并是 HITL)。

/** feature 分支命名(军规 6:ai/agent 前缀)。 */
export function branchName(jobId: string): string {
  return `agent/${jobId}`;
}

export interface WorktreeInfo {
  path: string;
  branch: string;
}

export interface IntegrateOpts {
  integrationBranch: string;
  baseRef: string;
  intWorktree: string;
}

export interface IntegrateResult {
  ok: boolean;
  /** 集成全绿、可供人类合 main 的就绪态。 */
  ready: boolean;
  summary?: string;
}

export interface WorktreeManager {
  /** 从 baseRef 建独立 worktree + feature 分支(agent/<jobId>)。 */
  create(jobId: string, baseRef: string): Promise<WorktreeInfo>;
  /** 把主检出工程的 node_modules 软链进 worktree(worktree 不检出 gitignore 的依赖)。 */
  linkDeps(worktreePath: string, relProjectDir: string): Promise<void>;
  /** 在 projectDir 下把切片改动(仅 targetPaths,相对 projectDir,不盲加 -A)提交为单 commit;无改动→false。 */
  squashCommit(projectDir: string, targetPaths: string[], message: string): Promise<boolean>;
  /** 回收 feature worktree(军规 3)。 */
  remove(worktreePath: string): Promise<void>;
  /** 集成分支兜底:feature squash-merge 进 integration(独立 worktree,不动 main)→ 跑集成 gate。 */
  integrate(featureBranch: string, opts: IntegrateOpts, gate: () => Promise<GateResult>): Promise<IntegrateResult>;
}

export function makeWorktreeManager(
  run: CmdRunner,
  opts: { repoRoot: string; runtimeDir?: string },
): WorktreeManager {
  const { repoRoot } = opts;
  const runtimeDir = opts.runtimeDir ?? join(repoRoot, 'pipeline', '.runtime', 'worktrees');

  return {
    async create(jobId, baseRef) {
      const branch = branchName(jobId);
      const path = join(runtimeDir, jobId);
      await run('git', ['worktree', 'add', '-b', branch, path, baseRef], repoRoot);
      return { path, branch };
    },

    async linkDeps(worktreePath, relProjectDir) {
      const src = join(repoRoot, relProjectDir, 'node_modules');
      const dst = join(worktreePath, relProjectDir, 'node_modules');
      await run('ln', ['-sfn', src, dst], repoRoot);
    },

    async squashCommit(projectDir, targetPaths, message) {
      // 在 projectDir 下 add(targetPaths 相对 projectDir),再从同处 commit 到 worktree 当前分支。
      await run('git', ['-C', projectDir, 'add', ...targetPaths], repoRoot);
      const c = await run('git', ['-C', projectDir, 'commit', '-m', message], repoRoot);
      return c.exitCode === 0;
    },

    async remove(worktreePath) {
      await run('git', ['worktree', 'remove', '--force', worktreePath], repoRoot);
    },

    async integrate(featureBranch, o, gate) {
      // 创建/重置 integration worktree 到 base(narrow:单 feature,每次自 base 起);不切主检出 HEAD。
      await run('git', ['worktree', 'add', '-f', '-B', o.integrationBranch, o.intWorktree, o.baseRef], repoRoot);
      await run('git', ['-C', o.intWorktree, 'merge', '--squash', featureBranch], repoRoot);
      await run('git', ['-C', o.intWorktree, 'commit', '-m', `integrate ${featureBranch}`], repoRoot);
      const g = await gate();
      return { ok: g.ok, ready: g.ok, summary: g.summary };
    },
  };
}
