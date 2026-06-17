# 铁锤小队 · 能力 Backlog v1（简 → 繁）

> **定位**：把 V4 拆成**有序、可独立演示、可短命快合**的能力切片，按 §13"从最小垂直切片起步、约束被失败拉出来"排序。
> **用法（方案一）**：每拿起一个切片 → 用 OpenSpec 开一个 change（`/opsx:propose`）写可执行规约 → TDD 实现 → 确定性 gate → 合并。本 backlog 只管**排序与边界**，规约细节在 OpenSpec，机制依据在 V4。
> 图例：依赖指"必须先完成的切片"。每个里程碑独立可演示后才进下一个。

## 路线图总览

| 里程碑 | 能力 | 依赖 | 映射 V4 | 演示判据（DoD 精要） |
|---|---|---|---|---|
| **M0** | 单 US 内循环最小切片 | — | §3.4、§13 | 在一个玩具产品上：规约切片→test-first→实现→**1 道确定性 gate(lint 或变异)**→全绿合并，端到端跑通一次 |
| **M1** | 约束层 + 规则边界 | M0 | §4.1、§4.3 | Always/Ask-First/Never 写入 AGENTS.md；新增 Plan-Alignment gate（Hook/PreToolUse 拦截 Never/越界/重复造组件） |
| **M2** | 多角色编排 | M1 | §3.1、§4.2 | Claude Code subagents 跑通 Planner-Workers-Judge：测试 Agent≠开发 Agent，评审两遍 |
| **M3** | 事件触发 + 状态外置 | M2 | §3（D4）、§3.1 | 本地事件（规约 delta/测试转绿/合并完成）经胶水 `claude -p` 拉起对应循环；状态/检查点外置，崩溃可恢复 |
| **M4** | 追溯链 + 看板 + 指标采集 | M3 | §4.4、§7 | 双向追溯链带 ID 可回放；PM 看板；采集 harness 四指标（含 Verification Tax）原始数据 |
| **M5** | 并行内循环 + 消息组件 | M4 | §3.1（D9）、§9 | 第三方消息组件(MCP)支持 2 个并行内循环；worktree 隔离 + 集成分支兜底 + squash |
| **M6** | NFR 门 + 安全门 | M4 | §8、§4.7、§9军规7 | NFR 派生测试入门禁；OWASP/STRIDE + CodeQL/Dependabot 前置；敏感改动加严审批 |
| **M7** | drift 监控 | M3 | §6 | ASI 类 sensor（语义相似度/共识率/工具序列一致性）滚动窗口告警；两级拓扑；EMC/ABA |
| **M8** | 自演进回灌（Steering Loop 自动化） | M4、M7 | §2、§5 | 失败 → 自动产出对 rules/gate 的 diff 建议，**经人类门禁**后固化；带独立回归 sensor 兜底 |

## 里程碑细节（仅 M0–M2，后续拿起时再展开）

### M0 · 单 US 内循环最小切片（先做这个）
- **目标**：证明内循环这条"管道"端到端能通——这是整个 harness 的最小可靠单元。
- **范围**：选一个**玩具产品**（如一个纯函数库/CLI 小工具，无 UI、无浏览器，避开 gstack /qa 依赖）。
- **步骤**：OpenSpec 写 1 个 US 的规约切片 → 测试 Agent 先写用例 → 开发 Agent 在 worktree 内 TDD 实现 → **1 道确定性 gate**（先 lint，能力到位再加变异）→ 全绿 → 合并集成分支。
- **DoD**：跑通一次；产出第一条追溯链（spec→test→commit）；记录本切片的 token/墙钟作为后续基线（→V4 §7）。
- **刻意不做**：多角色、事件触发、drift、并行——全部留给后续里程碑（避免过度约束，→V4 §13）。
- **显式技术债（决策 B）**：**外循环的"需求澄清 via gstack 产品/澄清 Agent"在 M0 跳过，延后到 M2**。M0 仅内循环验证；产品澄清 grounding 从简，待 M2 补做并回填规约上游。

### M1 · 约束层 + 规则边界
- AGENTS.md/CLAUDE.md 落 Always/Ask-First/Never（→V4 §4.3）。
- Plan-Alignment gate 做成 Hook：拦截 Never 规则、文件越界、本应复用却新造组件（→V4 §3.4、§4.1）。
- **失败驱动**：M0 跑通后观察到的真实失误，正是 M1 要固化的约束（→V4 §2 Steering Loop）。

### M2 · 多角色编排
- 用 Claude Code subagents 实现 Planner-Workers-Judge（→V4 §3.1）。
- 严守"写测试≠写实现"，评审分计划/代码两遍（→V4 §4.2、§4.6）。
- 暂用外置 JSON 状态文件做 task 依赖（消息组件留到 M5，→V4 §3.1 D9 最小方案 Step 0）。
- **搭建外循环角色，含 gstack 产品/澄清 Agent（/office-hours、/plan-ceo-review）**：偿还 M0 延后的需求澄清技术债，产出产品概念/用户画像/痛点/场景并回填规约上游（→V4 §3.3、§4.2）。

## 排序原则

1. **每个里程碑可独立演示且可短命快合**（→V4 §10）。
2. **约束被失败拉出来**：先跑最小切片，用实测失误决定下一层加什么约束（→V4 §2、§13），不一次想全。
3. **先确定性后推断性**：先上 computational gate（lint/变异），AI review 等 inferential 控制随信任度逐步放开（→V4 §4.1）。
