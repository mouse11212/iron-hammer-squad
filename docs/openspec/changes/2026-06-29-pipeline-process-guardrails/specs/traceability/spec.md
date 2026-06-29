## ADDED Requirements

### Requirement: 追溯链一致门（断链即退出非零）
系统 SHALL 提供确定性校验 `traceCheck(links: TraceLink[]): TraceCheckResult`，把既有"链节缺失即显式标注"升级为**可门控的一致性判定**：对每条 `TraceLink(changeId → spec → tests[] → commit)`，spec、tests、commit 任一缺失即为**断链**。`traceCheck` MUST 收集所有断链（按类型：`spec-without-tests`、`spec-without-commit`、`missing-spec`），并在存在任一断链时令调用方可据以退出非零。校验 MUST 纯确定性（输入为 `weaveTraces` 从 OpenSpec 归档派生的 `TraceLink[]`，无 LLM、无网络）。系统 SHALL 提供 CLI `npm run trace:check`，对当前归档织链运行 `traceCheck`，有断链则进程退出非零并打印断链清单。

#### Scenario: 完整链 → 通过
- **WHEN** 每条 TraceLink 的 spec、tests[]（非空）、commit 均存在
- **THEN** `traceCheck` 返回 `{ ok: true, broken: [] }`，CLI 退出 0

#### Scenario: spec 无关联测试 → 断链
- **WHEN** 某 TraceLink 有 spec、commit 但 tests[] 为空
- **THEN** `broken` 含一条 `{ changeId, kind: 'spec-without-tests' }`，`ok: false`

#### Scenario: spec 无关联 commit → 断链
- **WHEN** 某 TraceLink 有 spec、tests 但 commit 缺失
- **THEN** `broken` 含一条 `{ changeId, kind: 'spec-without-commit' }`，`ok: false`

#### Scenario: CLI 断链非零退出
- **WHEN** 织链存在任一断链时运行 `npm run trace:check`
- **THEN** 进程退出非零并打印每条断链的 changeId 与 kind

#### Scenario: 接进 harness 门
- **WHEN** `traceCheck` 判定存在断链
- **THEN** harness green/pre-merge 门据此拦截（不放行集成）
