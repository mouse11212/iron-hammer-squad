# design-review Specification

## Purpose
TBD - created by archiving change pipeline-design-soundness-review. Update Purpose after archive.
## Requirements
### Requirement: 设计合理性评审角色（实现前，独立对抗）
系统 SHALL 提供"设计合理性评审"角色（agent prompt 模板 `roles/design-soundness-agent.md`），在规约切片**实现前**调用，作**独立对抗性**评审者，专查"行为正确但跑偏"——评审规约是否达成其声称的产品意图、穷举反目标（正确但失败的条件）、用户会注意到的失败模式。该角色 MUST 只读（不改规约、不写代码），且 prompt MUST 强制评审者**站终端用户/对抗者视角、不得假设规约作者正确**（防与规约作者共享盲点）。

#### Scenario: 评审合目的性缺陷的规约
- **WHEN** 规约描述"听音选词判分"但未约束"答案不得在答题前可得"
- **THEN** 评审产出反目标，指向"答案不得在答题前可得 / 必须靠听辨词"

#### Scenario: 只读不越界
- **WHEN** 评审一份规约切片
- **THEN** 仅产出 findings，不修改规约、不创建实现文件

### Requirement: 设计 findings 结构化纯解析
系统 SHALL 提供纯函数 `parseDesignFindings(raw: string): DesignFindings`，把评审 agent 的结构化输出解析为 `DesignFindings`：`{ intentRestatement: string(非空), antiGoals: { desc: string(非空), testable: boolean }[], failureModes: string[], suggestedAcceptance: string[] }`。校验契约严：任一必填字段缺失/类型错/`raw` 非 JSON → 抛 Error，**信息明确指向违规字段**（不静默、不返回残缺）。`failureModes`/`suggestedAcceptance` 可为空数组。

#### Scenario: 合法 findings 解析
- **WHEN** `raw` 为含全部字段的合法 JSON（intentRestatement 非空、antiGoals 各含非空 desc 与布尔 testable）
- **THEN** 返回对应 `DesignFindings`，字段一一对应

#### Scenario: intentRestatement 为空 → 抛错
- **WHEN** `raw` 的 `intentRestatement` 为空串
- **THEN** 抛 Error，信息指向 `intentRestatement`

#### Scenario: antiGoal 的 testable 非布尔 → 抛错
- **WHEN** 某 `antiGoal` 的 `testable` 为字符串/缺失
- **THEN** 抛 Error，信息指向 `testable`

#### Scenario: antiGoal 的 desc 为空 → 抛错
- **WHEN** 某 `antiGoal` 的 `desc` 为空串
- **THEN** 抛 Error，信息指向 `desc`

#### Scenario: 非 JSON → 抛错
- **WHEN** `raw` 非合法 JSON
- **THEN** 抛 Error（信息指向解析失败）

#### Scenario: 可选字段为空合法
- **WHEN** `failureModes` 与 `suggestedAcceptance` 为空数组，其余合法
- **THEN** 正常解析返回（不抛错）

### Requirement: agent 产 findings + 人裁，不硬阻断、不接 inner-loop 每轮
系统 SHALL 把设计合理性评审作为"agent 产结构化 findings、人复核拍板"的流程：评审 agent **不单独硬阻断**（findings 是供人判的候选，红线7 人在环）；本能力 orchestrator **可手动调用**，**不自动接进 inner-loop 每轮**（贵/非确定，从窄到宽；同 security-review-agent 首切片）。

#### Scenario: findings 不自动阻断流程
- **WHEN** 评审产出含严重反目标的 findings
- **THEN** 不自动阻断；由人复核决定是否在建造前改规约

#### Scenario: 不接每轮
- **WHEN** inner-loop 跑一个普通 US
- **THEN** 不自动触发设计合理性评审（仅 orchestrator 显式调用时才跑）

