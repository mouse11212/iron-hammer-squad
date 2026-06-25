## Why

M7 drift 监控——项目根命题(agent drift = 单步误差长链路复利累积,整个 harness 对抗的根本)的第一个落地 sensor。KB 接地(`[[agent-drift]]`/`[[arxiv-agent-drift-2026]]` arXiv:2601.04170):ASI 框架 Behavioral 类的 **Tool Sequencing Consistency(Levenshtein)** 是最可确定性/离线/可从现有 `events.jsonl` 算的 drift 信号(语义相似度需 embedding、共识率需多 agent,离线更难,排后)。本切片建**确定性 sensor + 滚动窗口告警框架**。

## What Changes

- 新增 `metrics/src/drift-sensor.ts`:**纯函数**——`opSequence(events, traceId)` 取一个 US 的 op 序列(按 ts 排序,token=`phase:<role>`|op);`levenshtein(a,b)` 序列编辑距离;`seqConsistency(a,b)→[0,1]`(归一化 `1 - dist/maxLen`,1=完全一致,双空=1);`driftAlert(series, τ, k)`——连续 k 个一致性 < τ 即告警(KB「连续三窗触发」)。+ 薄 IO 读 events.jsonl(保 ts/op/phase/traceId)。
- **诚实约束(同 NFR/红线1)**:当前**未做长程任务测试 → 无 drift 数据**;sensor 机制建好,真信号待长程;τ=0.75/k=3 用 KB 默认值,随真实数据标定;**不臆造"已检测到 drift"**(无数据→无告警/待数据)。

## Capabilities

### New Capabilities
- `drift-monitor`: agent drift 监控能力(M7)。首个 Requirement = Tool Sequencing Consistency sensor(Levenshtein + 滚动窗口 τ 告警框架);后续(人工干预率/语义/共识/复合 ASI/缓解)在此扩展。

### Modified Capabilities
<!-- 无。 -->

## Impact

- **新增**:`pipeline/metrics/src/drift-sensor.ts`(纯 sensor + 薄 reader)+ 测试。
- **不影响已实现功能**:纯新增独立模块,不改 inner-loop/既有 gate/metrics 既有;只读 events.jsonl。既有测试零影响。
- **数据源**:`<pipeline>/.runtime/events.jsonl`(op 序列)——ephemeral(同 VTax 早期),持久化/长程积累待后续。
- **范围(YAGNI/红线3)**:只 **Tool Sequencing Consistency sensor + 告警框架**(框架供后续 sensor 复用)。**不**做语义/共识 sensor(需 embedding/多 agent)、复合 ASI 汇总、EMC/ABA/DAR 缓解、两级拓扑。
- **求真**:KB 接地(ASI 12 维框架、τ/窗口、Levenshtein 法均取自 `[[agent-drift]]`/`[[arxiv-agent-drift-2026]]`);阈值用 KB 默认,真信号待长程,不臆造已发生 drift。
