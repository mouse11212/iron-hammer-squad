# pipeline/ — 铁锤小队 Harness SDLC 流水线（最终交付物）

> **这是本工程的最终产物**：一条 harness 级、可复用的 AI SDLC 流水线——给定需求，尽可能高质量稳定地完成开发。
> 区别于 `iron-hammer-output/`（流水线**造出来的产品**，如 fincards）。本目录是**流水线本身**。

## 当前状态（诚实标注）

抽取线方案 A：能力先在 fincards 上验证（M0–M8），验证后抽取到此目录。**当前为 E5+**——E0(角色/质量门/Guide/编排剧本)+ E3(`driver/` ① Loop 引擎:事件触发+claude -p)+ E4(`metrics/` ② 可观测:四指标+追溯链+看板)+ E5(`driver/` 并行多消费者:`node:sqlite` 事务原子认领队列 + N 路并行 worker + stdio MCP)+ **inner-loop 自动编排(`driver/` 把 `kind='inner-loop'` 的 job 自动跑完整多角色 PEV:测试→开发→评审,阶段间确定性 gate,must-fix 热上下文 `--resume` 回修闭环 + 止损 + 域归属;全程 stream-json trace 可观测。验证来源:fincards `relativeTime` 端到端 243s/done,变异门 93.31%)**。
**仍待完善**：① 回修闭环目前仅单测覆盖,端到端 fixRounds=0(happy path),真实 must-fix 回修实证待一个会产生 must-fix 的 US;② per-job state/usage 接入 metrics 看板;③ M5-B(worktree 隔离 + 集成分支 + squash)待做。

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
│       ├── {verdict,gates,prompts}.ts  # M5 评审解析 / 确定性 gate / 角色 prompt 合成
│       └── inner-loop-runner.ts # M5 真实装配(makePhaseInvoke+gates+verdict→runInnerLoop+per-job state/trace)
└── metrics/       # ② 可观测(M4/E4)：harness 四指标 + 追溯链 + 看板
    ├── src/{types,compute,trace,board,collect,bin-report}.ts
    └── data/{traces,defects}.json
```

## metrics/ 用法（② 可观测）

```bash
cd pipeline/metrics && npm install && npm run report -- <repoRoot>
# 采集 git churn + OpenSpec 归档计数 + traces/defects → 生成 <repoRoot>/docs/metrics/dashboard.md
```
四指标:Task Resolution Rate / Code Churn / Verification Tax / Defect Escape Rate。**无标准基线,需产线标定(V4 §7)**;未埋点项显示"待埋点"不伪造。

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
