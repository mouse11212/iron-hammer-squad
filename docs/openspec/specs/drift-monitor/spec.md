# drift-monitor Specification

## Purpose
为 harness 提供 agent drift 监控 sensor（KB ASI 框架,arXiv:2601.04170）：以确定性纯函数从既有日志/ledger 派生 drift 信号、滚动窗口 + 连续 k 窗告警。当前覆盖**工具序列一致性**(M7-a,Levenshtein on op 序列)与**人工干预率**(M7-b,HIR=blocked-escalated 率时间窗趋势)。诚实约束：未做长程任务测试前无真实 drift 数据,数据不足一律返回 insufficient-data,不臆造已发生 drift;阈值(τ/θ/k)用 KB 默认或保守占位待长程标定。语义相似度(需 embedding)/共识协调(需多 agent)/复合 ASI/缓解/拓扑排后。
## Requirements
### Requirement: op 序列提取（纯）
系统 SHALL 提供纯函数 `opSequence(events, traceId)`,从事件列表取指定 traceId(一个 US)的操作序列:按 `ts` 升序,每事件映射为 token(`op==='phase'` → `phase:<phase>`,否则 op),返回 token 字符串数组。无匹配 traceId → 空数组。

#### Scenario: 取一个 US 的 op 序列
- **WHEN** 传入含 traceId='u1' 的 phase:test→gate→phase:dev→gate→phase:review 事件(ts 乱序)
- **THEN** 返回按 ts 排序的 `['phase:test','gate','phase:dev','gate','phase:review']`

#### Scenario: 无匹配 → 空
- **WHEN** 无该 traceId 事件
- **THEN** 返回 `[]`

### Requirement: 序列一致性（Levenshtein，纯）
系统 SHALL 提供纯函数 `levenshtein(a, b)`(token 数组编辑距离)与 `seqConsistency(a, b)`(归一化一致性 `1 - dist/max(len)`,值域 [0,1],1=完全一致;两空序列=1;一空一非空=0)。

#### Scenario: 完全一致 → 1
- **WHEN** 两序列相同
- **THEN** seqConsistency=1(dist=0)

#### Scenario: 部分差异 → (0,1)
- **WHEN** 序列有 1 处 token 不同(长 4)
- **THEN** seqConsistency = 1 - 1/4 = 0.75

#### Scenario: 双空 → 1;一空一非空 → 0
- **WHEN** 两空序列 / 一空一长度 3
- **THEN** 分别为 1 / 0

### Requirement: 滚动窗口漂移告警（纯）
系统 SHALL 提供纯函数 `driftAlert(series, tau, k)`,对一致性序列,当存在**连续 k 个**值 < tau 时 `alert=true`(KB「τ=0.75 连续三窗触发」),并报告首次触发位置;否则 `alert=false`。空/不足 k 个 → 不告警(数据不足,不臆造)。

#### Scenario: 连续 k 个低于 τ → 告警
- **WHEN** series=[0.9,0.7,0.6,0.5],tau=0.75,k=3
- **THEN** alert=true(0.7/0.6/0.5 连续三个 < 0.75),报告触发起始位置

#### Scenario: 未连续 k 个 → 不告警
- **WHEN** series=[0.6,0.9,0.6,0.9],tau=0.75,k=3
- **THEN** alert=false(无连续三个 < τ)

#### Scenario: 数据不足 → 不告警(不臆造)
- **WHEN** series 长度 < k(如长 2,k=3)
- **THEN** alert=false

### Requirement: 从事件采集漂移信号（薄 IO + 组装）
系统 SHALL 提供从 `events.jsonl` 读事件、按 US(traceId)分组取 op 序列、对各序列相对基线(参考序列)算一致性序列、再经 `driftAlert` 判定的组装入口;缺文件/事件不足时返回"数据不足/待长程",不臆造已发生 drift。

#### Scenario: 无 events → 待数据
- **WHEN** events.jsonl 不存在或事件不足
- **THEN** 返回数据不足态(无告警),诚实标注待长程数据

### Requirement: 人工干预率（HIR，纯）
系统 SHALL 提供纯函数 `hir(runs)`,对 run 记录列表(每条 `{ts, status}`)计算人工干预率 = `status==='blocked-escalated'`(红线6 显式升级人类)的条数 / 总条数;总条数为 0 → 返回 `null`(不臆造,同 `avgCostUsd`)。定义对齐既有 `InnerLoopStats.escalationRate`(单一真相)。

#### Scenario: 有干预 → 比例
- **WHEN** runs 含 4 条,其中 1 条 status='blocked-escalated'
- **THEN** hir = 0.25

#### Scenario: 无 run → null（不臆造）
- **WHEN** runs 为空
- **THEN** hir = null

### Requirement: HIR 时间窗序列（纯）
系统 SHALL 提供纯函数 `hirSeries(runs, windowSize)`,按 `ts` 升序排序后切成**不重叠(tumbling)**窗,每个**满窗**计算 HIR,返回 number[];不足一窗的尾部丢弃。这是给 HIR 加时间维度、使其可测 drift 趋势的基础(既有 escalationRate 是无时间维的标量,无法测 drift)。

#### Scenario: 切满窗算 HIR 序列
- **WHEN** 6 条 run(ts 升序),windowSize=3,前 3 条 0 干预、后 3 条全干预
- **THEN** 返回 `[0, 1]`(两个满窗)

#### Scenario: 不足一窗 → 空
- **WHEN** runs 条数 < windowSize
- **THEN** 返回 `[]`

### Requirement: 上升漂移告警（纯）
系统 SHALL 提供纯函数 `risingAlert(series, theta, k)`,对 HIR 窗口序列,当存在**连续 k 个**值 ≥ theta 时 `alert=true` 并报告首次触发位置;否则 `alert=false`。空/不足 k 个 → 不告警(数据不足,不臆造)。此为 M7-a `driftAlert`「跌破 τ」的上升方向镜像(HIR 升过 θ = drift);k 用 KB「连续三窗」,theta 因 KB 未给 HIR 绝对阈值而为保守占位待长程标定。

#### Scenario: 连续 k 个升过 θ → 告警
- **WHEN** series=[0.1,0.5,0.6,0.7],theta=0.5,k=3
- **THEN** alert=true(0.5/0.6/0.7 连续三个 ≥ 0.5),报告触发起始位置

#### Scenario: 未连续 k 个 → 不告警
- **WHEN** series=[0.6,0.1,0.6,0.1],theta=0.5,k=3
- **THEN** alert=false

#### Scenario: 数据不足 → 不告警（不臆造）
- **WHEN** series 长度 < k
- **THEN** alert=false

### Requirement: 从 ledger 采集 HIR 信号（薄 IO + 组装）
系统 SHALL 提供薄 IO `readHirRuns(path)`,从 `runs-ledger.jsonl` 逐行 parse、**保 ts**(窗口排序需要)+ 按 jobId 去重(后写覆盖,对齐 escalationRate 幂等语义)、跳畸形/缺字段行、缺文件返回 `[]`;并提供组装入口 `computeHir(runs, windowSize, theta, k)`,算 HIR 总率与时间窗序列、再经 `risingAlert` 判趋势;runs 不足一窗时返回 `insufficient-data`(无告警),诚实标注待长程数据,不臆造已发生的干预上升。
> 注:既有 `readRunLedger` 投影丢了 ts,无法做时间窗,故 HIR 用专用 reader(同 M7-a `readDriftEvents` 保 ts)。

#### Scenario: 缺文件 → 空
- **WHEN** runs-ledger.jsonl 不存在
- **THEN** `readHirRuns` 返回 `[]`(不抛,不臆造)

#### Scenario: 同 jobId 去重
- **WHEN** 同一 jobId 两行(failed 后 blocked-escalated)
- **THEN** 只留最新一条(blocked-escalated)

#### Scenario: 渐升干预 → 告警
- **WHEN** 足量 run,HIR 窗口序列连续 k 窗 ≥ θ
- **THEN** status='ok',alert.alert=true

#### Scenario: 数据不足 → 待数据
- **WHEN** runs 条数 < windowSize（如当前空 ledger）
- **THEN** status='insufficient-data',无告警

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

