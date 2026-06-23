## Why

V4 §7:204 要求"所有操作记结构化日志、挂追溯链 ID、全链路可回放"。M4 已搭可观测骨架（四指标 `harness-metrics` + 看板 + `traceability` 双向查询 + inner-loop 的 per-phase/gates/state 埋点），但日志分散、无统一 schema、无 traceId 贯穿——无法凭一个 US 的标识回放它经历的全部操作。本切片打通"一条链可回放"这一地基，是 M4+「可观测闭环」从窄到宽（CLAUDE.md 红线3）的第一步。

## What Changes

- 定义统一 **event schema**：一条操作 = 一行 JSONL，字段 `{ ts, traceId, op, phase?, status?, durationMs?, payload? }`。
- **traceId = jobId**：不新造标识——`jobId` 已天然贯穿 `runsDir` / squash message / feature 分支名，直接作为一个 US 全链的锚。
- 引入中心化 append-only 存储 `pipeline/.runtime/events.jsonl`（按 traceId 索引）。
- 把现有 5 个埋点点路由进统一 sink：`phase` / `gate` / `squash` / `integrate` / `orchestrator-fix`。其中 `gate` 由"只记 {cmd,args}"升级为补 exitCode/durationMs；`squash`/`integrate`/`orchestrator-fix` 从无日志变为有结构化事件（严格增强，无 BREAKING）。
- 新增**回放能力**：纯函数 `groupByTrace` / `formatReplay` + 薄 IO `readEvents` + CLI `bin-replay <traceId>`，按 traceId 渲染一个 US 的 `phase→gate→squash→integrate` 有序事件链。

## Capabilities

### New Capabilities
- `observability-events`: 操作级结构化事件日志（统一 schema + traceId=jobId 贯穿 + append-only 中心存储 + 5 发射点）与按 traceId 的全链路回放（纯函数分组/渲染 + 薄 IO 读取 + CLI）。

### Modified Capabilities
<!-- 无：harness-metrics（四指标计算）与 traceability（TraceLink changeId→spec→tests→commit）的既有 REQUIREMENT 不变。本切片的 durationMs 仅为后续 Verification Tax 切片预留字段，不在此改它们的规约。 -->

## Impact

- **新增代码**：`pipeline/driver/src/events.ts`（schema + `makeEvent` 构造器 + `makeEventSink`）、`pipeline/driver/src/replay.ts`（`groupByTrace` + `formatReplay` + `readEvents`）、`pipeline/driver/src/bin-replay.ts`（CLI）。
- **修改代码**：`inner-loop-runner.ts`（runPhase 包装发 `phase` 事件、gate cmd 包装发 `gate` 事件、orchestratorFix 装配发 `orchestrator-fix` 事件）、`runIsolated`（发 `squash` 事件）、`drainBatchIsolated`（集成回调发 `integrate` 事件，复用 `branchRel` 把集成结局挂回各 US 的 traceId）。
- **存储**：新增 `pipeline/.runtime/events.jsonl`（已被 `.runtime` gitignore 覆盖，不入库）。
- **不影响**：现有 `${role}-${attempt}.jsonl`（claude 原始流）保留作深度调试；`gates.jsonl` 内容并入统一事件后可保留或淘汰（实现期决定，不破坏既有读者——目前无自动读者）。
- **明确不做**（留后续切片）：追溯链自动织链（取代手维护 traces.json）、Verification Tax 计算 / collect.ts 去 `verificationMs=null`、Defect Escape 自动喂。
