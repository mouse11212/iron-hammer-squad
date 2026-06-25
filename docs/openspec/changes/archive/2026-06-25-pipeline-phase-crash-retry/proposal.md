## Why

工程**首个真实长程任务**(词灵岛 US-1)的第一次内循环驱动就因 harness 缺口**假失败**:dev 的 `claude -p` 在一次 API 重试中途硬崩、exitCode 1、stream 里 **0 条 `type:result` 收尾事件**(末尾停在 `system/api_retry`)。`parsePhaseResult` 对"无 result"返回 `{ isError:true, result:'' }`,而 `runFresh` 的重试条件是 `r.isError && isTransient(r.result)`——`isTransientApiError('')` 为 false,**瞬时重试不触发**,整个 run 判 `failed`,12/12 绿、typecheck 干净的 `scoring.ts` 被丢弃,$0.74 真成本浪费。

根因:既有"phase 瞬时错误有限重试"只覆盖"模型发出了含 overloaded/429/timeout 文本的 result",漏掉"进程没机会发 result 就死"——而后者是**最常见的瞬时基础设施失败形态**。这是真实长程任务"拉"出的 harness 可靠性缺口(③ Compound)。

## What Changes

- `invoke.ts parsePhaseResult`:`PhaseMeta` 新增可选 `noResult` 标志——stream 无任何 `type:result` 事件时 `noResult=true`(进程崩溃前未收尾),否则 false。纯函数,向后兼容(可选字段)。
- `inner-loop-runner.ts makeRunPhase`:`runFresh` 重试条件由 `r.isError && isTransient(r.result)` 扩为 `r.isError && (isTransient(r.result) || r.noResult)`——把"进程崩溃无 result"也视为可重试的瞬时基建崩溃。每次重试仍换 fresh session-id、线性退避、上限不变(默认 2)。
- **严格保留**:phase 发出了 `type:result` 但 is_error 且文本无瞬时信号(模型/代码真失败)**仍 SHALL NOT 重试**——`noResult` 与"有 result 的 is_error"严格区分,避免把确定性失败盲目重试烧钱。

## Capabilities

### New Capabilities
<!-- 无:不引入新 capability。 -->

### Modified Capabilities
- `inner-loop-orchestration`: MODIFY「phase 瞬时错误有限重试」——瞬时判别同时覆盖"result 文本含瞬时信号"与"进程崩溃无 result 收尾"两种形态;ADD「phase 结果解析标记是否缺失 result 收尾事件」(noResult)。既有"瞬时 API 错误判别"(纯文本判别)Requirement 不动(空文本判非瞬时仍正确,新行为在重试层)。

## Impact

- **修改**:`pipeline/driver/src/invoke.ts`(`PhaseMeta` 加 `noResult`,`parsePhaseResult` 设值)、`pipeline/driver/src/inner-loop-runner.ts`(`runFresh` 重试条件)。
- **测试**:`test/phase-invoke.test.ts`(noResult 真值)、`test/inner-loop-runner.test.ts`(崩溃无 result → 重试 / 持续崩溃 → 耗尽失败 / 真失败仍不重试)。
- **向后兼容**:`noResult` 可选字段,既有构造 `PhaseInvokeResult` 的测试 fixture 与生产路径零改动;既有"非瞬时不重试"语义不变。
- **范围(红线3 从窄到宽)**:只扩"新会话 runFresh"的重试入口。resume 失败路径已无条件回退 fresh(其崩溃由 runFresh 的 noResult 重试接住),不另开口子。不改重试上限/退避策略。
- **验证来源**:词灵岛 US-1 真实假失败(`pipeline/.runtime/runs/us-wordspirit-001/`:dev-0.jsonl 0 条 result + 末尾 api_retry)。修后重驱 US-1 端到端验证。
