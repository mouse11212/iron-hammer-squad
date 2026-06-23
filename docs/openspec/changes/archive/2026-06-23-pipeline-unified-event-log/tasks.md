## 1. 事件 schema 与构造器（纯，TDD）

- [x] 1.1 RED：写 `events.test.ts`——`makeEvent` 构造 phase 事件含全部字段、不读系统时钟（注入 ts）、无 IO
- [x] 1.2 RED：写 `makeEvent` 可选字段缺省用例（仅必填 → 不臆造 phase/status/durationMs/payload）
- [x] 1.3 GREEN：实现 `pipeline/driver/src/events.ts` 的 `Event` 类型 + `EventOp` 联合 + `makeEvent` 纯构造器

## 2. 事件 sink（薄 IO，TDD）

- [x] 2.1 RED：写 sink 用例——对 tmp 文件写一条 Event 追加恰好一行合法 JSON、既有行不动；多次写入保持顺序
- [x] 2.2 GREEN：实现 `makeEventSink(path)`（序列化单行 + appendFileSync + mkdir -p），无计算逻辑

## 3. 回放（纯 + 薄 IO，TDD）

- [x] 3.1 RED：写 `replay.test.ts`——`groupByTrace` 按 traceId 分组、组内按 ts 升序
- [x] 3.2 RED：`formatReplay` 渲染按 ts 排序、含 op 序列（phase→gate→squash→可选 integrate）的可读文本
- [x] 3.3 RED：`readEvents` 跳过畸形行返回其余合法事件、不抛错
- [x] 3.4 GREEN：实现 `pipeline/driver/src/replay.ts`（`groupByTrace` + `formatReplay` 纯 + `readEvents` 薄 IO）

## 4. CLI 回放入口

- [x] 4.1 实现 `pipeline/driver/src/bin-replay.ts`：读 events.jsonl → 按传入 traceId 渲染；traceId 不存在输出明确空结果提示而非报错
- [x] 4.2 在 driver `package.json` 加 `replay` 脚本入口

## 5. 接入 5 个发射点（埋点路由进 sink）

- [x] 5.1 `inner-loop-runner.ts` runPhase 包装发 `phase` 事件（role/attempt/resumed/exitCode/costUsd/durationMs，traceId=jobId）
- [x] 5.2 gate cmd 包装由"只记 {cmd,args}"升级发 `gate` 事件（补 exitCode/durationMs）
- [x] 5.3 orchestratorFix 装配处发 `orchestrator-fix` 事件（action/target/ok）
- [x] 5.4 `runIsolated` 发 `squash` 事件（jobId/committed/branch）
- [x] 5.5 `drainBatchIsolated` 集成回调发 `integrate` 事件（每分支 branch/status:merged|held/reason，复用 `branchRel` 把 traceId 回填为该分支所属 US 的 jobId）

## 6. 集成测试（注入 deps，无需真 claude）

- [x] 6.1 用注入 phaseInvoke/cmd 跑一遍 inner-loop → 断言 events.jsonl 落 phase/gate/squash 事件、traceId=jobId
- [x] 6.2 按 jobId 调 `groupByTrace`/`formatReplay` 重建有序链并断言 op 序列

## 7. Gate 与验证（工作节奏 §4–5）

- [x] 7.1 lint + tsc + vitest 全绿
- [x] 7.2 变异门：events.ts/replay.ts 纯逻辑纳入 mutate，≥ driver 现阈值（~91%）
- [x] 7.3 真实验证：跑一个 inner-loop（或复用既有 e2e）后 `bin-replay <jobId>` 打印出 phase→gate→squash 链（DoD）

## 8. 收尾（规约同步 + 归档 + 提交）

- [x] 8.1 `openspec validate pipeline-unified-event-log --strict` 通过
- [x] 8.2 写复盘 `docs/plan/M4plus-event-log-retro.md`（验证来源、揪出的坑）
- [x] 8.3 更新 `pipeline/README.md`（observability：events.jsonl + bin-replay）与 `docs/context/RESUME.md` 进度
- [ ] 8.4 `openspec archive pipeline-unified-event-log` → `git commit` + `push`
