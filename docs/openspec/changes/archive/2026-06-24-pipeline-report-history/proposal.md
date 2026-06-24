## Why

`bin-report.ts` 每次 `npm run report` 覆盖 `dashboard.md` → 看板永远只有"此刻"一张快照,**看不到趋势**:Verification Tax 这周比上周降没降、Defect Escape Rate 是否抬头、churn 走向。而趋势正是 ③ Compound/Steering 层("越用越强")判断小队是否变好的输入——没有时间序列就无从判断。本切片把每次(opt-in)归档的指标快照留一份带时间戳的历史,看板渲出趋势。

## What Changes

- 新增 `metrics/src/report-history.ts`:纯 `historySnapshot(snap): HistoryRecord`(从 MetricsSnapshot 投影 slim 趋势记录 `{generatedAt, taskResolutionRate, verificationTax, defectEscapeRate, codeChurnTotal, resolved, attempted}`,不存 traces/taxByTrace 大字段)+ 薄 `appendHistory(path, rec)` + 薄 `readHistory(path): HistoryRecord[]`(逐行 parse、跳畸形、缺文件 [])。
- 新增 CLI `bin-archive.ts`(`npm run report:archive`):`collect → historySnapshot → appendHistory(docs/metrics/history.jsonl)`。**opt-in**:仅此命令追加;普通 `report` 不污染历史。
- `board.ts` `renderBoard(snap, history?)` 加可选 history 参数:非空渲染「指标趋势(最近 N=10 次归档)」表(generatedAt + 四 KPI),空/不传省略。`bin-report` 读 history 传入,让归档在看板可见。

## Capabilities

### New Capabilities
<!-- 无。 -->

### Modified Capabilities
- `harness-metrics`: 新增 Requirement「归档指标快照到历史」「看板渲染指标趋势」——report 快照可 opt-in 追加到持久 history.jsonl,看板渲出最近 N 次趋势。`renderBoard` 加可选 history 参数(既有无 history 调用零变化)。

## Impact

- **新增**:`metrics/src/report-history.ts`(纯 `historySnapshot` + 薄 `appendHistory`/`readHistory`);`metrics/src/bin-archive.ts`(CLI,薄 glue 不单测);`package.json` `report:archive` script。
- **修改**:`board.ts`(renderBoard 加可选 history + 趋势区渲染);`bin-report.ts`(读 history 传入 renderBoard)。
- **新文件**:`docs/metrics/history.jsonl`(committed,机器 append,从空起步)。
- **范围(YAGNI/红线3)**:只做 opt-in 归档命令 + slim 记录 + 最简趋势**表**。**不**每次 report 自动归档;**不**接 daemon 自动采样(留后续);**不**做图表/sparkline;**不**回填。
- **诚实限制**:history **持久但不可从 git 复现**(归档的是过去某时刻算出的值,churn/时间戳随当时仓库状态)——同 runs-ledger 的固有性质。
- **与切片⑥ 区别**:⑥ 存 per-run 原子事实(runs-ledger);本切片存 per-report 聚合快照(history)。互不重复。
