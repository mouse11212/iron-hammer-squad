## 1. batchIntegrate gate 携带分支(TDD)
- [x] 1.1 worktree.ts batchIntegrate:gatePerFeature 签名 (branch)=>Promise<GateResult>,调用时传 branch
- [x] 1.2 batch-integration 用例:断言 gate 收到对应分支(其余行为不变)

## 2. drainBatchIsolated 按项目路由(TDD)
- [x] 2.1 记录 branch→relProjectDir(从各 job spec.projectDir 推导);移除单一 relProjectDir dep
- [x] 2.2 per-feature gate:按 branch 取 rel → linkDeps + green 在该项目目录
- [x] 2.3 batch-drain 用例:单项目回归 + 多项目混批(不同 branch gate 在不同目录)

## 3. 验证归档
- [x] 3.1 lint+tsc+vitest 全绿;worktree.ts 变异门 ≥ 阈值
- [x] 3.2 README/RESUME + validate --strict → archive → commit + push(真实多产品 e2e 待第二产品,记录)
