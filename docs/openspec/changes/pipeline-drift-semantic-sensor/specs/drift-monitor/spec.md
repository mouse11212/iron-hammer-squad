## ADDED Requirements

### Requirement: 余弦相似度（纯）
系统 SHALL 提供纯函数 `cosine(a, b)`,计算两向量余弦相似度 `dot(a,b)/(‖a‖·‖b‖)`。任一为零向量 → 返回 0（不臆造,避免 0/0 NaN）;两向量维度不等 → 抛错（embedding provider 契约违例,红线6 不静默吞）。这是 KB（`[[topics/agent-drift]]`）指定的 Semantic Drift 检测法 Output Semantic Similarity（embedding cosine similarity）。

#### Scenario: 同向 → 1
- **WHEN** a=b=[1,2,3]
- **THEN** cosine=1

#### Scenario: 正交 → 0
- **WHEN** a=[1,0],b=[0,1]
- **THEN** cosine=0

#### Scenario: 零向量 → 0（不臆造）
- **WHEN** 任一为 [0,0]
- **THEN** cosine=0

#### Scenario: 维度不等 → 抛
- **WHEN** a 长 2,b 长 3
- **THEN** 抛错

### Requirement: 语义一致性序列（纯，相对基线）
系统 SHALL 提供纯函数 `semanticConsistencySeries(vecs)`,以首向量为语义基线,返回 `vecs[1..]` 各自对基线的 cosine 序列;向量数 < 2 → 空数组。

#### Scenario: 相对基线 cosine 序列
- **WHEN** vecs=[基线, 同基线, 正交]
- **THEN** 返回 `[1, 0]`

#### Scenario: 不足 2 → 空
- **WHEN** vecs 长 ≤ 1
- **THEN** 返回 `[]`

### Requirement: 语义漂移采集（注入 embedding + 组装）
系统 SHALL 提供组装入口 `computeSemanticDrift(responses, embed?, tau?, k?)`:`embed`（`EmbedFn=(text)=>number[]`,可选注入,不绑定模型）缺省或 responses 不足 2 条 → 返回 `insufficient-data`（无告警,诚实标注待埋点）;否则按 ts 排序、embed 每条 text、算相对基线语义一致性序列、再经 M7-a `driftAlert`（语义一致性**跌破 τ** 连续 k 窗告警）判定。阈值 τ=0.75/k=3 沿用 ASI 框架默认（KB 未给语义专用阈值,待长程标定）。

#### Scenario: 无 embed provider → 待埋点
- **WHEN** 不注入 embed
- **THEN** status='insufficient-data',无告警（不臆造已发生语义漂移）

#### Scenario: 响应不足 → 待埋点
- **WHEN** responses 少于 2 条
- **THEN** status='insufficient-data'

#### Scenario: 渐进语义偏离 → 告警
- **WHEN** 注入 embed,响应向量相对基线一致性连续 k 窗跌破 τ
- **THEN** status='ok',alert.alert=true
