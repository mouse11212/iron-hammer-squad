## Why

inner-loop 自主运行统计(总数/升级率/回修轮次分布/成本)是 M4+ 可观测里最后一块仍 ephemeral 的:它从 `.runtime/runs/*/state.json`(gitignored)派生,清空即丢、fresh checkout 无。它**无法走 trailer 持久化**——升级率需要 `blocked-escalated` run,而 escalated/failed run **不产生提交**,git 里无痕迹。唯一出路是机器 append 的持久 ledger。本切片收尾:每个 run 完成时把 slim 统计记录 append 进 committed ledger,metrics 换源到 ledger。

## What Changes

- **driver(append)**:`runInnerLoopJob` 在写 `state.json` 的同一点额外 append 一条 slim 记录到 committed `docs/metrics/runs-ledger.jsonl`:`{jobId, status, fixRounds, costUsd, ts}`(只取统计所需,不含 sessions/residual 噪声)。纯 `runLedgerRecord(jobId, result, costUsd, ts)` 投影 + 薄 `appendRunLedger(path, record)`。**每个 run 都 append**(done/failed/escalated 全捕获——trailer 做不到的)。
- **metrics(换源)**:薄 `readRunLedger(path)` 逐行 parse + **按 jobId 去重(后写覆盖,幂等)**;`collect` 的 inner-loop 源由 `.runtime/runs/*/state.json`(ephemeral)换为 `docs/metrics/runs-ledger.jsonl`(持久);`innerLoopStats`(纯)不变。看板 inner-loop 区现持久。
- **guide**:补 runs-ledger 说明(机器 append,持久但不可 git 复现的固有性质)。

## Capabilities

### New Capabilities
<!-- 无。 -->

### Modified Capabilities
- `inner-loop-orchestration`: 新增 Requirement「持久化 run 统计到 ledger」——每个 run 完成时 append slim 记录到 committed runs-ledger.jsonl。
- `harness-metrics`: 修改「inner-loop 运行聚合」——统计来源由 `.runtime/runs`(ephemeral)换为持久 ledger,按 jobId 去重后聚合。

## Impact

- **新增**:driver `run-ledger.ts`(纯 `runLedgerRecord` + 薄 `appendRunLedger`);metrics `readRunLedger`(薄 IO + 去重)。
- **修改**:driver `inner-loop-runner.ts`(state.json 写点 append ledger);metrics `collect.ts`(inner-loop 换源,retire `.runtime/runs` 读取)。
- **新文件**:`docs/metrics/runs-ledger.jsonl`(committed,机器 append,从空起步)。
- **跨包契约**:ledger 记录 schema(`{jobId,status,fixRounds,costUsd,ts}`)= driver 写、metrics 读,文档化。
- **范围(YAGNI/红线3)**:只 append 统计 slim 记录。**不**回填现有 4 个 `.runtime/runs`(旧 e2e 产物,非真交付);**不**把 VTax/缺陷搬进 ledger(它们已走 trailer 且可复现,优于 ledger)。
- **诚实限制**:ledger **持久但不可从 git 复现**(累积记录,非可推导)——非提交型 run 的固有性质。daemon 跑时 ledger 增长为未提交改动,随切片提交。
