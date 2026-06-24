## Context

续切片③ 把 caught 从 inner-loop runtime(`.runtime/runs`,ephemeral)派生、escaped 从 git trailer(持久)挖采——时间口径不对称,率失真。本切片根治:driver 在 squash 提交 emit `Defect-Caught:` trailer,metrics caught 换源为 git trailer,两侧同口径持久。

已确认(实证):`inner-loop-runner.ts:237` 在 `result.status==='done'` 分支构建 squash 消息 `feat(<jobId>): inner-loop 交付`,`result.fixRounds` 在作用域内——天然 emit 点。只 done run 走 squash。

## Goals / Non-Goals

**Goals:**
- caught 持久进 git(随 squash 提交),与 escaped 同口径、同 `git log` 挖采源 → Defect Escape Rate 完全可比,根治不对称。
- 复用对称:caught/escaped 都是 trailer → metrics 一个通用 `mineTrailers(repoRoot, key)`,deriveDefects 两侧每行一记录。
- 沿用纯函数 + 薄 IO 分层;driver 的消息构建抽成纯 `squashMessage` 可测。

**Non-Goals:**
- 不持久 escalated-run caught(无提交可挂)。
- 不回溯历史已合并 done run 补 trailer。
- 不改 `defectEscapeRate` 算法(null 语义不变)、不改 escaped 侧行为。

## Decisions

**D1:trailer 格式 = 一行一回修轮(非整数计数)。**
- done run fixRounds=N → N 行 `Defect-Caught: inner-loop 回修轮 <k>`(k=1..N)。
- *理由*:与 `Defect-Escaped:`(人写,一行一缺陷)对称 → metrics 一个通用挖采器、deriveDefects 统一"每行一记录",无需为 caught 写整数求和分支。fixRounds 极少 >2,行数可控。
- *备选*:`Defect-Caught: <n>` 整数计数(1 行)——省行但解析非对称(求和 vs 数行),弃。

**D2:driver 消息构建抽纯函数。**
- `squashMessage(jobId: string, fixRounds: number): string`:基础标题 + (fixRounds>0 ? `\n\n` + N 行 trailer : '')。纯、可穷尽单测。`inner-loop-runner.ts` squash 调用用它替换字面量。
- trailer 块在消息末尾、连续 `Key: value` 行=合法 git trailer。

**D3:metrics 换源 + 通用挖采。**
- 薄 IO `mineTrailers(repoRoot, key): {commit, desc}[]`——`git log --format=%H%x1f%B%x1e` 扫 `<key>: <value>` 行(复用切片③ readEscapeTrailers 的解析,泛化 key)。`readEscapeTrailers` = `mineTrailers(repoRoot, 'Defect-Escaped')` 薄封装;caught = `mineTrailers(repoRoot, 'Defect-Caught')`。
- 纯 `deriveDefects(caught: Trailer[], escapes: Trailer[]): DefectRecord[]`——两侧每行一记录(caught where='caught'、escaped where='escaped')。
- `collect.ts`:caught 由 `deriveDefects(mineTrailers(repoRoot,'Defect-Caught'), readEscapeTrailers(repoRoot))`;去掉 run 派生 caught 与 residualCount 读取。

**D4:回退切片③ 的 runtime caught。**
- `types.ts` 移除 `InnerLoopRunRecord.residualCount`(仅切片③ caught 用,现废)。`collect.ts` readInnerLoopRuns 去掉 residual 读取。runs 仍为 innerLoopStats 读取(不动)。

## Risks / Trade-offs

- [escalated-run caught 无提交→不持久] → 已知边界;escalated 本就升级人类处理,标注限制,留后续(如人解决时手打 trailer)。
- [历史已合并 done run 无 trailer→caught 不可重建] → 接受;此后每次 done 自动持久,逐步积累。同切片② 早期 change tests 退化的同类诚实限制。
- [trailer 与 squash 动态 changedPaths 机制交互] → squashMessage 只改消息字符串,不碰 `git add`/动态捕获逻辑,正交无耦合。
- [N 行重复 trailer 观感] → fixRounds 极少 >2;带轮次索引 `回修轮 k` 可读、非纯重复。

## Open Questions

- 无(格式、换源、回退范围均经 brainstorm 与用户确认)。
