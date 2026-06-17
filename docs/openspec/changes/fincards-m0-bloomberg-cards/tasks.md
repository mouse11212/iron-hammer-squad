## 1. 项目脚手架

- [x] 1.1 在 `iron-hammer-output/fincards/` 初始化 Node+TS 项目（package.json、tsconfig strict、ESLint、vitest 配置）
- [x] 1.2 安装依赖：fast-xml-parser（运行时）；typescript、vitest、eslint 及其 TS 插件（开发）
- [x] 1.3 配置 npm scripts：`test`(vitest)、`lint`(eslint)、`typecheck`(tsc --noEmit)、`gate`、`start`(运行 main)
- [x] 1.4 定义 `src/types.ts`：`NewsItem { title, link, pubDate, summary, source }`

## 2. 录制确定性测试样本

- [x] 2.1 真实抓取一次 `feeds.bloomberg.com/markets/news.rss`，保存为 `fixtures/bloomberg-markets.rss`（30 item）
- [x] 2.2 另存一个空 feed 与一个畸形 XML 样本，供边界场景测试

## 3. news-parse（test-first）

- [x] 3.1 先写 `parse` 单测：覆盖 spec 四场景（正常多条 / 空 feed / 缺字段 / 畸形 XML），测试先红
- [x] 3.2 实现 `src/parse.ts`（纯函数，用 fast-xml-parser）使单测转绿（RED→GREEN）
- [x] 3.3 重构去重，保持绿（REFACTOR）

## 4. news-filter-today（test-first）

- [x] 4.1 先写 `filterToday` 单测：覆盖 spec 三场景（保留当天/过滤其它 / 当天无 / 边界时刻），今天日期为显式入参，测试先红
- [x] 4.2 实现 `src/filterToday.ts`（纯函数）使单测转绿
- [x] 4.3 在测试中固定 pubDate 时区基准（UTC 自然日），并断言边界行为

## 5. news-card-render（test-first）

- [x] 5.1 先写 `render` 单测：覆盖 spec 四场景（N 条→N 卡 / 标题链接跳原文且不内联正文 / HTML 转义防注入 / 空列表占位），测试先红
- [x] 5.2 实现 `src/render.ts`（纯函数，输出自包含 HTML，含转义）使单测转绿
- [x] 5.3 重构样式与模板，保持绿

## 6. news-fetch（薄 IO 适配器）

- [x] 6.1 实现 `src/fetch.ts`：HTTPS GET RSS，设超时；200 返回原文，非 200/超时抛可识别错误（对应 spec 场景）
- [x] 6.2 fetch 集成验证：经 `npm start` 真实抓取一次成功（不进确定性 gate）

## 7. main 组合 + run log

- [x] 7.1 实现 `src/main.ts`：fetch→parse→filterToday(today)→render→写 `dist/index.html`
- [x] 7.2 输出一行 run log：抓取条数 / 筛今天后条数 / 输出路径 / 耗时ms / 成功失败

## 8. 确定性 gate 接线

- [x] 8.1 确保 `vitest` 全绿（parse/filterToday/render，13/13）
- [x] 8.2 确保 `eslint` 与 `tsc --noEmit` 全绿（lint 规则设为 error，禁 inline-disable 滥用）
- [ ] 8.3 （可选增强）记录一次 gate 命令与结果，作为后续 pre_merge hook 雏形

## 9. 真实抓取验证与产物

- [x] 9.1 运行 `main` 真实抓一次 Bloomberg RSS，生成 `dist/index.html`（30 抓取 / 23 当天 / 1325ms / ok）
- [ ] 9.2 浏览器打开确认当天卡片可见、标题链接跳回 bloomberg.com 原文、无正文镜像（待用户目视）

## 10. 追溯链与基线（M0 可度量种子）

- [ ] 10.1 记录第一条追溯链：spec（本 change）→ 各测试文件 → 实现 commit（待 git 决策）
- [x] 10.2 记录本切片基线（四指标种子，见 `docs/plan/M0-retro-baseline.md`；gate≈1.7s、356 行、缺陷逃逸 0）
- [x] 10.3 复盘：暴露 4 点 M1 候选约束（见 `docs/plan/M0-retro-baseline.md`）
