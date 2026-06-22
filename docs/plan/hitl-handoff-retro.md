# 复盘:集成交接报告(held 通知 + 合并辅助)

> 日期 2026-06-22 · change `2026-06-22-pipeline-hitl-handoff` · 权威 V4 §9 军规 1/2/7/8、红线 6/7

## 问题

批后集成产出 `{ready, merged, held}` 仅内存返回,未 durable 递给人。"停 HITL"半截:held(冲突/gate)无人被通知;集成全绿后人要合 main 却无辅助。项目核心"人判质量、人担责"要求把结果可执行地交到人手上。

## 交付

- `handoff.ts renderHandoffReport`(纯):渲染集成交接 markdown——✅已集成(merged + 建议 squash 合并命令 + 合后删 integration 提示)、⚠️挂起(held + 原因 conflict/gate + 处理指引)、状态;明确"合 main 是人类决策,系统不自动合"。5 测试。
- `drainBatchIsolated` 加 `onHandoff?(integration)` 钩子:本批有 job 时批后触发(含全 held/无产出);空轮不触发。
- `makeDefaultHandoff`(IO):写 `.runtime/integration-report.md` + 控制台摘要(挂起时 ⚠️ 标注)。
- driver gate 149。

## 关键决策

- **纯渲染 + IO 钩子分离**:报告内容(renderHandoffReport)纯可测;落盘/通知(makeDefaultHandoff)是 IO 注入。
- **合并辅助连上累积切片**:报告里提示"合后删 integration 分支,下批自 base 重新累积"——与跨批次累积语义闭环。
- **只在有 job 时通知**:daemon 空轮不刷报告(防噪音)。

## 不在本切片

外部通知渠道(Slack/邮件等);report 历史归档;把 makeDefaultHandoff 接进 daemon CLI(组合,thin)。
