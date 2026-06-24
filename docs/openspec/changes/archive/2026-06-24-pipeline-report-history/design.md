## Context

`bin-report.ts:16` 每次覆盖 `dashboard.md` → 只有"此刻"快照,无趋势。③ Compound 层判断"小队是否越用越强"需时间序列。本切片归档每次(opt-in)快照,看板渲趋势。与 `runs-ledger.jsonl`(切片⑥)同构:append-only JSONL、机器写、持久不可复现。

## Goals / Non-Goals

**Goals:**
- 每次 opt-in 归档留一份带时间戳的 slim 快照,看板渲最近 N 次趋势。
- 沿用纯 + 薄 IO 分层;opt-in 触发避免污染(普通 report 不追加)。

**Non-Goals:**
- 不每次 report 自动归档;不接 daemon 自动采样(留后续);不做图表/sparkline(只表);不回填。
- 不改四指标算法、不改既有 renderBoard 无 history 调用的行为。

## Decisions

**D1:opt-in 单独命令(用户确认)。**
- `bin-archive.ts`(`npm run report:archive`)才 append;`npm run report` 只重生看板(读 history 渲趋势,但不写)。避免随手 regen 凑重复行 + dev 期跳测污染。归档=刻意里程碑采样。

**D2:slim 投影,只存趋势 KPI。**
- 纯 `historySnapshot(snap): HistoryRecord` = `{generatedAt, taskResolutionRate, verificationTax, defectEscapeRate, codeChurnTotal, resolved, attempted}`。丢 traces/taxByTrace/innerLoop 大字段(趋势不需,避免账本膨胀)。保留 null KPI(不臆造)。

**D3:位置 = `docs/metrics/history.jsonl`(committed,中立)。**
- 与 dashboard.md / runs-ledger.jsonl 同处。append-only;机器写。

**D4:renderBoard 加可选 history 参数,取末 N=10。**
- `renderBoard(snap, history?)`:history 非空渲「指标趋势(最近 N)」表(取 `slice(-10)`),空/不传省略。**向后兼容**:既有 board.test 不传 history → 零变化。bin-report 读 history 传入。
- N=10:看板不无限长;history.jsonl 留全量,N 只截显示。

## Risks / Trade-offs

- [history 持久但不可 git 复现] → 同 ledger 固有性质(归档过去某时刻的值);proposal/guide 标注。
- [opt-in → 采样稀疏(靠人记得跑)] → 接受;趋势是里程碑级,稀疏可用;daemon 自动采样留后续。
- [renderBoard 签名加参数破坏既有调用] → 设为可选(`history?`),既有调用零改;只 bin-report 传入。
- [history 行随仓库增长(churn 递增)] → 趋势本就反映累积态;codeChurnTotal 是历史总量,趋势看增量靠相邻行差(渲染层不算,留读者)。

## Open Questions

- 无(opt-in、slim、N=10 均经 brainstorm 与用户确认)。
