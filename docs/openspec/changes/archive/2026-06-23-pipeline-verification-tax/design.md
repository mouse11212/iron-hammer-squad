## Context

M4+ 续切片(放大可观测闭环)。地基切片(`2026-06-23-pipeline-unified-event-log`)已落统一事件日志:每个 phase/gate 事件带 `durationMs`,中心 `<pipeline>/.runtime/events.jsonl`。但 `metrics/collect.ts:59` 仍写死 `verificationMs=null` → 看板 Verification Tax 恒"待埋点"。`metrics/compute.ts:16` 的 `verificationTax(verificationMs, implementationMs)` 纯函数已就位(含 null 回落/除零)。本切片只补"从 events 算出两个 ms 喂进去"。已与人类 brainstorm 并批准(2026-06-23)。

约束:CLAUDE.md 红线3 从窄到宽;KB guides-and-sensors 可观测=computational sensor(纯/确定可测);metrics 与 driver 是独立 npm 包,靠 events.jsonl 契约解耦。

## Goals / Non-Goals

**Goals:**
- 从 events.jsonl 按固定口径算实现/验证耗时 → Verification Tax 出真值。
- 按 traceId(每个 US) 分组算 tax(backlog「按 change 埋点」)。
- 接入 collect.ts,消掉看板的"待埋点";无 events 优雅回落 null。

**Non-Goals:**
- 追溯链自动织链、Defect Escape 自动喂(后续切片)。
- 持久化指标存储(events.jsonl ephemeral 是固有限制,本切片接受)。
- 改 verificationTax 纯函数签名/null 语义、改埋点层(driver 一行不动)。

## Decisions

**D1: Verification Tax 口径——写测试归"验证"。**
实现 = `phase=dev`;验证 = `phase∈{test,review}` + `op=gate` + `op=orchestrator-fix`。Augment 的 Verification Tax 衡量"为信任 AI 产出付出的额外开销"——TDD 写测试正是此开销,非产出特性本身。
- 备选:test 归实现 → 否决:低估 tax、模糊"花在确认上的比例"这一诊断意义。

**D2: 复用 compute.ts 既有 `verificationTax()`,不新写比率逻辑。**
新代码只负责从 events 归类出两个 ms;null 回落/除零由既有纯函数处理。兑现地基切片"durationMs 预埋钩子"——埋点层零改动,纯加消费侧。

**D3: 跨包靠 events.jsonl 契约,metrics 不 import driver。**
metrics 侧定义本地最小 event 形状(只需 op/phase/durationMs/traceId)逐行 parse。两包无交叉依赖,jsonl 是稳定接口。

**D4: 纯/薄 IO 分离。**
纯:`categorizeDuration`/`taxByTrace`(events-tax.ts,纳入变异门)。薄 IO:`readEventsJsonl`(读+逐行 parse 跳畸形行,缺文件→[])。

## Risks / Trade-offs

- [events.jsonl ephemeral → tax 不持久] 清空后回落 null → 缓解:本切片接受;null 回落诚实,持久化存储另立切片。
- [口径争议] 写测试归验证可能与他人直觉不同 → 缓解:规约/设计显式钉死 D1,看板同时展示实现/验证原始 ms 供复核。
- [并发写交错的畸形行] → 缓解:readEventsJsonl 跳畸形行(沿用地基切片容错)。
- [跨包 schema 漂移] driver 改 event 字段名 → metrics 静默失准 → 缓解:本地形状只依赖 op/phase/durationMs/traceId 四个稳定核心字段;字段变更属规约级改动需人类签字。

## Migration Plan

无数据迁移。回滚=collect.ts 恢复 verificationMs=null + 移除 events-tax.ts。增量:先纯函数 + 单测,再接 collect,再看板渲染,最后真实/集成验证。

## Open Questions

- 是否需要把某次快照的 tax 落盘归档(脱离 ephemeral)?→ 归入"持久化指标存储"另立切片,本切片不做。
