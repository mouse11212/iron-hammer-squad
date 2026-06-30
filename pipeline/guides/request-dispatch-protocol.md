# 会话级请求分诊协议（Request Dispatch Protocol）

> 形态：**inferential 前馈 guide**（V4 §4.1 控制矩阵里的「推断性前馈引导」）。
> 判定主体：**据本协议行事的编排 agent / 人**——不是确定性计算门。
> 配套：`2026-06-29-pipeline-process-guardrails`（computational 反馈门）攻追溯链；本协议攻技能路由的**前馈**半边。前馈/反馈成对才闭环（KB guides-and-sensors「缺一不可」）。
> capability：`request-dispatch`（OpenSpec 活规约 SoT，判例为可复核 Scenario，见 `docs/openspec/specs/request-dispatch/`）。
> 验证来源：2026-06-29 两路只读审计 + KB 接地（`docs/plan/2026-06-29-meta-router-dispatch-protocol-design.md`）。

## 怎么用（给主 agent）

每次会话级请求来临，**先按 §1 判轨道，再按 §2 判工件状态→下一步**，横切护栏（§3）始终生效。判定结果 = `{轨道, SDLC 步, 角色, skill}`。**无法归类或缺信息 → ⑦ 升级人，不臆造**（红线6）。

---

## §1 一级轨道分诊（7 轨 MECE）

把请求分到下列 7 条互斥轨道之一：

| 轨 | 触发条件（这是什么活） |
|---|---|
| ① 立项轨 | 新需求/概念，范围(含 out-of-scope)/技术架构/NFR/全局视觉风格未澄清 |
| ② 规约轨 | 需求设计就绪，需 Epic/US/task 拆分、写/校验活规约、实现前评审 |
| ③ 内循环实现轨 | 单 US 内：US 级 UI / 测试先写 / 实现 / 安全 / 评审 |
| ④ 验收发布轨 | epic 收口：验收 / 构建 / 部署 / ReleaseNote / 复盘 |
| ⑤ harness 自身工程轨 | 改铁锤小队本身（pipeline/driver/roles/guides）；元层面 |
| ⑥ 纯查询/咨询轨 | 问答/检索，无交付物 |
| ⑦ 未知/缺信息 | 无法归类 **或** 触 Ask-First → 阻塞升级人（兜底，红线6） |

### 13 角色全覆盖对账表（MECE 验收：无一遗漏归属）

| 角色 / 步 | 归属轨道 | 二级触发条件 | 规定 skill |
|---|---|---|---|
| 产品/澄清 Agent | ① 立项轨 | 新需求，范围未澄清 | gstack(/office-hours、/plan-ceo-review) · claude-obsidian |
| 架构 Agent | ① 立项轨 | 技术选型/NFR 未定，需 design.md | gstack(/plan-eng-review) + OpenSpec(design.md) |
| 全局 UX/UI 风格规约（系统级）⊕ | ① 立项轨 | 系统整体视觉/交互约束未定（设计系统级） | frontend-design + gstack(designer) |
| Bootstrap/初始化 Agent | ① 立项轨 | 新仓库，无骨架/CLAUDE.md/规约结构 | OpenSpec(init) + bootstrap |
| 规划/拆分 Agent（Planner）⊕新 | ② 规约轨 | 需求设计就绪，需 Epic→US→task 拆分（依赖 DAG + 执行顺序） | pev-loop Plan phase（§4.2 表外·新角色）|
| 规约 Agent（SoT 守门） | ② 规约轨 | US/task 已分解，写/校验活规约 | OpenSpec(proposal/specs/tasks, validate --strict) |
| 一致性 check 门 ⊕新 | ② 规约轨 | 任一派生物产出后：需求澄清→设计→US/task 前后一致校验 | §4.4 追溯链机制化门 |
| 设计合理性评审 Agent ⊕ | ② 规约轨 | 规约就绪，**实现前**对抗评审合目的性 | §4.2 表外·补充 |
| US 级 UI/UX（US 级触发点）| ③ 内循环实现轨 | 单 US 涉界面，需该 US 具体 UI（受①全局风格约束） | frontend-design + gstack(designer) |
| 测试 Agent | ③ 内循环实现轨 | 有 spec **无 test**，先写功能/集成用例 | superpowers(TDD/RED-GREEN-REFACTOR) + gstack(/qa) |
| 开发 Agent | ③ 内循环实现轨 | 有 test **无实现**，worktree 内 TDD | superpowers(writing/executing-plans, TDD, worktree, subagent-driven) |
| 安全 Agent | ③ 内循环实现轨 | 改动触敏感面(鉴权/密钥/CI/依赖)，插安全门 | gstack(/cso:OWASP+STRIDE) |
| 评审 Agent | ③ 内循环实现轨 | 有实现**未评审**，计划/代码两遍 | superpowers(requesting/receiving-code-review) + gstack(/review) |
| 验收 Agent ⊕ | ④ 验收发布轨 | epic 收口，视觉+合目的性验收 | §4.2 表外·补充 |
| 发布/文档 Agent | ④ 验收发布轨 | 验收过，构建/部署/ReleaseNote/复盘 | gstack(/ship、doc engineer、/retro、/learn) |

> ⊕ = §4.2 表外补充角色；⊕新 = 本协议新增（BOSS 补充或诊断缺口）。
> **已知缺口（暂无实现文件，补建留后续切片，YAGNI/红线3）**：Bootstrap / 架构 / 规约 / 发布文档 / 规划-Planner。本表登记其归属与 skill，role 文件待补。

### 三条「非产品-SDLC」出口（保证 MECE 穷尽）

| 轨道 | 触发条件 | 去向 |
|---|---|---|
| ⑤ harness 自身工程轨 | 请求改铁锤小队本身（pipeline/driver/roles/guides） | superpowers:SDD 或直接 TDD+OpenSpec（CLAUDE.md §5）；元层面 |
| ⑥ 纯查询/咨询轨 | 问答/检索，无交付物 | claude-obsidian KB grounding，不进流水线 |
| ⑦ 未知/缺信息 | 无法归类 **或** 触 Ask-First | 阻塞升级人（红线6 / V4 §4.5），永远兜底 |

---

## §2 二级工件状态判定（防跳步）

在产品开发轨（①②③④）内，据工件**当前状态**定位下一个该做的 SDLC 步：

```
① 立项轨：
   需求澄清(产品/澄清) → 需求设计{ 技术架构+NFR(架构) ‖ 全局UX/UI风格规约(系统级) } → [新项目]Bootstrap
② 规约轨：
   Epic/US拆分→task拆分{依赖DAG+规划分配}(Planner) → 活规约(规约SoT)
   → ★一致性check门(需求澄清→设计→US/task 前后一致) → 设计合理性评审(实现前)
③ 内循环实现轨（每 US）：
   [涉UI]US级UI设计(US级) → 测试先写(测试) → 实现(开发,worktree TDD)
   → [触敏感面]安全评审(安全) → 评审两遍(评审) → commit(军规2)
④ 验收发布轨（epic 收口）：
   验收(验收,视觉+合目的性) → 发布/文档/复盘(发布/文档)
```

**防跳步铁律**：

- 需求未澄清 → 不直奔 ② 拆分（先 ① 澄清）。
- 无活规约 → 不直奔 ③ 开发（先回 ② 产规约）。
- 有实现未评审 → 不直奔 ④ 验收（先 ③ 评审两遍）。
- 触敏感面 → ③ 内插安全门（不跳过）。

---

## §3 横切护栏（不分轨道，每条都适用）

1. **Ask-First**（V4 §4.3）：引入新依赖、改既有测试、定重试间隔 → 停下问人，不自行拍板。
2. **Never**（V4 §4.3）：由 Plan-Alignment Gate / 后续 hook 拦截。
3. **测试反作弊**（V4 §4.6）：写测试 agent ≠ 写实现 agent（红线4）；变异门为不可延后硬 gate（红线5）。
4. **追溯链**（V4 §4.4）：`概念→spec→US→task→测试→commit` 每节点带唯一 ID，可正反向回溯。
5. **阻塞升级**（V4 §4.5）：任何 agent 遇未知/缺信息 → 交还人类，禁止臆造（红线6）。

---

## §4 精简注入版（≤40 行速查卡，供后续 UserPromptSubmit hook）

> 本节为本协议的注入形态：结构紧凑、可作 `additionalContext` 注入（避 hook 30s 超时 + context 膨胀）。
> **本 MVP 不实现 hook 注入，仅产出可被注入的速查卡**。下一刀切片（设计 §10-A）接线。

```
【请求分诊·两步】
1) 判轨道(7选1,互斥):
   ①立项 ②规约 ③内循环实现 ④验收发布 ⑤harness自身 ⑥纯查询 ⑦未知→升级人
   →⑤改铁锤小队自身(pipeline/*);⑥问答无交付物;⑦说不清/触Ask-First→问人
2) 产品轨内判工件状态→下一步(防跳步):
   无澄清→①澄清;无设计→①设计;无规约→②产规约;无test→③测试先写;
   有test无实现→③开发TDD;触敏感面→③安全;有实现未评审→③评审两遍;epic收口→④验收→发布
【角色↔skill 速查】
   产品澄清=gstack/office-hours·claude-obsidian | 架构=gstack/plan-eng-review+OpenSpec
   全局UX/UI(系统级)=frontend-design+gstack | Bootstrap=OpenSpec init | Planner=pev-loop(新)
   规约=OpenSpec validate--strict | 一致性门=§4.4 | 设计合理性评审=表外补充
   US级UI=frontend-design+gstack | 测试=superpowers TDD+gstack/qa | 开发=superpowers+worktree
   安全=gstack/cso(OWASP+STRIDE) | 评审=superpowers code-review+gstack/review
   验收=表外补充 | 发布/文档=gstack/ship·/retro·/learn
【横切·每轨适用】
   Ask-First(新依赖/改测试/重试间隔→问人) | Never(Gate拦) | 测试反作弊(写测≠写实现,变异门硬)
   追溯链(每节点带ID) | 阻塞升级(未知→人,红线6)
【铁律】无法归类/缺信息 → ⑦升级人,不臆造。
```
