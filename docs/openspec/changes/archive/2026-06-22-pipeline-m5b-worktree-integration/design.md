# 设计要点(SoT 摘要)

> 机制权威=V4 §9 驭手 8 军规(D8 已定)。本文件只记规约级关键决策。

## 范围(brainstorm 决议:start narrow)
单 job 隔离 + squash + 单分支集成全绿 + 停 HITL。**多分支并发集成的冲突解决留后**(待真实冲突拉出,符合 start narrow / V4 §13)。

## 组件
`worktree.ts`:`makeWorktreeManager(run, {repoRoot})`(注入 CmdRunner,可确定性测 git 命令序列)
- `create(jobId, baseRef)` → `git worktree add -b agent/<jobId> <path> <baseRef>`
- `linkDeps(worktreePath, relProjectDir)` → 软链主检出 node_modules(`ln -sfn`)
- `squashCommit(worktreePath, targetPaths, msg)` → `git -C <wt> add <targetPaths>` + `commit`(仅切片文件,不盲加 -A;地雷)
- `integrate(branch, integrationBranch)` → 独立 integration worktree 内 `merge --squash` + 集成 gate
- `remove(worktreePath, branch)` → `git worktree remove` + 删分支(可选)

隔离包装 `runInnerLoopJobIsolated(jobId, spec)`:create→linkDeps→runInnerLoopJob(projectDir=worktree 子路径)→done? squash+integrate : 跳过 →remove。dispatch 可开关(isolation flag)。

## 关键决策
- **HITL 边界**(军规 1/2,强制):自动到"集成全绿",main 合并交人;系统绝不写 main。
- **集成在独立 worktree**:不切换主检出 HEAD(军规 2:不动 main 检出)。
- **依赖 symlink**(非 install/copy):最快省盘;gates 只读 node_modules,.stryker-tmp 在各 worktree cwd 隔离。
- **squash 仅切片 targetPaths**:不 `git add -A`(地雷:防卷入 .stryker-tmp 等);gitignore 已排除 node_modules/.runtime/.stryker-tmp。
- **非 done 不提交不集成**:失败/升级的改动不接近 main(兜底)。

## 验证策略
worktree 管理纯命令序列用注入 runner 确定性测试;真实 git 集成用**廉价真集成**(真 git worktree/merge,无 claude)确认;真 inner-loop e2e 视需要。
