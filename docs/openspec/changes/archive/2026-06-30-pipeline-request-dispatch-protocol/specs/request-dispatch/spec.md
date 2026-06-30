## ADDED Requirements

### Requirement: 一级轨道分诊覆盖全（7 轨 MECE，13 角色无一遗漏）
据本协议行事的编排 agent（判定主体，inferential）SHALL 把每个会话级请求分诊到下列 7 条互斥轨道之一：① 立项轨、② 规约轨、③ 内循环实现轨、④ 验收发布轨、⑤ harness 自身工程轨、⑥ 纯查询/咨询轨、⑦ 未知/缺信息→升级人。分诊 SHALL 覆盖全部 13 个角色（V4 §4.2 的 10 角色 + 表外补充的 design-soundness / 验收 Agent + 本协议新增的规划/拆分 Agent），无一遗漏归属某条轨道（完整归属对账表见协议文档 `pipeline/guides/request-dispatch-protocol.md` §1）。本判定属**推断性前馈引导**（判定主体为据协议行事的编排 agent/人），**非确定性计算门**——真正强制路由核对需后续 hook/sensor 切片。

#### Scenario: 有 spec 无 test 的 US 实现 → ③ 内循环 → 测试 Agent
- **WHEN** 请求为"实现 US-2 金币连对加成"且该 US 已有活规约、无测试
- **THEN** 编排 agent 分诊到 ③ 内循环实现轨，下一个 SDLC 步 = 测试 Agent（先写测试，superpowers TDD）

#### Scenario: 实现前评审规约合目的性 → ② 规约 → 设计合理性评审 Agent
- **WHEN** 请求为"评审听音选词玩法是否暴露答案"
- **THEN** 分诊到 ② 规约轨，触发设计合理性评审 Agent（实现前对抗评审，§4.2 表外补充角色）

#### Scenario: 改铁锤小队自身 → ⑤ harness 自身工程轨
- **WHEN** 请求为"补 clampPercent 的 stryker 变异目标"
- **THEN** 分诊到 ⑤ harness 自身工程轨（元层面，§4.2 外；走 superpowers:SDD 或 TDD+OpenSpec）

#### Scenario: 纯问答检索 → ⑥ 纯查询/咨询轨
- **WHEN** 请求为"问 KB 怎么做 drift sensor"
- **THEN** 分诊到 ⑥ 纯查询轨（claude-obsidian KB grounding，不进流水线、无交付物）

#### Scenario: Epic/US 拆分规划 → ② 规约 → 规划/拆分 Agent
- **WHEN** 请求为"把词灵岛拆成 Epic 和 US"
- **THEN** 分诊到 ② 规约轨，触发规划/拆分 Agent（Planner，含依赖 DAG + 执行顺序规划，本协议新增角色）

#### Scenario: 定系统整体视觉风格 → ① 立项 → 全局 UX/UI（系统级触发点）
- **WHEN** 请求为"定词灵岛整体视觉风格"
- **THEN** 分诊到 ① 立项轨，触发 UX/UI Agent 的系统级触发点（全局风格规约，设计系统级，区别于 US 级）

#### Scenario: 单 US 涉界面 → ③ 内循环 → UX/UI（US 级触发点）
- **WHEN** 请求为"给某 US 做具体界面"
- **THEN** 分诊到 ③ 内循环实现轨，触发 UX/UI Agent 的 US 级触发点（受①全局风格规约约束）

#### Scenario: 请求无法归类或缺信息 → ⑦ 升级人
- **WHEN** 请求语义不明、未说清要什么，或触 Ask-First
- **THEN** 分诊到 ⑦，阻塞升级交还人类（红线6），不得臆造归类

### Requirement: 二级工件状态判定（防跳步）
在产品开发轨（①②③④）内，编排 agent SHALL 据工件当前状态（需求澄清/设计/规约/test/实现/评审 是否已就绪）定位下一个该做的 SDLC 步骤与角色。**无活规约不得直奔开发**（防跳步：缺上游产物时先回上游补齐）。

#### Scenario: 无 spec 请求开发 → 先回 ② 规约
- **WHEN** 请求开发某 US 但该 US 无活规约
- **THEN** 分诊回 ② 规约轨（先产规约），不直奔 ③ 开发

#### Scenario: 有实现未评审 → 触发评审 Agent
- **WHEN** 某 US 有通过测试的实现但未经评审
- **THEN** 下一步触发评审 Agent（两遍独立 spawn），不直奔 ④ 验收

### Requirement: 横切护栏不分轨道一律适用
下列护栏 SHALL 适用于所有轨道，不分轨：Ask-First（引入新依赖/改既有测试/定重试间隔 → 停下问人，不自行拍板）；Never（由 Plan-Alignment Gate / 后续 hook 拦截）；测试反作弊（写测试 agent ≠ 写实现 agent，变异门为不可延后硬 gate）；追溯链（概念→spec→US→task→测试→commit 每节点带唯一 ID，可正反向回溯）；阻塞升级（遇未知/缺信息 → 交还人类，禁止臆造）。

#### Scenario: 任一轨道遇 Ask-First 项 → 仍须停下问人
- **WHEN** 分诊到任意轨道后，请求触发起 Ask-First 项（如引入新依赖、改既有测试）
- **THEN** 无论处于哪条轨道，都停下问人（红线6），不自行拍板

### Requirement: 精简注入版速查卡（供后续 hook 切片）
协议文档 SHALL 含一份 ≤40 行的精简分诊速查卡，供后续 UserPromptSubmit hook 切片作为 `additionalContext` 注入（避 30 秒超时与 context 膨胀）。本 MVP 不实现 hook 注入，仅产出可被注入的速查卡形态。

#### Scenario: 速查卡可被下一刀 hook 注入
- **WHEN** 审查协议文档
- **THEN** 含一节 ≤40 行的精简分诊速查卡，结构适合作为 UserPromptSubmit hook 的注入内容
