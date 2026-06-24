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

## 下一切片候选（M4+ 续）

3. **Defect Escape 自动喂**;持久化指标存储(events.jsonl/traces 产物均 ephemeral 重生成的固有限制);metrics 包级 stryker 变异门。
