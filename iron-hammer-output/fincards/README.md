# fincards

铁锤小队产品切片:从 Bloomberg 官方 RSS 拉取当天财经新闻，渲染成卡片页（`dist/index.html`）。
合规：仅展示 标题+摘要+时间+原文链接（跳回 bloomberg.com），不抓 HTML 正文、不镜像全文。

## 命令

```bash
npm start        # 真实抓取 Bloomberg RSS → 生成 dist/index.html（输出一行 run log）
npm run gate     # 快 gate：lint + tsc --noEmit + vitest（每次改动可跑，~2s）
npm run mutation # 变异门：StrykerJS 审计测试有效性（合并前必过，较慢）
```

## 质量门分层（V4 §4.1 / guides-and-sensors）

| 门 | 何时跑 | 内容 |
|---|---|---|
| **快 gate**（`npm run gate`） | 每次改动 | ESLint + tsc + vitest（确定性、毫秒级） |
| **变异门**（`npm run mutation`） | **合并前 / 集成阶段** | StrykerJS 变异测试，break 阈值 90；只变异纯逻辑 parse/filterToday/render |

> 变异门审计"测试够不够强"（覆盖率≠有效性）。当前有效变异分数 **100%**（59/59 非等价变异被杀），2 个等价变异在源码内以理由显式豁免。

## 架构（分层纯函数 + 薄 IO 边界）

`fetch.ts`(网络 IO，隔离) → `parse.ts` → `filterToday.ts` → `render.ts`（后三者纯函数，确定性可测）→ `main.ts`(组合 + run log)。
