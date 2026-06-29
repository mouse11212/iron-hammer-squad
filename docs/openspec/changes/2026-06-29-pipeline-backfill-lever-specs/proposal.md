## Why

过程审计（2026-06-29）发现杠杆1（反目标→测试自动管道）与杠杆2-2a（验收关纯核 + findings 总持久化）的能力代码已合入 main 且测试齐全（`acceptance.test.ts` 27 例、变异 96.97%；driver 312 绿），但**当初绕过了 OpenSpec 活规约 SoT**——`specs/` 下无 `acceptance` 规约、杠杆1 的反目标管道未进 `design-review`，`weave-traces` 织链看不到这块。这是 `process-guardrails` change 即将上线的 spec-coverage/trace-check 门的**前置依赖**：不回填，门会（正确地）把现有杠杆码判为孤儿。

本 change 为**回填**：把已合入、已测的能力补写成活规约，逐条 Scenario 对应现有测试，复原 SoT 与追溯链。**不改任何代码**。

## What Changes

- 新能力 `acceptance`（杠杆2-2a 纯核）：`aggregateAcceptanceItems`（聚合非 testable findings→清单，去重/稳定 id）、`parseAcceptanceVerdicts`（严格解析三级 verdict）、`resolveAcceptance`（据模式+人确认分流 pass/escalate/hold）。
- 扩展 `design-review`（杠杆1 反目标管道）：`extractTestableAntiGoals` + `resolveDesignReview`（off/auto/block）+ test phase 注入 + inner-loop design-soundness 前置步 + design-findings **总持久化**（供 2b epic 聚合）。

## Capabilities

### New Capabilities
- `acceptance`: epic 验收关纯核——聚合非 testable 反目标/验收建议/失败模式成清单、严格解析视觉 agent 三级 verdict、据模式与人确认分流（杠杆2-2a，2b 将接 epic 入口与视觉走查）。

### Modified Capabilities
- `design-review`: 新增"反目标→确定性测试自动管道"（杠杆1）——testable 反目标实现前自动注入 test phase、`IH_DESIGN_REVIEW` off/auto/block 渐进自治、findings 跑过即总持久化。

## Impact

- **仅文档**：本 change 不改代码，对应代码已在 main（commit `4871616`/`5d86fd1`/`91c7e18`/`2d9aaf6`/`bf691a8` 及杠杆1 的 `0258445`/`c23be63`/`e05712e`）。
- 归档后 `specs/acceptance/` 新建、`specs/design-review/` 扩展 → `weave-traces` 织链恢复覆盖。
- tasks 全部 `[x]`（回填，对应已合入代码/测试），无新增施工。
- **验证**：`openspec validate --strict` 通过；归档后 `npm run trace:check`（待 process-guardrails 实现）对杠杆系列不再报孤儿。
