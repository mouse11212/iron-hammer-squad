# 设计：HIR drift sensor（M7-b）

## 定位：与既有 escalationRate 的关系

| | `InnerLoopStats.escalationRate`（已有） | M7-b HIR sensor（本切片） |
|---|---|---|
| 量纲 | 标量，全时段 | 时间窗序列 + 趋势 |
| 能否测 drift | 否（无时间维度） | 是（连续 k 窗上升告警） |
| 定义 | blocked-escalated / 总 | **`hir()` 对齐同一定义**（单一真相） |

M7-b 不重算 escalationRate 的语义，而是把同一「干预」定义放到**时间轴**上，加趋势检测层。

## 纯函数（`pipeline/metrics/src/hir-sensor.ts`）

```ts
export interface HirRun { ts: string; status: string; }  // runs-ledger 行的最小投影
const INTERVENED = 'blocked-escalated';                   // 红线6 显式升级人类

hir(runs): number | null
  // 干预数 / 总数;总数 0 → null(不臆造,同 avgCostUsd)

hirSeries(runs, windowSize): number[]
  // 按 ts 升序 → 切 tumbling(不重叠)窗 → 每个**满窗**算 HIR;不足一窗的尾部丢弃

risingAlert(series, theta, k): { alert: boolean; triggerIndex?: number }
  // 连续 k 个值 >= theta → alert,报首触发位;不足 k → false(镜像 driftAlert 的「下降」为「上升」)

computeHir(runs, windowSize, theta, k): { status: 'ok'|'insufficient-data'; rate: number|null; series: number[]; alert: {...} }
  // runs 不足一窗(< windowSize) → insufficient-data;否则 status=ok,报 rate+series+alert

readHirRuns(path): HirRun[]  // 薄 IO
  // 逐行 parse ledger,保 ts(窗口排序需要)+ 按 jobId 去重,跳畸形,缺文件→[]
  // 既有 readRunLedger 投影丢了 ts → 不能复用;专用 reader 同 M7-a readDriftEvents
```

## 关键决策

1. **干预 = `blocked-escalated`**：红线6 显式升级人类的唯一终态，带 ts，单一数据源。`failed`（run 级失败，非必然人工介入）与 `held`（集成级，另一源）本切片不计——从窄到宽。
2. **tumbling 而非 sliding 窗**：首切片用不重叠窗最易解释/测；真实 drift 数据到位后可切 KB 的 rolling-50。
3. **上升方向**：M7-a 一致性「跌破 τ」告警；HIR「升过 θ」告警——同一连续-k 框架，反向比较。
4. **阈值不臆造**：KB 无 HIR 绝对阈值 → θ=0.5/window=5 为**保守占位待标定**（同 NFR 保守基线），k=3 用 KB「连续三窗」。
5. **空数据诚实**：当前 ledger 空 → insufficient-data，不告警。

## 不影响已实现功能

纯新增文件（含专用薄 IO `readHirRuns`）；**不动**既有 `readRunLedger`。既有 71 测试零改动；不触 types/collect/board 的行为。看板接入留后续。
