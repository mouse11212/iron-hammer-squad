## 1. acceptance 能力（回填，对应 main 已合入代码/测试）

- [x] 1.1 `aggregateAcceptanceItems`（`src/acceptance.ts`，commit `4871616`）+ 6 测试
- [x] 1.2 `parseAcceptanceVerdicts`（commit `5d86fd1`）+ 12 测试
- [x] 1.3 `resolveAcceptance`（commit `91c7e18`）+ 9 测试，变异 96.97%

## 2. design-review 反目标管道（回填，对应 main 已合入代码/测试）

- [x] 2.1 `extractTestableAntiGoals` + `resolveDesignReview`（`src/design-findings.ts`）+ 测试
- [x] 2.2 反目标注入 test phase（`prompts.ts` antiGoals + inner-loop 前置步，commit `c23be63`/`e05712e`）
- [x] 2.3 design-findings 总持久化（`inner-loop-runner.ts`，commit `2d9aaf6`）

## 3. 回填校验

- [ ] 3.1 `openspec validate --strict` 通过
- [ ] 3.2 归档后 `npm run trace:check`（待 process-guardrails 实现）对杠杆系列不报孤儿
