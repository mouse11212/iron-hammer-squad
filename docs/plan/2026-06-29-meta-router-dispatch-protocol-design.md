# 会话级请求分诊协议（meta-router）设计 · MVP 第一刀

> 状态：设计待 BOSS review（brainstorming 产出）
> 日期：2026-06-29
> 作者：③Compound 观察者 + 主编排 agent（subagent-driven 调研）
> 关联诊断：本文 §1；关联 KB 接地：本文 §2

---

## 1. 背景与动机（诊断结论）

### 1.1 起因

BOSS 发现：**铁锤小队在开发它自己（及词灵岛验证载体）时，并未遵守自己定义的技能路由表（V4 §4.2）**。要求：① 审计需求澄清/US 拆分/US 开发/testcase/commit 各步是否遵守路由表、找出不遵守的原因；② 让铁锤小队在**每次请求来临时自己判断该用哪个 skill、跳到 SDLC 哪一步**；③ 所有实现遵守知识库（KB）指导。

### 1.2 诊断（规定态 vs 实际态，两路只读审计 + git/观察日志证据）

| SDLC 步骤 | 路由表规定 | 实际 | 判定 |
|---|---|---|---|
| 需求澄清 | product-clarify-agent + gstack/office-hours | 手工 + BOSS 人裁；PM agent 试用后退役 | ❌ 偏离（刻意，harness 未稳）|
| US 拆分 | **路由表未规定** | 手工切片 + BOSS 裁决 | ⚪ 路由表空白（真缺口）|
| US 开发 | dev-agent + superpowers | dev-agent（产品）/ superpowers:SDD（harness 自身）| ✅ 遵守（分层）|
| testcase | test-agent + superpowers(TDD) | test-agent；TDD 已固化成内循环纪律 | ✅ 遵守 |
| 评审 | review-agent + superpowers(code-review) | review-agent 两遍 | ✅ 遵守 |
| commit | 军规2 分支纪律 | 纯军规2 + 手动 | ⚪ 无 skill，纪律执行 |

### 1.3 三层根因

- **根因1 — 前馈断链**：路由表写在宪法层（V4 §4.2），未下沉到 role 文件。8 个 role 中仅 2 个（product-clarify、security-review）显式声明 skill；dev/test/review 三个核心角色**未声明** superpowers。orchestrator 读不到"该注入哪个 skill" → 路由只能靠主 agent 凭记忆 → 漂移。
- **根因2 — 无反馈 sensor**：没有任何 sensor 事后核对"这一步实际走的角色/skill == 路由表规定的吗"。漂移**无声发生**。
- **根因3 — 路由表本身不完整 + skill/纪律/角色三层混淆**：需求澄清/US 拆分/外循环触发本就刻意人在环（红线3 从窄到宽，可接受）；TDD/commit 已从 skill 沉淀成纪律（非违规）；但 **Epic/US/task 拆分规划、harness 自身轨 vs 产品轨的分流判断，全靠主 agent 即兴，无机制**。

### 1.4 核心结论：BOSS 两诉求是一枚硬币两面

| 诉求 | 缺失机制 | KB 锚点 |
|---|---|---|
| 为什么没遵守路由表 | **流程漂移 Sensor**（反馈）| guides-and-sensors：缺反馈则"不知规则是否生效"|
| 每次请求自己判断 skill/步骤 | **Router/Dispatcher**（前馈）| loop-engineering：「替换掉那个反复 prompt 的人」|

KB 硬约束：**前馈 + 反馈缺一不可，必须成对落地**。只做 router 会重蹈"编码了规则却不知是否生效"。

---

## 2. KB 接地（红线2 强制，已查 KB 再决策）

| KB 页 | 对设计的约束 |
|---|---|
| **loop-engineering**（Osmani）| 动态路由器 = loop engineering 核心定义本身；KB 无现成 router 页 → 本能力为自建（标"验证来源"，不臆造）|
| **pev-loop** | 路由判断属 **Plan phase**「减少自由度」；Epic/US/task 拆分 = Plan phase「显式分解 + acceptance criteria + 识别依赖 + 确定执行顺序」；Plan-Alignment Gate = "用既有组件还是另起炉灶"的会话级翻版 |
| **orchestrator-patterns** | 路由 = Planner-Workers-Judge 的 **Planner** 职责；规划/拆分 Agent = Planner |
| **agent-skills-standard** | skill 选择底层 = 渐进式披露（discovery：name+description ~100token）→ router 靠 description 匹配 → 路由表/role 的 description 必须可判别 |
| **guides-and-sensors** | 前馈/反馈缺一不可；Ashby 必要多样性：router 无法路由"没有模型"的请求类型 → 未知必须 fallback 到人（红线6）|

### 2.1 Claude Code hook/plugin 能力核实（claude-code-guide agent，基于官方文档）

- **UserPromptSubmit hook**：每次提交前触发，可 `additionalContext` 注入文本、可 `block`；**30 秒超时** + 注入过量撑爆 context（已知坑）。
- **🔴 hook 不能强制调 skill**（官方："cannot trigger `/` commands or tool calls"）→ 只能**软引导**（注入建议）或**硬拦截**（block 工具/prompt）。
- hook 有 5 种类型：`command`/`prompt`(单轮 LLM)/`agent`(多轮)/`http`/`mcp_tool` → hook 本身能做 inferential 判断，不必在 shell hook 内塞 `claude -p`（会超时）。
- **Stop/SubagentStop hook（type: agent）= 事后核对路由最强**：读日志、跑命令、验证"实际走的 == 规定的"，不合规 block + 反馈。
- **plugin** 能打包 hooks+skills+agents+commands，装好即用 → 即最终插件形态。

### 2.2 由 hook 能力锁定的架构本质

因 hook 不能强制调 skill，meta-router 是「**每次都提醒 + 事后硬核对**」，**不是「硬性自动跳转」**。这符合红线6（不替人拍板）与 Ashby 边界（未知请求 fallback 人）。它是**机制化的纪律**，不是全自动遥控。

---

## 3. 目标与非目标

### 3.1 目标（MVP 第一刀，纯 prose、零代码）

1. 产出**请求分诊协议**（前馈 guide）：主 agent 每次面对请求按它判定 → 轨道 → SDLC 步 → 角色/skill；未知 fallback 人。
2. **补全 role 文件 skill 声明**（修根因1），把 V4 §4.2 下沉到执行层。
3. 协议设计成**可被下一刀 hook 注入**的形态（含精简注入版速查卡）。

### 3.2 非目标（YAGNI，红线3 从窄到宽，刻意推到后续切片）

- ❌ 不做 hook（UserPromptSubmit 注入）——**下一刀**。
- ❌ 不做 Stop/SubagentStop 漂移 sensor（反馈半边）——**下一刀**。
- ❌ 不做 driver 代码 dispatcher——更后（独立切片）。
- ❌ MVP 不补建缺失的 4 个 role 文件（Bootstrap/架构/规约/发布文档），仅在协议登记缺口。

---

## 4. 架构：会话级 meta-router，两轴判定

```
请求来临
  │
  ├─ 一级：轨道分诊（这是什么活）
  │    ① 立项轨    ② 规约轨    ③ 内循环实现轨    ④ 验收发布轨
  │    ⑤ harness 自身工程轨   ⑥ 纯查询/咨询轨   ⑦ 未知→升级人（兜底）
  │
  └─ 二级：工件状态定位（产品开发轨内，到哪一步了 → 下一个该做的 SDLC 步 → 角色/skill）
```

判定逻辑 = **方案B 两轴判定**（意图 × 工件状态），防"跳步"（如无 spec 却直奔 dev）。

---

## 5. 轨道划分：对路由表职责边界全覆盖（MECE）

**完备性验收标准**：V4 §4.2 全部 10 角色 + §3.4 的 2 补充角色 + BOSS 新增的规划/拆分 Agent = **13 角色无一遗漏归属**；UX/UI Agent 有两个触发点（系统级 / US 级）。

### 5.1 产品 SDLC 四大轨（含 BOSS 三点补充）

| 角色 / 步 | 归属轨道 | 二级触发条件 | 规定 skill |
|---|---|---|---|
| 产品/澄清 Agent | **① 立项轨** | 新需求/概念，范围(含 out-of-scope)未澄清 | gstack/office-hours · claude-obsidian |
| 架构 Agent（需求设计-技术侧）| **① 立项轨** | 技术选型/组件/NFR 未定，需 design.md | gstack/plan-eng-review + OpenSpec |
| **全局 UX/UI 风格规约**（UX/UI Agent 系统级）⊕新 | **① 立项轨** | 需求设计阶段，**系统整体**风格/视觉/交互约束未定（设计系统级，区别于 US 级 UI）| frontend-design + gstack(designer) |
| Bootstrap/初始化 Agent | **① 立项轨** | 新仓库/项目，无骨架/CLAUDE.md/规约结构 | OpenSpec(init) + bootstrap |
| **规划/拆分 Agent（Planner）**⊕新 | **② 规约轨** | 需求设计就绪，需 Epic→US→task 拆分，**含依赖 DAG + 执行顺序规划 + 合理分配** | (§4.2 表外·新角色；KB pev-loop Plan phase) |
| 规约 Agent(SoT) | **② 规约轨** | US/task 已分解，需写/校验活规约 | OpenSpec(proposal/specs/tasks, validate --strict) |
| **一致性 check 门**⊕新 | **② 规约轨** | 任一派生物产出后：需求澄清 → 需求设计 → US/task **前后一致校验**，不一致触发对账整改 | (§4.4 追溯链一致性，机制化门) |
| 设计合理性评审 Agent ⊕ | **② 规约轨** | 规约就绪，**实现前**对抗评审合目的性 | (§4.2 表外·补充) |
| US 级 UI/UX 设计（UX/UI Agent US 级）| **③ 内循环实现轨** | 单个 US 涉界面，需该 US 的具体 UI 实现（受①全局风格规约约束）| frontend-design + gstack(designer) |
| 测试 Agent | **③ 内循环实现轨** | 有 spec **无 test**，先写功能/集成用例 | superpowers(TDD) + gstack/qa |
| 开发 Agent | **③ 内循环实现轨** | 有 test **无实现**，worktree 内 TDD | superpowers(writing/executing-plans/worktree) |
| 安全 Agent | **③ 内循环实现轨** | 改动触敏感面(鉴权/密钥/CI/依赖)，插安全门 | gstack(/cso:OWASP+STRIDE) |
| 评审 Agent | **③ 内循环实现轨** | 有实现**未评审**，计划/代码两遍 | superpowers(code-review) + gstack/review |
| 验收 Agent ⊕ | **④ 验收发布轨** | epic 收口，需视觉+合目的性验收 | (§4.2 表外·补充) |
| 发布/文档 Agent | **④ 验收发布轨** | 验收过，需构建/部署/ReleaseNote/复盘学习 | gstack(/ship、/retro、/learn) |

⊕ = §4.2 表外角色/门；⊕新 = 本设计新增（BOSS 补充或诊断缺口）。

### 5.2 三条「非产品-SDLC」出口（保证 MECE 穷尽）

| 轨道 | 触发条件 | 去向 |
|---|---|---|
| **⑤ harness 自身工程轨** | 请求改铁锤小队本身（pipeline/driver/roles/guides）| superpowers:SDD 或直接 TDD+OpenSpec（CLAUDE.md §5）；元层面，§4.2 外 |
| **⑥ 纯查询/咨询轨** | 问答/检索，无交付物 | claude-obsidian KB grounding，不进流水线 |
| **⑦ 未知/缺信息** | 无法归类 **或** 触 Ask-First | 阻塞升级人（红线6 / §4.5），永远兜底 |

### 5.3 完整 SDLC 链（从需求到 commit，体现 BOSS 的"前后一致"链）

```
① 立项轨：
   需求澄清(产品/澄清) → 需求设计{ 技术架构+NFR(架构) ‖ 全局UX/UI风格规约(UX/UI系统级) } → [新项目]Bootstrap
② 规约轨：
   Epic/US拆分→task拆分{依赖DAG+规划分配}(规划/拆分 Planner) → 活规约(规约SoT)
   → ★一致性check门(需求澄清→设计→US/task 前后一致) → 设计合理性评审(实现前)
③ 内循环实现轨（每 US）：
   [涉UI]US级UI设计(UX/UI US级) → 测试先写(测试) → 实现(开发,worktree TDD)
   → [触敏感面]安全评审(安全) → 评审两遍(评审) → commit(军规2)
④ 验收发布轨（epic 收口）：
   验收(验收,视觉+合目的性) → 发布/文档/复盘(发布/文档)
```

---

## 6. 横切护栏（不分轨道，每条都适用；来自 §4.3/§4.5/§4.6）

1. **Ask-First**（§4.3）：引入新依赖、改既有测试、定重试间隔 → 停下问人，不自行拍板。
2. **Never**（§4.3）：由 Plan-Alignment Gate / Hook 拦截。
3. **测试反作弊**（§4.6）：写测试 agent ≠ 写实现 agent；变异门为不可延后硬 gate。
4. **追溯链**（§4.4）：`概念→spec→US→task→测试→commit` 每节点带唯一 ID，可正反向回溯；BOSS 强调的"需求澄清→设计→US/task 前后一致"是此链早期段的 §5.1「一致性 check 门」。
5. **阻塞升级**（§4.5）：任何 agent 遇未知/缺信息 → 交还人类，禁止臆造。

---

## 7. 两个产物形态

### 7.1 产物1 — 分诊协议文档

路径：`pipeline/guides/request-dispatch-protocol.md`（前馈 inferential guide，放 guides/）。

结构四节：
- **§1 一级轨道分诊** + §5.1/5.2 的角色全覆盖对账表
- **§2 二级工件状态判定** + §5.3 完整 SDLC 链
- **§3 横切护栏**（§6）
- **§4 精简注入版**：≤40 行速查卡，供**下一刀 hook** 注入（避 30s 超时 + context 膨胀）

### 7.2 产物2 — role 文件 skill 声明补全（修根因1）

| role 文件 | 动作 |
|---|---|
| dev-agent.md / test-agent.md / review-agent.md | 加 `## 技能路由（V4 §4.2 对账）` 段，补全 superpowers + gstack 声明 |
| ui-agent.md | 补 gstack(designer)；标注系统级 vs US 级两触发点 |
| design-soundness / acceptance-agent.md | 标注「§4.2 表外补充角色」 |
| product-clarify / security-review-agent.md | 已合规，对账确认 |

**已知缺口（MVP 不补，仅协议登记）**：Bootstrap / 架构 / 规约 / 发布文档 / **规划-Planner** 这些角色 §4.2 有规定（或本设计新增）但 pipeline/roles 下无文件。协议指向它们并标注"暂无实现文件"，补建留后续切片。

---

## 8. V4 §4.2 宪法变更项（🔴 红线7，需 BOSS 签字 — 已在 brainstorm 口头同意，落 doc 待 review 复核）

1. 把 **design-soundness Agent / 验收 Agent** 回填 §4.2 表（补 skill 列）。
2. **轨⑤ harness 自身工程轨**正式纳入协议范围（标注元层面）。
3. 新增 **规划/拆分 Agent（Planner）** 进 §4.2 表（Epic/US/task 依赖拆分规划）。
4. UX/UI Agent 职责拆分为**系统级（全局风格规约）/ US 级（单 US 实现）**两触发点。
5. 新增 **一致性 check 门**（需求→设计→US/task 前后一致）进 §4.4 追溯链机制化。

> MVP 内：先在新协议文档落地以上；V4 §4.2/§4.4 的实际回填作为同批 prose 改动（guide/规约 prose 直接提交，但 §4.2 属架构宪法 → 经 BOSS review 本 spec 即视为签字授权）。

---

## 9. 验证策略（prose 无单测 → 穷尽判例兜底）

建**路由判例表**（放 `pipeline/guides/request-dispatch-protocol.md` 附录或同目录 `*-cases.md`），取真实历史请求逐条过协议，断言"判定到的轨道/角色 == 应走的"：

| 历史请求（来自观察日志/git）| 期望轨道 → 角色/步 |
|---|---|
| "实现 US-2 金币连对加成" | ③ → 测试 Agent（有 spec 无 test）|
| "评审听音选词玩法是否暴露答案" | ② → 设计合理性评审 Agent |
| "补 clampPercent 的 stryker 变异目标" | ⑤ harness 自身工程轨 |
| "问 KB 怎么做 drift sensor" | ⑥ 纯查询轨 |
| "把词灵岛拆成 Epic 和 US" | ② → 规划/拆分 Agent（依赖 DAG）|
| "定词灵岛整体视觉风格" | ① → 全局 UX/UI 风格规约 |
| "给某 US 做具体界面" | ③ → US 级 UI/UX 设计 |
| "未说清要什么/缺信息" | ⑦ 升级人 |

≥8 判例全部命中 = MVP 验证通过。

---

## 10. 后续切片（红线3 从窄到宽，本 MVP 之后）

1. **下一刀 A — hook 前馈**：plugin 骨架 + UserPromptSubmit hook 注入 §4 精简协议（实跑验证机制）。
2. **下一刀 B — hook 反馈**：Stop/SubagentStop（type: agent）漂移 sensor，核对"实际走的路由 == 规定的"，不合规 block+反馈（修根因2）。
3. **更后 — driver dispatcher**：把协议机制化进 pipeline/driver（方案C 阶段机+前置守门）。
4. **补建缺失 role 文件**：Bootstrap/架构/规约/发布文档/Planner。

> 前馈（本 MVP 协议 + 下一刀 A）与反馈（下一刀 B）**成对**才闭环，符合 guides-and-sensors「缺一不可」。
</content>
</invoke>
