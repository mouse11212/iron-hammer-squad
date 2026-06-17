# M0 复盘与基线（fincards-m0-bloomberg-cards）

> 日期 2026-06-17。M0 = 内循环管道验证切片。对应 V4 §7（度量种子）、§2（Steering Loop）。

## 交付结果

- 内循环端到端跑通：OpenSpec 规约 → test-first → TDD 实现 → 确定性 gate → 真实产物。
- 产物：`iron-hammer-output/fincards/dist/index.html`，真实抓取 Bloomberg markets RSS，30 抓取 / 23 当天卡片 / 1325ms / status ok。
- 单测 13/13；ESLint + tsc + vitest 全绿；规约 `validate --strict` 通过。

## harness 四指标基线（V4 §7 第一个数据点，待 M4 系统化采集）

| 指标 | M0 基线 | 说明 |
|---|---|---|
| Task Resolution Rate | 1/1 切片解决 | 单切片，全绿合并就绪 |
| Code Churn | 低 | TDD RED→GREEN 一次成型，无返工重写；src+test 共 356 行 |
| Verification Tax | gate ≈ 1.7s（lint 0.72s + tsc 0.45s + vitest 0.52s） | 确定性 gate 总耗时；可随每次变更实时跑 |
| Defect Escape Rate | 0 已知 | 测试全绿 + 真实运行 ok；浏览器目视待确认 |
| Token 基线 | 未精确计量 | M0 手动代行，token 采集留待 M4 |

## 复盘：本切片暴露的、可固化进 harness 的点（→ M1 候选约束）

1. **流程缺口（已处理）**：跳过了外循环"需求澄清 via gstack"。已记录为显式技术债，延后 M2（见 backlog）。→ M1/M2 应让外循环阶段缺失变成**显式 gate**，而非靠人记得。
2. **fixture 即终极规格**：parse 的确定性来自录制 fixture；真实 feed 改版会让 parse 失效但 fixture 测试仍绿。→ M1 候选：加"fixture 新鲜度"提醒 / 真实抓取的轻量集成 sanity check。
3. **时区基准是隐藏决策**：filterToday 的 UTC 自然日是被测试逼出来显式化的（design 开放问题→测试固定）。→ 印证 §12：把隐含假设显式到 sensor 可消费。
4. **gate 缺变异测试**：M0 只用 lint+tsc+vitest，未上变异（覆盖率≠测试有效性）。→ M1/M6 候选：引入变异分数硬门（V4 §4.6）。

## 待办（M0 收尾）

- 9.2 浏览器目视 `dist/index.html`（用户）。
- 10.1 追溯链 spec→test→commit（待 git 决策）。
- 8.3 gate 命令记录为 pre_merge hook 雏形（可选，建议并入 M1）。
