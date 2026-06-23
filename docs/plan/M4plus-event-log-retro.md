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

## 下一切片候选（M4+ 续）

2. **追溯链自动织链**:changeId→spec→tests→commit 从 OpenSpec/git/runs 自动采集,取代手维护 traces.json。
3. **Defect Escape 自动喂**;持久化指标存储;metrics 包级 stryker 变异门。
