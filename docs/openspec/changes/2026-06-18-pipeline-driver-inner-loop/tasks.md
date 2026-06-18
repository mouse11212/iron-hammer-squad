## 1. phase 边界(invoke 扩展)

- [ ] 1.1 `invoke.ts` 新增 `makePhaseInvoke({cwd, sessionId?, resume?, traceSink?})`:`claude -p --output-format json`(+ 可选 `stream-json --verbose` 落 trace),返回 `{exitCode, result, sessionId, usage, cost, durationMs, isError}`
- [ ] 1.2 支持 `--session-id <uuid>`(起会话)与 `--resume <uuid>`(热续接);关 stdin(`< /dev/null` / `stdio:['ignore',...]`)
- [ ] 1.3 trace 逐行落 `.runtime/runs/<jobId>/<phase>-<attempt>.jsonl`;边界可注入替身

## 2. gate runner(TDD:先测后实现)

- [ ] 2.1 `gates.ts`:`runRedGate`(测试存在 且 npm test 失败)→ 布尔 + 摘要
- [ ] 2.2 `runGreenGate`(lint + tsc --noEmit + npm test 全绿)→ 布尔 + 摘要
- [ ] 2.3 `runMutationGate`(stryker 存活率 ≥ 阈值)→ 布尔 + 摘要;全部可注入替身

## 3. verdict 读取与 prompt 合成

- [ ] 3.1 `verdict.ts`:读评审产出 JSON,校验 schema `{decision, mustFix:[{域,desc,file?}], niceToHave}`,非法→明确报错
- [ ] 3.2 `prompts.ts`:由 `roles/*.md` + `guides/agent-conventions.md` + US 上下文(spec 切片/目标路径)合成 spawn prompt;回修变体附 must-fix + 角色硬边界

## 4. inner-loop 编排器(纯逻辑,确定性测试)

- [ ] 4.1 `inner-loop.ts`:`runInnerLoop(job, deps)` 跑 PEV 链(deps=phaseInvoke/gates/verdictReader/clock/persist 全注入)
- [ ] 4.2 状态机:PLAN→TEST→[RED]→DEV→[GREEN+变异门]→REVIEW→[verdict]→裁决/回修/DONE/blocked-escalated/failed
- [ ] 4.3 回修:按归属域 resume(devSessionId/testSessionId)注入 must-fix;不可 resume → fresh spawn 回退
- [ ] 4.4 止损 `maxFixRounds`(默认 2):每轮重跑 GREEN+评审;超限→blocked-escalated;变异门末轮必跑
- [ ] 4.5 确定性测试覆盖:happy path / RED 不红升级 / GREEN 失败→回修→通过 / must-fix→resume→干净 / 超限→blocked-escalated / phase 非 0→failed / 域归属路由(dev vs test session)

## 5. per-job 可观测与 worker dispatch

- [ ] 5.1 per-job `.runtime/runs/<jobId>/state.json`:phase 转移 + gate 结果 + fixRound + sessionId + usage/cost + trace 路径
- [ ] 5.2 `drive-parallel.ts`:`job.kind==='inner-loop'→runInnerLoop`;否则保留单 `invoke`(向后兼容 freeform);注入替身测两条路径
- [ ] 5.3 对接 `pipeline/metrics`:usage/cost/duration 喂四指标 + 追溯链(spec→test→commit)

## 6. 确定性 gate 与端到端验证

- [ ] 6.1 lint + tsc --noEmit + vitest 全绿
- [ ] 6.2 纯编排逻辑纳入变异门 ≥ 阈值
- [ ] 6.3 **端到端**:`iron-hammer-output/fincards/` 选/造一个小 US,真实跑完整 inner-loop(测试→开发→评审→必要时回修),产出真实基线(回修轮次分布 / 回修后 gate 通过率 / 超限升级率)——不编数字
- [ ] 6.4 验证 `--resume` 热续接在真实回修中生效(开发 phase→评审 must-fix→resume 修复全循环)

## 7. 抽取与归档

- [ ] 7.1 能力直接建于 `pipeline/driver/`(引擎基建即最终产物);更新 `pipeline/workflows/orchestration-pwj.md` "驱动方式"段(现已自动驱动),标验证来源;更新 `pipeline/README.md`
- [ ] 7.2 写复盘 `docs/plan/M5-inner-loop-retro.md`(暴露点 → 固化为 harness diff,Steering Loop)
- [ ] 7.3 `openspec validate --strict` 通过 → `openspec archive` → git commit + push(SSH)
