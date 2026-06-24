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

### Requirement: 从 OpenSpec archive + git 自动织追溯链
系统 SHALL 提供纯函数,从已读好的归档 change 结构化输入组装 `TraceLink[]`(`changeId→spec→tests→commit`),每个字段可溯源到真实归档 commit:`changeId` = archive 目录名去日期前缀;`spec` = 该 change `specs/` 下 capability 目录名(多个按字典序斜杠拼接);`commit` = 归档该 change 的 git commit 短 hash;`tests` = 该 commit diff 中改动的 `*.test.ts`/`*.spec.ts` 文件名(basename,按字典序去重)。不读手维护的 traces.json。

#### Scenario: 单 capability change 织链
- **WHEN** 传入一个归档 change(目录 `2026-06-17-fincards-m0-bloomberg-cards`,specs 下含 `news-fetch`,归档 commit `adbac4a` 改动了 `parse.test.ts`)
- **THEN** 返回 `{ changeId: "fincards-m0-bloomberg-cards", spec: "news-fetch", tests: ["parse.test.ts"], commit: "adbac4a" }`

#### Scenario: 多 capability 按字典序拼接 spec
- **WHEN** 一个 change 的 `specs/` 下含多个 capability 目录(如 `news-fetch`、`news-parse`)
- **THEN** `spec` 字段为各 capability 目录名按字典序斜杠拼接(如 `news-fetch/news-parse`)

#### Scenario: 归档 commit 内无测试文件 → tests 诚实退化
- **WHEN** 某 change 的归档 commit diff 中无 `*.test.ts`/`*.spec.ts` 文件
- **THEN** 该 TraceLink 的 `tests` 为 `[]`(不臆造测试文件名)

#### Scenario: 归档 commit 无法确定 → 跳过该 change
- **WHEN** 某归档目录找不到对应的归档 commit
- **THEN** 该 change 不出现在结果中(不臆造 commit hash),其余 change 正常织链

#### Scenario: 只织已归档 change
- **WHEN** 仓库同时存在归档 change 与未归档(活跃)change
- **THEN** 结果只含已归档 change;未归档 change(无确定归档 commit)不织

### Requirement: 采集时以自动派生追溯链替代手维护文件
系统 SHALL 在采集快照时通过扫描 `docs/openspec/changes/archive/` 目录结构与 `git log`/`git show` 自动派生 `TraceLink[]` 填充 `MetricsSnapshot.traces`,替代读取手维护的 `data/traces.json`;并 SHALL 提供 CLI 把派生结果写出到 `data/traces.json` 作为可检视产物(每次重生成,供人眼审计,非采集依赖)。

#### Scenario: 快照 traces 来自实时派生
- **WHEN** 采集快照
- **THEN** `MetricsSnapshot.traces` 为从 archive + git 实时派生的 `TraceLink[]`,不读 `data/traces.json`

#### Scenario: 写出可检视产物
- **WHEN** 运行织链 CLI
- **THEN** 把当前派生的 `TraceLink[]` 写出到 `data/traces.json`(覆盖重生成),内容与采集所用派生值一致

