## 1. parseDesignFindings 纯解析（纯，TDD）

- [x] 1.1 RED：`design-findings.test.ts`——合法 findings JSON → 解析为 DesignFindings（字段一一对应）
- [x] 1.2 RED：intentRestatement 空串 → 抛 Error，`toThrow(/intentRestatement/)`
- [x] 1.3 RED：antiGoal.testable 非布尔/缺失 → 抛 Error，`toThrow(/testable/)`
- [x] 1.4 RED：antiGoal.desc 空串 → 抛 Error，`toThrow(/desc/)`
- [x] 1.5 RED：raw 非 JSON → 抛 Error
- [x] 1.6 RED：failureModes/suggestedAcceptance 空数组 + 其余合法 → 正常解析（不抛）
- [x] 1.7 RED：antiGoals 非数组 / 缺字段 → 抛 Error 指向字段
- [x] 1.8 GREEN：实现 `pipeline/driver/src/design-findings.ts` `parseDesignFindings` + 导出 `DesignFindings` 类型
- [x] 1.9 把 `design-findings.ts` 纳入 driver 静态变异门 mutate 列表

## 2. 角色文档

- [x] 2.1 写 `pipeline/roles/design-soundness-agent.md`：独立对抗评审者；只读；站终端用户/对抗者视角不假设作者正确；自包含方法（意图对齐→反目标穷举→失败模式）；输出 schema（intentRestatement/antiGoals[{desc,testable}]/failureModes/suggestedAcceptance 的 JSON）

## 3. 门禁 + 杀手验证

- [x] 3.1 driver gate lint+tsc+vitest 全绿（既有零回归）
- [x] 3.2 静态变异门 ≥ 阈值（design-findings.ts 纳入）
- [x] 3.3 **杀手验证**：用既有 phaseInvoke 跑 design-soundness-agent 在 **US-1 听音选词原始规约切片**（见观察日志/scratchpad）→ 真 findings 经 parseDesignFindings 接受 → 确认 antiGoals 含"答案不得在答题前可得/必须靠听"类条目（testable=true）。证当初能拦 #2。贴 findings 给 BOSS

## 4. 收尾

- [x] 4.1 复盘要点（docs/plan 或观察日志）：能否拦 #2、findings 质量、与 product-clarify/security-review 的边界
- [x] 4.2 openspec validate --strict → archive → commit
