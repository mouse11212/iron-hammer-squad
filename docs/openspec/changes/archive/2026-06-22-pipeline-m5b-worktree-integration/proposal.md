## Why

M5-A 交付了并行队列(多 worker 原子认领),但所有 inner-loop 当前**跑在同一个 projectDir**——2 个并发 inner-loop 的测试/开发 agent 会互相覆盖文件,无法真正安全并行。M5-B 补上 M5 DoD 的另一半(V4 §9 驭手军规 3/8):**git worktree 隔离 + 集成分支兜底 + squash**,使每个 inner-loop 在独立 worktree(独立 feature 分支、共享 `.git`)里跑,完成后 squash 提交并经集成分支全绿,**停在 HITL 不自动碰 main**(军规 1/2)。

## What Changes

- 新增 **worktree 隔离包装**:每个隔离 inner-loop job 从 base 创建独立 worktree(`agent/<jobId>` 分支)→ inner-loop 在 worktree 内跑 → 回收。`runInnerLoop` 纯状态机不变。
- **依赖软链**:把主检出 projectDir 的 `node_modules` symlink 进 worktree(worktree 是仓库级检出,gitignore 的 node_modules 不会被检出 → 否则 gates 缺依赖失败)。
- **squash 提交**:inner-loop `done` 后把切片改动(targetPaths)在 feature 分支提交为单个 commit;非 done 不提交。
- **集成分支兜底**(军规 8):feature 分支 squash-merge 进 `integration`(独立 integration worktree,不动 main 检出)→ 跑集成 gate 全绿;不全绿则不推进(兜底保护 main)。
- **HITL 边界**(军规 1/2):SHALL NOT 自动合并 main;集成全绿后停下交人签字。
- **回收**:完成后回收 feature worktree(军规 3:无残留自动回收)。

## Capabilities

### New Capabilities
- `worktree-integration`: inner-loop 的 git worktree 隔离 + feature 分支 squash 提交 + 集成分支兜底(全绿才推进)+ HITL main 边界 + worktree 回收。

### Modified Capabilities
<!-- inner-loop-orchestration / concurrent-queue 不变;隔离是其外层包装(Impact),非 spec 级需求变更。 -->

## Impact

- **代码**:`pipeline/driver/` 新增 `worktree.ts`(worktree 管理:create/linkDeps/squashCommit/integrate/remove,注入 CmdRunner 可测);隔离包装接入 dispatch(可开关)。
- **不在本切片**(留后,待真实冲突拉出):N 并发多分支集成的**冲突解决**(军规 8 完整态);本切片单 job 隔离 + 单分支集成全绿。
- **依赖**:无新增 npm;用 git worktree + symlink。
- **真相源**:V4 §9(驭手 8 军规,D8 已定)、backlog M5-B、KB `orchestrator-patterns`(Worktree Isolation 协调原语)。
- **安全**(V4 §9 提醒):worktree hook 默认无沙箱,只在可信仓库启用;main 合并人类签字。
