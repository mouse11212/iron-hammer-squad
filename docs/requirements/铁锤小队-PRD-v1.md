# 铁锤小队 · PRD v1（北极星）

> **定位**：本 PRD 是 V4 构思的**低密度蒸馏**，只承担"愿景 / 范围 / 成功标准"，是给人和 Claude Code 读的**北极星**——**不是 SoT**。
> 真相源分层：**PRD = 愿景(人读) · OpenSpec 活规约 = 可执行规约 SoT(机器判定) · V4 = 架构宪法 · 能力 backlog = 排序**。
> 详细机制一律回查 `docs/requirements/铁锤小队-Harness工程构思-v4.md`（下文标 `→V4 §x`）。

## 1. 一句话

给定需求，用 AI / AI 团队**最大限度自动地跑完整 SDLC**，且这条流水线本身具备 harness 素质——在已知可靠性边界内**可观测、可度量、可问责**地交付软件。

## 2. 为什么 / 解决什么

前沿模型单步误差不可忽略，在长链路中自回归复利成 agent drift（→V4 §0、§6）。本工程用纪律化 harness 把误差拦在放大之前。核心哲学：**人定目标、人判质量、人担责；AI 编排执行**（→V4 §0）。

## 3. 用户与场景

- **驭手 = BOSS**：框定问题、判断质量、在关键门禁签字、承担问责（→V4 §4.5，签字人全为 BOSS）。
- **小队 = 角色化 Claude 子 agent**：产品/架构/规约/UX/测试/开发/评审/安全/发布（→V4 §4.2）。
- **场景**：BOSS 给出需求 → 小队按外/内循环交付 → BOSS 在门禁处把关。

## 4. 范围（v1）

**In**：单机、本地运行的 SDLC 流水线骨架；规约驱动（OpenSpec）；单 US 内循环（test-first → 实现 → 确定性 gate → 合并）；事件触发；基本可观测与追溯。
**Out（v1 暂不做）**：云端常驻（→V4 §3）、DeerFlow（D7）、Agent SDK/Managed Agents（按需升级）、gstack 浏览器 /qa（待产品有 Web UI）、完整 drift 自演进回灌（后期里程碑）。

## 5. 核心需求（FR，高层；细节→V4）

1. **三层结构**：① Loop（反复跑 SDLC）/ ② Harness（单次可靠）/ ③ Compound（越用越强）（→V4 §1）。
2. **Steering Loop**：每次失败 → 固化为对 harness 的 diff，结构性不可重现（→V4 §2）。
3. **内循环**：规约切片 → 测试先行 → 实现 → Plan-Alignment gate → 两遍 review → 变异/测试达标 → 合并（→V4 §3.4）。
4. **真相源与追溯链**：OpenSpec 活规约为 SoT；双向追溯链带 ID（→V4 §4.4）。
5. **控制矩阵**：Guides/Sensors × Computational/Inferential（→V4 §4.1）。
6. **Git 分支纪律**：驭手 8 条军规（Trunk-Based + worktree 并行 + 集成分支兜底 + AI 代码加严审查）（→V4 §9）。
7. **编排层**：Claude Code 自身（运行内协调）+ 本地事件触发器（→V4 §3.1，Max 订阅）。
8. **drift 防御**：ASI 监控 + 两级拓扑 + EMC/ABA/DAR（→V4 §6）。

## 6. 质量属性（NFR，高层）

可观测（结构化日志+追溯回放）、可度量（harness 四指标）、可问责（HITL 门禁）、成本可控（Max 订阅内）、安全（沙箱+凭据隔离）（→V4 §7、§4.5、§4.7）。

## 7. 成功标准 / 验收

- **里程碑级**：每个能力切片可独立演示、可短命快合（→V4 §10 US 大小上界）。
- **工程级**：harness 四指标可采集——Task Resolution Rate / Code Churn / **Verification Tax** / Defect Escape Rate（→V4 §7，基线需产线标定）。
- **第一切片（M0）**：单 US 内循环端到端跑通，含 ≥1 道确定性 gate，全绿合并（→V4 §13）。

## 8. 约束与已定决策

- 编排=Claude Code 本体；**Max 订阅 + 本地运行，暂不云端常驻**（D4 事件触发、D7 不引入 DeerFlow）。
- 规约 SoT=OpenSpec（已装项目级）；分支策略=驭手 8 条军规（D8）。
- HITL 签字全为 BOSS（D1）；drift 按 §6 全套执行（D5）；D9 用第三方消息组件渐进落地。
- 工具：见 `tools/TOOLS.md`。

## 9. 边界与风险（必须显式承认）

- **规格模糊是能力上界**：说不清想要什么，正确性就出 sensor 职责范围（→V4 §12，Ashby）。
- **自演进回归预测弱**：自动回灌不保证不引入回归，须独立回归 sensor 兜底 + 人类门禁（→V4 §5）。
- **过度约束会失效**：harness 从窄到宽（→V4 §13）。

## 10. 里程碑（简→繁）

详见 `docs/plan/铁锤小队-能力backlog-v1.md`（M0 最小切片 → … → M8 自演进回灌）。
