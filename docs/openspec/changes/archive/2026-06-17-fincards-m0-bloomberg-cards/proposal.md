## Why

铁锤小队需要把 V4 构思从纸面变成可运行的 harness——但必须从最小垂直切片起步（V4 §13），先用一个真实但极薄的产品切片跑通"内循环管道"（规约→test-first→TDD→确定性 gate→合并），把误差拦在累积放大之前。fincards 产品的第一片正是这个验证载体。

## What Changes

- 新建产品 `iron-hammer-output/fincards/`（Node + TypeScript，strict）。
- 从 Bloomberg 官方 RSS（`feeds.bloomberg.com/markets/news.rss`，实测可用、返回当天条目）拉取今天的财经新闻。
- 解析为结构化 `NewsItem`，筛出"今天"的条目，渲染成卡片 HTML 文件 `dist/index.html`（本地浏览器可看）。
- 卡片仅展示 标题 + 官方摘要 + 时间 + 原文链接（跳回 bloomberg.com，**不抓 HTML 正文、不镜像全文**，合规）。
- 建立确定性 gate：ESLint + `tsc --noEmit` + vitest 单测，全绿方可合并。
- 输出一行轻量 run log（抓取条数 / 筛今天后条数 / 输出路径 / 耗时ms / 成功失败）作为 M0 最小可观测。
- **不做（留给后续里程碑）**：Top10/20 排序选取、LLM 摘要、多 RSS 源、定时调度、服务器/前端框架、gstack /qa 浏览器测试、完整观测/度量与看板（M4/M7）。

## Capabilities

### New Capabilities
- `news-fetch`: 从 Bloomberg 官方 RSS 拉取原始 feed（薄 IO 边界，隔离网络非确定性）。
- `news-parse`: 把 RSS XML 解析为结构化 `NewsItem[]`（纯函数）。
- `news-filter-today`: 按给定"今天"日期筛选当天条目（纯函数）。
- `news-card-render`: 把 `NewsItem[]` 渲染为卡片 HTML 页面（纯函数）。

### Modified Capabilities
<!-- 无：这是首个 change，openspec/specs/ 当前为空。 -->

## Impact

- 新增代码目录 `iron-hammer-output/fincards/`（源码、测试、fixtures、dist 产物）。
- 新增运行时依赖：RSS/XML 解析库（如 fast-xml-parser）；开发依赖：typescript、vitest、eslint。
- 外部依赖：Bloomberg 官方 RSS 端点（只读公开 feed）。
- 确立 harness 内循环纪律的第一份可执行规约与确定性 gate，作为后续里程碑（M1+）的基线。
