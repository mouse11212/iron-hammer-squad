## Why

driver 现状(M3/M5-A):worker 对每个 job 只 `invoke(prompt)` 跑**一次** `claude -p`。而多角色全流程(测试→开发→评审×2→回修)还停在**人工剧本**(`pipeline/workflows/orchestration-pwj.md`)——靠人主 session 当 orchestrator 手动 spawn 子 agent。要让"事件→自动跑完整 SDLC 内循环"成立,必须把这条剧本从人工驱动变成 **driver 自动驱动**:driver 当高层状态机,按 PEV 串起整条内循环,阶段间确定性 gate,must-fix 自动回修闭环。

spike(2026-06-18)已验证 `claude -p --session-id/--resume` 能跨独立进程保留对话记忆 → 回修可**热上下文续接**那个写出代码的角色,溶解"SendMessage 不可用"限制,无需 D9 常活角色 + inbox 基建。

## What Changes

- 新增 **inner-loop 编排器**:driver 对 `kind='inner-loop'` 的 job 按 PEV 串起 测试→开发→评审 phase 链,每 phase 一次 `claude -p`,**阶段间 TS 跑确定性 gate**(RED / GREEN+变异门 / verdict)。
- phase 内允许 claude 自主 spawn 子 agent(如评审两遍),**但全程 `stream-json --verbose` 落 trace**(可观测硬约束)——phase 内黑盒变白盒。
- **结构化 verdict 文件**:评审 phase 产出固定 schema 的 JSON,driver 确定性裁决(不解析自由文本)。
- **must-fix 自动回修闭环**:按归属域 `--resume` 对应角色 session 注入 must-fix(回退 fresh spawn);`maxFixRounds` 止损,超限 → `blocked-escalated` 阻塞升级人类。
- **可观测**:每 phase 落 trace(含子 agent 事件)+ per-job state(phase 转移/gate 结果/fixRound/sessionId/usage/cost),喂 M4 metrics。
- worker dispatch 升级:`kind==='inner-loop'→runInnerLoop`;否则保留单 `invoke`(向后兼容 freeform)。

## Capabilities

### New Capabilities
- `inner-loop-orchestration`: driver 自动驱动多角色 PEV 内循环——阶段链编排、阶段间确定性 gate(RED/GREEN+变异门/verdict)、热上下文回修闭环(域归属路由 + 止损 + 升级)、phase trace + per-job 可观测、崩溃整链重跑。

### Modified Capabilities
<!-- event-driver 的事件触发/状态机/幂等/恢复需求在 inner-loop 模式下仍成立;worker dispatch 增加 kind 路由属实现升级(Impact),非 spec-level 需求变更。无修改既有 capability。 -->

## Impact

- **代码**:`pipeline/driver/` 新增 `inner-loop.ts`(纯编排)、`gates.ts`、`verdict.ts`、`prompts.ts`;扩展 `invoke.ts`(`makePhaseInvoke`:json 输出 + session-id/resume + trace);改 `drive-parallel.ts`(kind 路由)。
- **观测**:新增 `.runtime/runs/<jobId>/`(state.json + per-phase trace JSONL);对接已落地 `pipeline/metrics`。
- **验证载体**:`iron-hammer-output/fincards/` 选/造一个小 US 跑真实端到端(方案 A 边验证边抽取)。
- **抽取线**:能力直接建于 `pipeline/driver/`(引擎基建即最终产物);验证后更新 `pipeline/workflows/orchestration-pwj.md` "驱动方式"段,标验证来源。
- **不在本切片**(留 M5-B):Git worktree 隔离 + 集成分支兜底 + squash 合并;mid-chain 精细恢复(本切片崩溃=整链重跑)。
- **设计真相源**:`docs/plan/2026-06-18-driver-inner-loop-orchestration-design.md`(brainstorm 决议 + spike 记录 + 架构细节)。
