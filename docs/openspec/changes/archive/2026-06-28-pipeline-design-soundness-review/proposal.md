## Why

词灵岛长程验证真人试玩暴露 issue#9/#12：**功能门（lint/tsc/test/变异门）+ 视觉评审只验"实现 vs 规约的正确性"，验不出"规约/设计是否达成产品意图"**。#2 铁证：判分逻辑每条对、318 测试全绿、变异门满分，但 UI 把答案印出 → 整个"听音选词"没达成"靠听辨词"的目的。harness 默认"规约=真相"，缺一步校验"规约是否句句对却整体跑偏"。本切片补第一块：实现前由独立对抗 agent 评审规约"合目的性"，产结构化 findings，人裁。

## What Changes

- 新角色 `pipeline/roles/design-soundness-agent.md`：实现前独立对抗评审一份规约切片，专查"行为正确但跑偏"（意图达成？反目标？用户会注意的失败模式？），只读、不改规约、不写代码；prompt 强制站终端用户/对抗者视角，不假设规约作者正确（防共享盲点）。
- 新纯函数 `pipeline/driver/src/design-findings.ts` `parseDesignFindings(raw)`：校验/解析 agent 结构化输出为 `DesignFindings`，非法即抛（信息指向违规字段）。
- 流程：agent 产 findings + 人复核拍板；**不单独硬阻断**（仿 security-review-agent）；orchestrator **可手动调用，不自动接进 inner-loop 每轮**（从窄到宽）。

## Capabilities

### New Capabilities
- `design-review`: 设计合理性评审——实现前评审规约是否达成产品意图（独立对抗 agent 产结构化 findings + 纯解析 + 人裁，不硬阻断、不接每轮）。

### Modified Capabilities
<!-- 无 -->

## Impact

- **新增**：`pipeline/roles/design-soundness-agent.md`、`pipeline/driver/src/design-findings.ts` + 测试。
- **不改** inner-loop.ts / gates.ts（不接每轮，既有测试零回归）。
- **范围（红线3）**：仅"角色 + 解析 + 可调用 + 在 US-1 规约上验证"。**不做**：反目标→test-agent 自动写测试（杠杆1）、实现后验收关/人工试玩（杠杆2）、确定性动作映射/escalate-hold。
- **验证来源**：词灵岛 issue#12。**杀手验证**：跑在 US-1 听音选词原始规约上，确认产出"答案不得提前可得"反目标——证当初能拦 #2。
