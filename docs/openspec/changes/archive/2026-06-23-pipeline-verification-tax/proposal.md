## Why

M4+ DoD 要求"四指标（含 Verification Tax）全部有真实值、无'待埋点'"。地基切片已落统一事件日志（每个 phase/gate 带 `durationMs`），但 `metrics/collect.ts:59` 仍写死 `verificationMs=null` → 看板 Verification Tax 长期显示"待埋点"。本切片把上一切片预埋的 `durationMs` 钩子兑现:从 events.jsonl 算出实现/验证耗时,让 Verification Tax 出真值。

## What Changes

- 新增 `metrics/src/events-tax.ts`:纯函数从事件流按口径归类累加耗时——**实现** = `op=phase & phase=dev`;**验证** = `op=phase & phase∈{test,review}` + `op=gate` + `op=orchestrator-fix`;`squash`/`integrate` 不计（无 durationMs）。
- `taxByTrace`:按 traceId（每个 US）分组算 tax（backlog「按 change 埋点」）。
- 薄 IO `readEventsJsonl`:读 `<repoRoot>/pipeline/.runtime/events.jsonl`,逐行 parse 跳畸形行,缺文件返回 `[]`。
- `collect.ts`:接入上述,把 `verificationMs=null` 改为真值;无 events 时优雅回落 null（"待埋点"诚实不变）。
- `MetricsSnapshot` 加 `implementationMs` + per-US `taxByTrace`;看板补显示实现/验证 ms + 「Verification Tax 按 US」小节。

## Capabilities

### New Capabilities
<!-- 无:不引入新 capability。 -->

### Modified Capabilities
- `harness-metrics`: 新增 Requirement「从事件流派生 Verification Tax 输入」——指标从"实现耗时未埋点→恒 null"演进为"有 events 时从 durationMs 算真值,无 events 时回落 null"。既有「计算四指标(纯函数)」「渲染看板」Requirement 不变(verificationTax 纯函数签名/null 语义不动)。

## Impact

- **新增**:`pipeline/metrics/src/events-tax.ts` + 测试;`pipeline/metrics/stryker.conf.json` mutate 纳入。
- **修改**:`metrics/src/collect.ts`(接线)、`types.ts`(加 implementationMs/taxByTrace)、`board.ts`(渲染)。
- **数据源契约**:metrics 按行 parse driver 写的 events.jsonl(跨包不 import driver,靠 jsonl 稳定契约)。
- **固有限制**:events.jsonl 在 `.runtime`(ephemeral/gitignored)——tax 反映当前运行时的 runs,清空后回落 null。持久化指标存储不在本切片。
- **不做**:追溯链自动织链、Defect Escape 自动喂。
