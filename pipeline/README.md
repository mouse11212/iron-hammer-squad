# pipeline/ — 铁锤小队 Harness SDLC 流水线（最终交付物）

> **这是本工程的最终产物**：一条 harness 级、可复用的 AI SDLC 流水线——给定需求，尽可能高质量稳定地完成开发。
> 区别于 `iron-hammer-output/`（流水线**造出来的产品**，如 fincards）。本目录是**流水线本身**。

## 当前状态（诚实标注）

抽取线方案 A：能力先在 fincards 上验证（M0–M8），验证后抽取到此目录。**当前为 E5+**——E0(角色/质量门/Guide/编排剧本)+ E3(`driver/` ① Loop 引擎:事件触发+claude -p)+ E4(`metrics/` ② 可观测:四指标+追溯链+看板)+ E5(`driver/` 并行多消费者:`node:sqlite` 事务原子认领队列 + N 路并行 worker + stdio MCP)+ **inner-loop 自动编排(`driver/` 把 `kind='inner-loop'` 的 job 自动跑完整多角色 PEV:测试→开发→评审,阶段间确定性 gate,must-fix 热上下文 `--resume` 回修闭环 + 止损 + 域归属;全程 stream-json trace 可观测。验证来源:fincards `relativeTime` 端到端 243s/done,变异门 93.31%)**。
**已补完**:回修闭环真实实证(canonicalizeUrl/clampPercent,resume 续接同一 session);per-job state/usage(含成本)入 metrics 看板;变异门按 git diff 动态范围(新文件不逃门);**M5-B worktree 隔离 + squash + 集成分支兜底(军规 3/8,绝不写 main,真集成验证)**。
**仍待完善**:① N 并发多分支集成的冲突解决(军规 8 完整态,待真实冲突);② 并行 driver 常驻/轮询守护(当前 drain-once);③ 真 inner-loop 隔离 e2e(逻辑+真集成已证)。

## 结构（对应 V4 三层模型）

```
pipeline/
├── guides/        # ② 前馈 Guides：注入所有角色 agent 的共享约定
│   └── agent-conventions.md
├── roles/         # 角色 agent 提示模板（可复用，已脱 fincards 耦合）
│   ├── product-clarify-agent.md
│   ├── test-agent.md
│   ├── dev-agent.md
│   └── review-agent.md
├── gates/         # ② Sensors / 质量门模板
│   └── quality-gates.md
├── workflows/     # 编排剧本
│   ├── inner-loop.md
│   └── orchestration-pwj.md
├── driver/        # ① Loop 引擎：事件触发 + claude -p 循环驱动
│   └── src/
│       ├── {types,state,run-once,invoke,store,loop,bin-enqueue}.ts  # M3/E3 单消费者(文件队列,回退路径)
│       ├── queue-sqlite.ts     # M5-A/E5 嵌入式 SQLite 队列(node:sqlite,事务原子认领+WAL)
│       ├── drive-parallel.ts   # M5-A/E5 N 路并行 worker pool + dispatch(kind=inner-loop→内循环)
│       ├── mcp-server.ts       # M5-A/E5 stdio MCP 封装(enqueue/claim/ack/fail/status)
│       ├── inner-loop.ts       # M5 PEV 状态机(纯逻辑:回修止损+域归属+升级)
│       ├── {verdict,gates,prompts}.ts  # M5 评审解析 / 确定性 gate(变异门按 git diff 动态范围)/ 角色 prompt
│       ├── secret-scan.ts        # M6-a 安全门:密钥扫描(scanSecrets 纯检测 + secretScanGate;green 可选注入)
│       ├── sensitive-change.ts   # M6-b 安全门:敏感改动分类(classifySensitive;batchIntegrate held:sensitive 路由人签)
│       ├── security-findings.ts  # M6-d 安全门:安全评审 findings 解析 + 确定性动作映射(非确定 findings→确定动作)
│       ├── worktree.ts         # M5-B worktree 隔离 + squash + 集成分支兜底(军规 3/8;绝不写 main)
│       └── inner-loop-runner.ts # M5 真实装配 + M5-B runIsolated(worktree 隔离编排)
└── metrics/       # ② 可观测(M4/E4)：harness 四指标 + 追溯链 + 看板
    ├── src/{types,compute,trace,board,collect,events-tax,weave-traces,defects-feed,bin-report,bin-weave}.ts
    └── data/traces.json             # 自动派生产物(npm run weave),勿手改;defects 改为 collect 内存派生(run信号+git trailer),无文件
```

## metrics/ 用法（② 可观测）

```bash
cd pipeline/metrics && npm install && npm run report -- <repoRoot>
# 采集 git churn + OpenSpec 归档计数 + 自动织追溯链 + defects + VTax + inner-loop(runs-ledger) → 生成 <repoRoot>/docs/metrics/dashboard.md(含「指标趋势」区,若 history 非空)
npm run weave -- <repoRoot>           # 把自动织的追溯链写出 data/traces.json(可检视产物,勿手改)
npm run report:archive -- <repoRoot>  # opt-in:把当前指标快照追加进 docs/metrics/history.jsonl(里程碑级趋势采样)
```
四指标:Task Resolution Rate / Code Churn / Verification Tax / Defect Escape Rate。**无标准基线,需产线标定(V4 §7)**;未埋点项显示"待埋点"不伪造。
**Verification Tax 已真值化 + 已持久(M4+ 续切片①→⑤)**:口径 D1——实现=dev phase,验证=test/review phase + gate + orchestrator-fix(`events-tax.ts categorizeDuration`,**口径单一真相源**)。切片⑤ 把来源从 ephemeral `.runtime/events.jsonl` **换为 git `Metrics-Phase-Ms:` trailer**(driver done run squash 时把本 run 原始 op 分类耗时打进提交,`aggregate-phase-ms.ts`/`squash-message.ts`;metrics `parsePhaseMsTrailer` 还原最小事件复用口径)——VTax 持久且 **fresh checkout 可复现**,per-US 以 commit 短 hash 为键。无 trailer 时回落"待埋点"。**固有限制**:只 done-run 持久(escalated 无提交);历史已合并 done run 无 trailer→不可重建。
**追溯链已自动织链(M4+ 续切片②)**:`changeId→spec→tests→commit` 从 OpenSpec archive + git 确定性派生(`weave-traces.ts`:纯 `weaveTraces` + 薄 `readArchivedChanges`),取代手维护 traces.json——锚点=归档 commit(同含 archive+实现+测试);早期 change 若归档与实现分属不同 commit,tests 诚实退化为空(不臆造)。
**Defect 已自动喂 + caught 已持久(M4+ 续切片③→④)**:`caught` 与 `escaped` **均从 git commit trailer 挖采**(同口径持久,Defect Escape Rate 完全可比)——`caught`=机器写的 `Defect-Caught:`(driver done run squash 时据 `fixRounds` emit,`squash-message.ts`),`escaped`=人写的 `Defect-Escaped:`(发现合并后缺陷时,判定归人/红线6)。metrics `defects-feed.ts`:纯 `deriveDefects`(两侧每行一记录对称)+ 薄通用 `mineTrailers(repoRoot, key)`。`defectEscapeRate` 总数 0→null("待埋点",不伪造 0%)。**已根治**:切片④ 把 caught 从 runtime(ephemeral)换为 git trailer(持久),消除切片③ 的口径不对称。**固有限制**:escalated run 无提交→caught 不持久(升级人类);历史已合并 done run 无 trailer→不可重建,此后每次 done 自动持久。
**inner-loop 统计已持久(M4+ 续切片⑥,收尾)**:升级率/成本/回修分布从 ephemeral `.runtime/runs` 换源到 **committed `docs/metrics/runs-ledger.jsonl`**(driver 机器 append `{jobId,status,fixRounds,costUsd,ts}`,`run-ledger.ts`;metrics `readRunLedger` 按 jobId 去重)。**它无法走 trailer**——升级率需 escalated/failed run,而它们不产生提交、git 无痕,ledger 是唯一出路。**诚实限制**:ledger 持久但**不可从 git 复现**(累积记录,非提交型 run 的固有性质);从空起步不回填旧 e2e。
**report 历史归档(M4+ 续切片⑦)**:`npm run report:archive` opt-in 把当前指标 slim 快照(四 KPI + 解决计数)追加进 committed `docs/metrics/history.jsonl`(`report-history.ts`);`report` 读 history 渲「指标趋势(最近 10 次)」区,服务 ③ Compound 层趋势判断。与 runs-ledger 同构(持久不可复现)。普通 `report` 不污染历史(opt-in)。

## 安全门（M6 · ② Sensors）

**密钥扫描门(M6-a,M6 首切片)**:`driver/secret-scan.ts` 纯 `scanSecrets`(高精度模式:`ghp_`/`github_pat_`/AWS `AKIA`/PEM 私钥块/通用 `key|secret|token|password = "…"`)+ 薄 `secretScanGate`(扫**本次改动 diff**)。**向后兼容注入** green 门(`makeGates` 可选 `secretScan`;不注入零变化,真实装配启用)——命中即 green 红 → dev 回修移除(像 lint,不升级人类)。内联 `// allowlist-secret: <理由>` 豁免(须带理由,不弱化门)。**失败驱动**(真实 PAT 泄露)。**不影响已实现功能**实证:fincards 全量零误报 + 既有 222 driver 测试零改动通过。

**敏感改动加严审批(M6-b)**:`driver/sensitive-change.ts` 纯 `classifySensitive`(路径分类:**鉴权**`auth/login/oauth/credential/session`、**CI**`.github/`/`*.ci.yml`/`Jenkinsfile`、**基础设施**`Dockerfile`/`*.tf`/`k8s/`/`deploy/`;依赖清单不列——机器可判)。`batchIntegrate` 可选注入敏感检查 → 命中 → **held(`reason:'sensitive'`+类别)路由人签,不自动合**(复用 held/handoff,红线7/军规7/D1);工作保留为 feature 分支,人签后手动合。与 M6-a 区别:M6-a=must-fix(agent 移除密钥),M6-b=escalate-hold(改动合法但需人签)。向后兼容(不注入零变化);真 git e2e:`.github/` 改动→held(sensitive,ci)、普通 src→merged、main 不动。

**安全评审 agent(M6-d 首切片)**:`roles/security-review-agent.md`(STRIDE 6 类 + OWASP 检查,offline 自包含)合并前评审,产**结构化 findings**;`driver/security-findings.ts` 纯 `parseSecurityFindings`(仿 verdict 严格校验)+ `mapFindingsToAction`(**确定性**:有 high→escalate 人签/复用 held、medium/low→advisory)。**关键**:LLM findings 非确定 → 动作映射确定;**agent 不单独硬阻断**(漏报风险),高危人在环(红线7),与 M6-a/b 确定门**互补**。真 claude e2e:SQL/命令注入样本→5 STRIDE findings→契约接受→escalate(2 high)。首切片**可调用、不接 inner-loop 每轮**(留后续按长程验证)。

M6 拆解(a 密钥 ✅/b 敏感面 ✅/NFR 上游 ✅/c NFR 门/d 安全 agent ✅/e CodeQL 需 CI)见 backlog。

## drift 监控（M7 · 对抗 agent drift 的根命题）

**工具序列一致性 sensor(M7-a,M7 首切片)**:KB 接地(`[[agent-drift]]`/arXiv:2601.04170 ASI 框架)。`metrics/drift-sensor.ts` 纯 `opSequence`(events.jsonl 按 ts 取 op token 序列)+ `levenshtein`/`seqConsistency`([0,1])+ `driftAlert`(连续 k 个一致性<τ 告警,KB「τ=0.75 连续三窗」)+ 薄 `readDriftEvents`/`computeDrift`(按 US 分组→相对基线一致性序列→告警)。**最可确定性/离线/已可从 events 算的 drift 信号**(语义需 embedding、共识需多 agent,排后)。**诚实路径(同 NFR)**:未做长程任务测试→无 drift 数据→`insufficient-data` 不告警,**不臆造已发生 drift**;τ/k 用 KB 默认待标定;合成渐变漂移序列单测证机制正确。M7 拆解(a 工具序列 ✅/b 人工干预率/c 语义/d 共识/e 复合 ASI/f EMC·ABA·DAR/g 两级拓扑)见 backlog。

## driver/ 用法（① Loop 引擎）

```bash
cd pipeline/driver && npm install
# 投递一个请求(= 触发事件)
npm run enqueue -- <runtimeRoot> <id> <kind> "<prompt>"
# 启动事件驱动循环(启动恢复 + drain + fs.watch 监听新投递)
npm run drive -- <runtimeRoot>
```
状态外置在 `<runtimeRoot>/{queue,state,done,failed}/`（`**/.runtime/` 已 gitignore）；已 done 请求幂等跳过；崩溃时残留 running 启动时回收。

**并行多消费者模式(M5-A,推荐用于 ≥2 并行内循环):**
```bash
# 并行 drain:N 路 worker 各自从 SQLite 队列原子认领,跑完即退
npx tsx src/drive-parallel.ts <queue.db> <concurrency>
# 或把队列暴露为 stdio MCP,供外部 agent 投递/认领
npx tsx src/mcp-server.ts <queue.db>   # 工具:enqueue/claim/ack/fail/status
```
单消费者用文件队列(零依赖回退);**并行多消费者必须用 `queue-sqlite`**——`rename` 文件认领在多进程下会双领(D9)。SQLite 队列用单条 `UPDATE...RETURNING` 在写事务内原子认领,WAL + `busy_timeout` 承受并发(已用 4 进程抢 500 条压测零双领)。

**统一事件日志 + 全链路回放(M4+ 地基切片):** inner-loop 全链的关键操作(`phase`/`gate`/`squash`/`integrate`/`orchestrator-fix`)各落一条带 `traceId`(=jobId,贯穿一个 US 全链)的结构化事件到中心 `<pipeline>/.runtime/events.jsonl`(append-only,已 gitignore)。
```bash
# 凭 jobId(=traceId) 回放一个 US 的全链操作事件(按 ts 排序:phase→gate→squash→integrate)
npm run replay -- <traceId> [eventsPath]
```
schema 含 `durationMs` 字段(为后续 Verification Tax 切片预埋钩子)。埋点为 computational sensor:纯构造器 + 时钟注入(确定可测),IO 锁在薄 sink(`events.ts`/`replay.ts`/`instrument.ts`,变异门 100%/85%/100%)。**已补:** Verification Tax 计算(①)、追溯链自动织链(②)、Defect 自动喂(③)、caught 持久化 git trailer(④)、VTax 持久化 `Metrics-Phase-Ms:` trailer(⑤,fresh checkout 可复现)。**未做(留后续切片):** inner-loop 升级率/成本持久(需 ledger)、metrics 包级 stryker 变异门。

## 终极形态：可安装为 Claude Code 技能/插件（目标，持续完善）

`pipeline/` 的最终目标是**打包成一个 Claude Code 插件/技能集**——别人(或新项目)通过 marketplace/`.claude/` 安装后，即获得这条 harness SDLC 流水线(角色 skills + gates + hooks + 编排驱动 + 入口命令)。
- 演进路径：现为可复用组件(markdown 模板)→ 随 E3+ 加入可运行驱动/hooks → 逐步具备 `.claude-plugin/plugin.json` + SKILL.md + commands 的插件结构。
- 该目标**贯穿后续每次抽取持续完善**(参考本仓 `tools/skills/` 下 superpowers/gstack 的插件形态)。详见 backlog「抽取线 E」打包目标。

## 修正原则（抽取≠冻结）

每个 artifact 头部标 **`验证来源: Mx`** 与 **`状态`**。后续里程碑的验证若推翻/加强某模式，**就地修正对应 artifact** 并更新验证来源。`pipeline/` 是活的流水线定义，不是一次性快照。

## 怎么用（当前 E0）

orchestrator 执行一个需求/US 时：
1. 读 `guides/agent-conventions.md`，随每个角色 spawn 一并注入。
2. 按 `workflows/inner-loop.md` + `workflows/orchestration-pwj.md` 调度角色。
3. 各角色用 `roles/*.md` 作为 spawn 提示模板（填入具体规约/上下文）。
4. 合并前过 `gates/quality-gates.md` 定义的门。

> 路线：E3 起本目录将出现可运行的事件触发驱动，把上述"手动调度"逐步变成"自动跑"。
