## Why

续切片③(Defect 自动喂)落地了 caught 派生,但 caught 源是 inner-loop 运行时(`.runtime/runs`,**ephemeral**),escaped 源是 git trailer(**持久**)——两者时间口径不对称,fresh checkout 极端下 Defect Escape Rate 失真(caught=0+历史 escaped>0→100%)。本切片根治:让 driver 在 squash 提交里 emit `Defect-Caught:` trailer,metrics 把 caught 来源**从 runtime runs 换为 git trailer 挖采**——caught+escaped 同口径、同持久,率彻底可比。

## What Changes

- **driver(emit)**:新纯函数 `squashMessage(jobId, fixRounds)`——基础 `feat(<jobId>): inner-loop 交付`,`fixRounds>0` 时追加 N 行 trailer `Defect-Caught: inner-loop 回修轮 <k>`(每个回修轮一行=评审/门抓到的一处缺陷)。`inner-loop-runner.ts` 的 squash 调用用它替换字面量。**只 done run 走 squash → 只持久化 done-run caught**;escalated 无提交可挂(不持久,标注限制)。
- **metrics(换源)**:新通用薄 IO `mineTrailers(repoRoot, key)`(`git log` 挖某 key 的 trailer 行);`readEscapeTrailers` 重构为其薄封装,新增 caught 挖采。`deriveDefects` 的 **caught 源 runtime runs → git `Defect-Caught:` trailer**,签名变 `deriveDefects(caughtTrailers, escapeTrailers)`(两侧对称,每行一记录)。
- **回退切片③ 的 runtime caught**:`collect.ts` 去掉 run 派生 caught;`types.ts` 移除 `InnerLoopRunRecord.residualCount`(被本切片取代)。caught+escaped 同 git 源 → 口径彻底对齐,率完全可比。`defectEscapeRate` null 语义不变。
- **guide**:`agent-conventions.md` 补 `Defect-Caught:` 约定(**机器写**,人勿手动打——与 `Defect-Escaped:` 人写区分)。

## Capabilities

### New Capabilities
<!-- 无。 -->

### Modified Capabilities
- `inner-loop-orchestration`: 新增 Requirement「squash 提交持久化 caught 缺陷」——done run squash 时据 fixRounds emit `Defect-Caught:` trailer。
- `harness-metrics`: 修改「自动喂缺陷记录」——caught 来源由 inner-loop runtime run 改为 git `Defect-Caught:` trailer 挖采(与 escaped 同口径持久);新增通用 trailer 挖采。

## Impact

- **新增**:driver `squashMessage` 纯函数 + 测试;metrics `mineTrailers` 通用挖采。
- **修改**:driver `inner-loop-runner.ts`(squash 消息);metrics `defects-feed.ts`(caught 换源 + mineTrailers)、`collect.ts`(去 runtime caught)、`types.ts`(移除 residualCount)、测试。
- **跨包契约**:driver 写 `Defect-Caught:` trailer 格式 = metrics 挖采契约(约定写进 guide + 两侧 spec)。
- **范围(YAGNI/红线3)**:只持久化 done-run caught。**不**做 escalated-run caught 持久(无提交);**不**回溯历史已合并 done run 补 trailer。
- **诚实限制**:escalated caught 不持久;本切片前的历史 done run 无 trailer→caught 不可重建,此后每次 done 自动持久。
