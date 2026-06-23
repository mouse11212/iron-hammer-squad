# 复盘:daemon CLI 接全 + 动态 squash + orchestrator 代修能力

> 日期 2026-06-23 · 切片:把已验证单元组装成可一键启动的全链 daemon,并补齐 orchestrator 代修能力。
> 关联真相源:`pipeline/driver/`、V4 §9(Git 8 军规)、CLAUDE.md(7 红线)、KB loop-engineering/agentic-harness-hardcore-problems。

## 1. 做了什么

### 任务 1:daemon CLI 接全
- `makeBatchDrainRound(dbPath, {buildDeps, openQueueFn?, drainBatch?})` —— 守护单轮生命周期:开队列→recover→drainBatchIsolated→close(finally 保证异常也关)。注入 open/drain 接缝可确定性单测。
- `makeRealBatchDeps({concurrency?, baseRef?, cmd?})` —— 真实 BatchDrainDeps 装配:runOne=隔离跑、batchIntegrate=跨批累积集成、integrationGate=各项目 green、linkDeps、onHandoff=HITL 报告。构造期不做 IO,可单测接线(守住"onHandoff 不被漏接")。
- main 三态:`IH_DAEMON` 常驻全链守护 / `IH_ISOLATION` 单批全链 / 默认 legacy 非隔离单次。

### 任务 1 附带根治:动态 squash
- `squashCommit` 去掉外部 `targetPaths` 参数,改 `changedPathsFromStatus(porcelain, prefix)` 据 git status 动态捕获实际改动(不限扩展名/目录、含删除;porcelain 天然排除 .gitignore 的变异沙箱/依赖)。
- 动机:真 e2e 揪出 targetPaths 预测错路径(测试在 `test/` 而非 spec 写的 `src/`)→ `git add` fatal → **done 的成果被静默丢弃**(比 bug 更危险:丢的是正确)。

### 任务 2:orchestrator 代修能力
- `FixDomain` 加 `orchestrator`;`OrchestratorAction`/`MustFix.action`(白名单 `register-mutation-target`)。
- inner-loop 回修循环遇 orchestrator 域 → 调注入 `orchestratorFix`(确定性、非 agent):成功继续循环 / 失败 / 无能力 → escalated(不静默吞)。
- `orchestrator-fix.ts`:`registerMutationTarget`(纯,幂等登记进 stryker.conf)+ `makeOrchestratorFix`(白名单 IO,仅 register-mutation-target,不识别→ok:false)。
- review prompt 告知 orchestrator 域 + action 用法。
- 破解:formatCompactNumber 那类"新文件需登记 stryker.conf 但 test/dev 无权、又无 orchestrator 环节"的结构性 escalated。

## 2. 真 e2e 实证(fincards,真 claude)

| 路径 | US | 结果 | 揭示 |
|---|---|---|---|
| ① failed | formatCompactNumber | test phase 超时 5min(agent 认知混乱+rate limit) | 失败路径干净:不 squash/不集成/main 不变/worktree 回收 |
| ② blocked-escalated | formatCompactNumber | must-fix: stryker.conf 未登记新文件(域边界拦截) | review 正确识别交付沉淀缺失;暴露"缺 orchestrator 代修"缺口 |
| ③ **done→merged** | clampPercent NaN | done(fixRounds=0)→动态squash→batchIntegrate merged→main 不变 | **接全 success 端到端铁证** + 动态 squash 捕获 src/+test/ |
| ④ handoff 三态 | — | 无产出/已集成/(挂起) | 报告渲染正确 |

**对照实验**:未登记新文件 → escalated(②) vs 已登记现有文件 → success(③)。同等质量代码,登记与否决定能否过交付门 —— 实证"交付沉淀(静态护栏)"必要性。

## 3. Steering Loop:真实失败 → 根因 → 固化

| 真 e2e 揪出 | 根因 | 根治 + 固化 |
|---|---|---|
| daemon 静默不启动 | `import.meta.url===\`file://\`+argv1` 在中文/URL编码路径下永不相等 → main 块不执行 | `isMainModule` 用 `pathToFileURL` 归一化;5 测试含中文回归基准 |
| done 成果被静默丢弃 | squashCommit 用外部硬编码 targetPaths,预测错即 add fatal | 动态 squash(changedPathsFromStatus);7 测试 |
| 新文件结构性 escalated | 缺 orchestrator 代修环节(test/dev 无权登记 stryker.conf) | orchestrator 域 + 白名单代修;11 测试 |

## 4. KB grounding(本切片实际查证)

- `loop-engineering`(Osmani):daemon 命中六部件(timer/worktree/sub-agent/state),"runs on a timer, spawns helpers, feeds itself" —— 接全形态被背书。引入概念 **comprehension debt(理解负债)** = daemon 长跑无限累积待合的真实债务(已记为已知边界)。
- `ralph-wiggum-loop`:每轮全新上下文、状态靠文件系统/git 存活 —— 与每轮重开队列同构。
- `agentic-harness-hardcore-problems` 痛点三(自演进 harness 回归预测仅~11.8%):**orchestrator 自动代修 = 自演进,必须白名单+确定性+可审计**,绝不做通用自动改。痛点四(agent drift ~200交互):daemon 长跑安全因 **job 级 fresh session** 规避(非单会话长跑)。

## 5. 求真纠正(本切片记录)

把 CLAUDE.md「核心禁止事项」(7 红线)与 V4 §9「Git 驭手」(8 军规)两套编号张冠李戴:误称"角色不混同=军规4""阻塞升级=军规6"(实为红线4/红线6;军规4=短命快合、军规6=规范命名)。已修 `inner-loop.ts`/`orchestrator-fix.ts` 注释 2 处。教训:代码注释是轻量真相源,引用规约须核对编号,不凭记忆。

## 6. 已知边界 / 待办

- 任务2 真 e2e(formatCompactNumber 翻盘 escalated→done):单测已覆盖,用户选跳过 e2e 直接收尾;留作下次可选铁证。
- **comprehension debt**:daemon 跨批无限累积 integration 等人合 main,未来加"待合阈值告警/暂停收新批"。
- OpenSpec worktree-integration 规约未更新(动态 squash + orchestrator 代修);本切片直接 TDD 引擎基建,规约待补。
- 变异门 orchestrator-fix.ts 残 2 存活(接近等价的边缘变异),核心逻辑已覆盖。
- 外部通知渠道、report 历史归档、M6+。
