## Why

M0 的单测全绿，但"绿"不等于"测试够强"——覆盖率只说代码被跑到，不说测试会因代码改错而失败（KB 痛点二：弱测试制造可信度幻觉，SWE-Bench+ 实证 31% 通过补丁因弱测试可疑）。M1 用变异测试以确定性手段审计 M0 测试的有效性，并把"变异分数达标"固化为硬门（V4 §4.6）。这是 M0 复盘点 #4，有据可依的第一条 harness 约束。

## What Changes

- fincards 接入 **StrykerJS** 变异测试（`@stryker-mutator/core` + vitest runner）。
- 变异范围限定在**纯逻辑**：`src/parse.ts`、`src/filterToday.ts`、`src/render.ts`；排除 `fetch.ts`(网络 IO)、`main.ts`(组合)、`types.ts`。
- 先测量 M0 测试的变异分数基线；对存活变异(survived mutants)要么补测试杀死、要么显式标注理由。
- 设 Stryker **break threshold** 为硬门：低于阈值即失败。
- 新增 `npm run mutation` 脚本；变异门定位为"合并前/集成阶段" sensor（比单测慢，不必每次改动跑，但合并前必过）。

## Capabilities

### New Capabilities
- `mutation-gate`: 以变异测试审计测试套件有效性，并强制变异分数达到阈值方可合并。

### Modified Capabilities
<!-- 无：不改 M0 已有 capability 的行为，仅新增测试强度门。 -->

## Impact

- fincards 新增开发依赖：`@stryker-mutator/core`、`@stryker-mutator/vitest-runner`；新增 `stryker.conf.json`。
- 可能新增/加强若干单测以杀死存活变异（强化 M0 的 parse/filterToday/render 测试）。
- 确立可复用的"变异门"模式，作为后续里程碑(M6 安全门等)的 sensor 范式（V4 §4.1 computational sensor）。
