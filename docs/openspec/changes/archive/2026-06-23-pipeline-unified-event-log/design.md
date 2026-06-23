## Context

M4+「可观测闭环」立项（backlog 2026-06-23）。V4 §7:204 要求全链路结构化日志 + traceId + 可回放。当前 inner-loop 埋点分散：`${role}-${attempt}.jsonl`（claude 原始流）、`gates.jsonl`（仅 {cmd,args}，无结果/耗时/ts）、`state.json`（job 终态），且 squash/integrate/orchestrator-fix 完全无日志（见 `pipeline/driver/src/inner-loop-runner.ts`）。

约束：
- CLAUDE.md 红线3「从窄到宽」——本切片只打通"一条链可回放"，不上统一日志框架全家桶。
- KB `guides-and-sensors`：可观测属 computational sensor，须确定、可测——延续本工程 IO/逻辑分离的薄边界纪律。
- KB `agent-observability`：三要素之①端到端动态追踪（intent→tool→data→output）即本切片要落地的 op 序列。

本设计已与人类 brainstorm 并批准（2026-06-23）。

## Goals / Non-Goals

**Goals:**
- 统一 event schema：`{ ts, traceId, op, phase?, status?, durationMs?, payload? }`，一条操作一行 JSONL。
- traceId = jobId，贯穿一个 US 全链；中心化 `pipeline/.runtime/events.jsonl`。
- 5 个发射点（phase/gate/squash/integrate/orchestrator-fix）接入统一 sink。
- 按 traceId 回放：纯分组/渲染 + 薄 IO 读取 + CLI `bin-replay`。
- `durationMs` 字段就位，为后续 Verification Tax 切片留 drop-in 钩子。

**Non-Goals（留后续切片）：**
- 追溯链自动织链（changeId→spec→tests→commit，取代手维护 traces.json）。
- Verification Tax 计算 / `collect.ts` 去 `verificationMs=null`。
- Defect Escape 自动喂。
- 改 `harness-metrics` / `traceability` 既有规约。

## Decisions

**D1: traceId = jobId（不新造标识）。**
jobId 已贯穿 runsDir / squash message / feature 分支名，是天然的"一个 US 全链"锚。
- 备选：新造独立 traceId 并在各层透传 → 否决：徒增透传协调成本，与现有标识冗余。

**D2: 中心化 append-only `events.jsonl`（非每 job 一文件）。**
集成事件跨多个 job（`batchIntegrate` 合 N 个分支），中心日志按 traceId 过滤使"回放一个 US 全链"成为一次干净 filter；集成事件经 branch→jobId 映射把结局挂回各 US。
- 备选：每 job 一个 events.jsonl → 否决：squash/integrate 发生在批级、跨 job，落哪个文件有歧义，回放要跨文件拼。

**D3: IO/逻辑分离的薄边界。**
- 纯（纳入变异门）：`makeEvent` 构造器、`groupByTrace`、`formatReplay`——时钟注入，零非确定性。
- 薄 IO：`makeEventSink(path)`=appendFileSync 包装（含 mkdir -p）；`readEvents`=读+逐行 parse，跳畸形行（沿用 `collect.ts` 容错风格）。

**D4: 发射点路由现有埋点，不新增散落日志。**
gate 由"只记 {cmd,args}"升级为补 exitCode/durationMs（严格增强）；squash/integrate/orchestrator-fix 由无到有。`${role}-${attempt}.jsonl` 原始流保留作深度调试（granularity 不同）。integrate 复用 `inner-loop-runner.ts:262` 的 `branchRel` 映射回填 traceId。

**D5: durationMs 现在就进 schema 但本切片不计算 Tax。**
为下一切片预埋接口——届时 `collect.ts` 只需按 `op=phase&phase=dev`(实现) vs `op=gate|phase=review`(验证) 聚合 durationMs，无需再改埋点层。

## Risks / Trade-offs

- [中心日志并发写交错] 多 worker 并行 drain 时 append 可能交错 → 缓解：每行独立 JSON、append 原子（单行 < PIPE_BUF），回放按 traceId 过滤 + ts 排序，交错不影响正确性；读取跳畸形行兜底。
- [事件 schema 早期僵化] 过早锁死字段 → 缓解：payload 为开放结构化袋子，op 特定数据放 payload，核心字段保持最小。
- [新增写 IO 拖慢 inner-loop] → 缓解：append 单行、computational sensor 量级（毫秒），可忽略；sink 注入便于测试关闭。
- [durationMs 口径误用] 本切片只记不算，若他处误把它当 Tax → 缓解：规约明确本切片 Non-Goal，metrics 侧不读该字段直到下一切片。

## Migration Plan

无数据迁移。`events.jsonl` 在 `.runtime`（已 gitignore），不入库。回滚=移除发射点调用与新文件，现有 `${role}-*.jsonl`/`gates.jsonl`/`state.json` 不受影响。增量部署：先落 events.ts/replay.ts + 单测（纯逻辑），再逐个接发射点，每接一个跑集成验证。

## Open Questions

- `gates.jsonl` 是否在事件并入后淘汰？→ 实现期决定；当前无自动读者，倾向保留至下一切片确认无依赖后再删。
