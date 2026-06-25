## ADDED Requirements

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
