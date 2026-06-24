## 1. driver:ledger 记录投影（纯，TDD）

- [x] 1.1 RED：写 `run-ledger.test.ts`——`runLedgerRecord('job-x', {status:'done',fixRounds:1,sessions:{...}}, 0.57, 'ts')` → `{jobId:'job-x',status:'done',fixRounds:1,costUsd:0.57,ts:'ts'}`(slim,不含 sessions)
- [x] 1.2 RED：escalated result(带 residual/reason)→ 投影仍只 slim 字段
- [x] 1.3 GREEN：实现纯 `runLedgerRecord(jobId, result, costUsd, ts)`(driver `src/run-ledger.ts`)+ 薄 `appendRunLedger(path, record)`(appendFileSync 一行)

## 2. driver:state.json 写点 append ledger（接线）

- [x] 2.1 `inner-loop-runner.ts` line 197 写 state.json 后,append `runLedgerRecord` 到 `join(pipeline,'..','docs','metrics','runs-ledger.jsonl')`(mkdir -p 兜底)
- [x] 2.2 driver gate 全绿(lint+tsc+vitest)

## 3. metrics:读 ledger + 去重（薄 IO，TDD）

- [x] 3.1 RED：`readRunLedger`——逐行 parse、跳畸形行、按 jobId 去重(后写覆盖)、缺文件 []
- [x] 3.2 GREEN：实现薄 `readRunLedger(path): InnerLoopRunRecord[]`(metrics)
- [x] 3.3 `collect.ts`：inner-loop 源由 `readInnerLoopRuns('.runtime/runs')` 换为 `readRunLedger('docs/metrics/runs-ledger.jsonl')`;retire `.runtime/runs` 读取

## 4. 约定 + 验证

- [x] 4.1 `pipeline/guides/agent-conventions.md`：补 runs-ledger 说明(机器 append,持久但不可 git 复现的固有性质,只读勿手编)
- [x] 4.2 metrics gate 全绿
- [x] 4.3 真实验证(非破坏)：构造临时 ledger(含 done×2 + escalated×1，含同 jobId 重复)→ `collect` → innerLoop.total/escalationRate 正确、去重生效;空 ledger → innerLoop 省略

## 5. 收尾（规约同步 + 归档 + 提交）

- [x] 5.1 `openspec validate pipeline-persist-runledger --strict` 通过
- [x] 5.2 更新 `pipeline/README.md` 与 `docs/context/RESUME.md`(M4+ 续切片⑥ 完成、inner-loop 统计已持久、M4+ 闭环收尾)
- [x] 5.3 复盘并入 `docs/plan/M4plus-event-log-retro.md`
- [x] 5.4 创建空 `docs/metrics/runs-ledger.jsonl`(从空起步,带说明头注释? 否——jsonl 不带注释,空文件 + README 说明)
- [x] 5.5 `openspec archive pipeline-persist-runledger` → `git commit` + `push`
