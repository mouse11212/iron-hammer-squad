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
| M5 inner-loop 自动编排 | ✅ 归档 | `pipeline/driver/`:driver 自动驱动多角色 PEV(测试→开发→评审),阶段间确定性 gate,must-fix **热上下文 `--resume` 回修闭环**+止损+域归属,全程 trace。变异门 93.31%。**两个端到端实证**:① `relativeTime` 243s/done/fixRounds=0;② `canonicalizeUrl` 856s/done/**fixRounds=1**——真实 must-fix(评审抓 valueless 参数缺口+豁免等价变异)→ **resume 同一 session 回修**(session_id 一致)→ 收敛;fincards gate 100 绿。**回修闭环已真实坐实** |

- **抽取线 E0–E5(部分) 已完成**(方案 A 边验证边抽取,产物可持续修正):`pipeline/` 现有 roles/gates/guides/workflows + driver(①,含 M5-A 并发队列/并行驱动/MCP)+ metrics(②)。
- **产品 fincards** 在 `iron-hammer-output/fincards/`:真四源聚合,TDD + 变异门 100%。
- **SoT**:10 个 OpenSpec capability(新增 concurrent-queue),M0–M5A change 全部归档。
- **GitHub**:`mouse11212/iron-hammer-squad`(SSH 推送,无需 token)。

## 3. 下一步（立即可做）

回修闭环已真实实证。✅ inner-loop 接入 M4 看板(成本埋点已产真实值);✅ `canonicalizeUrl` 接线 `aggregate`(规范化去重);✅ **事件驱动全链打通**——SQLite 入队→认领→dispatch→inner-loop→ack done(穿真实队列,`bin-enqueue-sqlite.ts`)。✅ **修复 harness 缺口**:inner-loop 变异门改为**按 git status 动态确定 mutate 范围**(`gates.ts` `mutateTargetsFromStatus`+`mutation()` 用 `--mutate` 覆盖静态 stryker.conf),dev 新建文件不再逃门;driver 变异门 92.64%,stryker `--mutate` 机制实测只变指定文件。✅ **动态变异门真 e2e 确认**:真跑 clampPercent US 暴露并修了子目录路径 bug(`git status --porcelain` 是仓库根相对 → 用 `git rev-parse --show-prefix` 剥成工程相对);实测修复后 gate 跑出 `npm run mutation -- --mutate src/clampPercent.ts`,ok。顺带加 gate 命令 trace(`gates.jsonl`,补阶段间观测盲点)。✅ **M5-B 完成**(M5 DoD 收尾):`worktree.ts`(隔离 worktree + symlink 依赖 + squash 仅 targetPaths + 集成分支兜底,**绝不写 main**/军规 1/2)+ `runIsolated` 编排 + dispatch 开关 `IH_ISOLATION=1`;真集成验证(真 git,无 claude:squash→集成全绿→main HEAD 不变→隔离→回收);worktree.ts 变异门 100%。**真集成又揪出子目录路径坑**(squash 的 `git -C` 用了 worktree 根而非 projectDir,第 3 次同类,已修+固化纪律)。✅ **①完成 批量多分支集成**(军规 8):`worktree.ts` `batchIntegrate`——N feature 汇入 integration,clean+green 合入、冲突/gate 红回滚 held 升级(**不自动解冲突**/军规1、**不写 main**/军规2);真 git 真冲突验证(a/b 冲突→b held、a/c 合入、main 不变、无 unmerged 残留);worktree.ts 变异门 96.72%。✅ **②完成 守护+批后集成**:runIsolated 解耦(只产 feature 分支,不 per-job 集成)+ `drainBatchIsolated`(N 路并行隔离 drain → 收集成功分支 → batchIntegrate)+ `driveParallelLoop`(轮询守护,连续空轮即停;main `IH_DAEMON=1`)。下一步:
✅ **③完成 全链真 e2e**:入队→drainBatchIsolated→隔离 worktree 内真 claude 跑内循环→done→squash 产分支→batchIntegrate→`{ready:true,merged:[agent/e2e-iso-1]}`→main 不变→回收(249s)。首跑撞瞬时 API 错误反向验证失败路径(不提交/不集成/回收正确)。
**1/2/3 全部完成。** ✅ **harness 硬化:phase 瞬时 API 错误有限重试**已落地(`isTransientApiError` + makeRunPhase 重试:默认 2 次线性退避、每次 fresh session-id;只重瞬时不重真失败;resume 失败回退 fresh 的瞬时也重)。闭合了 ③ e2e 暴露的稳定性短板。✅ **集成分支跨批次累积**已落地:batchIntegrate 由"每批重置 base"改为"首建(`-b`)后复用累积"(`git rev-parse --verify` 判存在);真 git 两批验证 integration 同时含 a+b、main 不变。daemon 多轮的已验证 feature 不再被后批覆盖。✅ **多项目混批 relProjectDir 动态推导**已落地:batchIntegrate gatePerFeature 加 branch 参数;drainBatchIsolated 建 branch→relProjectDir 映射,per-feature 集成 gate 在各自产品目录跑(支持一批含不同产品)。真实多产品 e2e 待第二产品(现仅 fincards)。✅ **HITL 交接(held 通知 + 合并辅助)**已落地:`handoff.ts renderHandoffReport`(纯,渲染集成交接 md:已集成+squash 合并命令、挂起+原因+指引、明确合 main 是人类决策)+ drainBatchIsolated `onHandoff` 钩子 + `makeDefaultHandoff`(写 `.runtime/integration-report.md` + console)。**人机边界已闭合**——结果可执行地递到人手上。下一步候选:
① 把 daemon CLI 接全(drainBatchIsolated + makeBatchDrainRound + makeDefaultHandoff 组合成常驻批处理入口);外部通知渠道;report 历史归档;
② M6+(后续里程碑)。
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
