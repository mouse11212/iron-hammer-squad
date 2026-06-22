## Why

批后集成的 per-feature gate 当前用**一个固定 relProjectDir**(deps.relProjectDir)对整批所有 feature 跑 green。当一批 job 来自**不同产品**(混批)时,非该目录的产品的 feature 没在自己产品目录被集成 gate 验证就进暂存区——假信心。流水线设计上服务 `iron-hammer-output/` 下任意产品,需支持混批。

## What Changes

- `batchIntegrate` 的 `gatePerFeature` 改为接收 `branch` 参数,调用方据此把 gate 路由到该 feature 所属产品目录。
- `drainBatchIsolated` 记录 `branch → relProjectDir`(从各 job 的 spec.projectDir 推导),per-feature gate 在各自产品目录跑 green + linkDeps;移除单一 relProjectDir dep。

## Capabilities

### Modified Capabilities
- `worktree-integration`: 批后集成 gate 按 feature 所属项目动态推导目录(支持多项目混批)。

## Impact

- **代码**:`worktree.ts` batchIntegrate gate 签名加 branch;`inner-loop-runner.ts` drainBatchIsolated 建 branch→rel 映射 + per-branch gate。
- **测试变更(红线 5)**:batch-drain 用例 gate 路由按 branch;新增多项目混批用例(断言不同 branch gate 在不同目录)。
- **不在本切片**:真实多产品 e2e(现仅 fincards,待第二产品);held 通知;合并辅助。
