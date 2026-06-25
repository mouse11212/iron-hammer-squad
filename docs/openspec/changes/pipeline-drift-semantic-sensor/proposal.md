# 提案：语义相似度 drift sensor（M7-c）

## Why

KB（`[[topics/agent-drift]]`，arXiv:2601.04170）的 drift 三型里，**Semantic Drift（语义漂移）= agent 输出渐进偏离原始任务意图但语法仍有效**，检测法 = **Output Semantic Similarity（embedding cosine similarity）**。它属 ASI 的 **Response Consistency** 类（四类里权重最高 0.30）。

M7-a（工具序列）/M7-b（人工干预率）已建好「相对基线 + 滚动窗口 + 连续 k 窗告警」框架。M7-c 把语义维度补上——但它**首次引入外部依赖（embedding）**，且要 embed 的 agent 响应文本**当前没采集**（events.jsonl 只记 op/status 元数据；invoke 的 stream-json 只取 session_id/usage，不落 assistant 文本）。

## What Changes

- 扩 `drift-monitor` capability：新增语义 sensor 纯函数族（`cosine` / `semanticConsistencySeries`）+ 注入接口 `EmbedFn` + 组装 `computeSemanticDrift`。
- 复用 M7-a `driftAlert`（语义一致性**跌破 τ** 连续三窗告警，与工具序列同方向）。
- **不绑定 embedding 模型**：provider 作可选注入（`EmbedFn = (text)=>number[]`），离线纪律；无 provider/无文本 → `insufficient-data`。

## 范围（用户裁定：只建纯核 + 接口）

- **不碰** invoke/instrument 的响应文本采集（碰核心执行路径，留后续独立切片单独验证，守「不影响已实现功能」）。
- 双重待埋点：① 响应文本采集 ② embedding provider 接入——首切片只交付确定性纯核 + 接口契约 + 合成验证。

## 诚实约束（红线1 不臆造）

- KB **未给语义 drift 绝对阈值**——沿用 ASI 框架 τ=0.75 / k=3（连续三窗），cosine 专用阈值延续「保守占位待标定」。
- 当前无 embedding、无响应文本 → `computeSemanticDrift` 返回 `insufficient-data`，**不臆造已发生语义漂移**。第五次复用「建机制 + 阈值待标定 + 无数据不告警」（M4+→NFR→M7-a→M7-b→M7-c），且**双重待埋点**（外部条件最多的一刀）。

## Impact

- 纯新增文件 `pipeline/metrics/src/semantic-sensor.ts` + 单测；复用 `driftAlert`。
- **不影响已实现功能**：不改既有 types/collect/board/invoke 行为；Confidence Calibration（JS 散度，语义检测第二条腿）本切片不做（从窄到宽，先 cosine）。
