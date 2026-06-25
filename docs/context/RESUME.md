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
| **M4+ 可观测闭环** | ✅ **封板**(2026-06-24) | `pipeline/metrics`+`driver`:统一事件日志(traceId 全链回放)+ 地基切片①–⑦。四指标(Task Resolution/Churn/Verification Tax/Defect Escape)+ 追溯链 + inner-loop 统计 + 指标趋势**全部真实派生且持久**(trailer/ledger/history;前者 git-可复现,后两者持久)。口径自洽、缺数据诚实回落 null/省略。**全部明细见 `docs/plan/M4plus-event-log-retro.md`(地基+①–⑦)** |
| **M6 NFR 门 + 安全门** | 🚧 **主体完成**(2026-06-25) | 安全门谱系:M6-a 密钥扫描(green 门)+ M6-b 敏感改动审批(held 人签)+ M6-d STRIDE 安全评审(非确定 findings+确定动作,真 claude e2e)+ NFR 上游基线(方向占全/阈值待长程标定)。每切片"不影响已实现功能"三重保证。**余项待外部条件**:CodeQL(需 CI)、NFR 派生门(需长程数据)、d 接 run。复盘 `docs/plan/M6-retro.md` |

- **抽取线 E0–E5(部分) 已完成**(方案 A 边验证边抽取,产物可持续修正):`pipeline/` 现有 roles/gates/guides/workflows + driver(①,含 M5-A 并发队列/并行驱动/MCP)+ metrics(②)。
- **产品 fincards** 在 `iron-hammer-output/fincards/`:真四源聚合,TDD + 变异门 100%。
- **SoT**:10 个 OpenSpec capability(新增 concurrent-queue),M0–M5A change 全部归档。
- **GitHub**:`mouse11212/iron-hammer-squad`(SSH 推送,无需 token)。

## 3. 下一步（立即可做）

> ✅ **M4+ 已封板**(2026-06-24;见 §2 表 + `docs/plan/M4plus-event-log-retro.md` 地基+①–⑦)。**M0–M5 + M4+ 全部完成**。
> 🚧 **M5+ 进行中**。**M6（NFR 门+安全门）主体完成**(a 密钥/b 敏感面/d STRIDE 安全评审/NFR 上游 ✅;余 CodeQL 需 CI、NFR 派生门需长程数据;复盘 `M6-retro.md`)。**M7（drift 监控,项目根命题)已启动**:
>   - ✅ **M7-a 工具序列一致性 sensor 完成**(change `pipeline-drift-toolseq-sensor`,新 capability `drift-monitor`)。KB 接地(`[[agent-drift]]`/arXiv:2601.04170,ASI 12 维框架/τ=0.75 连续三窗)。`metrics/drift-sensor.ts` 纯 `opSequence`(events.jsonl 按 ts 取 op token 序列)/`levenshtein`/`seqConsistency`([0,1])/`driftAlert`(连续 k 个<τ 告警)+ 薄 `readDriftEvents`/`computeDrift`(按 US 分组→相对基线一致性序列→告警)——**最可确定性/离线/已可从 events 算的 drift 信号**(语义需 embedding、共识需多 agent,排后)。metrics gate 全绿(71,58→71 +13,既有零影响)。**诚实路径(同 NFR)**:未做长程任务测试→真实 events.jsonl 空→`insufficient-data` 不告警**不臆造已发生 drift**;合成渐变漂移序列单测证连续三窗<τ 正确告警、稳定不告警;τ=0.75/k=3 用 KB 默认待标定。**首切片建机制,真 drift 信号待长程**。拆解 M7-a..g 见 backlog「明确待办 · M7」;下一候选 M7-b 人工干预率 sensor(已有数据)。
> （以下 M6 切片明细留作历史)
>   - ✅ **M6-a 密钥扫描门 完成**(change `pipeline-secret-scan-gate`,新 capability `security-gate` + 改 `inner-loop-orchestration`):`driver/secret-scan.ts` 纯 `scanSecrets`(高精度模式 `ghp_`/`github_pat_`/AWS `AKIA`/PEM/通用赋值)+ 薄 `secretScanGate`(扫**本次改动 diff**,复用 `changedPathsFromStatus`)。**向后兼容注入** green(`makeGates` 可选 `secretScan`,**不注入零变化**;`inner-loop-runner:169` 真实装配启用)——命中 green 红 → dev 回修移除(不升级人类,人签留 M6-b);内联 `// allowlist-secret: 理由` 豁免(空理由不豁免)。**失败驱动**(§6 真实 PAT 泄露)。driver gate 全绿(232 测试,222→232 +10)。**「不影响已实现功能」三重保证实证**:① 可选注入默认 no-op→既有 222 测试零改动通过;② 只扫改动文件不回溯;③ fincards 产品全量 25 文件零误报。真实验证(临时 dir):密钥→红(摘要 path:line:rule)/移除→绿/豁免→绿/无改动→绿。
>   - ✅ **M6-b 敏感改动加严审批 完成**(change `pipeline-sensitive-change-gate`,改 `security-gate`+`worktree-integration`):`driver/sensitive-change.ts` 纯 `classifySensitive`(路径分类:鉴权 `auth/login/oauth/credential/session`、CI `.github/`/`*.ci.yml`/`Jenkinsfile`、基础设施 `Dockerfile`/`*.tf`/`k8s/`/`deploy/`;**依赖清单不列**——用户裁定机器可判)。`batchIntegrate` 加可选 4 参 `sensitiveCheck`(`BatchHeld.reason` 扩 `'sensitive'`+`categories`)→ 命中 → **held 路由人签,不自动合**(复用 held/handoff,红线7/军规7/D1);真实装配 drainBatchIsolated 注入(`git diff --name-only base...branch` → classifySensitive)。handoff 渲染 sensitive 类别+人签提示。**与 M6-a 区别**:M6-a=must-fix(移除密钥),M6-b=escalate-hold(改动合法但需人签,工作保留为分支)。driver gate 全绿(240 测试,232→240 +8)。**不影响已实现功能**:可选注入默认 off→既有 232 测试零改动通过;真 git e2e:`.github/` 改动→held(sensitive,ci)、普通 src→merged、main 不动。
- ✅ **NFR 上游已补**(`docs/requirements/铁锤小队-NFR-baseline-v1.md`,M6-c 的上游):harness 引擎层 8 维 NFR 基线——可观测/安全/并发/可移植**已达标**(既有门满足)、可维护**保守基线**(变异门 break90)、**可靠/性能/成本待长程标定**。约束:**当前未做长程任务测试**,性能/成本/长程可靠性 SLO 一律标"待长程标定"不臆造(红线1,同 M4+「待埋点」哲学);方向占全(8 维),usability/合规/可伸缩刻意排除(YAGNI)。V4 §8/§266 已回填指针。**M6-c 部分解依赖**:可对已达标/保守基线维度(如可维护性=补 metrics 包级变异门)派生门;待标定维度等长程数据。
>   - ✅ **M6-d 安全评审 agent 首切片 完成**(change `pipeline-security-review-agent`,扩 `security-gate`):`roles/security-review-agent.md`(STRIDE 6 + OWASP 自包含,只读评审)+ `driver/security-findings.ts` 纯 `parseSecurityFindings`(仿 verdict 严格校验,非法即抛)+ `mapFindingsToAction`(**确定性**:有 high→escalate 人签/复用 held、medium/low→advise)。**核心架构**:LLM findings 非确定 → 动作映射确定;**agent 不单独硬阻断**(漏报风险),高危人在环(红线7),与 M6-a/b 确定门**互补**(不替代)。driver gate 全绿(249,240→249 +9,既有 240 零影响)。**真 claude e2e**:含 SQL/命令注入样本→真 agent 产 5 STRIDE findings(2 high)→`parseSecurityFindings` 接受→`mapFindingsToAction` escalate=true。⚠️ **首切片可调用,不接 inner-loop 每轮**(贵/非确定,留后续按长程验证是否常态化)。
>   - 下一候选:M6-c NFR 门(已达标/保守维度可做,如补 metrics 包级变异门;待标定维度等长程数据)→ M6-e CodeQL(需 CI)→ M6-d 接进 run(按长程验证)。M6 主体(a/b/d 首切片 + NFR 上游)已成型。
> 以下为已完成工作的历史明细(已沉淀进各 retro,略读即可)：

回修闭环已真实实证。✅ inner-loop 接入 M4 看板(成本埋点已产真实值);✅ `canonicalizeUrl` 接线 `aggregate`(规范化去重);✅ **事件驱动全链打通**——SQLite 入队→认领→dispatch→inner-loop→ack done(穿真实队列,`bin-enqueue-sqlite.ts`)。✅ **修复 harness 缺口**:inner-loop 变异门改为**按 git status 动态确定 mutate 范围**(`gates.ts` `mutateTargetsFromStatus`+`mutation()` 用 `--mutate` 覆盖静态 stryker.conf),dev 新建文件不再逃门;driver 变异门 92.64%,stryker `--mutate` 机制实测只变指定文件。✅ **动态变异门真 e2e 确认**:真跑 clampPercent US 暴露并修了子目录路径 bug(`git status --porcelain` 是仓库根相对 → 用 `git rev-parse --show-prefix` 剥成工程相对);实测修复后 gate 跑出 `npm run mutation -- --mutate src/clampPercent.ts`,ok。顺带加 gate 命令 trace(`gates.jsonl`,补阶段间观测盲点)。✅ **M5-B 完成**(M5 DoD 收尾):`worktree.ts`(隔离 worktree + symlink 依赖 + squash 仅 targetPaths + 集成分支兜底,**绝不写 main**/军规 1/2)+ `runIsolated` 编排 + dispatch 开关 `IH_ISOLATION=1`;真集成验证(真 git,无 claude:squash→集成全绿→main HEAD 不变→隔离→回收);worktree.ts 变异门 100%。**真集成又揪出子目录路径坑**(squash 的 `git -C` 用了 worktree 根而非 projectDir,第 3 次同类,已修+固化纪律)。✅ **①完成 批量多分支集成**(军规 8):`worktree.ts` `batchIntegrate`——N feature 汇入 integration,clean+green 合入、冲突/gate 红回滚 held 升级(**不自动解冲突**/军规1、**不写 main**/军规2);真 git 真冲突验证(a/b 冲突→b held、a/c 合入、main 不变、无 unmerged 残留);worktree.ts 变异门 96.72%。✅ **②完成 守护+批后集成**:runIsolated 解耦(只产 feature 分支,不 per-job 集成)+ `drainBatchIsolated`(N 路并行隔离 drain → 收集成功分支 → batchIntegrate)+ `driveParallelLoop`(轮询守护,连续空轮即停;main `IH_DAEMON=1`)。下一步:
✅ **③完成 全链真 e2e**:入队→drainBatchIsolated→隔离 worktree 内真 claude 跑内循环→done→squash 产分支→batchIntegrate→`{ready:true,merged:[agent/e2e-iso-1]}`→main 不变→回收(249s)。首跑撞瞬时 API 错误反向验证失败路径(不提交/不集成/回收正确)。
**1/2/3 全部完成。** ✅ **harness 硬化:phase 瞬时 API 错误有限重试**已落地(`isTransientApiError` + makeRunPhase 重试:默认 2 次线性退避、每次 fresh session-id;只重瞬时不重真失败;resume 失败回退 fresh 的瞬时也重)。闭合了 ③ e2e 暴露的稳定性短板。✅ **集成分支跨批次累积**已落地:batchIntegrate 由"每批重置 base"改为"首建(`-b`)后复用累积"(`git rev-parse --verify` 判存在);真 git 两批验证 integration 同时含 a+b、main 不变。daemon 多轮的已验证 feature 不再被后批覆盖。✅ **多项目混批 relProjectDir 动态推导**已落地:batchIntegrate gatePerFeature 加 branch 参数;drainBatchIsolated 建 branch→relProjectDir 映射,per-feature 集成 gate 在各自产品目录跑(支持一批含不同产品)。真实多产品 e2e 待第二产品(现仅 fincards)。✅ **HITL 交接(held 通知 + 合并辅助)**已落地:`handoff.ts renderHandoffReport`(纯,渲染集成交接 md:已集成+squash 合并命令、挂起+原因+指引、明确合 main 是人类决策)+ drainBatchIsolated `onHandoff` 钩子 + `makeDefaultHandoff`(写 `.runtime/integration-report.md` + console)。**人机边界已闭合**——结果可执行地递到人手上。下一步候选:
✅ **daemon CLI 接全已完成**:`makeBatchDrainRound`(守护单轮:开队列→recover→drainBatchIsolated→close,注入 open/drain 可测)+ `makeRealBatchDeps`(真实 deps 装配:隔离跑+批后集成+green gate+HITL 交接)+ main 三态(`IH_DAEMON` 常驻全链 / `IH_ISOLATION` 单批全链 / 默认 legacy)。**真 e2e 揪出并修 `isMainModule` bug**(`import.meta.url===\`file://\`+argv1` 在中文/URL编码路径下永不相等→main 块静默不执行;改 `pathToFileURL(argv1).href===metaUrl`,5 测试固化含中文回归基准)。
✅ **动态 squash 已完成(根治"成功被静默丢弃")**:`squashCommit(projectDir,message)` 去掉外部 targetPaths,改 `changedPathsFromStatus`(据 git status 动态捕获实际改动,porcelain 天然排除 gitignore 的变异沙箱);agent 写在 `test/` 还是 `src/`、什么命名都正确捕获。**真 e2e 揪出**:targetPaths 预测错路径→`git add` fatal→done 成果静默丢。
✅ **orchestrator 代修能力已完成(任务2)**:`FixDomain` 加 `orchestrator`;`MustFix.action`(白名单 `register-mutation-target`);inner-loop 回修循环遇 orchestrator 域→调注入 `orchestratorFix`(确定性非agent,成功继续/失败/无能力→escalated);`orchestrator-fix.ts`(`registerMutationTarget` 纯+`makeOrchestratorFix` 白名单)登记新纯逻辑文件进产品 stryker.conf;review prompt 告知。**破解"新文件需登记 stryker.conf 但环内无人有权"的结构性 escalated**。
- **真 e2e 四路径全实证**(fincards,真 claude):①failed(test 超时 5min)②blocked-escalated(formatCompactNumber 新文件未登记 stryker.conf,域边界拦截)③**done→动态squash→batchIntegrate merged→main 不变**(clampPercent NaN,success 实证)④handoff 三态。**对照实验**:未登记新文件→escalated vs 已登记文件→success,实证"交付沉淀(静态护栏)"必要性。
- **双层变异门认知**(KB loop-engineering/痛点三):inner-loop 动态门=建造期脚手架(US内),产品静态 stryker.conf=交付后护栏;交付须把建造期覆盖的文件沉淀进静态护栏(orchestrator 代修做这件事)。
- ⚠️ **求真纠正**:曾把"角色不混同(CLAUDE.md 红线4)/阻塞升级(红线6)"误称"军规4/6"(军规4=短命快合、军规6=规范命名,见 V4 §9)。两套编号:CLAUDE.md 7 红线 ≠ V4§9 8 军规。已修代码注释 2 处。
- driver gate:lint/typecheck/**185 测试**/变异门 **91.16%**(orchestrator-fix.ts + changedPathsFromStatus 排除软链入 mutate)。
- ✅ **任务2真 e2e 翻盘完成**:formatCompactNumber(曾 escalated)→ review 标 orchestrator 域 register-mutation-target → 代修登记 stryker.conf → 次轮 review 确认(变异100%)→ **done**;integration 含 src+test+stryker.conf 登记三者,main 不变。**揪出并修 node_modules symlink 缺口**:linkDeps 软链因 root `.gitignore` `**/node_modules/` 带尾斜杠只匹配目录而漏网,被动态 squash 误捕获(合 main 会污染不可移植软链)→ `changedPathsFromStatus` 排除,2 测试固化。
- ✅ **OpenSpec 规约已补**:归档 `2026-06-23-pipeline-dynamic-squash-orchestrator-fix`(worktree-integration squash 动态化+排除软链;inner-loop-orchestration 新增 orchestrator 域确定性代修)。
- ✅ **红线/军规分层厘清**:CLAUDE.md 核心禁止事项加体系说明(7 红线=原则层、8 军规=Git执行层,**独立编号、引用带"红线N"/"军规N"前缀、抵触以红线为准**);V4 §9 反向引用。纠正曾把红线4/6 误称军规4/6。
- ✅ **M4+ 地基切片完成**(change `pipeline-unified-event-log`,capability `observability-events`):统一 event schema(`events.ts`:`{ts,traceId,op,phase?,status?,durationMs?,payload?}`,纯构造器+薄 sink)+ **traceId=jobId 贯穿** + 中心 `<pipeline>/.runtime/events.jsonl` + **5 发射点**(`instrument.ts` 包装 phase/gate/squash/integrate/orchestrator-fix)+ **回放**(`replay.ts`+`bin-replay.ts`,`npm run replay -- <traceId>`)。driver gate 全绿(205 测试,185→205),**变异门 91.72%**(events/instrument 100%、replay 85%)。**真 claude e2e DoD 完全闭合**:`IH_ISOLATION=1` 跑 fincards 新 US `formatSignedPercent` 全链成功(已集成1/挂起0,~690s),events.jsonl 落 17 条真实事件(phase×4/gate×10/orchestrator-fix×1/squash×1/integrate×1,全 traceId=m4plus-e2e-1),`bin-replay` 渲染出 规约→test→RED→dev→GREEN→review→orchestrator-fix(登记新文件)→review回修→变异门→squash→integrate 全链(带真实耗时/成本/退出码);**main 未动(军规2)**,e2e 临时分支已清。复盘 `docs/plan/M4plus-event-log-retro.md`。
- ✅ **M4+ 续切片①完成 Verification Tax 真值化**(change `pipeline-verification-tax`,改 `harness-metrics` capability):`metrics/events-tax.ts`(纯 `categorizeDuration`/`taxByTrace` + 薄 `readEventsJsonl`)从 events.jsonl 的 durationMs 派生——**实现=dev phase,验证=test/review phase+gate+orchestrator-fix**(D1 口径,写测试归验证);collect.ts 接入,去掉写死的 `verificationMs=null`;看板出聚合+按 US(traceId) 明细;无 events 优雅回落"待埋点"。metrics gate 全绿(32 测试)。**真实验证**:复刻上一切片真 e2e 17 事件经真 sink → `npm run report` → Verification Tax **86.2%**(验证 595376ms/实现 95029ms,手算一致);清 events 后回"待埋点"两路径均真跑。⚠️ metrics 包无 stryker 变异门(E4 未配)→ 用变异级穷尽单测兜底,包级变异门另立基建。
- ✅ **M4+ 续切片② 完成 追溯链自动织链**(change `pipeline-trace-weaving`,改 `harness-metrics` capability):`metrics/weave-traces.ts`(纯 `weaveTraces` + 薄 `readArchivedChanges`)从 OpenSpec archive + git 确定性派生 `changeId→spec→tests→commit`,取代手维护 traces.json。**锚点=归档某 change 的 git commit**(工作节奏 §5「archive→commit」使该 commit 同含 archive 移动+实现+测试):changeId=archive 目录名去日期前缀、spec=该 change `specs/` 下 capability 目录名按字典序斜杠拼接、commit=归档 commit 短 hash、tests=该 commit diff 里的 `*.test.ts`/`*.spec.ts`(方案 A)。collect.ts 接线(snapshot.traces 由读文件改实时派生);`bin-weave`(`npm run weave`)写出 `data/traces.json` 作可检视产物。metrics gate 全绿(38 测试,+6)。**真实验证**:`npm run report` traces **5→18**(手维护停在 M3 → 全 18 归档 change 自动织链);看板表渲染全链(board.ts 零改动)。**实证诚实退化**:早期 M0/M1 归档 commit(`eac24ab` 纯归档提交,无测试)→ tests 空,`git show` 证实非 bug,非臆造——揭示工作流演进(早期"实现提交+单独归档提交"两步 vs M4+"实现+归档同提交")。⚠️ metrics 包仍无 stryker(E4)→ 6 纯函数测试穷尽精确断言兜底。
- ✅ **M4+ 续切片③ 完成 Defect 自动喂**(change `pipeline-defect-feed`,改 `harness-metrics` capability):`metrics/defects-feed.ts`(纯 `deriveDefects` + 薄 `readEscapeTrailers`)取代手维护 defects.json。**caught** 从 inner-loop run 信号确定性派生(`fixRounds` 次回修各一条 + escalated `residual` 各一条;`fixRounds=0` 干净 run 不臆造缺陷;**ephemeral**=当前 runtime,同 VTax);**escaped** 从 git commit trailer `Defect-Escaped: <desc>` 挖采(**持久**,全历史)。**逃逸判定归人**(发现合并后缺陷时打 trailer,约定写进 `guides/agent-conventions.md`)、采集归机(红线6)。`compute.defectEscapeRate` 总数 0→**null**("待埋点",不伪造 0%;原返回 0,已改+更新 compute.test);`collect.ts` 复用既读 runs(扩 `residualCount`)不重复扫描;`board.ts` 分别显示拦截/逃逸数 + 标注时间口径 + null 路径"待埋点"。metrics gate 全绿(46 测试,+8)。**真实验证**(临时 git repo,非破坏):有缺陷 total=4(1fix+2residual+1escaped)/escaped=1/rate=**0.25**;无缺陷 total=0/rate=**null**——两路径穿真 git log trailer 挖采 + 真 fs run + collect 接线。⚠️ **固有限制**:caught(ephemeral)/escaped(持久) **时间口径不对称**(fresh checkout 极端下率失真)→ total=0 回落 null 缓解,根治留"持久化 caught"切片;历史 3 条手维护 caught 无机器源不重建。metrics 包仍无 stryker(E4)→ 穷尽精确断言兜底。
- ✅ **M4+ 续切片④ 完成 持久化 caught**(change `pipeline-persist-caught`,改 `inner-loop-orchestration`+`harness-metrics` 双 capability):根治切片③ 的 caught(ephemeral)/escaped(持久) 口径不对称。**driver emit**:纯 `squash-message.ts` `squashMessage(jobId, fixRounds)`——done run squash 时 `fixRounds>0` 追加 N 行 `Defect-Caught: inner-loop 回修轮 <k>`(机器写),`inner-loop-runner.ts:237` 接线;只 done run 走 squash(escalated 无提交→不持久,已知边界)。**metrics 换源**:caught 从 runtime runs **改为 git `Defect-Caught:` trailer 挖采**——caught+escaped 同 `git log` 源、同口径持久,**率彻底可比**。新通用薄 IO `mineTrailers(repoRoot, key)`(`readCaughtTrailers`/`readEscapeTrailers` 皆其薄封装);`deriveDefects(caught, escapes)` 两侧每行一记录对称;collect 接线;**回退切片③ 的 `residualCount`**(被取代)。driver gate 全绿(214 测试)+ metrics gate 全绿(45 测试)。**真实验证**(临时 git repo,非破坏):`Defect-Caught:`×2 + `Defect-Escaped:`×1 → collect total=3/escaped=1/rate=**0.333**(两侧均 git 挖采,口径对齐实证);无缺陷→null。guide 补 `Defect-Caught:` 约定(机器写,人勿手打)。⚠️ 残留限制:escalated caught 不持久;历史已合并 done run 无 trailer 不可重建,此后每 done 自动持久。
- ✅ **M4+ 续切片⑤ 完成 持久化 VTax**(change `pipeline-persist-vtax`,改 `inner-loop-orchestration`+`harness-metrics` 双 capability):把 Verification Tax 从 ephemeral `.runtime/events.jsonl` 换源到 git trailer,**fresh checkout 可复现**。**driver emit**:纯 `aggregate-phase-ms.ts`(过滤 traceId=jobId、按 op 分类累加 durationMs,**只报原始事实不应用口径**)+ `squashMessage(jobId, fixRounds, phaseMs?)` 扩展追加一行 `Metrics-Phase-Ms: dev=.. test=.. ...`(仅非零);`runIsolated` 加注入 dep `readPhaseMs?`(默认读中心 events.jsonl 聚合),squash 前算好传入。**metrics 换源**:`collect` VTax 由 `mineTrailers(repoRoot,'Metrics-Phase-Ms')` → 纯 `parsePhaseMsTrailer(desc, commit)` 还原最小 TaxEvent → **复用既有 `categorizeDuration`/`taxByTrace`**(D1 口径仍只活 metrics 一处,choice A);不再读 events.jsonl;per-US 以 commit 短 hash 为键。driver gate 全绿(220 测试)+ metrics gate 全绿(48 测试)。**真实验证**(临时 git repo,非破坏):`Metrics-Phase-Ms: dev=95000 test=595000` → VTax=**0.862**(与切片① 86.2% 一致)、per-US 按 commit、**可复现重算一致**;无 trailer→null。guide 补 `Metrics-Phase-Ms:` 约定。⚠️ 残留:只 done-run VTax 持久(escalated 无提交);历史已合并 done run 无 trailer 不可重建。**events.jsonl 仍供 replay 调试(降级为 live 态源)**。
- ✅ **M4+ 续切片⑥ 完成 持久化 inner-loop 统计(收尾)**(change `pipeline-persist-runledger`,改 `inner-loop-orchestration`+`harness-metrics` 双 capability):升级率/成本/回修分布从 ephemeral `.runtime/runs` 换源到 **committed `docs/metrics/runs-ledger.jsonl`**。**为什么非 trailer**:升级率需 `blocked-escalated`/`failed` run,而它们**不产生提交**、git 无痕——trailer 持久不了无提交的事,ledger 是唯一出路。**driver**:`run-ledger.ts` 纯 `runLedgerRecord`(slim 投影:只 `{jobId,status,fixRounds,costUsd,ts}`,丢 sessions/residual 噪声)+ 薄 `appendRunLedger`;在 `runInnerLoopJob` 写 state.json 同点(每个终态 run 单一汇合)append。**metrics**:薄 `readRunLedger` 逐行 parse + **按 jobId 去重(后写覆盖,幂等)**;`collect` inner-loop 源换 ledger,retire `.runtime/runs` 读取。driver gate 全绿(222 测试)+ metrics gate 全绿(52 测试)。**真实验证**(临时 repo,非破坏):ledger 含 done×2+escalated×1+failed(同 jobId 重试)→ collect total=3/escalationRate=**0.333**(**escalated 成功持久——trailer 做不到的**)/去重生效;空 ledger→innerLoop 省略。guide 补 ledger 说明。⚠️ **诚实限制**:ledger **持久但不可从 git 复现**(累积记录,非提交型信号固有性质,与前 5 块 git-可复现不同);从空起步不回填旧 e2e。
- 🎯 **M4+ 可观测闭环主体收尾**:四指标(Task Resolution/Code Churn/Verification Tax/Defect Escape)+ 追溯链 + inner-loop 统计**全部真实派生、持久**(前 5 块 git-可复现,第 6 块 ledger 持久);口径自洽、缺数据诚实回落 null/省略。
- ✅ **M4+ 续切片⑦ 完成 report 历史归档**(change `pipeline-report-history`,改 `harness-metrics`):`bin-report` 每次覆盖 dashboard.md 只剩"此刻"快照,看不到趋势。新增 `report-history.ts`(纯 `historySnapshot` 投影 slim 趋势记录 `{generatedAt,taskResolutionRate,verificationTax,defectEscapeRate,codeChurnTotal,resolved,attempted}` + 薄 `appendHistory`/`readHistory`)+ CLI `bin-archive.ts`(`npm run report:archive`,**opt-in** 追加快照到 committed `docs/metrics/history.jsonl`,普通 report 不污染);`renderBoard(snap, history?)` 加可选 history 参数渲「指标趋势(最近 N=10)」区(向后兼容:既有无 history 调用零变化),`bin-report` 读 history 传入。metrics gate 全绿(58 测试,+6)。**真实验证**(临时 repo):`report:archive` 跑两次→history 2 行→看板趋势表显示两行;空 history→无趋势区。⚠️ 同 ledger:history 持久但不可 git 复现(归档过去某时刻的值);从空起步不回填。**与⑥ 区别**:⑥ 存 per-run 原子事实,⑦ 存 per-report 聚合快照,互不重复;服务 ③ Compound 层趋势判断。
- 待办(M4+ 零头,非阻塞):metrics 包级 stryker 变异门(E4 未配,现靠穷尽精确断言兜底);外部通知渠道(留 daemon 长跑时,涉对外发布的安全裁决);daemon 自动归档采样;comprehension debt 待合阈值告警。**M5+ 主线见 §3 顶部:M6 NFR/安全门。**
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
- NFR 基线(引擎层,M6 上游):`docs/requirements/铁锤小队-NFR-baseline-v1.md`
- 路线/抽取线:`docs/plan/铁锤小队-能力backlog-v1.md`
- 各里程碑复盘:`docs/plan/{M0-retro-baseline,M1-retro,M2A-retro,M2-crosspublisher-retro,M3-E3-retro,M4-E4-retro,M5A-retro,M5-inner-loop-retro,M4plus-event-log-retro,M6-retro,M7-drift-retro}.md`(M6 切片细节另见 `M6-secret-scan-retro.md`)
- inner-loop 设计:`docs/plan/2026-06-18-driver-inner-loop-orchestration-design.md`(brainstorm 决议 + spike + 架构)
- 关键决策:`docs/plan/D9-message-component-decision.md`
- 最终产物:`pipeline/README.md`(roles/gates/guides/workflows/driver/metrics)
- 可执行规约 SoT:`docs/openspec/specs/`(9 capability)+ `changes/archive/`
- 实时看板:`docs/metrics/dashboard.md`(运行 `pipeline/metrics` 的 `npm run report`)
- 产品:`iron-hammer-output/fincards/`
- 知识库 grounding:`KB_ROOT`(LLMwiki/.../ai-dev-learning),经 claude-obsidian wiki-query 逐层披露
