# 复盘 · M4+ 可观测闭环（地基切片:统一事件日志 + traceId 回放）

> 日期 2026-06-23 · change `pipeline-unified-event-log`（capability `observability-events`）
> 范围:M4+「可观测闭环」从窄到宽（CLAUDE.md 红线3）的**第一个地基切片**——只打通"一条链可回放"。

## 做了什么

V4 §7:204 要求"所有操作记结构化日志、挂追溯链 ID、全链路可回放"。M4 已有骨架但日志分散、无统一 schema、无 traceId 贯穿。本切片:

- **统一 event schema**(`events.ts`):一条操作=一行 JSONL,`{ ts, traceId, op, phase?, status?, durationMs?, payload? }`。纯构造器 `makeEvent`(时钟注入)+ 薄 IO `makeEventSink`(append-only + mkdir -p)。
- **traceId = jobId**:不新造标识,直接复用已贯穿 runsDir/squash message/feature 分支名的 jobId。
- **中心化** `<pipeline>/.runtime/events.jsonl`:集成事件跨多 job,中心日志使"按 traceId 回放一个 US"成为一次干净 filter。
- **5 个发射点**(`instrument.ts` 包装器):`phase`(runPhase 包装,per-role attempt 计数)、`gate`(cmd 包装,补 exitCode/durationMs,取代旧 gates.jsonl)、`squash`(runIsolated)、`integrate`(drainBatchIsolated,分支名 `agent/<jobId>` 反推 traceId)、`orchestrator-fix`。
- **回放**(`replay.ts` + `bin-replay.ts`):纯 `groupByTrace`/`formatReplay` + 薄 `readEvents`(跳畸形行)+ CLI `npm run replay -- <traceId>`。

## 验证来源（可溯源）

- driver gate 全绿:lint + typecheck + **205 测试**(185→205,+20)。
- **变异门 91.72% > 90 破线**:`events.ts` 100% / `instrument.ts` 100% / `replay.ts` 85.11%。
- **真 claude e2e(DoD 完全闭合)**:`IH_ISOLATION=1` 跑 fincards 新 US `formatSignedPercent`(全新小纯函数),全链成功(**已集成 1/挂起 0**,~690s)。events.jsonl 落 **17 条真实事件**(phase×4、gate×10、orchestrator-fix×1、squash×1、integrate×1),全部 traceId=`m4plus-e2e-1`。`bin-replay m4plus-e2e-1` 渲染出完整链:
  `phase/test(113s,$0.79) → gate npm test ERROR(RED) → phase/dev(95s,$0.57) → gate lint/tc/test OK(GREEN) → phase/review(190s,$0.88) → orchestrator-fix 登记 src/formatSignedPercent.ts → gate OK → phase/review attempt=1(286s,$1.14 回修轮) → gate 变异门 --mutate src/formatSignedPercent.ts OK → squash done(agent/m4plus-e2e-1) → integrate merged`。
  凭 jobId 一条命令回放出 规约→test→dev→review→gate→orchestrator-fix→squash→integrate 全链,带真实耗时/成本/退出码——V4 §7:204"全链路可回放"落地。**main 全程未动(军规2)**;e2e 临时分支/worktree 已清理(formatSignedPercent 仅作验证载体,非真交付)。
- **意外印证**:真 e2e 自然触发 orchestrator-fix(新文件需登记 stryker.conf)——这条以前**完全无日志**的盲区操作被统一事件如实捕获;phase×4(非3)是真实回修轮,被 per-role attempt 计数正确分离(review attempt=0/1)。
- **诚实标注**:`orchestrator-fix durationMs:0` 是同步确定性操作 Date.now() 两次紧邻调用所得,非 bug。

## 揪出的坑 / 隐性知识

- **可选 emit 而非必填**:`runIsolated`/`drainBatchIsolated` 加 `emit?`/`clock?` 可选注入——既有 30+ 注入式假 deps 测试不传 emit 即零行为变化、一行不改全绿。新能力对旧调用方透明,是"从窄到宽"在接口层的体现。
- **变异门钉精确输出**:首跑 89.28% 未达标,因 `formatReplay` 渲染只断言了 op 顺序、没断言精确格式 → 分隔符/字段/join 变异存活。补"全字段事件精确渲染"+"最小事件不渲染可选片段"+ comparator 降序/相等边界用例后达标。教训:回放渲染这类纯函数必须断言**精确字符串**,不能只断言 contains。
- **临时 tsx 脚本相对导入**:放 /tmp 解析不到 `./src/*.js`,须放进工程目录(相对工程根)再清理。
- **bin-* CLI 不单测**:沿用本仓库约定——CLI 是薄 glue,逻辑全在已测纯函数(replay.ts),CLI 经真实 IO 烟测验证。

## 双层认知（接 KB）

- KB `agent-observability` 三要素之①端到端动态追踪 = 本切片的 op 序列;埋点属 KB `guides-and-sensors` 的 **computational sensor**(确定、毫秒级、可随每次变更运行)→ 纯构造器 + 注入时钟 + 薄 IO 的设计直接对应。
- `durationMs` 现在进 schema 但本切片不算 Tax:为下一切片预埋钩子——届时 collect.ts 按 `op=phase&phase=dev`(实现) vs `op=gate|phase=review`(验证) 聚合即可,无需回头改埋点层。

## 续切片① 已完成:Verification Tax 真值化（change `pipeline-verification-tax`）

兑现地基切片预埋的 `durationMs` 钩子:`metrics/events-tax.ts` 从 events.jsonl 派生实现/验证耗时,接入 collect.ts。

- **口径 D1**:实现=dev phase;验证=test/review phase + gate + orchestrator-fix(写测试归"验证"——Verification Tax 衡量"为信任 AI 产出的开销")。squash/integrate 不计。
- **复用** compute.ts 既有 `verificationTax()`(null 回落/除零),新代码只从 events 算两个 ms——埋点层零改动。
- **跨包契约**:metrics 不 import driver,按本地最小 event 形状逐行 parse events.jsonl。
- **真实验证**:复刻地基切片真 e2e 17 事件经真 sink → `npm run report` → Verification Tax **86.2%**(验证 595376ms / 实现 95029ms,与手算一致),per-US 明细 m4plus-e2e-1=86.2%;清 events 后回落"待埋点"——两路径真跑。metrics gate 全绿(32 测试)。
- **意义**:86.2% 印证 D1 口径诊断价值——该 US 95s 实现 vs 595s 验证(写测试+两轮评审+门),验证开销 6 倍于实现,正是早期切片"慢"的真相。
- ⚠️ **metrics 包无 stryker 变异门**(E4 抽取时未配)→ 本切片用变异级穷尽单测兜底,包级变异门列为独立基建任务。
- **dashboard 提交策略**:events.jsonl 为 ephemeral,提交的 dashboard.md 重生成为无 events 的"待埋点"态(避免提交不可复现的本地派生数字);真值证明留本复盘。

## 续切片② 已完成:追溯链自动织链（change `pipeline-trace-weaving`）

把追溯链从手维护 `traces.json`(5 条,停在 M3)改为从 OpenSpec archive + git **确定性派生**,根治"手维护必然漂移"。

- **关键洞察=归档 commit 是全链锚点**:工作节奏 §5「`openspec archive`→`git commit`」使归档某 change 的那次 commit 同含 archive 移动 + 实现 + 测试(commit `93b57cc` 实证)。于是 `changeId/spec/tests/commit` 四字段**同源**于一个真实 commit,每字段可溯源,零臆造(红线1)。
- **分层=纯 + 薄 IO**(仿 events-tax.ts):纯 `weaveTraces(changes)` 组装/排序/拼接/过滤(6 测试穷尽精确断言);薄 `readArchivedChanges(repoRoot)` 扫 archive 目录 + 跑 `git log --diff-filter=A`(取归档 commit,rename 回退兜底)/`git show --name-only`(取改动文件)。collect.ts 一行接线,`bin-weave` 写可检视产物。
- **TDD 精化边界**:design 原把"测试文件过滤"放 IO,写测试时发现去前缀/过滤/去重/排序全是确定性纯逻辑 → 上移进纯函数(吃原始 changedFiles),IO 退化为纯采集。"难测=边界不对"的信号在起作用。
- **真实验证**:`npm run report` traces **5→18**(全 18 归档 change 织链);看板表 board.ts 零改动渲染全链;`npm run weave` 写出合法 JSON 18 条。
- **实证诚实退化(求真)**:早期 M0/M1 归档 commit(`eac24ab`="chore: 归档 M0 change",纯归档提交)无测试文件 → `tests:[]`;`git show` 证实是真退化非过滤 bug。**揭示工作流演进**:早期"先实现提交、后单独归档提交"两步走 → 归档 commit 无测试;M4+"实现+归档同提交" → 织出丰富测试链。weaver 比旧手维护清单更诚实(旧清单把实现 commit 与归档状态混为一谈)。
- **确定性 > 启发式**:找"实现 commit"无干净确定性信号(正是当初要手维护的原因)。归档 commit 是唯一可确定性锚定点;在禁止臆造下,确定但稀疏 > 启发但可能编造。
- **坑/隐性知识**:`.json` 产物不能带 `//` 注释头(破坏 JSON 合法性且 spec 要求内容=TraceLink[]) → "自动生成勿手改"溯源放 console + README,不污染文件。`noUncheckedIndexedAccess` 下 `arr[i]` 是 `T|undefined` → 源用 `?? ''`、测试用 `?.`(沿用本仓 board.test.ts 的 `?.` 风格)。
- ⚠️ metrics 包仍无 stryker 变异门(E4 未配)→ 用 6 纯函数穷尽精确断言兜底,包级变异门另立基建。

## 续切片③ 已完成:Defect 自动喂（change `pipeline-defect-feed`）

把缺陷记录从手维护 `defects.json`(3 条全 caught,停在 M3)改为自动喂:caught 确定性派生、escaped 显式 trailer 挖采。

- **关键张力=时间口径不对称**:caught 信号在 inner-loop 运行时(`.runtime/runs`,ephemeral),escaped 是合并后人类判断(无干净确定性信号)。设计选择:**caught 自动派生(机器)+ escaped 显式 git trailer(人判定、机采集)**——对齐红线6"人判质量、AI 执行",零启发式臆造(红线1)。escaped 走 git trailer 而非又一个手维护 JSON,与提交同源、`git log` 可挖。
- **分层=纯 + 薄 IO**(仿 weave-traces.ts):纯 `deriveDefects(runs, escapes)` 计数组装(6 测试穷尽);薄 `readEscapeTrailers` 跑 `git log --format=%H%x1f%B%x1e` 扫 `Defect-Escaped:` 行。collect 复用既读 runs(扩 `residualCount`)不重复扫描。
- **caught 口径**:`fixRounds` 次回修各一条(每轮 must-fix=评审/门抓到的真实缺陷)+ escalated `residual` 各一条(抓到但升级未解,仍 caught);`fixRounds=0` 干净 run 不产缺陷(不臆造);初始 RED 不计(TDD 正常流)。
- **诚实回落**:`defectEscapeRate` 总数 0→**null**(原返回 0,改 null 并更新 compute.test——规约化的测试变更,记录在本 change)。无缺陷≠门有效,可能只是没在看 → null"待埋点"比 0% 诚实。看板分别显示拦截/逃逸数 + 标注两侧时间口径。
- **真实验证(非破坏)**:临时 git repo 造 `Defect-Escaped:` 提交 + escalated run state.json → 真 `collect`:有缺陷 total=4(1fix+2residual+1escaped)/rate=0.25;无缺陷 total=0/rate=null。穿真 git log trailer 挖采 + 真 fs run 读取 + collect 接线,临时 repo 已清。metrics gate 全绿(46 测试,+8)。
- **坑/隐性知识**:`noUncheckedIndexedAccess` 下正则 `m[1]` 是 `string|undefined` → `(m[1] ?? '').trim()`;`git log` 体解析用 `%x1f`(hash/body 分隔)+`%x1e`(commit 分隔)避免换行歧义。
- ⚠️ **固有限制(已知,留后续)**:caught(ephemeral)/escaped(持久)口径不对称——fresh checkout 极端下率失真(caught=0+历史 escaped>0→100%),total=0 回落 null 缓解;根治=driver 跑完自动 emit `Defect-Caught:` trailer 把 caught 也持久化(下一切片候选)。历史 3 条手维护 caught 无机器源,不重建(留旧文件 git 历史)。

## 续切片④ 已完成:持久化 caught（change `pipeline-persist-caught`）

根治切片③ 的 caught(ephemeral)/escaped(持久)口径不对称——双包联动把 caught 也变成 git trailer。

- **核心=换源,不是补数据源**:让 caught 与 escaped **同从 `git log` 挖采**(同口径、同持久),率才彻底可比。driver 在 done run squash 提交 emit `Defect-Caught:` trailer(机器写),metrics caught 来源从 runtime runs 换成 git trailer。
- **对称催生抽象**:既然两侧都是 trailer,metrics 收敛出一个通用 `mineTrailers(repoRoot, key)`,`readCaughtTrailers`/`readEscapeTrailers` 皆其薄封装;`deriveDefects(caught, escapes)` 两侧每行一记录统一处理。这是"caught 也用一行一回修轮(D1)"换来的——若 caught 用整数计数,就得为它写非对称的求和分支。
- **emit 点**:`inner-loop-runner.ts:237` 的 squash 调用,`result.fixRounds` 在作用域内、只 done 分支走 squash → 天然 emit 点。纯 `squashMessage(jobId, fixRounds)` 抽出可穷尽单测(fixRounds=0 无 trailer、N→N 行)。
- **真实验证(非破坏)**:临时 git repo `Defect-Caught:`×2 + `Defect-Escaped:`×1 → collect total=3/rate=0.333。**契约靠传递验证**:driver `squash-message.test` 钉死 trailer 精确格式,metrics 挖采该格式——两端各测、契约对齐。driver gate 214 / metrics gate 45 全绿。
- **回退即进步**:删掉切片③ 加的 `residualCount`(runtime caught 的遗留)——切片③ 的 runtime caught 本就是"持久化前的 ephemeral 停靠点",④ 落地后正式退役。一次切片的产物被下一切片取代是预期的(抽取≠冻结)。
- ⚠️ **残留限制(已知)**:escalated run 无提交可挂→其 caught 不持久(升级人类处理);本切片前的历史已合并 done run 无 trailer→caught 不可重建,此后每 done 自动持久(同切片② 早期 tests 退化的同类诚实限制)。

## 续切片⑤ 已完成:持久化 VTax（change `pipeline-persist-vtax`）

把 Verification Tax 从 ephemeral `.runtime/events.jsonl` 换源到 git `Metrics-Phase-Ms:` trailer——fresh checkout 可复现。延续切片④ 的 trailer 模式与 mineTrailers 基建。

- **口径单一真相源(choice A)是设计核心**:driver 只报**原始 op 分类耗时**(dev/test/review/gate/orchestrator-fix 各多少 ms),metrics 保留 D1 口径(哪类算验证)。理由:trailer 存未定性的原始事实 → 改口径时历史 trailer 自动按新口径重算;跨包契约纯数据无语义;metrics 直接复用既有 categorizeDuration/taxByTrace,零口径重写。choice B(driver 预算 impl/verif)会把口径焊进历史 trailer 且复制到两包,弃。
- **复用的优雅**:metrics 把 trailer 还原成最小 TaxEvent[](`parsePhaseMsTrailer`)再喂给已写好测好的 `categorizeDuration`/`taxByTrace`——一行口径代码不用新写。per-US 把 commit 当 traceId 喂 taxByTrace,天然分组。
- **events.jsonl 不死,降级为 live 态源**:它仍供 replay 调试;持久的指标快照改从 squash trailer 来。这是切片④ 同款"换源"——live signal 在 .runtime,persistent snapshot 在 git。
- **注入式默认 dep**:`runIsolated` 加 `readPhaseMs?`,默认实现读中心 events.jsonl 聚合;既有 30+ 注入测试不传=空、零行为变化。新能力对旧调用方透明,延续"从窄到宽"在接口层的体现。
- **真实验证(非破坏)**:临时 git repo `Metrics-Phase-Ms: dev=95000 test=595000` → VTax=0.862(与切片① 实测 86.2% 一致)、per-US 按 commit、**可复现重算一致**;无 trailer→null。driver gate 220 / metrics gate 48 全绿。契约靠传递验证:driver `squash-message.test` 钉死 trailer 格式,metrics 挖采该格式。
- ⚠️ **残留限制**:只 done-run VTax 持久(escalated 无提交可挂);历史已合并 done run 无 trailer→不可重建,此后每 done 自动持久(同切片②/④ 同类诚实限制)。

**M4+ 可观测闭环主体收尾**:四指标(Task Resolution/Code Churn/Verification Tax/Defect Escape)+ 追溯链全部真实派生、git 持久、fresh checkout 可复现、口径自洽。

## 续切片⑥ 已完成:持久化 inner-loop 统计（change `pipeline-persist-runledger`，M4+ 收尾）

把 inner-loop 统计(升级率/成本/回修分布)从 ephemeral `.runtime/runs` 换源到 committed ledger。

- **为什么这块必须破例**:前 5 块(caught/escaped/VTax)都走 trailer,因为它们的 run **有提交**。但升级率需 `blocked-escalated`/`failed` run,而它们**不产生提交**——git 里没有任何痕迹,trailer 持久不了"没提交的事"。唯一出路=机器 append 的持久 ledger。
- **诚实标注"持久 ≠ 可复现"**:ledger 与前 5 块有本质区别——它**持久但不可从 git 复现**(累积记录,非可推导)。trailer 是 git 历史本身(fresh checkout 能重算);ledger 是"过去发生过什么"的账本。这不是退步——而是如实承认**非提交型信号**只能有不同种类的持久化,混淆二者才是不诚实。
- **单点 append 覆盖最全**:落点选 `runInnerLoopJob` 写 state.json 处(每个终态 run 的单一汇合,done/failed/escalated 都经此),而非 drainBatchIsolated(单 job dispatch 路径漏 run)。
- **slim 投影 + 去重幂等**:ledger 行只 `{jobId,status,fixRounds,costUsd,ts}`(丢 sessions/residual 噪声/churn);metrics 读时按 jobId 去重(后写覆盖)→ 同 jobId 重试取最新、report 多次不重复计数。
- **真实验证(非破坏)**:临时 repo ledger 含 done×2+escalated×1+failed(同 jobId 重试)→ collect total=3/escalationRate=0.333(**escalated 成功持久——trailer 做不到的头条**)/去重生效;空 ledger→innerLoop 省略。driver gate 222 / metrics gate 52 全绿。
- ledger 从空 `docs/metrics/runs-ledger.jsonl` 起步,不回填旧 e2e(非真交付);guide 补"机器 append、只读勿手编"说明。

## 🎯 M4+ 可观测闭环主体收尾

四指标 + 追溯链 + inner-loop 统计**全部真实派生、持久、口径自洽、缺数据诚实回落**:

| 维度 | 持久机制 | 可复现性 |
|---|---|---|
| Task Resolution / Code Churn | OpenSpec archive 计数 / git numstat | git 可复现 |
| 追溯链(②) | archive + git 织链 | git 可复现 |
| Verification Tax(①→⑤) | `Metrics-Phase-Ms:` trailer | git 可复现 |
| Defect Escape(③④) | `Defect-Caught:`/`Defect-Escaped:` trailer | git 可复现 |
| inner-loop 统计(⑥) | `runs-ledger.jsonl` 机器账本 | **持久但不可复现**(非提交型 run 固有) |

**贯穿洞察**:持久化优先走"进 git 历史"(可复现);唯有非提交型信号(escalated/failed run)才退而用 ledger,并如实标注其不可复现性。事实归 driver(原始 trailer/ledger 行),度量定义归 metrics(口径/聚合)。

## 下一候选（M4+ 零头 / M5+）

7. metrics 包级 stryker 变异门(E4 未配,现靠穷尽精确断言兜底);外部通知渠道;report 历史归档;comprehension debt 待合阈值告警;M6+。
