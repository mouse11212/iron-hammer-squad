# 复盘:多项目混批 relProjectDir 动态推导

> 日期 2026-06-22 · change `2026-06-22-pipeline-multiproject-batch` · 流水线服务 iron-hammer-output/ 下任意产品

## 问题

批后集成的 per-feature gate 原用**一个固定 relProjectDir** 对整批所有 feature 跑 green。一批含不同产品的 feature(混批)时,非该目录产品的 feature 没在自己产品目录被验证就进暂存区——假信心。

## 交付

- `batchIntegrate` 的 `gatePerFeature` 改为 `(branch)=>...`,调用时传当前 feature 分支(供按项目路由)。
- `drainBatchIsolated` 建 `branch → relProjectDir` 映射(从各 job spec.projectDir 推导),per-feature gate 在各自产品目录 linkDeps + green;移除单一 relProjectDir dep。
- 测试:gate 收到分支;单项目回归;**多项目混批**(jA→projA、jB→projB,断言 gate/linkDeps 各在 projA/projB)。driver gate 142 + worktree.ts 变异门 91.03%。

## 关键决策

- **per-feature 项目路由**:集成是 N feature 合一处,但 gate 必须按各 feature 所属项目跑;靠 branch→项目 映射实现。
- **测试变更(红线 5)**:gatePerFeature 签名加 branch;batch-drain 用例按 branch 路由。

## 不在本切片(诚实边界)

真实多产品 e2e 需第二个产品(现仅 fincards);本切片用注入单测(断言路由到不同目录)验证。待 iron-hammer-output/ 出现第二产品再补真实混批 e2e。held 通知 / 合并辅助仍留后。
