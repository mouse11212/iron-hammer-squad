## Why

M0–M3 把可观测信号散落各处(run-state、gate 结果、变异分数、git、OpenSpec 归档、复盘)。M4/E4 把它们**系统化采集**成 harness 四指标 + 追溯链 + 看板——兑现 V4 §7"可观测/可度量",也是 M0 复盘埋的"为 M4 留接口雏形"。

## What Changes

- 新增 `pipeline/metrics/`(Node+TS):**四指标纯计算 + 追溯链 + 看板渲染 + 采集器**。
- **harness 四指标**(V4 §7 / KB how-to-build-high-quality-harness):
  - **Task Resolution Rate** = 已解决单元 / 尝试单元(用 OpenSpec 归档/活跃 change 数)。
  - **Code Churn**(diff 代理)= git numstat 增删行汇总。
  - **Verification Tax** = 验证耗时 / (验证+实现)耗时(验证耗时可测;实现耗时**待埋点**,先报可得部分)。
  - **Defect Escape Rate** = 逃逸(合并后才发现)/ 总缺陷(从 defects 记录)。
- **追溯链**:结构化 TraceLink(changeId → spec → tests → commit),可回放/正反查。
- **看板**:从快照渲染 markdown dashboard(指标 + 追溯链 + 缺陷)。
- 在**真实仓库**上采集并输出 `docs/metrics/dashboard.md`。

## Capabilities

### New Capabilities
- `harness-metrics`: 采集并计算 harness 四指标,渲染看板。
- `traceability`: 维护 spec→test→commit 双向追溯链记录,可回放。

## Impact

- 新增 `pipeline/metrics/`(自带 gate,复用项目约定);纯计算/渲染可测,采集 IO 为薄边界。
- 诚实标注:四指标**无标准基线、需产线标定**(V4 §7);Verification Tax 的实现耗时、Defect Escape 的缺陷来源**部分待埋点**,先报可得、缺口显式标注。
- E4 抽取:metrics 即 ② 可观测组件,纳入 `pipeline/`。
