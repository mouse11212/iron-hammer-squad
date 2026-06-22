# 复盘:批量多分支集成 + 冲突回滚升级(军规 8 完整态)

> 日期 2026-06-22 · change `2026-06-22-pipeline-batch-integration` · 权威 V4 §9 军规 8 + 军规 1/2 + 红线 6

## 交付

`worktree.ts` 新增 `batchIntegrate(featureBranches, opts, gatePerFeature)`:把 N 个 feature 分支汇入 integration(自 base 重置),依次试合——clean-merge + 集成 gate 全绿则保留(merged),merge 冲突或 gate 红则 `reset --hard` 回滚并 held 升级。返回 `{ready, merged[], held[{branch,reason}]}`,held 空且 merged 非空才 ready。**绝不写 main、不自动解冲突**(军规 1/2)。

- 6 测试(全合入/冲突回滚不阻塞/gate 红回滚/重置到 base/不碰 main/空列表);worktree.ts 变异门 96.72%,driver 总 93.07%。
- driver gate 118 绿。

## 关键决策

- **冲突不自动解决**(军规 1 代码归人 + 红线 6 阻塞升级):冲突 feature 回滚 + held(conflict)升级人类,不让 agent 自动解冲突。clean+green 的照常合入(部分推进)。这是"集成分支兜底"的真义:buffer 保护 main,冲突/未验证代码永不近 main。
- **逐 feature 集成 gate**:每个合入后跑 gate,精确定位是哪个 feature 破坏集成;红的回滚 held(gate)。
- **范围窄**:本切片交付 batchIntegrate 能力 + 真冲突验证;接进 driver"批量 drain 后集成"流程留后(②)。

## 暴露点 → Steering

**真冲突验证(真 git,无 claude)揪出两点**:
1. **`git clean -fd` 回滚时删掉 node_modules symlink**(untracked)→ 后续 feature 的 gate 需依赖;但 gate thunk 每次先 `linkDeps` 自愈 → 不影响。记录:回滚的 clean 会churn symlink,gate 自愈兜住。
2. **验证断言语义错**:初版用"工作区全清"判无冲突残留,但 node_modules symlink 本就 untracked → 误报。正解=查 `git diff --diff-filter=U`(无 unmerged 文件)。教训累积:**判"无冲突残留"应查 unmerged 文件,而非工作区全清**(symlink/gitignore 边界)。

真冲突验证结果:a/b 改同一文件(冲突)+ c 改另一文件 → batchIntegrate → merged=[a,c]、held=[{b,conflict}]、main HEAD 不变、无 unmerged 残留、worktree 回收。

## 不在本切片(留后)

- 接进 driver:批量 drain 后对所有成功 feature 分支调 batchIntegrate(②)。
- integration 累积跨批次(当前每次自 base 重置)。
- held 冲突的人机交互/通知。
