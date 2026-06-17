# pipeline/ — 铁锤小队 Harness SDLC 流水线（最终交付物）

> **这是本工程的最终产物**：一条 harness 级、可复用的 AI SDLC 流水线——给定需求，尽可能高质量稳定地完成开发。
> 区别于 `iron-hammer-output/`（流水线**造出来的产品**，如 fincards）。本目录是**流水线本身**。

## 当前状态（诚实标注）

抽取线方案 A：能力先在 fincards 上验证（M0–M8），验证后抽取到此目录。**当前为 E3**——已抽取 M0–M2 的角色/质量门/Guide/编排剧本（E0），并新增 **① Loop 层第一块可运行引擎 `driver/`**（M3/E3：事件触发 + `claude -p` 循环驱动，已实跑验证：事件→驱动→真实 claude→状态外置→幂等可恢复）。
**仍待完善**：driver 当前执行"按请求 prompt 调一次 claude"，把它接到完整内循环/多角色编排（让事件自动拉起 `workflows/` 全流程）是后续抽取目标。

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
└── driver/        # ① Loop 引擎(M3/E3)：事件触发 + claude -p 循环驱动
    └── src/{types,state,queue,run-once,invoke,store,loop,bin-enqueue}.ts
```

## driver/ 用法（① Loop 引擎）

```bash
cd pipeline/driver && npm install
# 投递一个请求(= 触发事件)
npm run enqueue -- <runtimeRoot> <id> <kind> "<prompt>"
# 启动事件驱动循环(启动恢复 + drain + fs.watch 监听新投递)
npm run drive -- <runtimeRoot>
```
状态外置在 `<runtimeRoot>/{queue,state,done,failed}/`（`**/.runtime/` 已 gitignore）；已 done 请求幂等跳过；崩溃时残留 running 启动时回收。

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
