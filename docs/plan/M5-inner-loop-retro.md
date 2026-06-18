# 复盘:M5 inner-loop 多角色 PEV 自动编排

> 日期 2026-06-18 · change `2026-06-18-pipeline-driver-inner-loop` · 设计 `docs/plan/2026-06-18-driver-inner-loop-orchestration-design.md`

## 交付

driver 从"每 job 调一次 claude"升级为**自动驱动多角色 PEV 内循环**:测试→开发→评审,阶段间确定性 gate,must-fix 自动回修(热上下文 resume + 止损 + 域归属),全程 trace 可观测。

- 纯逻辑(确定性测试 + 变异门):`inner-loop.ts`(状态机)/`verdict.ts`(解析)/`gates.ts`(判定)。
- IO 边界:`invoke.ts`(makePhaseInvoke/stream-json)/`prompts.ts`/`inner-loop-runner.ts`/`drive-parallel.ts` dispatch。
- driver gate:lint+tsc+**83 测试**全绿;变异门 **93.31%**(break 90,exit 0)。

## 关键决策与验证来源

- **编排器 locus=混合**(BOSS 选):driver 高层状态机 + 阶段间确定性 gate;phase 内允许 claude 自主 spawn 但全程落 trace。依据 KB `pev-loop`(验证须四时点,非 post-hoc)。
- **热上下文 resume 溶解 "SendMessage 不可用"**:spike(2026-06-18)证 `claude -p --session-id/--resume` 跨进程保留对话记忆;`--output-format json/stream-json` 同时吐 session_id + usage/cost。无需 D9 常活角色+inbox。
- **变异门末轮策略**:挪到"verdict 干净、准备 DONE"检查点跑 → 中间回修轮天然跳过、末轮必跑。
- **bypassPermissions**:自主 phase 免审批运行;安全网=角色硬边界 + 确定性 gate + verdict + blocked-escalated 人类门。

## 端到端实证(fincards 基线)

真实跑通一个 US(相对时间标签 `relativeTime`),**243s**:
- status=done,fixRounds=0(happy path 一轮过);test/dev session id 真实捕获。
- 评审两遍 + 结构化 verdict(pass + 一条 Invalid Date niceToHave);trace 含真实工具调用(Read/Bash/Write)。
- 生成 `src/relativeTime.ts` + 16 测试**独立复跑通过**;fincards 全工程 gate 50 绿,无回归。

> ⚠️ ~~诚实缺口:回修闭环未被真实触发~~ → **已填补(2026-06-18)**,见下。

## 回修闭环真实实证(2026-06-18,填补上述缺口)

第二个端到端 US:`canonicalizeUrl`(新闻 URL 规范化去重 key,补强 aggregate 精确 link 去重缺陷;依据 RFC 3986 §6 + 跟踪参数剥离实践)。**刻意选高错误率纯逻辑**(7 规则 × 多边界)以触发 must-fix。

结果:**status=done,fixRounds=1**,856s。完整链路 test-0→dev-0→review-0(**真实 must-fix**)→test-1(resume 回修)→review-1(复审干净)→done。

- **真实 must-fix**:评审(conditional)抓出"缺无 `=` 的 valueless 查询参数用例"(如 `?gclid&id=1`),留了一个真实存活变异(L83);并**正确豁免等价变异**(比较器第二分支/idx tiebreak,引 §13 建议豁免而非堆测试)——吻合变异纪律。
- **热上下文 resume 实证**:test-0 与 test-1 的 `session_id` **完全一致**(`34cc7360...`)→ 回修用 `--resume` 续接同一测试 agent 会话,非 fresh spawn。SendMessage 替代机制在真实回修中坐实。
- **独立验证**:回修补测确实新增 valueless 用例(`?gclid&id=1`/`?z&a=1`);canonicalizeUrl 50 测试通过;fincards 全工程 gate **100 绿**,无回归。
- 教训:产出真实 must-fix 不需"挖坑",选业界公认高坑率的纯逻辑(URL 规范化)即可;完整 spec + 多边界自然产生首版遗漏 → 评审捕获 → resume 修复。回修闭环(含 resume 热续接 + 域归属 + 收敛)端到端成立。

## 暴露点 → Steering(固化)

1. **变异门揭穿弱测试**:首跑 66.56%。补强后 93.31%。揭出的真盲区:GREEN-超限/变异门-超限分支无测试、单 phase 失败靠后续兜底而非就地、止损 fixRounds 未断言、verdict 错误分支消息未钉。→ 已补 22 个测试。教训:**状态机的每条终止/分支边都要独立断言,不能靠"最终态相同"蒙混**(变异 `if(false)` 正是利用这点存活)。
2. **prompts.ts 移出 mutate**:纯字符串模板,变异测试低价值(改文案算"存活"但仅展示层),按 M5-A 先例(排除低价值 mutation 目标)处理,关键部分由包含性断言覆盖。

## 测试变更记录(红线 5:变更测试需独立记录)

均为**真实性修正,非弱化**:
- `drive-parallel.test.ts` 用例 #1:`kind:'inner-loop'→'freeform'`。该标签现有了真实派发含义(dispatch 路由),用例本意是测 invoke 路径的并行性/无重复/maxActive,改后语义对齐。三个核心断言原样保留。
- `queue-concurrency` fixture(claim-worker.ts):加**启动屏障**(N 进程开库就位再抢)+ **每条认领后模拟工作 8ms**。修正"紧凑空转"这一不真实模型(真实 worker claim 后要 spawn claude 干很久)。数据实证:真实并发稳定 3–4 进程瓜分,"≥2"见证恒成立;零双领/总数=500 始终确定。消除了此前 tsx 冷启动序列化导致的 flaky(8 次单测 + 多次完整 gate 稳定)。

## 事件驱动全链实证 + harness 发现(2026-06-18)

第三个端到端(穿过真实 SQLite 队列,非直接调 runInnerLoopJob):enqueue inner-loop job →
`driveParallelOnce` 原子认领 → dispatch → inner-loop 真跑 → ack done。结果 status=done/
fixRounds=0/263s/**costUsd=$1.67**(成本埋点首次产出真实值)。坐实 ① Loop 引擎"事件自动拉起完整 SDLC"。
新增 `bin-enqueue-sqlite.ts`(SQLite 入队 CLI)。看板:总运行 3 / 回修分布 0:2,1:1 / 成本均 $0.557。

> ⚠️ **harness 发现(待 Steering 固化)**:inner-loop 的变异门跑 fincards 的 `stryker.conf`,其 mutate 列表**固定**——
> dev agent **新建的文件不在列表 → 逃出变异门**(relativeTime/truncateTitle 当时均未被真正变异门把关,
> status=done 只代表既有 mutate 文件 ≥90)。已手动把三个新文件补入 mutate(均 ≥93%,truncateTitle/aggregate 100%)。
> **根因修复方向**:让 inner-loop 的变异门按"本切片改动/新增的源文件"动态确定 mutate 范围(如从 git diff 推导),
> 而非依赖静态 stryker.conf —— 否则新能力的测试强度无人把关。记入 backlog。

## 抽取(E,方案 A)

能力直接建于 `pipeline/driver/`(引擎基建即最终产物)。更新 `pipeline/workflows/orchestration-pwj.md`"驱动方式"段(现已自动驱动)+ `pipeline/README.md`。抽取≠冻结,随回修真实实证后续修正。

## 下一步

- 跑一个会产生 must-fix 的 US,拿回修闭环真实基线(填上"诚实缺口")。
- per-job state/usage 接入 M4 metrics 看板(本切片已落 state.json + trace,接看板待做)。
- M5-B:Git worktree 隔离 + 集成分支兜底 + squash 合并。
