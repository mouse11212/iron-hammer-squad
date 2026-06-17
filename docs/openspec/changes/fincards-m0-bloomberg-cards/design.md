## Context

M0 是铁锤小队首个垂直切片，目的是跑通"内循环管道"并验证 harness（V4 §13）。载体是 fincards 产品的第一片：抓 Bloomberg 官方 RSS → 渲染当天新闻卡片页。约束：Node + TypeScript（strict）；本地运行；只读公开 RSS、不抓 HTML 正文（合规，调研实测 `www.bloomberg.com` 网页 403，官方 RSS 200 可用）。relevant 真相源：本 change 的 proposal/specs；架构宪法 V4。

## Goals / Non-Goals

**Goals:**
- 跑通内循环：规约（本 change）→ test-first → TDD 实现 → 确定性 gate（ESLint + tsc + vitest）→ 合并。
- 把"网络非确定性"与"纯逻辑确定性"切开，使核心逻辑可对录制样本确定性测试。
- 产出真实可看的 `dist/index.html`（当天 Bloomberg 卡片）。
- 留下第一条追溯链 + token/墙钟基线 + 最小 run log。

**Non-Goals:**
- Top10/20 排序选取、LLM 摘要、多 RSS 源、定时调度、服务器/前端框架（后续里程碑）。
- 完整观测/度量与看板（M4）、drift 监控（M7）、gstack /qa 浏览器测试。
- **需求澄清 via gstack 产品/澄清 Agent（/office-hours 等）显式延后到 M2 多角色编排**。M0 定位为"仅内循环验证"，外循环各阶段的角色编排尚未搭建；本切片的产品澄清 grounding（目标用户画像/核心痛点/业务场景）刻意从简，**记录为显式技术债**，待 M2 用 gstack 补做完整需求澄清后回填规约上游。

## Decisions

- **分层纯函数 + 薄 IO 边界**（选它而非端到端 live 测试 / 全依赖注入）：`fetch`(IO) / `parse` / `filterToday` / `render`(纯) / `main`(组合)。理由：纯函数对 fixture 确定性 TDD，网络隔离在薄适配器；比 live 测试稳定，比全 DI 抽象更省（YAGNI，V4 §13）。
- **今天日期作为显式入参**（不在 filter 内读系统时钟）：保证测试确定性。
- **RSS 解析用成熟库 fast-xml-parser**（而非手写正则）：健壮、维护性好。
- **确定性 gate = ESLint + `tsc --noEmit` + vitest**（V4 §4.1 computational sensor + 类型系统前馈约束）。
- **合规**：卡片只展示 title+summary+time+link，标题超链接跳回 bloomberg.com 原文，不镜像正文。
- **测试边界**：`parse`/`filterToday`/`render` 进确定性 gate；`fetch` 薄适配器做手动/集成验证，不进 gate（避免网络 flaky 污染 gate）。

## Risks / Trade-offs

- [Bloomberg 改版/feed 结构变化使 parse 失效] → 解析针对录制 fixture 测试；真实抓取失败由 main 记入 run log 失败状态，不静默。
- [个别 topic feed 为空（实测 wealth 当前空）] → M0 只用 markets；parse/filter 对空 feed 返回 `[]` 不抛错（见 specs）。
- [合规边界] → 只消费官方 RSS 公开字段、导流回原文、不抓正文（已在 specs/design 固化）。
- [fixture 与线上漂移] → fixture 仅用于确定性测试；真实抓取作为集成步骤单独验证当天可见。

## Migration Plan

新增产品目录，无既有系统改动，无需迁移/回滚。失败回退：M0 不通则停在本切片排查（不进入下一里程碑）。

## Open Questions

- HTML 卡片样式精细度（M0 仅需可读、可看；视觉打磨非 M0 目标）。
- pubDate 时区基准（建议按 feed 的 GMT 解析后以本地或 UTC 自然日筛选，实现时在 tasks 固定一种并写进测试）。
