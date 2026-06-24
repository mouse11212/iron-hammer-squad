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
| ✅ **M4+** | 可观测闭环（统一日志 + 追溯链自动化） | M4 | §7、§4.4、§3.1 | **已封板 2026-06-24**(地基+①–⑦)：统一事件日志 traceId 全链回放；追溯链自动织链(取代手维护 traces.json)；Verification Tax 持久(Metrics-Phase-Ms trailer)；Defect Escape 自动喂(Caught/Escaped trailer);inner-loop 统计持久(runs-ledger);report 历史归档(趋势)。详见 `M4plus-event-log-retro.md` |
| ✅ **M5** | 并行内循环 + 消息组件 | M4 | §3.1（D9）、§9 | **已完成**：node:sqlite 原子认领队列 + N 路并行 worker + stdio MCP;worktree 隔离 + 集成分支兜底 + squash;daemon 全链。详见 `M5A-retro.md`/`M5-inner-loop-retro.md` |
| ⬜ **M6（下一个）** | NFR 门 + 安全门 | M4 | §8、§4.7、§9军规7 | NFR 派生测试入门禁；OWASP/STRIDE + CodeQL/Dependabot 前置；敏感改动加严审批 |
| ⬜ **M7** | drift 监控 | M3 | §6 | ASI 类 sensor（语义相似度/共识率/工具序列一致性）滚动窗口告警；两级拓扑；EMC/ABA |
| ⬜ **M8** | 自演进回灌（Steering Loop 自动化） | M4、M7 | §2、§5 | 失败 → 自动产出对 rules/gate 的 diff 建议，**经人类门禁**后固化；带独立回归 sensor 兜底 |

> ✅ **M4+ 已封板**(2026-06-24)。M0–M5 + M4+ 全部完成；**下一主线里程碑 = M6（NFR 门 + 安全门）**。展开见下「明确待办」(M4+ 段已闭，留作历史)。

## 明确待办 · M4+ 可观测闭环（2026-06-23 立项 → ✅ 2026-06-24 封板）

> ✅ **已全部完成封板**(地基切片 + 续切片①–⑦,逐个 OpenSpec change 归档,全链真实验证)。完整复盘 + 贯穿洞察见 `docs/plan/M4plus-event-log-retro.md`。本段留作立项历史。**残留零头(非阻塞,见 RESUME §3 待办)**:metrics 包级 stryker 变异门、外部通知渠道、daemon 自动归档采样。

**动机**：V4 §7:204 要求"**所有操作记结构化日志，挂追溯链 ID，全链路可回放**"。M4 已搭骨架（四指标纯计算 + 看板 + 追溯链双向查询 + inner-loop 的 per-phase/gates/state 埋点），但 §7 目标**尚未自动闭合**——日志分散、追溯链手维护、Verification Tax 未埋点。

**当前缺口**（M4 复盘 + 代码核查，可溯源）：
- **无统一日志 schema**：现为 `${role}-${attempt}.jsonl` / `gates.jsonl` / `state.json` 各自为政，无统一"操作事件"格式与 traceId 贯穿（`pipeline/driver/src/inner-loop-runner.ts`）。
- **追溯链未自动化**：`pipeline/metrics/data/traces.json` 手维护，未从 OpenSpec change / git / runs 自动织链（`M4-E4-retro.md:9`）。
- **Verification Tax 待埋点**：实现/验证耗时未按 change 记录 → 指标报"待埋点"（`M4-E4-retro.md:11`）。
- **Defect Escape 手维护**：`defects.json` 未由 CI / bug 看板自动喂。

**范围**：
1. **统一日志 schema**：每个操作（phase / gate / squash / integrate / orchestrator-fix / queue claim-ack 等）落一条带 `traceId`（贯穿一个 US 全链）+ `op` + `ts` + 结构化 payload 的事件；沿用 IO/逻辑分离的薄边界确定性写入。
2. **追溯链自动织链**：changeId→spec→tests→commit 从 OpenSpec change / git numstat / runs state.json 自动采集，取代手维护 traces.json。
3. **Verification Tax 埋点**：按 change 记实现耗时 vs 验证（gate/review）耗时。
4. **全链路可回放**：据 traceId 串起一个 US 的所有事件，可回放。

**DoD**：任取一个已完成 US，凭其 `traceId` 能自动回放 规约→test→dev→review→gate→squash→integrate 的全部操作事件；四指标（含 Verification Tax）全部有真实值、无"待埋点"；追溯链零手维护。

**纪律提醒**：横切、增量推进，从窄到宽（红线3）——先定 schema + traceId 贯穿一条链，再逐步把各操作接入，不一次上统一日志框架。

## 明确待办 · M6 NFR 门 + 安全门（2026-06-24 立项，M5+ 主线）

**动机**：V4 §8（NFR 派生测试入门禁）/§4.7（安全门）/军规7（AI 代码加严审查、CodeQL/Dependabot 前置）。把"质量门"从功能正确性扩到 NFR/安全。

**拆解（从窄到宽，建议施工序）**：

| 子切片 | 内容 | 依赖/摩擦 | 序 |
|---|---|---|---|
| **M6-a 密钥扫描门** | 确定性扫改动 diff 找硬编码密钥(`ghp_`/AWS/PEM/通用赋值)→ green 红阻断;内联 `// allowlist-secret: 理由` 豁免 | harness-native、offline、失败驱动(真实 PAT 泄露) | **1 ✅ 已交付** |
| M6-b 敏感改动加严审批 | 分类 diff 触及敏感面(鉴权/CI/依赖清单/基础设施)→ 升级人类签字(红线7/军规7/D1) | harness-native、需人签流程 | 2 |
| M6-c NFR 派生测试门 | 从 NFR/SLO 规约派生测试入门禁 | **需 NFR 上游**(§8 标"待完善 SLO 值") | 3 |
| M6-d OWASP/STRIDE 安全 agent | 威胁建模 agent role(gstack /cso)合并前跑 | agent-driven、方法论 | 4 |
| M6-e CodeQL/Dependabot | 供应链/静态安全扫描前置 | **需 CI/云**(与本地非云常驻 D9 张力) | 末/可选 |

- **M6-a 已完成**(change `pipeline-secret-scan-gate`)：`driver/secret-scan.ts` 纯 `scanSecrets` + 薄 `secretScanGate`;向后兼容注入进 green 门(不注入零变化,真实装配启用);**不影响已实现功能**实证(fincards 全量零误报、既有 222 测试零改动通过)。详见 `docs/plan/M6-secret-scan-retro.md`。

**纪律提醒**：安全门同样从窄到宽——先 harness-native 确定性门(密钥/敏感面),CodeQL/Dependabot 等需 CI 的留末位;**命中=阻断,豁免须带理由(不弱化门)**。

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
  - ✅ **M2-B 已偿还需求澄清债**：用 office-hours 方法产出 `docs/requirements/fincards-需求澄清-v1.md`（用户=个人投资者/交易者；痛点=信息过载提重点；下一步优先=多源聚合）。
  - ⏭ **M2-A 待做**：多角色编排跑真实功能，首选增量=多源聚合（对齐用户优先级）。

## 抽取线 E（贯穿 M0–M8，方案 A：边验证边抽取，产物可持续修正）

> **定位**：M0–M8 在 fincards 上**验证**能力；抽取线把每个验证过的能力从"fincards 耦合 + 手动驱动"**抽取成根目录 `pipeline/` 下可复用工程**——这才是最终交付物(① Loop + ② Harness 层的工程化体现)。
> **核心原则**：**抽取≠冻结**。`pipeline/` 产物随后续里程碑的验证结果**持续修正**(每个 artifact 标注"验证来源"，被后续推翻/加强时更新)。

| 抽取批次 | 触发 | 抽取/修正内容 → `pipeline/` |
|---|---|---|
| **E0（now）** | M0–M2 已验证 | 角色定义(测试/开发/评审/产品澄清)、质量门模板(确定性 gate + 变异门)、共享约定 Guide、内循环与 Planner-Workers-Judge 编排剧本 |
| E3 | M3 完成 | **事件触发 + `claude -p` 循环驱动**(① Loop 层第一块真正可运行的根目录引擎)、状态外置 |
| E4 | M4 完成 | 追溯链/看板/四指标采集组件 |
| E5 | M5 完成 | 消息组件(D9，**已锁定:嵌入式 SQLite 队列 + stdio MCP**,排除 Inngest/Redis/NATS)→ 支持并行多消费者(文件队列仅单消费者安全)、角色纠错路由回拥有域 · **✅ M5-A 已交付**:`pipeline/driver/` node:sqlite 原子认领队列 + 并行 worker + MCP(实现库 better-sqlite3→node:sqlite,BOSS 签字);⏭ M5-B 待做:worktree 隔离+集成分支+squash |
| E6 | M6 完成 | NFR 门 / 安全门(OWASP/STRIDE/CodeQL)模板 |
| E7 | M7 完成 | drift ASI 监控组件 |
| E8 | M8 完成 | 自演进回灌(Steering Loop 自动化，带人类门禁) |

> 到 M8/E8，`pipeline/` 即"给定需求 → 可运行、被实战验证过的 harness SDLC 流水线"。每批抽取后产物进入"可被下一里程碑修正"状态。

> **打包目标(贯穿 E0–E8，持续完善)**：`pipeline/` 终极形态 = **可安装的 Claude Code 技能/插件**(角色 skills + gates + hooks + 编排驱动 + 入口命令 + `.claude-plugin/plugin.json`)。每次抽取顺带向"可安装插件结构"靠拢；E8 收口为可分发插件。参考 `tools/skills/`(superpowers/gstack)的插件形态。

## 排序原则

1. **每个里程碑可独立演示且可短命快合**（→V4 §10）。
2. **约束被失败拉出来**：先跑最小切片，用实测失误决定下一层加什么约束（→V4 §2、§13），不一次想全。
3. **先确定性后推断性**：先上 computational gate（lint/变异），AI review 等 inferential 控制随信任度逐步放开（→V4 §4.1）。
