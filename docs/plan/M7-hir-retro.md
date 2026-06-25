# 复盘 · M7-b 人工干预率（HIR）drift sensor

> 日期 2026-06-25 · change `pipeline-drift-hir-sensor` · 扩 `drift-monitor` capability
> KB「终极 drift indicator」(Human Intervention Rate)落地为时间窗趋势 sensor。

## KB 接地

承 M7-a 的 KB 读（`[[topics/agent-drift]]`，arXiv:2601.04170，Rath 2026）：
- **HIR = ASI 的 drift「终极指标」**——drift 演进规律：~200 交互后人工干预 **+216%**、成功率 87.3%→50.6%、agent 冲突 +487%。
- KB 给了 τ=0.75（一致性）与 50 交互滚动窗，但**未给 HIR 的绝对阈值**——这本身是「θ 待标定」诚实处理的 KB 依据，不是省略。

## 做了什么

把系统里已有但「无时间维」的 `escalationRate` 升级为**可测 drift 趋势**的 sensor。

- 纯 `hir(runs)`：干预数/总数（干预=`blocked-escalated`，红线6 显式升级人类）；总数 0 → null（不臆造，同 `avgCostUsd`）。**定义对齐既有 escalationRate（单一真相）**。
- 纯 `hirSeries(runs, windowSize)`：按 ts 升序切 tumbling 满窗 → 每窗 HIR 序列（给 HIR 加时间维度）。
- 纯 `risingAlert(series, θ, k)`：连续 k 窗 ≥ θ 告警（M7-a `driftAlert`「跌破 τ」的**上升方向镜像**）。
- 薄 `readHirRuns(path)`：逐行 parse ledger，**保 ts**（窗口排序需要）+ 按 jobId 去重；缺文件→[]。
- 组装 `computeHir`：runs 不足一窗 → `insufficient-data`。

## 验证来源（可溯源）

- metrics gate 全绿：lint(`eslint .`) + tsc + **88 测试**（71→88，+17），**既有 71 零影响**。
- **合成验证**：渐升干预窗序列 `[0,0,0.5,1,1]` 连续三窗 ≥θ → **正确告警**；全 0 稳定 → 不告警；不足一窗 → insufficient-data。
- **真实 `runs-ledger.jsonl` 诚实路径**：当前 0 条 → `computeHir` 返回 `{status:'insufficient-data', rate:null, alert:false}`——**机制不臆造未发生的干预上升**。

## 贯穿洞察

- **同一定义放到时间轴 = 从 KPI 到 sensor**：`escalationRate`（全时段标量）与 `hir()` 是同一公式，差别只在**有没有时间维**。drift 的本质是「变化趋势」，所以加时间窗 + 连续-k 告警这层，才把一个统计量变成 drift 探针。这是「既有度量复用、不另起炉灶」的范例。
- **复用 M7-a 框架、反向比较**：一致性「跌破 τ」↔ 干预率「升过 θ」，连续-k 窗框架同构。M7-a 复盘说「框架建好可复用给后续 sensor」——M7-b 是第一次兑现。
- **第四次「待埋点」哲学**：M4+ 待埋点 → NFR 待长程标定 → M7-a insufficient-data → **M7-b**。机制确定、阈值占位待标定、无数据不告警。θ 不臆造的依据是 **KB 本身没给 HIR 绝对阈值**。
- **诚实修正中途暴露的复用假设**：原以为复用 `readRunLedger`，落地发现它的投影**丢了 ts**，时间窗做不了 → 改写专用 `readHirRuns`，并回改规约措辞（红线1：不让规约留下不实的「复用」声明）。

## 固有限制 / 待后续

- **真信号待长程**：HIR 趋势要长程序列才显现——未做长程任务测试前恒为 insufficient-data。这是 M7 整体前置。
- **干预口径窄**：本切片只计 run 级 `blocked-escalated`；`held`（集成级人签，events.jsonl 另一源）、`failed` 留作后续拓宽（从窄到宽）。
- **tumbling 固定窗**：首切片用不重叠窗（易测易解释）；真实 drift 数据到位后可切 KB 的 rolling-50。
- **未接看板**：sensor 机制 + 单测交付完，dashboard 接入留独立后续（同 M7-a）。

## M7 后续候选

M7-c 语义相似度（需 embedding）→ M7-d 共识/协调（需多 agent）→ M7-e 复合 ASI（12 维加权，纳入 §7）→ M7-f 缓解 EMC/ABA/DAR → M7-g 两级拓扑。**所有真信号仍待长程任务测试**——这越来越是 M7/NFR 共同的关键路径。
