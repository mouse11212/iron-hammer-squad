## Context

M0 交付了内循环 + 确定性 gate(lint+tsc+vitest),但未验证测试**强度**。M1 是第一条有据可依的 harness 约束(复盘 #4),用变异测试把"测试有效性"本身变成 computational sensor(V4 §4.1)。落在 fincards(已有 13 个绿测试)上,既验证 M0 测试质量,又确立可复用的变异门模式。

## Goals / Non-Goals

**Goals:**
- 测量 M0 测试的变异分数,暴露弱测试点。
- 把"变异分数 ≥ 阈值"做成 `npm run mutation` 硬门。
- 强化存活变异对应的测试(以测试杀死变异)。

**Non-Goals:**
- 不对 `fetch.ts`(网络 IO)、`main.ts`(组合)做变异(IO 变异意义低、慢)。
- 不把变异门塞进"每次改动"的快 gate(它慢,定位为合并前/集成阶段 sensor)。
- 不改 M0 已有功能行为。

## Decisions

- **工具 = StrykerJS**(`@stryker-mutator/core` + `@stryker-mutator/vitest-runner`):TS/vitest 生态标准变异测试器,而非手写或其它框架。
- **变异范围 = 三个纯函数**(parse/filterToday/render):确定性、与测试一一对应,变异信号最干净。
- **阈值策略 = 先测基线再定档**:先跑出 M0 测试的变异分数;杀掉合理的存活变异后,把 break threshold 设在一个有意义的高位(目标 ≥85%,实际值依基线定),避免"凭空设阈值"。
- **门的时序**:变异门属 Böckeler "after integration / pipeline" 节奏(慢、合并前必过),与 lint/tsc/vitest 的"每次改动"快 gate 分层(V4 §4.1 / guides-and-sensors)。

## Risks / Trade-offs

- [变异测试慢,拖累迭代] → 不进快 gate,仅作合并前门;只变异三个小纯函数,规模可控。
- [Stryker 与 vitest/ESM 配置摩擦] → 用官方 vitest-runner;配置失败则记录为 M1 内的真实失误(Steering Loop 素材)。
- [阈值过高导致脆弱] → 先基线后定档,且对合理存活变异允许显式豁免(带理由),避免过度约束(V4 §13)。

## Open Questions

- break threshold 的具体数值(待基线测量后定,写入 tasks)。
- 是否对 render 的 HTML 字符串变异做等价变异(equivalent mutant)豁免(实现时按报告判断)。
