## Why

Verification Tax 是 M4+ 四指标里仍 ephemeral 的一个:它从 `<pipeline>/.runtime/events.jsonl`(gitignored)的 durationMs 派生,清空 `.runtime` 即归"待埋点",fresh checkout 不可复现。续切片④ 已证明"caught 走 squash trailer 持久化"可行;本切片把 VTax 纳入同一持久化机制:done run squash 时把各阶段耗时打成 trailer,metrics 换源到 git 挖采——VTax 既持久又可从 git 复现,收尾 M4+ 可观测闭环主体。

## What Changes

- **driver(emit 原始事实)**:新纯 `aggregatePhaseMs(events, jobId)`——过滤 `traceId=jobId`、按 op 分类(dev/test/review/gate/orchestrator-fix)累加 `durationMs`,**不应用 impl/verif 口径**(口径归 metrics)。`squashMessage(jobId, fixRounds, phaseMs?)` 扩展追加一行 `Metrics-Phase-Ms: dev=.. test=.. review=.. gate=.. orchestrator-fix=..`(仅非零项)。`runIsolated` squash 前读中心 events.jsonl(经注入 dep 便于测)聚合并传入。**只 done run 走 squash → 只 done-run VTax 持久**(同 Defect-Caught 边界)。
- **metrics(换源到 trailer)**:复用 `mineTrailers(repoRoot,'Metrics-Phase-Ms')` 挖采;纯 `parsePhaseMsTrailer(desc)` → `{cat:ms}` → **还原最小 TaxEvent[] → 复用既有 `categorizeDuration`/`taxByTrace`**(D1 口径仍只活 metrics 一处)。`collect.ts` VTax 源由 events.jsonl 换为 git trailer;per-US 以 commit 短 hash 为键。
- **board**:VTax 持久语义(无 done-run trailer 时仍"待埋点",不再标注 ephemeral runtime)。

## Capabilities

### New Capabilities
<!-- 无。 -->

### Modified Capabilities
- `inner-loop-orchestration`: 修改「squash 提交持久化 caught」——squash 消息除 `Defect-Caught:` 外,据本 run 各阶段耗时追加 `Metrics-Phase-Ms:` trailer(原始 op 分类耗时)。
- `harness-metrics`: 修改「从事件流派生 Verification Tax 输入」「采集时接入真实 Verification Tax」——VTax 来源由 `.runtime/events.jsonl`(ephemeral)换为 git `Metrics-Phase-Ms:` trailer 挖采(持久、可复现);口径(categorizeDuration)复用不变。

## Impact

- **新增**:driver `aggregatePhaseMs`(纯)+ events 读取;metrics `parsePhaseMsTrailer`(纯)。
- **修改**:driver `squash-message.ts`(加 phaseMs 参数 + trailer)、`inner-loop-runner.ts`(读 events 聚合传入);metrics `collect.ts`(VTax 换源)、`board.ts`、`events-tax.ts`(复用 categorize,collect 不再读 events.jsonl)、测试。
- **跨包契约**:`Metrics-Phase-Ms:` trailer 格式(纯 `cat=ms` 机械数据,**不含口径语义**)= metrics 挖采契约,写进 guide + 两侧 spec。
- **范围(YAGNI/红线3)**:只持久化 done-run VTax。**不**做 escalated/failed run 的指标持久(无提交);**不**持久 inner-loop 升级率/成本(需 ledger 类机制,另立);**不**回溯历史已合并 done run。
- **诚实限制**:escalated VTax 不持久;历史 done run 无 trailer→不可重建,此后每 done 自动持久;per-US 键为 commit hash(非 jobId)。
