# RESUME（会话续接入口 · 压缩后先读这份）

> 用途：上下文压缩后,**先读本文件**重建工作状态,再按需读下方"真相源地图"。
> 本文件只记"活状态 + 隐性知识"；机制/规约细节一律去真相源,不在此重复。最后更新 2026-06-18。

## 0. 核心目标（一句话）

做一条 **harness 级 AI SDLC 流水线**:给定需求,用 AI/AI 团队尽量高质量稳定地完成开发。最终交付物 = 根目录 **`pipeline/`**(可复用引擎,终极形态=可安装的 Claude Code 插件)。详见 `CLAUDE.md` / PRD / V4 构思。

## 1. 三层心智模型（贯穿一切）

① **Loop**(无人值守反复跑 SDLC,`pipeline/driver/`)· ② **Harness**(单次执行可靠:gates/roles/guides)· ③ **Compound/Steering**(每次失败固化进 harness,越用越强)。
**纪律**:范围可画满,但 harness 从窄到宽(§13);约束被真实失败"拉"出来,不凭空加。

## 2. 当前进度（里程碑 + 抽取线）

| 里程碑 | 状态 | 交付 |
|---|---|---|
| M0 内循环 | ✅ 归档 | fincards:规约→test-first→TDD→确定性 gate→合并 |
| M1 变异门 | ✅ 归档 | StrykerJS 变异门(break 90),揭穿弱测试 |
| M2 多角色编排 | ✅ 归档 | 需求澄清(B)+ 多源聚合(A,Bloomberg 多 topic)+ 跨发布方(CNBC);Planner-Workers-Judge 真 spawn 子 agent |
| M3 事件驱动 | ✅ 归档 | `pipeline/driver/`:文件队列(事件)→claude -p→外置状态→幂等/恢复 |
| M4 可观测 | ✅ 归档 | `pipeline/metrics/`:四指标+追溯链+看板;真实 dashboard |
| M5-A 并行队列 | ✅ 归档 | `pipeline/driver/`:node:sqlite 事务原子认领队列 + N 路并行 worker + stdio MCP;4 进程抢 500 条零双领压测 |
| M5 inner-loop 自动编排 | ✅ 归档 | `pipeline/driver/`:driver 自动驱动多角色 PEV(测试→开发→评审),阶段间确定性 gate,must-fix **热上下文 `--resume` 回修闭环**+止损+域归属,全程 trace。fincards `relativeTime` 端到端 243s/done;变异门 93.31%。⚠️**回修闭环仅单测,真实 must-fix 实证待补** |

- **抽取线 E0–E5(部分) 已完成**(方案 A 边验证边抽取,产物可持续修正):`pipeline/` 现有 roles/gates/guides/workflows + driver(①,含 M5-A 并发队列/并行驱动/MCP)+ metrics(②)。
- **产品 fincards** 在 `iron-hammer-output/fincards/`:真四源聚合,TDD + 变异门 100%。
- **SoT**:10 个 OpenSpec capability(新增 concurrent-queue),M0–M5A change 全部归档。
- **GitHub**:`mouse11212/iron-hammer-squad`(SSH 推送,无需 token)。

## 3. 下一步（立即可做）

**优先:跑一个会产生 must-fix 的 US,拿回修闭环真实基线**(填上 inner-loop 的诚实缺口:端到端 fixRounds=0,resume 回修仅单测覆盖)。
其后:① per-job state/usage 接入 M4 metrics 看板(state.json+trace 已落盘,喂看板待做,task 5.3);② **M5-B:Git worktree 隔离 + 集成分支兜底 + squash 合并**(M5 DoD 另一半)。
- inner-loop 自动编排已落地(取代"调一次 claude"):`drive-parallel.ts` dispatch `kind='inner-loop'→runInnerLoopJob`;`inner-loop.ts`(纯状态机)/`gates.ts`/`verdict.ts`/`prompts.ts`/`inner-loop-runner.ts`。
- D9 已落地:实现库由 better-sqlite3 改 **node:sqlite**(BOSS 签字,见 D9 决策记录"落地修正")。

## 4. 已锁定决策（速查;细节见 V4 §3.1 表 / docs/plan）

D1 HITL 签字全 BOSS · D3 内循环不强制重置(评估记录) · D4 事件触发 · D5 drift 全套(§6) · D7 不引入 DeerFlow · D8 Git=驭手8军规(§9) · **D9 消息组件=SQLite+MCP** · 编排层=Claude Code 自身(Max 订阅,本地,非云常驻)。

## 5. 工作节奏（每个切片照此跑）

1. 收敛范围(必要时 brainstorm)→ `/opsx:propose` 建 OpenSpec change(proposal/specs/design/tasks)→ `validate --strict`。
2. **产品功能**:用 `pipeline/roles/*.md` 编排子 agent(测试 Agent≠开发 Agent + 评审两遍),注入 `pipeline/guides/agent-conventions.md`。**引擎基建**:orchestrator 直接 TDD 建。
3. TDD:纯核心 test-first(RED→GREEN),IO 隔离到薄边界。
4. gate:lint+tsc+vitest 全绿 → 变异门 ≥ 阈值(纯逻辑纳入 mutate)。
5. 真实运行验证 → 写复盘(docs/plan/*-retro.md)→ `openspec archive` → `git commit`+`push`。
6. **E 抽取**:把验证过的能力抽进 `pipeline/`(可持续修正,标"验证来源")。

## 6. 地雷 / 隐性知识（压缩最易丢,务必记住）

- **OpenSpec**:命令需 `export PATH="$PWD/tools/bin:$PATH"`;工作区在 `docs/openspec/`,**根目录 `openspec` 软链勿删**(CLI 写死 `<root>/openspec`);遥测已在 wrapper 关。
- **git**:**别用 `git add -A` 无脑全加**(曾卷入 Stryker `.stryker-tmp` 沙箱)。已 gitignore:node_modules/dist/.runtime/.stryker-tmp/tools(skills 大体积)。提交前查 `git ls-files | grep -E 'node_modules|.runtime|dist|stryker'` 应 0。推送走 **SSH**(无需 token)。
- **claude -p**:`claude --print` 必须**关 stdin**(`stdio:['ignore',...]` 或 `< /dev/null`),否则等 stdin 挂死。
- **文件队列**:`rename` 在 Linux **非多消费者互斥**,只单消费者安全;并行已换 SQLite(M5-A,`queue-sqlite.ts`,保留文件队列为单消费者回退)。
- **node:sqlite + vite/vitest**:新内置模块不在 vite 过时的 builtin 列表 → strip 成 `sqlite` 报 "Failed to load url sqlite",配置层 `external` 不灵。解法:`createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')`(运行时加载绕静态解析 + 保类型)。新 Node 内置遇旧工具链会复现此坑。
- **变异测试**:杀不掉的存活变异若靠运行时偶然(如比较器 NaN)→ **根因重构实现为确定性结构**,而非堆测试;真等价变异用 `// Stryker disable next-line <M>: 理由`。
- **多角色 / SendMessage**:主 session 的 Task 子 agent 仍无法续已结束会话。**但 driver 路径已溶解此限制**(M5 inner-loop):`claude -p --session-id/--resume` 跨独立进程保留热上下文(spike 实证),回修可续接原角色 session,无需 D9 常活角色+inbox。resume 失败回退 fresh spawn。
- **求真纪律**:不臆造无源数字;指标缺口写"待埋点"不伪造。
- ⚠️ **安全**:用户曾在对话明文贴 GitHub PAT(已泄露)→ 提醒其去 GitHub **撤销/轮换**(最终推送走 SSH 未用该 token)。

## 7. 真相源地图（按需读,勿重复抄进本文件）

- 世界观/红线/目录约定:`CLAUDE.md`
- 架构宪法:`docs/requirements/铁锤小队-Harness工程构思-v4.md`(机制细节回查)
- 北极星 PRD:`docs/requirements/铁锤小队-PRD-v1.md`
- 路线/抽取线:`docs/plan/铁锤小队-能力backlog-v1.md`
- 各里程碑复盘:`docs/plan/{M0-retro-baseline,M1-retro,M2A-retro,M2-crosspublisher-retro,M3-E3-retro,M4-E4-retro,M5A-retro,M5-inner-loop-retro}.md`
- inner-loop 设计:`docs/plan/2026-06-18-driver-inner-loop-orchestration-design.md`(brainstorm 决议 + spike + 架构)
- 关键决策:`docs/plan/D9-message-component-decision.md`
- 最终产物:`pipeline/README.md`(roles/gates/guides/workflows/driver/metrics)
- 可执行规约 SoT:`docs/openspec/specs/`(9 capability)+ `changes/archive/`
- 实时看板:`docs/metrics/dashboard.md`(运行 `pipeline/metrics` 的 `npm run report`)
- 产品:`iron-hammer-output/fincards/`
- 知识库 grounding:`KB_ROOT`(LLMwiki/.../ai-dev-learning),经 claude-obsidian wiki-query 逐层披露
