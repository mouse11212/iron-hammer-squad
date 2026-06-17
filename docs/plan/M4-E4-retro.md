# M4 + E4 复盘（pipeline-m4-metrics-trace）

> 日期 2026-06-17。M4=追溯链+看板+四指标采集;E4=抽取为 `pipeline/metrics/`(② 可观测组件)。对应 V4 §7。

## 交付

- `pipeline/metrics/`:harness 四指标纯计算 + 追溯链正反查 + 看板渲染(13 测试全绿) + 真实采集器。
- 真实看板 `docs/metrics/dashboard.md`:TRR 83.3%(归档5/总6)、Code Churn +20871/-6525(182 文件)、Verification Tax 待埋点、Defect Escape 0%(逃逸0/捕获3)、追溯链 5 条。
- 兑现 M0 复盘埋的"为 M4 留接口雏形":散落信号(git/归档/缺陷)系统化成指标+看板。

## 诚实标注的缺口(V4 §7:四指标无标准基线,需产线标定)

- **Verification Tax**:实现耗时未按 change 埋点 → 报"待埋点",不臆造比率。后续可在 driver/内循环加每步耗时埋点补全。
- **Code Churn 是 diff 代理**:统计全 git 历史增删(含 docs/specs,故偏大),非"写后即改"的真 churn。后续可限定 code 文件 / 按时间窗。
- **Defect Escape 数据源**:目前来自手维护 `defects.json`(3 缺陷均合并前捕获)。后续应由 bug 看板/CI 自动喂(待 PM 机制)。

## 关键洞察

- **0% 逃逸率有真实含义**:M2-A 数据安全 bug(评审抓)、M2-A 变异缺口(变异门抓)、M3 claude stdin 挂死(冒烟抓)——3 个真实缺陷**全部合并前被 harness 拦下**。这是 gates+评审+变异门组合有效性的量化证据,不是空指标。
- 延续"纯核心可测 + 薄 IO 采集"模式:四指标/看板/追溯纯函数确定性测试;git/文件采集为薄边界。

## 待完善(→ 后续)

1. 真 PM 看板(迭代/US/task/bug)+ 缺陷自动喂 Defect Escape(M4 仅最小看板)。
2. Verification Tax 埋点(每步耗时)。
3. 看板可由 driver 事件自动刷新(接 ① Loop)。

## 追溯链

spec `pipeline-m4-metrics-trace`(harness-metrics + traceability)→ test(compute/board/trace)→ 实现 → 真实采集 → commit(待提交)。
