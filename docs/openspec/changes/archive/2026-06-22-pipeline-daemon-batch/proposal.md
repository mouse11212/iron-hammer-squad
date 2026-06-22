## Why

M5-B 的 `runIsolated` 做**每 job 单独 integrate**;但批量集成(军规 8)要求"各 job 先 squash 出 feature 分支,一批 drain 完再统一 batchIntegrate"。同时当前 driver 是 **drain-once**(处理完即退),缺"事件持续触发"的常驻形态。本切片:① 解耦隔离与集成(runIsolated 只产 feature 分支),② 加轮询守护 + 批后 batchIntegrate。

## What Changes

- **runIsolated 重构**:`done` → squash 出 feature 分支,返回 `{result, branch, committed}`;**移除 per-job integrate**(集成统一交批后步骤,即使 N=1)。
- **批后集成**:一批隔离 job drain 后,收集 `committed` 的 feature 分支 → `batchIntegrate` → 产出 `{ready, merged, held}`(停 HITL,不写 main)。
- **轮询守护** `driveParallelLoop`:循环 recover→drain→(批后集成)→sleep,直到停止条件;注入 clock/invoke/sleep 可确定性测试。

## Capabilities

### Modified Capabilities
- `worktree-integration`: 隔离与集成解耦(runIsolated 产分支不集成)+ 批后 batchIntegrate + 轮询守护。

## Impact

- **代码**:`inner-loop-runner.ts` runIsolated 重构 + 批后集成编排;`drive-parallel.ts` 加 `driveParallelLoop`(轮询)。
- **测试变更(红线 5)**:isolated 用例从"断言 per-job integrate"改为"断言产 feature 分支、不 integrate"(行为移到批后);记录。
- **不在本切片**:integration 跨批次累积;held 通知/人机交互。
- **真相源**:V4 §9 军规 4/8、D4 事件触发。
