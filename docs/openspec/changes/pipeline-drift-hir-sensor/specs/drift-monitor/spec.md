## ADDED Requirements

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
