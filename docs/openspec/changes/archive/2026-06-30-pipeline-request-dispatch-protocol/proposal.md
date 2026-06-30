## Why

BOSS 审计（2026-06-29）发现：**铁锤小队在开发它自己（及词灵岛验证载体）时，并未遵守自己定义的技能路由表（V4 §4.2）**。两路只读审计 + git/观察日志证据（详见 `docs/plan/2026-06-29-meta-router-dispatch-protocol-design.md` §1）定位三层根因：

- **根因1 前馈断链**：路由表写在宪法层（V4 §4.2），未下沉到 role 文件。8 个 role 中仅 2 个（product-clarify、security-review）显式声明 skill；**dev/test/review 三个核心角色未声明 superpowers**（本 change 已核实：三份 role 文件均无 skill 路由段）。orchestrator 读不到"该注入哪个 skill" → 路由靠主 agent 凭记忆 → 漂移。
- **根因2 无反馈 sensor**：没有任何 sensor 事后核对"实际走的角色/skill == 路由表规定的吗"。漂移无声发生。
- **根因3 路由表不完整 + 三层混淆**：Epic/US/task 拆分规划、harness 自身轨 vs 产品轨的分流判断，全靠主 agent 即兴，无机制。

与 `2026-06-29-pipeline-process-guardrails` change **互补**：那个 change 把"**追溯链**"从 prose 升级为确定性门（`traceCheck`），但"**技能路由**"仍是 §4.1 控制矩阵里最弱的「推断性前馈引导、零确定性门」——本切片攻这一半（前馈半边）。

**MVP 第一刀定位（红线3 从窄到宽）**：纯 prose 前馈 guide + role skill 声明下沉 + 宪法回填。前馈/反馈成对才闭环（KB guides-and-sensors「缺一不可」）：反馈半边（UserPromptSubmit hook 注入 + Stop/SubagentStop 漂移 sensor）为后续切片（设计文档 §10），本切片不涉及代码、hook、driver。

## What Changes

- **新能力 `request-dispatch`**（会话级请求分诊协议，**inferential 前馈 guide**）：每次请求来临，据协议判定 → 轨道 → SDLC 步 → 角色/skill。两轴判定（一级轨道 × 二级工件状态，防跳步）。7 条轨道 MECE 覆盖 13 角色无一遗漏；未知/缺信息 fallback 人（红线6）。
  - **诚实边界（红线1）**：本能力判定主体 = 据协议行事的编排 agent/人，属 **inferential 前馈引导**，**非 computational 确定性门**。判例（Scenario）是可由人/agent 据协议复核的判定，不是机器自动执行的函数断言。真正"上门"（强制路由核对）需后续 hook/sensor 切片（§10）。
- **role 文件 skill 声明下沉**（修根因1，把 V4 §4.2 下沉到执行层）：dev/test/review-agent.md 补 `## 技能路由（V4 §4.2 对账）`段；ui-agent.md 补 gstack(designer) + 标系统级/US 级两触发点；design-soundness/acceptance-agent.md 标「§4.2 表外补充角色」；product-clarify/security-review 对账确认。
- **V4 §4.2/§4.4 宪法回填**（🔴 红线7，BOSS 已签字批准 2026-06-30）：
  1. design-soundness Agent / 验收 Agent 回填 §4.2 表（补 skill 列）；
  2. 轨⑤ harness 自身工程轨正式纳入协议范围（标注元层面）；
  3. 新增 规划/拆分 Agent（Planner）进 §4.2 表（Epic/US/task 依赖拆分规划）；
  4. UX/UI Agent 职责拆分为系统级（全局风格规约）/ US 级（单 US 实现）两触发点；
  5. 新增 一致性 check 门（需求→设计→US/task 前后一致）进 §4.4 追溯链机制化。

## Capabilities

### New Capabilities
- `request-dispatch`: 会话级请求分诊协议——两轴判定（轨道 × 工件状态），7 轨 MECE 覆盖 13 角色，未知 fallback 人（inferential 前馈 guide，判例为可复核 Scenario）。

### Modified Capabilities
- 无。V4 宪法（`docs/requirements/`）与 role 文件（`pipeline/roles/`）不是 OpenSpec capability；它们的改动在本 change 的 Impact 登记。

## Impact

- **新增**：`pipeline/guides/request-dispatch-protocol.md`（4 节：一级轨道分诊 + 二级工件状态判定 + 横切护栏 + ≤40 行精简注入速查卡）。
- **改 role 文件**：`pipeline/roles/{dev,test,review,ui,design-soundness,acceptance,product-clarify,security-review}-agent.md`（skill 声明对账/补全/标注；纯 prose 改动）。
- **回填宪法**：`docs/requirements/铁锤小队-Harness工程构思-v4.md` §4.2（5 条变更中的 1/2/3/4）、§4.4（第 5 条）。
- **不改任何 `.ts` 源码**（纯 prose）→ `spec-coverage` 门不触发（门只看 `pipeline/*/src/**/*.ts`）。
- **不补建缺失 role 文件**（Bootstrap/架构/规约/发布文档/Planner）——协议登记缺口、标"暂无实现文件"，补建留后续切片（YAGNI/红线3）。
- **验证来源**：2026-06-29 两路只读审计 + KB 接地（设计文档 §2：loop-engineering / pev-loop / orchestrator-patterns / agent-skills-standard / guides-and-sensors）+ 本工程 git/观察日志证据。
- **验证**：判例（设计 §9）≥8 全部命中（prose 无单测 → 穷尽判例兜底）；改完跑既有 driver/metrics gate 确认 role 文件 prose 改动零回归。
