# 铁锤小队 · Harness 看板

> 生成于 2026-06-24T06:41:47.414Z · 四指标基线无标准值，需产线标定(V4 §7)

## harness 四指标

| 指标 | 值 | 说明 |
|---|---|---|
| Task Resolution Rate | 100.0% | 已解决 22 / 尝试 22 |
| Code Churn | +37365 / -7225（518 文件） | diff 代理 |
| Verification Tax | 待埋点(无 done-run 指标 trailer) | 验证 —ms / 实现 —ms |
| Defect Escape Rate | 待埋点(无缺陷记录) | 逃逸 0 / 拦截 0（均 git trailer） |

## 追溯链（change → spec → tests → commit）

| change | spec | tests | commit |
|---|---|---|---|
| fincards-m0-bloomberg-cards | news-card-render/news-fetch/news-filter-today/news-parse |  | eac24ab |
| fincards-m1-mutation-gate | mutation-gate |  | 8e4cf7a |
| fincards-m2-crosspublisher | news-parse | parse.test.ts | 393d7c4 |
| fincards-m2a-multisource-aggregate | news-aggregate | aggregate.test.ts | 8606f79 |
| pipeline-m3-event-driver | event-driver | run-once.test.ts, state.test.ts | 7d30216 |
| pipeline-m4-metrics-trace | harness-metrics/traceability | board.test.ts, compute.test.ts | 937a078 |
| pipeline-driver-inner-loop | inner-loop-orchestration | gates.test.ts, inner-loop.test.ts, verdict.test.ts | 34f44aa |
| pipeline-m5a-parallel-queue | concurrent-queue | drive-parallel.test.ts, mcp-server.test.ts, queue-concurrency.test.ts, queue-sqlite.test.ts | 7f1711e |
| pipeline-batch-integration | worktree-integration | batch-integration.test.ts, isolated.test.ts | 0db4fa4 |
| pipeline-cross-batch-accum | worktree-integration | batch-integration.test.ts | 82b8023 |
| pipeline-daemon-batch | worktree-integration | batch-drain.test.ts, daemon.test.ts, isolated.test.ts | ce03844 |
| pipeline-hitl-handoff | worktree-integration | batch-drain.test.ts, handoff.test.ts | 6da705d |
| pipeline-m5b-worktree-integration | worktree-integration | isolated.test.ts, worktree.test.ts | 2b98295 |
| pipeline-multiproject-batch | worktree-integration | batch-drain.test.ts, batch-integration.test.ts | 206d9d0 |
| pipeline-transient-retry | inner-loop-orchestration | inner-loop-runner.test.ts, phase-invoke.test.ts | d3b5181 |
| pipeline-dynamic-squash-orchestrator-fix | inner-loop-orchestration/worktree-integration | gates.test.ts | e9dc6fc |
| pipeline-unified-event-log | observability-events | events-integration.test.ts, events.test.ts, instrument.test.ts, replay.test.ts | c433e68 |
| pipeline-verification-tax | harness-metrics | board.test.ts, events-tax.test.ts | 93b57cc |
| pipeline-defect-feed | harness-metrics | board.test.ts, compute.test.ts, defects-feed.test.ts | 1a7c6c2 |
| pipeline-persist-caught | harness-metrics/inner-loop-orchestration | board.test.ts, defects-feed.test.ts, squash-message.test.ts | ce71288 |
| pipeline-trace-weaving | harness-metrics | weave-traces.test.ts | a3b973a |
