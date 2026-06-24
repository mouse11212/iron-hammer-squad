## Context

inner-loop 统计(升级率/成本/回修分布)是 M4+ 最后一块 ephemeral:从 `.runtime/runs/*/state.json`(gitignored)派生。它**无法走 trailer**——升级率需 `blocked-escalated` run,而 escalated/failed run 不产生提交,git 无痕。唯一出路=机器 append 的持久 ledger。

已确认:`runInnerLoopJob` 在 line 195-197 写 `state.json`(`record={jobId,...result,costUsd}`)——每个终态 run(done/failed/escalated)的单点落盘,主进程、字段齐全。ledger 的天然 append 点。

## Goals / Non-Goals

**Goals:**
- inner-loop 统计持久(survive `.runtime` clear),含 escalated/failed run。
- 单点 append(state.json 写点),覆盖所有终态 run。
- metrics 换源到 ledger,`innerLoopStats`(纯)不变;按 jobId 去重幂等。

**Non-Goals:**
- 不追求 git 可复现(ledger 是累积记录,非提交型 run 无 git 痕迹的固有性质)。
- 不回填现有 `.runtime/runs`(旧 e2e,非真交付)→ ledger 从空起步。
- 不把 VTax/缺陷搬进 ledger(已走 trailer 且可复现,优于 ledger)。
- 不改 `innerLoopStats` 算法。

## Decisions

**D1:append 点 = state.json 写点(runInnerLoopJob)。**
- 在 line 197 写 state.json 后,append slim 记录到 ledger。此点是所有终态 run 的单一汇合(done/failed/escalated 都经此),覆盖最全。
- *备选*:`drainBatchIsolated`(批后)——但单 job dispatch 路径不经它,漏 run;state.json 写点最全,弃备选。

**D2:slim 投影,不含噪声。**
- 纯 `runLedgerRecord(jobId, result, costUsd, ts): {jobId,status,fixRounds,costUsd,ts}`——只取统计字段,丢 sessions/residual/reason(避免账本 churn/噪声)。薄 `appendRunLedger(path, record)` = appendFileSync 一行 JSON。

**D3:ledger 位置 = `docs/metrics/runs-ledger.jsonl`(committed,中立)。**
- 与 dashboard.md 同处,driver 写 / metrics 读的中立共享路径(均已触 docs/metrics)。非 `.runtime`(那 gitignored 不持久)、非 metrics/data(driver 伸进 metrics 包)。

**D4:metrics 按 jobId 去重(后写覆盖,幂等)。**
- 薄 `readRunLedger(path)`:逐行 parse(跳畸形)、按 jobId 存 Map(后写覆盖)→ values。幂等:同 jobId 重跑/重试取最新,report 多次不重复计数。
- collect inner-loop 源 `.runtime/runs` → ledger;retire `readInnerLoopRuns`(`.runtime`)。

## Risks / Trade-offs

- [ledger 持久但不可 git 复现] → 固有性质(非提交型 run),已在 proposal/guide 诚实标注;这是为覆盖 escalated 必付的代价,trailer 给不了。
- [daemon 跑时 ledger 增长为未提交改动] → 机器账本常态;随切片提交。append-only 在主仓、不进 worktree、不被 squash 动态 changedPaths 捕获(ledger 在 docs/ 非 projectDir)。
- [append 与并行 run 竞争同一 ledger 文件] → appendFileSync 行级原子(POSIX O_APPEND);每 run 一行独立,无交错损坏。
- [同 jobId 多条] → D4 去重(后写覆盖)解决幂等。

## Open Questions

- 无(机制、位置、去重、reproducibility trade-off 均经 brainstorm 与用户确认)。
