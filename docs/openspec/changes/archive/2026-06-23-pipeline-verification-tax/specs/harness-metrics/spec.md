## ADDED Requirements

### Requirement: 从事件流派生 Verification Tax 输入
系统 SHALL 提供纯函数,从统一事件流(events.jsonl)按固定口径归类累加 `durationMs`,得出实现耗时与验证耗时,供 `verificationTax` 计算:**实现** = `op=phase 且 phase=dev`(含回修轮);**验证** = `op=phase 且 phase∈{test,review}` 加 `op=gate` 加 `op=orchestrator-fix`;`op∈{squash,integrate}` 不计入(无 durationMs)。缺 `durationMs` 的事件跳过。

#### Scenario: 按口径归类累加
- **WHEN** 传入含 dev/test/review phase 与 gate 事件(各带 durationMs)的列表
- **THEN** 返回 `{ implementationMs, verificationMs }`,implementationMs=各 dev durationMs 之和,verificationMs=各 test/review/gate/orchestrator-fix durationMs 之和

#### Scenario: 空事件流
- **WHEN** 传入空列表
- **THEN** implementationMs=0、verificationMs=0(不臆造)

#### Scenario: 按 traceId(每个 US) 分组算 tax
- **WHEN** 事件含多个 traceId
- **THEN** 返回 traceId → `{ implementationMs, verificationMs, tax }` 的映射,各组独立累加并按 `verificationTax` 算比率

### Requirement: 采集时接入真实 Verification Tax
系统 SHALL 在采集快照时读取 `<repoRoot>/pipeline/.runtime/events.jsonl`(逐行 parse、跳畸形行、缺文件视为空),据以填充 `MetricsSnapshot` 的 `verificationMs`/`implementationMs`/`verificationTax`/per-US 明细;无任何带 durationMs 的实现事件时 `verificationTax` 回落 null(沿用"待埋点"语义,不臆造)。

#### Scenario: 有 events → 出真值
- **WHEN** events.jsonl 含 dev 与验证类事件
- **THEN** 快照 verificationTax 为真实比率(=验证/(验证+实现)),verificationMs/implementationMs 为真实毫秒数

#### Scenario: 无 events → 回落 null
- **WHEN** events.jsonl 不存在或无 dev 实现事件
- **THEN** 快照 verificationTax 为 null,看板显示"待埋点"而非伪造数值
