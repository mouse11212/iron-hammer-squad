## Context

M7 drift 监控首切片。KB 接地(`[[agent-drift]]`/`[[arxiv-agent-drift-2026]]`):ASI 12 维复合度量(4 类加权:Response Consistency 0.30/Tool Usage 0.25/Coordination 0.25/Behavioral 0.20),滚动 50 交互窗口,τ=0.75 连续三窗触发。Tool Sequencing Consistency(Levenshtein)属 Tool Usage 类,是最可确定性/离线/可从现有 `events.jsonl` op 序列算的信号。drift ~200+ 交互才显现——**本工程未做长程任务测试,现无 drift 数据**。

## Goals / Non-Goals

**Goals:**
- 建**确定性** Tool Sequencing Consistency sensor(纯 Levenshtein)+ 滚动窗口 τ 告警**框架**(供后续 sensor 复用)。
- 离线、无 embedding、从现有 events.jsonl 算。穷尽单测。
- 诚实:机制建好,真信号待长程;阈值用 KB 默认;无数据→不告警(不臆造已发生 drift)。

**Non-Goals:**
- 不做语义相似度(需 embedding 模型,离线难)、共识/协调(需多 agent 同任务)sensor。
- 不做复合 ASI 12 维汇总、EMC/ABA/DAR 缓解、两级拓扑(后续切片)。
- 不改 inner-loop/既有 gate/metrics 既有。

## Decisions

**D1:首信号 = Tool Sequencing Consistency(Levenshtein)(用户确认)。** V4 §6 + KB 点名;纯/离线/可从 events.jsonl op 序列算。语义(embedding)/共识(多 agent)离线更难,排后。

**D2:4 个纯核心 + 薄 IO + 薄组装。**
- 纯 `opSequence(events, traceId)`:按 ts 排序,token = `op==='phase'?`phase:${phase}`:op`。
- 纯 `levenshtein(a,b)`(token 数组编辑距离,经典 DP)。
- 纯 `seqConsistency(a,b) = 1 - dist/max(len)`([0,1],双空=1,一空一非空=0)。
- 纯 `driftAlert(series, tau=0.75, k=3)`:存在连续 k 个 < tau → alert + 首触发位;不足 k → 不告警。
- 薄 IO 读 events.jsonl(保 ts/op/phase/traceId);薄组装 `computeDrift(events)`:按 traceId 分组 → op 序列(按各 US 首事件 ts 排序)→ 相对**基线序列**(第一个 US 序列作参考)算一致性序列 → driftAlert。

**D3:对比基线 = 参考序列(第一个 US),非 embedding。** KB 的 ABA 用"基准期 exemplars";首切片取首个 US op 序列作基线,后续各 US 相对它的一致性构成序列。窗口/基线语义(rolling-window vs fixed-baseline)是建模选择,首切片用 fixed-baseline(可测、可解释),随长程数据精化。

**D4:阈值用 KB 默认,真信号待长程(诚实)。** τ=0.75、k=3 取自 `[[arxiv-agent-drift-2026]]`;当前无长程数据 → computeDrift 多半返回"数据不足"。**不臆造"已检测到 drift"**——无数据即诚实标注待长程(同 NFR/M4+「待埋点」)。

**D5:归属 metrics 包。** drift 属可观测 sensor(V4 §6「纳入 §7 度量」),metrics 已消费 events.jsonl。`drift-sensor.ts` 自带最小 event 形状 + 薄 reader(保 ts,events-tax 的 TaxEvent 无 ts)。

## Risks / Trade-offs

- [events.jsonl ephemeral → drift 需长程序列] → 同 VTax 早期固有限制;首切片机制为主,持久化/长程积累待后续(可接 ledger 类)。诚实标注。
- [op 序列粒度 = phase/gate 级,非 agent 内部 tool 调用] → harness 可观测层即 phase/gate 序列;agent 内部 tool(stream-json)未落 events,首切片用 phase/gate 级 op 序列作 Tool Sequencing 代理。可后续细化。
- [fixed-baseline vs rolling-window 建模] → 首切片 fixed-baseline(可测可解释);随真实 drift 数据校验/切 rolling。
- [阈值未标定] → 用 KB 默认 + 诚实"待长程标定";无数据不告警,避免假阳性。

## Open Questions

- 无(首信号、诚实路径经 brainstorm 与用户确认;窗口/基线建模标注为首切片选择,可后续精化)。
