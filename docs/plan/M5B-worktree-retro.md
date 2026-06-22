# 复盘:M5-B worktree 隔离 + 集成分支兜底 + squash

> 日期 2026-06-22 · change `2026-06-22-pipeline-m5b-worktree-integration` · 权威 V4 §9 驭手 8 军规(D8)

## 交付(窄切片)

补齐 M5 DoD 另一半:每个 inner-loop 在独立 git worktree(`agent/<jobId>` 分支、共享 `.git`)内跑,完成后 squash 提交到 feature 分支,经集成分支兜底跑全绿,**停在 HITL 不自动碰 main**(军规 1/2)。这让 M5-A 的并行队列真正可安全并行(此前同目录会互相覆盖)。

- `worktree.ts`:`makeWorktreeManager`(create/linkDeps/squashCommit/integrate/remove,注入 CmdRunner)——9 测试,**变异门 100%**。
- `runIsolated`(inner-loop-runner):隔离编排,deps 全注入——5 测试(done/非done/无改动/集成不绿/异常仍回收)。
- dispatch 开关:`IH_ISOLATION=1` → `defaultRunInnerIsolated`(worktree 隔离);默认非隔离(向后兼容)。
- driver gate 112 + 变异门 92.98%。

## 关键决策(brainstorm 决议)

- **范围窄**:单 job 隔离 + squash + 单分支集成全绿 + 停 HITL。**多分支并发集成的冲突解决留后**(待真实冲突拉出,V4 §13)。
- **依赖 symlink**:worktree 是仓库级检出,gitignore 的 `node_modules` 不检出 → 软链主检出的 node_modules(最快省盘;gates 只读,.stryker-tmp 在各 worktree cwd 隔离)。
- **HITL 边界**(军规 1/2 强制):自动到"集成全绿",main 合并交人;系统绝不写 main。
- **集成在独立 worktree**:不切主检出 HEAD(军规 2)。
- **squash 仅 targetPaths**:不盲 `git add -A`(地雷)。

## 暴露点 → Steering

**真集成揪出注入测试抓不到的子目录路径 bug(第 3 次同类)**:
- `squashCommit` 原用 `git -C <worktreeRoot> add src/x.ts`,但 targetPaths 是 **projectDir 相对**,git 按 worktree 根解析 → 找不到文件 → commit 空 → false → 集成顶 commit 还是 base(probe 从未进入)。
- 修:`git -C <projectDir> add/commit`(targetPaths 相对 projectDir)。
- **教训(累积)**:子目录 + git 路径相对性是这套 harness 的反复坑(动态变异门 git-status、squash-add 已两次)。注入测试用合成路径永远测不出;**真集成(真 git,无 claude,~30s)是必需的一层**。已固化为纪律:涉及 git 子目录路径的逻辑必跑廉价真集成。

## 真集成验证(无 claude,~30s)

真 git worktree + symlink + 造改动 + squash + 集成分支 + green gate:
- squash 提交 ✓;集成全绿 ready ✓;integration 顶 commit = `integrate agent/_m5bprobe` ✓;
- **main HEAD 不受影响 ✓**(军规 2);主检出无 probe 文件 ✓(隔离);worktree + 临时分支回收 ✓。

## 不在本切片(留后)

- N 并发多 feature 分支集成的**冲突解决**(军规 8 完整态;待真实冲突)。
- 真 inner-loop 隔离 e2e(逻辑+真集成已证;真 claude 串可视需要补)。
- 集成分支累积多 feature(当前每次自 base 重置,单 feature)。
