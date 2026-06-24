## ADDED Requirements

### Requirement: 持久化 run 统计到 ledger
系统 SHALL 在每个 inner-loop run 完成(写 per-job state.json)时,额外 append 一条 slim 统计记录到 committed `docs/metrics/runs-ledger.jsonl`(一行一 JSON):`{jobId, status, fixRounds, costUsd, ts}`,只取统计所需字段(不含 sessions/residual)。**所有终态 run 都 append**(done/failed/blocked-escalated),使升级率等需要非提交型 run 的指标可持久——这是 git trailer 无法覆盖的(escalated/failed 不产生提交)。

#### Scenario: done run 落 ledger
- **WHEN** 一个 run 以 `done`、`fixRounds=1`、`costUsd=0.57` 完成
- **THEN** ledger 追加一行 `{jobId, status:'done', fixRounds:1, costUsd:0.57, ts}`

#### Scenario: escalated run 也落 ledger（trailer 做不到）
- **WHEN** 一个 run 以 `blocked-escalated` 终止(不 squash、无提交)
- **THEN** ledger 仍追加一行该 run 记录(status:'blocked-escalated'),其升级信号得以持久

#### Scenario: slim 投影不含噪声
- **WHEN** 投影一个含 sessions/residual/reason 的 InnerLoopResult
- **THEN** ledger 记录只含 `{jobId, status, fixRounds, costUsd, ts}`(不写 sessions/residual,避免账本噪声/churn)
