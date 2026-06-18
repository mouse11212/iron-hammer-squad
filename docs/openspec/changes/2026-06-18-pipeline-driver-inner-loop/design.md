# 设计要点(SoT 摘要)

> 完整设计(brainstorm 决议表、spike 记录、架构图、风险)见 `docs/plan/2026-06-18-driver-inner-loop-orchestration-design.md`。本文件只记规约级关键决策,避免双 SoT。

## 编排器 locus:混合
driver 当高层状态机 + 阶段间确定性 gate;phase 内允许 claude 自主 spawn,但**全程落 trace**。依据 KB `pev-loop`:验证必须在 pre/runtime/post/plan-alignment 四时点,不能退化为单次 post-hoc 自查。

## 回修:热上下文 resume(spike 已验证)
`claude -p --session-id <UUID>` 起会话 + `--resume <UUID>` 续接,跨独立进程保留对话记忆(2026-06-18 记忆探针实测通过)。`--output-format json` 同时吐 `session_id`(回修)+ `usage`/`total_cost_usd`/`duration_ms`(metrics)。
- 主路:按 must-fix 归属域 resume 对应角色 session 注入 must-fix。
- 回退:session 不可 resume → fresh spawn + 上下文注入(读盘 + 规约 + must-fix)。
- 这溶解了"SendMessage 不可用"——无需 D9 常活角色 + inbox。

## 角色间交接:repo 文件系统
KB `orchestrator-patterns`:teammates 不继承对话,靠 spawn prompt + 外部状态。测试 agent 写 `test/` → 开发 agent 下一进程读盘。进程级隔离 + 自然交接,driver 不在内存搬产物。

## 评审→driver 交接:结构化 verdict JSON
`{decision, mustFix:[{域,desc,file?}], niceToHave}`。driver 只读字段做确定性裁决,不解析自由文本。

## 止损:对抗 agent-drift
`maxFixRounds=2`(默认,可调)。每轮重跑 GREEN gate + 评审;超限 → blocked-escalated 升级人类(红线 6)。变异门末轮必跑,中间轮可跳过控成本。

## 恢复:整链重跑
崩溃 → recover 回收为 queued → 整链重跑(phase 对 repo 文件幂等覆盖)。第一切片不做 mid-chain 精细恢复(start narrow)。

## 组件边界(每个一职责,可注入替身测试)
`inner-loop.ts`(纯编排)· `invoke.ts`→`makePhaseInvoke`(json/session/resume/trace)· `gates.ts`(RED/GREEN/变异门)· `verdict.ts`(读裁决)· `prompts.ts`(合成 spawn prompt)· `drive-parallel.ts`(kind 路由)。
