# traceability Specification

## Purpose
TBD - created by archiving change pipeline-m4-metrics-trace. Update Purpose after archive.
## Requirements
### Requirement: 双向追溯链记录
系统 SHALL 维护结构化追溯链 TraceLink(changeId → spec → tests[] → commit)，支持正向(从 spec 找 commit)与反向(从 commit 回 spec)查询。

#### Scenario: 正向查询
- **WHEN** 给定一个 spec/change id
- **THEN** 返回其关联的 tests 与 commit

#### Scenario: 反向查询
- **WHEN** 给定一个 commit
- **THEN** 返回其关联的 change/spec(若有)

#### Scenario: 可回放
- **WHEN** 读取追溯链记录
- **THEN** 各 TraceLink 字段完整(无残缺链节即视为待补，显式标注)

### Requirement: 追溯链一致门（断链即退出非零；tests 缺失降级警告）
系统 SHALL 提供确定性校验 `traceCheck(links: TraceLink[]): TraceCheckResult`，把既有"链节缺失即显式标注"升级为**可门控的一致性判定**：对每条 `TraceLink(changeId → spec → tests[] → commit)`，**spec 或 commit 缺失为阻断级断链**（`broken`：`missing-spec`、`spec-without-commit`），计入 `ok`；**tests 缺失降级为警告**（`warnings`：`spec-without-tests`），**不计入 `ok`**——因 `weaveTraces` 的 tests 派生（归档 commit 改的 test 文件）对"单独归档 commit"工作流失效、且 prose capability 天然无 `*.test.ts`（tests=0 不作为阻断条件，BOSS 2026-06-30 裁决）。`ok = broken 为空`。校验 MUST 纯确定性（输入为 `weaveTraces` 从 OpenSpec 归档派生的 `TraceLink[]`，无 LLM、无网络）。系统 SHALL 提供 CLI `npm run trace:check`（报告门），对当前归档织链运行 `traceCheck`，打印 `broken` + `warnings`；`broken` 非空则进程退出非零，`warnings` 不影响退出码。本门作**报告门**（不接进集成阻断；阻断由 spec-coverage 门承担）。

#### Scenario: 完整链 → 通过
- **WHEN** 每条 TraceLink 的 spec、tests[]、commit 均存在
- **THEN** `traceCheck` 返回 `{ ok: true, broken: [], warnings: [] }`，CLI 退出 0

#### Scenario: spec 无关联测试 → 警告（不阻断）
- **WHEN** 某 TraceLink 有 spec、commit 但 tests[] 为空
- **THEN** `warnings` 含一条 `{ changeId, kind: 'spec-without-tests' }`，**不计入 `ok`**（`ok` 仍 true，若无其他断链）；CLI 退出 0

#### Scenario: spec 无关联 commit → 断链
- **WHEN** 某 TraceLink 有 spec、tests 但 commit 缺失
- **THEN** `broken` 含一条 `{ changeId, kind: 'spec-without-commit' }`，`ok: false`

#### Scenario: spec 缺失 → 断链
- **WHEN** 某 TraceLink 的 spec 为空串
- **THEN** `broken` 含一条 `{ changeId, kind: 'missing-spec' }`，`ok: false`

#### Scenario: CLI broken 非零退出（warnings 不影响）
- **WHEN** 织链存在任一 `broken` 时运行 `npm run trace:check`
- **THEN** 进程退出非零并打印每条 `broken` 的 changeId 与 kind；仅有 `warnings` 时退出 0

#### Scenario: 报告门（不阻断集成）
- **WHEN** `traceCheck` 判定存在 `broken`
- **THEN** trace:check CLI 报告供人审；**harness 集成阻断门由 spec-coverage 门承担**，trace-check 不接进集成阻断（因 tests 派生局限 + prose capability）

