## 1. worktree 管理器(注入 CmdRunner,TDD)

- [x] 1.1 `worktree.ts`:`branchName(jobId)`(纯)+ `makeWorktreeManager(run, {repoRoot})`
- [x] 1.2 `create(jobId, baseRef)`:`git worktree add -b agent/<jobId> <runtimeDir>/<jobId> <baseRef>`;返回 {path, branch}
- [x] 1.3 `linkDeps(worktreePath, relProjectDir)`:`ln -sfn <主 node_modules> <worktree projectDir>/node_modules`
- [x] 1.4 `squashCommit(worktreePath, targetPaths, msg)`:`git -C add <targetPaths>` + `commit -m`;无改动返回 false
- [x] 1.5 `remove(worktreePath)`:`git worktree remove --force <path>`
- [x] 1.6 注入 runner 测试:断言各操作的 git 命令序列正确(create/link/squash/remove)

## 2. 集成分支兜底(TDD)

- [x] 2.1 `integrate(branch, integrationBranch, gate)`:独立 integration worktree 内 `git merge --squash <branch>` + commit + 跑集成 gate(注入)
- [x] 2.2 全绿 → {ok:true, ready:true};不全绿 → {ok:false}(不推进);**绝不写 main**
- [x] 2.3 注入 runner + gate 替身测试:全绿就绪 / 不全绿停止 / 冲突路径

## 3. 隔离包装接入 driver

- [x] 3.1 `runInnerLoopJobIsolated(jobId, spec, deps)`:create→linkDeps→runInnerLoopJob(projectDir=worktree 子路径)→done? squash+integrate : skip →remove(finally)
- [x] 3.2 非 done(failed/blocked-escalated)不提交不集成;记录;仍回收 worktree
- [x] 3.3 dispatch 开关:isolation 开启时 inner-loop job 走 isolated;关闭走原 runInnerLoopJob(向后兼容);注入替身测两路径

## 4. 确定性 gate 与验证

- [x] 4.1 lint + tsc + vitest 全绿
- [x] 4.2 纯/注入逻辑纳入变异门 ≥ 阈值(动态范围已支持新文件)
- [x] 4.3 **廉价真集成**(真 git,无 claude):建 worktree→symlink→造改动→squash→merge integration→集成 gate→回收;断言主检出 HEAD/main 不受影响
- [~] 4.4 (视需要)一次真 inner-loop 隔离 e2e:job 在 worktree 内跑完整链 + squash + 集成全绿 + 停 HITL

## 5. 抽取与归档

- [x] 5.1 能力建于 `pipeline/driver/`;更新 `pipeline/README.md`(E5+ → 含 worktree 隔离)+ `workflows/orchestration-pwj.md`(并行隔离)
- [x] 5.2 复盘 `docs/plan/M5B-worktree-retro.md`(暴露点 → harness diff)
- [x] 5.3 `openspec validate --strict` → `openspec archive` → git commit + push
