# harness-metrics Specification

## Purpose
TBD - created by archiving change pipeline-m4-metrics-trace. Update Purpose after archive.
## Requirements
### Requirement: 计算 harness 四指标(纯函数)
系统 SHALL 提供纯函数，从结构化输入计算 harness 四指标:Task Resolution Rate、Code Churn、Verification Tax、Defect Escape Rate。无副作用，便于确定性测试。

#### Scenario: Task Resolution Rate
- **WHEN** 已解决 N 个、尝试 M 个单元
- **THEN** 返回 N/M（M=0 时返回 0，不除零报错）

#### Scenario: Code Churn 汇总
- **WHEN** 传入 numstat 列表（每项 added/removed）
- **THEN** 返回 added、removed、total(=added+removed)、files 计数

#### Scenario: Verification Tax 实现耗时缺失
- **WHEN** 实现耗时为 null(未埋点)
- **THEN** 返回 null(标注待埋点)，不臆造比率

#### Scenario: Defect Escape Rate 无缺陷
- **WHEN** 总缺陷为 0
- **THEN** 返回 0，不除零报错

### Requirement: 渲染看板(纯函数)
系统 SHALL 提供纯函数，把指标快照 + 追溯链渲染为 markdown 看板字符串。无 IO。

#### Scenario: 渲染含指标与追溯链
- **WHEN** 传入快照(四指标 + TraceLink 列表)
- **THEN** 输出含四指标表与追溯链表的合法 markdown；缺口指标显示"待埋点/待标定"而非伪造数值

