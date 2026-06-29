## ADDED Requirements

### Requirement: 聚合非 testable findings 成验收清单
系统 SHALL 提供纯函数 `aggregateAcceptanceItems(sources: FindingsSource[]): AcceptanceItem[]`，把多源 `DesignFindings` 的「非 testable 反目标 + suggestedAcceptance + failureModes」聚合成验收清单项（`testable=true` 反目标排除——那是杠杆1 的活）。去重按 `(kind, trim 后 desc)` 只留首现、来源取首现；稳定 id 按 kind 前缀递增（`anti-goal`→a、`acceptance`→c、`failure-mode`→f），跨源连续。纯函数无 IO。

#### Scenario: 只取非 testable 反目标 + 验收建议 + 失败模式并标来源
- **WHEN** 单源 findings 含 testable 与非 testable 反目标各一、一条 suggestedAcceptance、一条 failureMode
- **THEN** 返回项含非 testable 反目标(a1)、acceptance(c1)、failure-mode(f1)，各带 source；testable 反目标不出现

#### Scenario: 多源 id 按 kind 独立递增且跨源连续
- **WHEN** 两源各含一条非 testable 反目标
- **THEN** 依次为 a1、a2，source 分别为各自来源

#### Scenario: 同 kind+desc 去重（trim 归一）
- **WHEN** 两源含 desc 仅首尾空白之差的同类项
- **THEN** 只保留首现一条

#### Scenario: 空源
- **WHEN** sources 为空数组
- **THEN** 返回空数组

### Requirement: 严格解析视觉 agent 三级 verdict
系统 SHALL 提供纯函数 `parseAcceptanceVerdicts(raw: string): AcceptanceVerdict[]`，解析验收 agent 的 verdict JSON 数组：每项 `{ itemId: string(非空), tier: 'blocker'|'advise'|'pass', evidence: string, reason: string }`。校验契约严：顶层非数组、项非对象、itemId 空、tier 非枚举、evidence/reason 非字符串 → 抛 Error，信息指向违规字段/索引。空数组合法。

#### Scenario: 合法数组逐字段解析
- **WHEN** raw 为含合法项的 JSON 数组
- **THEN** 返回对应 `AcceptanceVerdict[]`，三档 tier 均可解析

#### Scenario: tier 非枚举 → 抛错指向 tier
- **WHEN** 某项 tier 为 `maybe`
- **THEN** 抛 Error，信息含 `tier`

#### Scenario: 顶层非数组 → 抛错
- **WHEN** raw 为 `{}`
- **THEN** 抛 Error，信息含「数组」

### Requirement: 据模式与人确认分流验收
系统 SHALL 提供纯函数 `resolveAcceptance(mode, agentVerdicts, humanConfirmed): AcceptanceDecision`，决定 `action: 'pass'|'escalate'|'hold'` 及 `escalated`(blocker itemId)/`advised`(advise itemId)：`auto` 用 agentVerdicts，有 blocker→escalate 否则 pass，advise 始终归档；`block` + 未确认(null)→hold；`block` + 人确认→用确认后的 verdicts 分流；`off`/未知→pass（安全兜底）。advise 项不阻塞放行（收编 issue#13）。

#### Scenario: auto 含 blocker → escalate
- **WHEN** mode=auto，verdicts 含 blocker 与 advise
- **THEN** `{action:'escalate', escalated:[blocker项], advised:[advise项]}`

#### Scenario: block 未确认 → hold
- **WHEN** mode=block，humanConfirmed=null
- **THEN** `{action:'hold', escalated:[], advised:[]}`

#### Scenario: block 人确认降级 blocker → pass
- **WHEN** mode=block，人把唯一 blocker 改判 advise
- **THEN** `action:'pass'`，该项进 advised 不进 escalated

#### Scenario: off → pass 安全兜底
- **WHEN** mode=off
- **THEN** `{action:'pass', escalated:[], advised:[]}`（忽略 verdicts）
