## 1. driver:阶段耗时聚合（纯，TDD）

- [x] 1.1 RED：写 `aggregate-phase-ms.test.ts`——`aggregatePhaseMs(events, 'job-x')` 按 op 分类(dev/test/review/gate/orchestrator-fix)累加 durationMs,只算 traceId 匹配
- [x] 1.2 RED：缺 durationMs 的事件跳过;无匹配 traceId → {}
- [x] 1.3 GREEN：实现纯 `aggregatePhaseMs(events, jobId): Record<string,number>`(driver `src/aggregate-phase-ms.ts`)

## 2. driver:squashMessage 扩展 emit Metrics-Phase-Ms（纯，TDD）

- [x] 2.1 RED：`squashMessage('job-x', 0, {dev:95000,test:113000,gate:12000})` → 含 `Metrics-Phase-Ms: dev=95000 test=113000 gate=12000`、无 Defect-Caught
- [x] 2.2 RED：`squashMessage('job-x', 2, {dev:1})` → Defect-Caught×2 + Metrics-Phase-Ms(顺序/块);`phaseMs` 省略或全零 → 无 Metrics-Phase-Ms 行
- [x] 2.3 GREEN：扩展 `squashMessage(jobId, fixRounds, phaseMs?)`(仅非零项;trailer 块合法)

## 3. driver:runIsolated 接线（注入读取）

- [x] 3.1 `IsolatedDeps` 加 `readPhaseMs?: (jobId)=>Record<string,number>`;squash 前算 phaseMs 传 `squashMessage`
- [x] 3.2 默认实现:读 `join(repoRoot,'pipeline','.runtime','events.jsonl')`(复用 replay 的 readEvents)+ `aggregatePhaseMs`;现有 runIsolated 测试注入假 readPhaseMs(不传=空,trailer 不变)
- [x] 3.3 driver gate 全绿(lint+tsc+vitest)

## 4. metrics:解析 trailer + 换源（纯，TDD）

- [x] 4.1 RED：`parsePhaseMsTrailer('dev=95000 test=113000 gate=12000')` → 还原最小 TaxEvent[](dev/test phase + gate,带 durationMs)
- [x] 4.2 RED：畸形片段(无 `=`、非数字)跳过
- [x] 4.3 GREEN：实现纯 `parsePhaseMsTrailer(desc): TaxEvent[]`(metrics,复用 events-tax 的 TaxEvent 形状)
- [x] 4.4 `collect.ts`：VTax 由 `mineTrailers(repoRoot,'Metrics-Phase-Ms')` → parse → `categorizeDuration`/`taxByTrace`(commit 当 traceId);**不再读 events.jsonl**;无 trailer→null

## 5. 看板 + 约定 + 验证

- [x] 5.1 `board.ts`：VTax 持久语义(去 "ephemeral/实现耗时未采集" runtime 措辞,改"无 done-run 指标 trailer→待埋点");per-US 明细键为 commit
- [x] 5.2 `pipeline/guides/agent-conventions.md`：补 `Metrics-Phase-Ms:` 约定(机器写,原始 op 分类耗时,口径在 metrics)
- [x] 5.3 metrics gate 全绿
- [x] 5.4 真实验证(非破坏)：临时 git repo 造含 `Metrics-Phase-Ms: dev=.. test=..` 的提交 → `collect` → VTax 真值且 per-US 按 commit;无 trailer→null。**可复现实证**:同 repo 重算一致

## 6. 收尾（规约同步 + 归档 + 提交）

- [x] 6.1 `openspec validate pipeline-persist-vtax --strict` 通过
- [x] 6.2 更新 `pipeline/README.md` 与 `docs/context/RESUME.md`(M4+ 续切片⑤ 完成、VTax 已持久可复现)
- [x] 6.3 复盘并入 `docs/plan/M4plus-event-log-retro.md`
- [x] 6.4 `openspec archive pipeline-persist-vtax` → `git commit` + `push`
