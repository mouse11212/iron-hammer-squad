# 铁锤小队 · Harness 看板

> 生成于 2026-06-22T03:33:09.083Z · 四指标基线无标准值，需产线标定(V4 §7)

## harness 四指标

| 指标 | 值 | 说明 |
|---|---|---|
| Task Resolution Rate | 100.0% | 已解决 8 / 尝试 8 |
| Code Churn | +31730 / -6815（302 文件） | diff 代理 |
| Verification Tax | 待埋点(实现耗时未采集) | 验证耗时 —ms |
| Defect Escape Rate | 0.0% | 逃逸 0 / 总 3 |

## 追溯链（change → spec → tests → commit）

| change | spec | tests | commit |
|---|---|---|---|
| fincards-m0-bloomberg-cards | news-fetch/parse/filter-today/card-render | parse.test.ts, filterToday.test.ts, render.test.ts | adbac4a |
| fincards-m1-mutation-gate | mutation-gate | stryker mutation | 1504b19 |
| fincards-m2a-multisource-aggregate | news-aggregate | aggregate.test.ts | 8606f79 |
| fincards-m2-crosspublisher | news-parse (MODIFIED, 按源归属) | parse.test.ts (归源) | 393d7c4 |
| pipeline-m3-event-driver | event-driver | state.test.ts, run-once.test.ts | 7d30216 |

## inner-loop 自主运行（① Loop）

| 指标 | 值 |
|---|---|
| 总运行 | 4 |
| 状态 | done 4 / failed 0 / blocked-escalated 0 |
| 升级率 | 0.0% |
| 回修轮次分布 | 0:2, 1:2 |
| 成本 | 总 $5.1475 / 均 $1.2869 |
