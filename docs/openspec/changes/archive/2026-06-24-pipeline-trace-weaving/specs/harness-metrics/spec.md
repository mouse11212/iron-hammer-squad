## ADDED Requirements

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
