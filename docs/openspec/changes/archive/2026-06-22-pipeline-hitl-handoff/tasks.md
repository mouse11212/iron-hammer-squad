## 1. renderHandoffReport(纯,TDD)
- [x] 1.1 handoff.ts renderHandoffReport(integration, {integrationBranch, mainBranch?, generatedAt}):markdown
- [x] 1.2 测试:全 ready(merged+合并命令)/ 部分挂起(merged+held 含原因指引)/ held-only / null(无产出);合并命令含 squash;标注 HITL 不自动合 main

## 2. drainBatchIsolated onHandoff 钩子(TDD)
- [x] 2.1 drainBatchIsolated 加 onHandoff?(report, integration);批后集成完(含 null)调用
- [x] 2.2 测试:集成后 onHandoff 收到报告(含 held/merged 信息)
- [x] 2.3 默认 onHandoff:写 .runtime/integration-report.md + console 摘要(IO 助手)

## 3. 验证归档
- [x] 3.1 lint+tsc+vitest 全绿
- [x] 3.2 README/RESUME + validate --strict → archive → commit + push
