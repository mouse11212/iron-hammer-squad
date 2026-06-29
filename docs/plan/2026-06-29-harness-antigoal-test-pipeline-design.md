# Harness 杠杆1：反目标 → 确定性测试 自动管道 · 设计

> 状态：设计已获 BOSS 批准（2026-06-29）。本文档为 spec，分两刀实现（1a 先、1b 后），终点是完整自动管道。
> 来源：词灵岛 issue#9（UI 无确定性功能门）+ issue#12（功能门验不出合目的性）+ design-review 首切片（已交付，产 DesignFindings）。
> 载体：`pipeline/`（harness）+ `iron-hammer-output/wordspirit`（组件测试基建与验证载体）。

## 1. Why

design-review 首切片已能产出结构化反目标（DesignFindings.antiGoals[{desc,testable}]），但**反目标目前是死的**——靠人写回规约、靠 test-agent 自觉。杠杆1 把它**接成自动管道**：`testable` 反目标自动变成确定性测试，钉死"#2 类回归"（功能正确但目的失败）。**人审是中间检查点，最终全自动**（BOSS 裁定）。

关键：#2 类反目标（"答案不得在答题前可读"）是 **UI/DOM 级**，需**组件测试**——这同时补 issue#9（UI 无确定性门）。

## 2. 终态管道（接进 inner-loop）

```
规约切片
 → 〔design-soundness phase〕agent 产 DesignFindings(反目标[testable])  [自动·复用首切片角色+parseDesignFindings]
 → 〔人审检查点〕默认阻塞:人确认/增删反目标 → ConfirmedFindings         [人门·复用 held/handoff；配置可跳过→全自动]
 → 〔自动注入〕确认的 testable 反目标 → test phase prompt               [自动]
 → 〔test phase〕test-agent 据规约+反目标写测试(含组件测试)            [自动]
 → dev / gate / 评审 / ...                                             [既有自动]
```
**渐进自治**：人审检查点默认阻塞（安全优先）；配置项 `IH_DESIGN_REVIEW=auto` 时跳过人审、agent 反目标直接注入（全自动）——同 driver 从手动单批→daemon 无人值守的范式。

## 3. 切片 1a — 可测性基建（先做，独立可交付）

**做**：
- wordspirit 装 `@testing-library/react`（+ `@testing-library/jest-dom` 可选；已有 vitest+jsdom+react，仅加测试库）。
- `pipeline/roles/test-agent.md` 升级：新增"对规约里标 `testable` 的反目标，写确定性测试钉死其'不发生'；UI/DOM 级反目标用**组件测试**（@testing-library 渲染组件、断言 DOM/交互），纯逻辑反目标用 vitest 单测。"
- **验证（杀手锏，证判别力）**：把 #2 反目标写成 `Play.test.tsx` 组件测试。**精确断言**（注意：正确答案本就是 4 选项之一，必然在选项里出现，故不能断言"DOM 无答案"）：
  - ① **提示卡/问题区不含正确答案的英文词文本**——答案只该靠音频，不该印在题面（#2 的核心：提示卡曾印 `🔊 "Stand up!"`）。实现：断言正确答案英文词在整个 Play 里**恰出现一次**（即只在那个选项里），或断言提示卡容器内不含该文本。
  - ② **答题前选项不显示中文释义**（#2 的 gloss 泄漏：答前选项 `<small>` 应为空）。
  - ③（对照）答题后正确选项显示释义（学习时刻）。
  **判别力验证**：临时把 Play 改回 #2 bug 渲染（提示卡印英文词 / 选项答前显释义）→ 测试 ①② RED → 还原修复版 → GREEN（不留临时改动）。证这条反目标测试能拦回归。

**不做（1a）**：不接 inner-loop、不自动喂（那是 1b）。

**验收（1a）**：组件测试基建就位；test-agent guide 升级；Play.test.tsx 的 #2 反目标测试 GREEN（修复版）且经验证对 bug 版 RED；wordspirit gate 全绿（含新组件测试）。

## 4. 切片 1b — 自动管道接线（后做，接成完整管道）

**做**：
- **DesignFindings/ConfirmedFindings 数据流**：design-review 首切片已有 `parseDesignFindings`。1b 加"确认"态：`ConfirmedFindings`（人确认/增删后的反目标子集，结构化）。
- **inner-loop 加 `design-soundness` phase**（test phase 之前）：跑 design-soundness-agent（注入规约切片）→ 收 findings → `parseDesignFindings` → DesignFindings。复用既有 phaseInvoke/instrument（进 events.jsonl，可观测/可回放）。
- **人审检查点（默认阻塞）**：复用 held/handoff——findings 渲染成交接物递人确认；人确认的反目标回流为 ConfirmedFindings。**配置 `IH_DESIGN_REVIEW`**：`block`(默认,阻塞人审) / `auto`(跳过人审,agent 反目标直接采纳) / `off`(整 phase 不跑,回到现状)。
- **自动注入 test phase**：ConfirmedFindings 的 `testable` 反目标拼进 test-agent 的 prompt（作显式"另须断言以下反目标不发生"要求）。复用既有 prompts.ts 注入点。
- **止损/降级**：design-soundness phase 瞬时崩用既有重试；agent findings 解析失败→记录并降级（不阻断主流程，回到"无反目标注入"，不让新 phase 拖垮既有 US）。

**不做（1b，留后续）**：反目标→测试的"是否真写了对应测试"的强校验（让 test-agent 写但不强制逐条核对，先靠评审+变异门兜底）；多年级/多语言。

**验收（1b）**：inner-loop 在一个 US 上跑出 design-soundness phase（events.jsonl 可见）；`block` 模式 findings 递人确认；`auto` 模式跳过人审全自动；确认反目标注入 test phase 且 test-agent 产出对应测试；既有 inner-loop 测试零回归（phase 可关：`off` 回现状）。

## 4.5 组件（落点）

| 文件 | 切片 | 职责 |
|---|---|---|
| `wordspirit package.json` + `Play.test.tsx` | 1a | 组件测试库 + #2 反目标组件测试 |
| `pipeline/roles/test-agent.md` | 1a | guide 升级:反目标→测试(含组件) |
| `pipeline/driver/src/inner-loop.ts`(+runner/prompts/instrument) | 1b | design-soundness phase + 注入 |
| `pipeline/driver/src/design-findings.ts` | 1b | 加 ConfirmedFindings 态(扩首切片) |
| 配置 `IH_DESIGN_REVIEW` | 1b | block/auto/off 渐进自治开关 |

## 5. 测试策略

- **1a 纯展示/组件**：Play.test.tsx 组件测试（@testing-library，jsdom）——属"反目标确定性测试"，本身是新基建的示范。**对 bug 版 RED 的验证**：临时改 Play 渲染暴露答案 → 测试红 → 还原 → 绿（证判别力，不留改动）。
- **1b 纯逻辑（TDD+变异门）**：ConfirmedFindings 解析/过滤（testable 筛选）、phase 装配的纯逻辑（注入 prompt 拼接、降级分支）。
- **1b 真 e2e**：inner-loop 真跑一个含反目标的 US（block + auto 两模式各一次），确认 phase 落 events、人门/自动两路径、测试被注入。

## 6. 范围与渐进

- 1a 独立交付（补 issue#9）；1b 接成自动管道（达成 BOSS"最终全自动"要求）。
- 渐进自治：`off`→`block`→`auto` 三档随信任度推进，默认 `block`（安全优先，红线3 从窄到宽）。
- 杠杆2（实现后验收关 + 人工试玩清单）依赖本管道的"非 testable 反目标 + suggestedAcceptance"，另设计另做。
