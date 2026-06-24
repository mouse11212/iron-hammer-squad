## ADDED Requirements

### Requirement: inner-loop 运行统计来自持久 ledger
系统 SHALL 在采集快照时从持久 `docs/metrics/runs-ledger.jsonl`(机器 append 的 run 记录)读取 inner-loop 运行,**按 jobId 去重(后写记录覆盖,幂等)** 后经 `innerLoopStats` 聚合(总数/状态分布/升级率/回修轮次分布/成本)填充 `MetricsSnapshot.innerLoop`;替代从 ephemeral `.runtime/runs/*/state.json` 读取。无 ledger 或空 → `innerLoop` 省略(看板不渲染该区,不臆造)。

#### Scenario: 从 ledger 聚合
- **WHEN** ledger 含 3 条 run 记录(2 done、1 blocked-escalated)
- **THEN** 快照 innerLoop.total=3、byStatus 正确、escalationRate=1/3

#### Scenario: 按 jobId 去重(幂等)
- **WHEN** ledger 含同 jobId 两条(先 failed 后 done,重试覆盖)
- **THEN** 该 jobId 只计最新一条(done),不重复计数

#### Scenario: 空 ledger → 省略 inner-loop 区
- **WHEN** ledger 不存在或为空
- **THEN** 快照 innerLoop 为 undefined,看板省略 inner-loop 区(不臆造)

### Requirement: 读取 run ledger（薄 IO + 去重）
系统 SHALL 提供薄 IO 函数,逐行 parse `runs-ledger.jsonl`(跳畸形行),按 jobId 去重保留最后一条,返回 `InnerLoopRunRecord[]`;缺文件返回 `[]`(不抛、不臆造)。

#### Scenario: 跳畸形行
- **WHEN** ledger 含一行畸形 JSON 与两行合法记录
- **THEN** 返回 2 条合法记录(畸形行跳过)
