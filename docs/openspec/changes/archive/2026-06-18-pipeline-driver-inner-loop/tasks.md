## 1. phase 边界(invoke 扩展)

- [x] 1.1 `invoke.ts` 新增 `makePhaseInvoke`:`claude -p --output-format stream-json --verbose`,返回 `{exitCode, result, sessionId, ...}`;`parsePhaseResult` 解析 result 事件(session_id/usage/cost)
- [x] 1.2 支持 `--session-id`(起会话)与 `--resume`(热续接)+ `--permission-mode bypassPermissions`(自主免审批);关 stdin
- [x] 1.3 trace 逐行落 `.runtime/runs/<jobId>/<phase>-<attempt>.jsonl`;onTraceLine 可注入

## 2. gate runner(TDD)

- [x] 2.1 `gates.ts` `runRedGate`(测试存在且失败)
- [x] 2.2 `runGreenGate`(lint+tsc+test 全绿)
- [x] 2.3 `runMutationGate`(stryker exit 0);均注入命令执行器,确定性测试

## 3. verdict 读取与 prompt 合成

- [x] 3.1 `verdict.ts` `parseVerdict`:校验 schema `{decision, mustFix:[{域,desc,file?}], niceToHave}`,非法明确抛错
- [x] 3.2 `prompts.ts` `buildPhasePrompt`:角色/约定/规约/目标路径一次性注入;回修变体附 must-fix + 评审 verdict 指示

## 4. inner-loop 编排器(纯逻辑,确定性测试)

- [x] 4.1 `inner-loop.ts` `runInnerLoop(job, deps)`:deps 全注入
- [x] 4.2 PEV 状态机:TEST→[RED]→DEV→[GREEN+变异门(末轮)]→REVIEW→[verdict]→裁决/回修/DONE/blocked-escalated/failed
- [x] 4.3 回修按域 resume(dev/test session);不可 resume → fresh spawn 回退(`makeRunPhase`)
- [x] 4.4 止损 `maxFixRounds`(默认 2):超限→blocked-escalated;变异门末轮必跑
- [x] 4.5 确定性测试全场景覆盖(含变异门补强,见 6.2)

## 5. per-job 可观测与 worker dispatch

- [x] 5.1 per-job `.runtime/runs/<jobId>/state.json` + per-phase trace JSONL(`runInnerLoopJob`)
- [x] 5.2 `drive-parallel.ts` dispatch:`kind==='inner-loop'→runInnerLoopJob`,向后兼容 freeform;注入替身测两路径
- [ ] 5.3 接入 `pipeline/metrics` 看板(state.json/usage 已落盘,**喂看板待做**——retro 记录)

## 6. 确定性 gate 与端到端验证

- [x] 6.1 lint + tsc --noEmit + vitest 全绿(driver 83 测试)
- [x] 6.2 纯逻辑变异门 **93.31% ≥ break 90**(inner-loop/verdict/gates;prompts 展示层移出);首跑 66.56% 揭弱测试→补 22 测试
- [x] 6.3 端到端:fincards `relativeTime` US 真实跑通,243s/done,生成代码 16 测试独立通过,fincards gate 50 绿无回归
- [~] 6.4 `--resume` 热续接 spike 已验证;**真实回修全循环未触发**(端到端 fixRounds=0,诚实缺口,retro 记录)

## 7. 抽取与归档

- [x] 7.1 能力建于 `pipeline/driver/`;更新 `workflows/orchestration-pwj.md`"驱动方式"段 + `README.md`
- [x] 7.2 复盘 `docs/plan/M5-inner-loop-retro.md`(含红线 5 测试变更记录 + 变异门发现 + e2e 基线 + 回修缺口)
- [ ] 7.3 `openspec validate --strict` → `openspec archive` → git commit + push
