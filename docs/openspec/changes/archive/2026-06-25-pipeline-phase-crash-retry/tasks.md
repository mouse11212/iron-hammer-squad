## 1. parsePhaseResult 标记 noResult（纯，TDD）

- [x] 1.1 RED：`phase-invoke.test.ts`——无 result 事件 → `parsePhaseResult(['{"type":"system"}']).noResult` 为 true
- [x] 1.2 RED：有 result 事件 → `parsePhaseResult([resultLine]).noResult` 为 false
- [x] 1.3 GREEN：`invoke.ts` `PhaseMeta` 加可选 `noResult?: boolean`;`parsePhaseResult` 无 found 时 `noResult:true`,有 found 时 `noResult:false`

## 2. runFresh 对崩溃无 result 重试（纯，TDD）

- [x] 2.1 RED：`inner-loop-runner.test.ts`——phaseInvoke 首返 `{exitCode:1,isError:true,result:'',noResult:true}`、次返成功 → 重试成功,phaseInvoke 调 2 次,session-id 不同
- [x] 2.2 RED：phaseInvoke 持续返 `{isError:true,result:'',noResult:true}` → 耗尽(1+2=3 次)后失败,不无限重试
- [x] 2.3 RED（回归守护）：phaseInvoke 返 `{isError:true,result:'测试断言失败'}`(无 noResult)→ 仍不重试(调 1 次)
- [x] 2.4 GREEN：`inner-loop-runner.ts` `runFresh` 重试条件改 `r.isError && (isTransient(r.result) || r.noResult)`

## 3. 门禁 + 真实验证

- [x] 3.1 lint + tsc + vitest 全绿（driver gate）
- [x] 3.2 变异门：`invoke.ts`/`inner-loop-runner.ts` 按设计**不在静态 mutate 表**（IO 邻接，穷尽精确单测兜底，同既有约定）；改动正交于 8 个被变异文件 → 静态变异门 **91.77 ≥ 90** 确认不受影响
- [x] 3.3 真实验证：清理残留→重驱 US-1 → **done**（fixRounds=1，$4.036）。本次 api_retry=0、noResult 重试**未生产复现触发**（假失败非确定、未复现）→ 修复仅单测验证，待自然复现现场观察；意外验证 resume-fallback。完整内循环（评审→must-fix→回修→变异 93.33%→100%→复评）走通。已填观察日志 §3/§4/§6/§7
