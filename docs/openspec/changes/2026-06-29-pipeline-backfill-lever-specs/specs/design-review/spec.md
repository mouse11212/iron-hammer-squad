## ADDED Requirements

### Requirement: testable 反目标抽取
系统 SHALL 提供纯函数 `extractTestableAntiGoals(findings: DesignFindings): string[]`，返回 `testable=true` 反目标的 desc 列表（保序），供实现前自动注入 test phase。`testable=false` 不返回（归杠杆2 验收）。

#### Scenario: 只取 testable 的 desc 保序
- **WHEN** findings 含 testable 与非 testable 反目标交替
- **THEN** 仅返回 testable 项的 desc，按原序

#### Scenario: 无 testable → 空数组
- **WHEN** 所有反目标 testable=false
- **THEN** 返回空数组

### Requirement: design-review 模式决策（off/auto/block）
系统 SHALL 提供纯函数 `resolveDesignReview(mode, findings, confirmed): DesignReviewDecision`，据 `IH_DESIGN_REVIEW` 模式与人工确认态决定 `action: 'proceed'|'hold'` 与注入的反目标：`auto`→proceed，注入全部 testable 反目标；`block` + 人确认(数组,含空)→proceed 用确认的；`block` + 未确认(null)→hold；`off`/未知→proceed 无反目标（安全兜底）。

#### Scenario: auto 注入全部 testable
- **WHEN** mode=auto
- **THEN** `{action:'proceed', antiGoals:[全部 testable desc]}`

#### Scenario: block 未确认 → hold
- **WHEN** mode=block，confirmed=null
- **THEN** `{action:'hold', antiGoals:[]}`

#### Scenario: off → proceed 无反目标
- **WHEN** mode=off
- **THEN** `{action:'proceed', antiGoals:[]}`

### Requirement: 反目标自动注入 test phase（实现前管道）
系统 SHALL 在 inner-loop 的 test phase **之前**设 design-soundness 前置步：据 `IH_DESIGN_REVIEW`（`off` 默认零回归 / `auto` 全自动 / `block` 人审检查点）跑评审 agent → `parseDesignFindings` → `resolveDesignReview` → 把 proceed 的 testable 反目标注入 test-agent prompt（`PromptContext.antiGoals`），由 test-agent 写成确定性测试钉死"不发生"。前置步任何失败 MUST 降级（不注入、主流程照常），并记 `design-soundness` 事件（可观测）。

#### Scenario: auto 注入反目标到 test phase
- **WHEN** IH_DESIGN_REVIEW=auto 且评审产出 testable 反目标
- **THEN** test-agent prompt 含"另须断言以下反目标不发生"段，列出该反目标

#### Scenario: block 未确认 → held 早返回
- **WHEN** IH_DESIGN_REVIEW=block 且无 design-confirmed.json
- **THEN** 写 design-review.md 待人审，run 终态 blocked-escalated，不进 test/dev

#### Scenario: 前置步崩溃 → 降级不阻断
- **WHEN** 评审 agent 调用抛错
- **THEN** 记 design-soundness 降级事件，主流程继续（无反目标注入），既有 US 不受拖累

### Requirement: design-findings 总持久化
系统 SHALL 在 design-soundness 前置步解析出 findings 后**无条件持久化** `<runsDir>/design-findings.json`（off 以外所有跑评审的模式），供杠杆2 epic 收口按 US 聚合验收清单。

#### Scenario: auto/block 跑过即落盘
- **WHEN** design-soundness 在 auto 或 block 模式跑完并解析出 findings
- **THEN** `<runsDir>/design-findings.json` 存在，内容为该 US 的 DesignFindings
