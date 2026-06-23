import { join } from 'node:path';
import { changedPathsFromStatus, type CmdRunner } from './gates.js';
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

export interface BatchHeld {
  branch: string;
  reason: 'conflict' | 'gate';
}

export interface BatchIntegrateResult {
  /** held 空且 merged 非空 → 可供人类合 main。 */
  ready: boolean;
  merged: string[];
  held: BatchHeld[];
}

export interface WorktreeManager {
  /** 从 baseRef 建独立 worktree + feature 分支(agent/<jobId>)。 */
  create(jobId: string, baseRef: string): Promise<WorktreeInfo>;
  /** 把主检出工程的 node_modules 软链进 worktree(worktree 不检出 gitignore 的依赖)。 */
  linkDeps(worktreePath: string, relProjectDir: string): Promise<void>;
  /** 在 projectDir 下把切片实际改动(据 git status 动态捕获,不依赖外部声明,不盲加 -A)提交为单 commit;无改动→false。 */
  squashCommit(projectDir: string, message: string): Promise<boolean>;
  /** 回收 feature worktree(军规 3)。 */
  remove(worktreePath: string): Promise<void>;
  /** 集成分支兜底:feature squash-merge 进 integration(独立 worktree,不动 main)→ 跑集成 gate。 */
  integrate(featureBranch: string, opts: IntegrateOpts, gate: () => Promise<GateResult>): Promise<IntegrateResult>;
  /** 批量集成 N 个 feature(军规 8):clean+green 合入,冲突/gate 红回滚并 held 升级;不动 main、不自动解冲突(军规 1)。
   *  gatePerFeature 接收当前 feature 分支,使调用方可按项目路由 gate(支持多项目混批)。 */
  batchIntegrate(
    featureBranches: string[],
    opts: IntegrateOpts,
    gatePerFeature: (branch: string) => Promise<GateResult>,
  ): Promise<BatchIntegrateResult>;
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

    async squashCommit(projectDir, message) {
      // 动态据 git status 捕获本切片实际改动(不依赖外部预声明 targetPaths——预测错路径/命名会
      // 静默丢弃 done 的成果,真 e2e 揪出的缺口)。porcelain 是仓库根相对,show-prefix 剥成工程相对;
      // porcelain 默认不列 .gitignore 忽略项(变异沙箱/依赖),故 add 天然安全,不盲加 -A。
      const prefix = (await run('git', ['-C', projectDir, 'rev-parse', '--show-prefix'], repoRoot)).stdout.trim();
      const status = await run('git', ['-C', projectDir, 'status', '--porcelain'], repoRoot);
      const paths = changedPathsFromStatus(status.stdout, prefix);
      if (paths.length === 0) return false; // 无改动→不空提交
      await run('git', ['-C', projectDir, 'add', ...paths], repoRoot);
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

    async batchIntegrate(featureBranches, o, gatePerFeature) {
      // 跨批次累积:integration 不存在则从 base 建,已存在则复用(不重置到 base),在其上累加本批。
      // 不切主检出 HEAD(军规 2)。
      const exists = (await run('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${o.integrationBranch}`], repoRoot)).exitCode === 0;
      await run('git', ['worktree', 'remove', '--force', o.intWorktree], repoRoot); // 移除残留(best-effort,不存在则忽略)
      if (exists) {
        await run('git', ['worktree', 'add', '-f', o.intWorktree, o.integrationBranch], repoRoot); // 复用已累积分支
      } else {
        await run('git', ['worktree', 'add', '-f', '-b', o.integrationBranch, o.intWorktree, o.baseRef], repoRoot); // 首建自 base
      }
      const merged: string[] = [];
      const held: BatchHeld[] = [];
      for (const branch of featureBranches) {
        const cur = (await run('git', ['-C', o.intWorktree, 'rev-parse', 'HEAD'], repoRoot)).stdout.trim();
        const m = await run('git', ['-C', o.intWorktree, 'merge', '--squash', branch], repoRoot);
        if (m.exitCode !== 0) {
          // 冲突:回滚 + 清残留,不自动解决(军规 1),不阻塞其它
          await run('git', ['-C', o.intWorktree, 'reset', '--hard', cur], repoRoot);
          await run('git', ['-C', o.intWorktree, 'clean', '-fd'], repoRoot);
          held.push({ branch, reason: 'conflict' });
          continue;
        }
        await run('git', ['-C', o.intWorktree, 'commit', '-m', `integrate ${branch}`], repoRoot);
        const g = await gatePerFeature(branch);
        if (!g.ok) {
          await run('git', ['-C', o.intWorktree, 'reset', '--hard', cur], repoRoot);
          held.push({ branch, reason: 'gate' });
          continue;
        }
        merged.push(branch);
      }
      return { ready: held.length === 0 && merged.length > 0, merged, held };
    },
  };
}
