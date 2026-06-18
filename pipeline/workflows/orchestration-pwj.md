# 编排剧本：Planner-Workers-Judge

> 验证来源: M2-A(主 session 当 orchestrator,真 spawn 测试/开发/评审子 agent) · 状态: active(手动驱动;自动驱动待 M3/E3)

> 更新(2026-06-18,M5 inner-loop):本剧本已由 **driver 自动驱动**(非人工 spawn)。见下"驱动方式"。

## 模式（KB: orchestrator-patterns）

orchestrator(主 session 或 **driver**) 分解工作 → spawn workers 执行 → Judge 把关。角色靠**上下文隔离**强制边界。

## 步骤

1. **Planner**(orchestrator):据规约切片拆任务、定角色边界、维护 task 状态(当前用 OpenSpec tasks.md;完整消息/状态机制待 M5/D9)。
2. **Worker A 测试 Agent**:spawn(`roles/test-agent.md` + 注入 `guides/agent-conventions.md`)→ 写 RED 测试。orchestrator 校验 RED + 未越界。
3. **Worker B 开发 Agent**:spawn(`roles/dev-agent.md`)→ GREEN。校验测试未被改 + 升级项已上报。
4. **Judge 评审两遍**:spawn ×2(`roles/review-agent.md`，可并行)→ 计划对齐 + 代码评审。
5. **处置裁决**:must-fix 路由回拥有域的角色修复;变异门复跑;复盘记录。

## 已知限制与演进

- **SendMessage 不可用**:无法续已结束的子 agent 会话 → 当前 must-fix 由 orchestrator 以集成者身份代修(注明域归属)。**M5/D9 第三方消息组件将支持真正路由回角色**(E5 抽取)。
- **驱动方式**(已落地 M5 inner-loop,验证来源:fincards `relativeTime` 端到端 243s/done):driver 自动驱动本剧本全流程——`kind='inner-loop'` 的 job 由 `inner-loop-runner.ts` 装配:driver 当高层 PEV 状态机,每角色一次 `claude -p`(stream-json 落 trace),阶段间确定性 gate(RED/GREEN+变异门/verdict),must-fix 自动回修(**热上下文 `--resume` 续接原角色** + 止损 maxFixRounds + 域归属路由)。角色 spawn 由 driver 而非人工发起。
  - **热上下文 resume 已溶解"SendMessage 不可用"**:`claude -p --session-id/--resume` 跨进程保留对话记忆(spike 实证),回修可续接写出代码的那个角色,无需 D9 常活角色+inbox。
  - **诚实缺口**:回修闭环目前仅单测覆盖,端到端 fixRounds=0(happy path),真实回修实证待一个会产生 must-fix 的 US。

## 价值证据（M2-A）

上下文隔离使"写测试≠写实现"成为物理事实;角色边界把缺陷顶到表面(开发 Agent 升级 tsc 问题);独立 Judge 抓出实现+测试自身盲区(数据安全 bug + 真实测试缺口)。对抗式角色分离 > 单 agent 自查。
