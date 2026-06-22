## 1. runIsolated 重构(解耦集成)

- [x] 1.1 runIsolated:done → squash 产分支,返回 `{result, branch?, committed}`;移除 per-job integrate
- [x] 1.2 更新 isolated 用例:断言产分支/committed、**不**调 integrate(红线 5 记录)

## 2. 批后集成编排(TDD)

- [x] 2.1 `runBatch(jobs, deps)`:对每 job 跑 runIsolated → 收集 committed 分支 → batchIntegrate(无分支则跳过)
- [x] 2.2 注入替身测:2 done+1 failed → 仅 2 分支进 batchIntegrate;全非 done → 跳过集成

## 3. 轮询守护(TDD)

- [x] 3.1 `driveParallelLoop(dbPath, {concurrency, pollMs, maxEmptyRounds, invoke, sleep, runInner, onBatch})`:recover→drain→批后→sleep,空轮达上限退出
- [x] 3.2 注入 sleep/invoke + 临时 db 测:陆续入队持续消费;空队列达上限即停(不无限空转)

## 4. 验证与归档

- [x] 4.1 lint+tsc+vitest 全绿;纯/注入逻辑变异门 ≥ 阈值
- [~] 4.2 (视需要)真集成串:多 job 隔离产分支 → 批后 batchIntegrate(真 git,无 claude)
- [x] 4.3 更新 README/RESUME + retro;validate --strict → archive → commit + push
