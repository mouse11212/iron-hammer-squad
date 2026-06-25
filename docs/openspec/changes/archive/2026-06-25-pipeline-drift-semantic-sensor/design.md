# 设计：语义相似度 drift sensor（M7-c）

## 把不确定性关在纯函数外（第三次，外部条件最多）

| 层 | 内容 | 性质 |
|---|---|---|
| 纯核 | `cosine` / `semanticConsistencySeries` / 复用 `driftAlert` | 确定,可穷尽单测 |
| 接口 | `EmbedFn = (text)=>number[]`（注入,不绑定模型） | 契约 |
| 待埋点 | ① 响应文本采集 ② embedding provider | 外部,无→insufficient-data |

M7-a 信号纯/离线/已可算；M7-b 已有 ledger 数据；M7-c **两个外部条件都缺**——所以首切片价值 = 钉死语义 drift 的确定性计算逻辑 + 定义接口契约，与 M7-a/b 同构。

## 纯函数（`pipeline/metrics/src/semantic-sensor.ts`）

```ts
export type EmbedFn = (text: string) => number[];          // 注入,不绑定模型
export interface SemanticResponse { ts: string; traceId: string; text: string; }

cosine(a, b): number
  // 标准余弦 dot/(‖a‖‖b‖);任一零向量 → 0(不臆造,避免 0/0);维度不等 → 抛(契约违例)

semanticConsistencySeries(vecs): number[]
  // 相对基线(首向量)的 cosine 序列:vecs[1..] vs vecs[0];< 2 向量 → []

computeSemanticDrift(responses, embed?, tau?, k?): { status:'ok'|'insufficient-data'; consistencies:number[]; alert:{...} }
  // embed 缺省 / responses < 2 → insufficient-data
  // 否则:按 ts 排序 → embed 每条 text → 相对基线一致性序列 → driftAlert(跌破 τ)
```

## 关键决策

1. **cosine 余弦相似度**：KB 指定的语义检测法（embedding cosine similarity）。零向量 → 0（不臆造，避免 0/0 NaN）；维度不等 → 抛（embedding provider 契约违例，红线6 不静默吞）。
2. **相对首基线**：同 M7-a——首个响应作语义基线，后续每条 vs 基线的 cosine。可测可解释；rolling 留真实数据后切。
3. **复用 driftAlert（下降方向）**：语义一致性「跌破 τ」= 输出偏离原意，与工具序列同方向，直接复用 M7-a 纯函数（不重写）。
4. **EmbedFn 注入、不绑定模型**：离线纪律 + 把 embedding 的不确定性关在纯核外。无 provider → insufficient-data。
5. **阈值不臆造**：KB 无语义专用阈值 → τ=0.75/k=3 沿用 ASI 框架默认待标定。
6. **Confidence Calibration（JS 散度）不做**：语义检测第二条腿，从窄到宽先 cosine。

## 不影响已实现功能

纯新增文件 + 复用只读 `driftAlert`。既有 88 测试零改动；不触 types/collect/board/invoke。响应文本采集 + 看板接入留后续。
