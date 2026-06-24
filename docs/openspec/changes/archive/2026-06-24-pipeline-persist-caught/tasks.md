## 1. driver:squash 消息 emit caught trailer（纯，TDD）

- [x] 1.1 RED：写 `squash-message.test.ts`——`squashMessage('job-x', 0)` → 只基础标题,无 `Defect-Caught:`
- [x] 1.2 RED：`squashMessage('job-x', 2)` → 基础标题 + 2 行 `Defect-Caught: inner-loop 回修轮 1`/`回修轮 2`(trailer 块在末尾)
- [x] 1.3 GREEN：实现纯 `squashMessage(jobId, fixRounds): string`(driver `src/squash-message.ts` 或就近)
- [x] 1.4 接线：`inner-loop-runner.ts:237` squash 调用用 `squashMessage(jobId, result.fixRounds)` 替换字面量

## 2. metrics:通用 trailer 挖采 + caught 换源（纯/薄 IO，TDD）

- [x] 2.1 重构薄 IO `mineTrailers(repoRoot, key): Trailer[]`(泛化切片③ readEscapeTrailers 解析);`readEscapeTrailers` 改为 `mineTrailers(_,'Defect-Escaped')` 薄封装
- [x] 2.2 RED：`deriveDefects` 改签名 `(caught: Trailer[], escapes: Trailer[])`——caught trailer → where:'caught';escaped → where:'escaped';两侧每行一记录;空→[]
- [x] 2.3 GREEN：实现新 `deriveDefects`;调整 `defects-feed.ts` 类型(Trailer 统一 {commit,desc})

## 3. collect 接线 + 回退切片③ runtime caught

- [x] 3.1 `collect.ts`：caught 改 `mineTrailers(repoRoot,'Defect-Caught')`;`deriveDefects(caughtTrailers, escapeTrailers)`;去掉 run 派生 caught
- [x] 3.2 回退 `types.ts` `InnerLoopRunRecord.residualCount`(切片③加,现废);`readInnerLoopRuns` 去 residual 读取(runs 仍供 innerLoopStats)
- [x] 3.3 更新 defects-feed.test.ts / collect 相关测试为新签名

## 4. 约定 + 验证

- [x] 4.1 `pipeline/guides/agent-conventions.md`：补 `Defect-Caught:` 约定(**机器写**,人勿手打;与 `Defect-Escaped:` 人写区分)
- [x] 4.2 driver gate 全绿(lint+tsc+vitest;`squashMessage` 穷尽单测)
- [x] 4.3 metrics gate 全绿(`deriveDefects` 换源 + `mineTrailers` 精确断言)
- [x] 4.4 真实验证(非破坏)：临时 git repo 造含 `Defect-Caught:`×2 + `Defect-Escaped:`×1 的提交 → `collect` → caught=2/escaped=1/rate=1/3;清空→null。**口径对齐实证**:两侧均 git 挖采

## 5. 收尾（规约同步 + 归档 + 提交）

- [x] 5.1 `openspec validate pipeline-persist-caught --strict` 通过
- [x] 5.2 更新 `pipeline/README.md` 与 `docs/context/RESUME.md`(M4+ 续切片④ 完成、caught 已持久、口径对齐)
- [x] 5.3 复盘并入 `docs/plan/M4plus-event-log-retro.md`
- [x] 5.4 `openspec archive pipeline-persist-caught` → `git commit` + `push`
