# 提案：人工干预率（HIR）drift sensor（M7-b）

## Why

KB（`[[topics/agent-drift]]`，arXiv:2601.04170）把 **Human Intervention Rate（HIR）列为 ASI 的 drift「终极指标」**——drift 演进规律显示 ~200 交互后人工干预 **+216%**。系统已有 `InnerLoopStats.escalationRate`（blocked-escalated/总），但它是**全时段标量 KPI，无时间维度**——无法判断「干预率是否在*上升*」，而 drift 的本质恰是这个**趋势**。

M7-a 已建好「相对基线 + 滚动窗口 + 连续 k 窗告警」框架（工具序列一致性）。M7-b 复用该框架，给 HIR 加上**时间窗趋势 + 上升告警**这层 drift 检测——这是 ASI 12 维里第二个「确定性 / 离线 / 已可从既有数据算」的信号。

## What Changes

- 扩 `drift-monitor` capability：新增 HIR sensor 纯函数族（`hir` / `hirSeries` / `risingAlert`）+ 组装入口 `computeHir`。
- 数据源**单一**：`runs-ledger.jsonl`（每行带 `ts` + `status`）；干预 = `status==='blocked-escalated'`（红线6 显式升级人类）。新增专用薄 IO `readHirRuns`（既有 `readRunLedger` 投影丢了 ts，无法做时间窗——同 M7-a `readDriftEvents` 保 ts），不动既有 reader。
- `held` 集成级签字（events.jsonl，另一源）**本切片不碰**，留作后续拓宽（从窄到宽）。

## 诚实约束（红线1 不臆造）

- KB 给了 τ=0.75（一致性）与 50 交互窗，但**未给 HIR 绝对阈值**。故 θ/windowSize **注入**，默认取保守占位（θ=0.5、window=5），代码与复盘**显式标「待长程标定」**；k=3 用 KB「连续三窗」。
- 当前 ledger 为空（未长程）→ `computeHir` 返回 `insufficient-data`，**不臆造已发生的干预上升**。第四次复用「建机制 + 阈值待标定 + 无数据不告警」（M4+ 待埋点 → NFR 待标定 → M7-a → M7-b）。

## Impact

- 纯新增文件 `pipeline/metrics/src/hir-sensor.ts` + 单测；复用只读 `readRunLedger`。
- **不影响已实现功能**：不改既有 types/collect/board 行为；看板接入留作独立后续（同 M7-a 首切片只交付 sensor 机制 + 单测）。
