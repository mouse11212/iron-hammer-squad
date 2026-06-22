## Why

批后集成产出 `{ready, merged, held}` 仅在内存返回,未 durable 递给人。"停 HITL"是半截:① held(冲突/gate 红)的 feature 无人被通知该处理;② 集成全绿后人要做 integration→main 合并(军规1/2 人签字)却无辅助。项目核心"人判质量、人担责"要求先把结果可执行地交到人手上。

## What Changes

- 新增纯函数 `renderHandoffReport(integration, opts)`:渲染集成交接报告(markdown)——✅已集成(merged + 建议 squash 合并命令 + 合后删 integration 提示)、⚠️挂起(held + 原因 + 处理指引)、状态。
- `drainBatchIsolated` 加 `onHandoff` 注入钩子:批后集成完调用之(默认写 `.runtime/integration-report.md` + 控制台摘要)。

## Capabilities

### Modified Capabilities
- `worktree-integration`: 批后集成产出 durable HITL 交接报告(held 通知 + 合并辅助)。

## Impact

- **代码**:新增 `handoff.ts`(renderHandoffReport,纯);`inner-loop-runner.ts` drainBatchIsolated 加 onHandoff 钩子;默认写报告 IO 助手。
- **真相源**:V4 §9 军规 1/2/7/8、红线 6/7(人机门禁)。
- **不在本切片**:外部通知渠道(Slack 等);report 历史归档。
