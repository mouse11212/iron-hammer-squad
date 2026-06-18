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

> ⚠️ **诚实缺口:回修闭环未被真实触发**。fixRounds=0 表示最复杂的 must-fix 回修路径(resume 续接原角色修复)仅有**完整单测覆盖**,尚无**真实模型回修实证**。待一个会产生 must-fix 的 US 跑出真实基线(回修轮次分布/回修后 gate 通过率/超限升级率)。

## 暴露点 → Steering(固化)

1. **变异门揭穿弱测试**:首跑 66.56%。补强后 93.31%。揭出的真盲区:GREEN-超限/变异门-超限分支无测试、单 phase 失败靠后续兜底而非就地、止损 fixRounds 未断言、verdict 错误分支消息未钉。→ 已补 22 个测试。教训:**状态机的每条终止/分支边都要独立断言,不能靠"最终态相同"蒙混**(变异 `if(false)` 正是利用这点存活)。
2. **prompts.ts 移出 mutate**:纯字符串模板,变异测试低价值(改文案算"存活"但仅展示层),按 M5-A 先例(排除低价值 mutation 目标)处理,关键部分由包含性断言覆盖。

## 测试变更记录(红线 5:变更测试需独立记录)

均为**真实性修正,非弱化**:
- `drive-parallel.test.ts` 用例 #1:`kind:'inner-loop'→'freeform'`。该标签现有了真实派发含义(dispatch 路由),用例本意是测 invoke 路径的并行性/无重复/maxActive,改后语义对齐。三个核心断言原样保留。
- `queue-concurrency` fixture(claim-worker.ts):加**启动屏障**(N 进程开库就位再抢)+ **每条认领后模拟工作 8ms**。修正"紧凑空转"这一不真实模型(真实 worker claim 后要 spawn claude 干很久)。数据实证:真实并发稳定 3–4 进程瓜分,"≥2"见证恒成立;零双领/总数=500 始终确定。消除了此前 tsx 冷启动序列化导致的 flaky(8 次单测 + 多次完整 gate 稳定)。

## 抽取(E,方案 A)

能力直接建于 `pipeline/driver/`(引擎基建即最终产物)。更新 `pipeline/workflows/orchestration-pwj.md`"驱动方式"段(现已自动驱动)+ `pipeline/README.md`。抽取≠冻结,随回修真实实证后续修正。

## 下一步

- 跑一个会产生 must-fix 的 US,拿回修闭环真实基线(填上"诚实缺口")。
- per-job state/usage 接入 M4 metrics 看板(本切片已落 state.json + trace,接看板待做)。
- M5-B:Git worktree 隔离 + 集成分支兜底 + squash 合并。
