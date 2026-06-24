# harness-metrics Specification

## Purpose
TBD - created by archiving change pipeline-m4-metrics-trace. Update Purpose after archive.
## Requirements
### Requirement: 计算 harness 四指标(纯函数)
系统 SHALL 提供纯函数，从结构化输入计算 harness 四指标:Task Resolution Rate、Code Churn、Verification Tax、Defect Escape Rate。无副作用，便于确定性测试。

#### Scenario: Task Resolution Rate
- **WHEN** 已解决 N 个、尝试 M 个单元
- **THEN** 返回 N/M（M=0 时返回 0，不除零报错）

#### Scenario: Code Churn 汇总
- **WHEN** 传入 numstat 列表（每项 added/removed）
- **THEN** 返回 added、removed、total(=added+removed)、files 计数

#### Scenario: Verification Tax 实现耗时缺失
- **WHEN** 实现耗时为 null(未埋点)
- **THEN** 返回 null(标注待埋点)，不臆造比率

#### Scenario: Defect Escape Rate 无缺陷
- **WHEN** 总缺陷为 0
- **THEN** 返回 0，不除零报错

### Requirement: 渲染看板(纯函数)
系统 SHALL 提供纯函数，把指标快照 + 追溯链渲染为 markdown 看板字符串。无 IO。

#### Scenario: 渲染含指标与追溯链
- **WHEN** 传入快照(四指标 + TraceLink 列表)
- **THEN** 输出含四指标表与追溯链表的合法 markdown；缺口指标显示"待埋点/待标定"而非伪造数值

### Requirement: 从事件流派生 Verification Tax 输入
系统 SHALL 提供纯函数,从已分类的阶段耗时按固定口径(D1)累加得出实现耗时与验证耗时:**实现** = dev;**验证** = test + review + gate + orchestrator-fix。口径函数(categorizeDuration/taxByTrace)单一活在 metrics,接受最小事件形状(op/phase/durationMs),不关心耗时来源(live events.jsonl 或持久 trailer)。

#### Scenario: 按口径归类累加
- **WHEN** 传入含 dev/test/review phase 与 gate(各带 durationMs)的最小事件
- **THEN** 返回 `{ implementationMs, verificationMs }`,implementationMs=dev 之和,verificationMs=test/review/gate/orchestrator-fix 之和

#### Scenario: 空输入
- **WHEN** 传入空
- **THEN** implementationMs=0、verificationMs=0(不臆造)

### Requirement: 采集时接入真实 Verification Tax
系统 SHALL 在采集快照时从 git `Metrics-Phase-Ms:` trailer 挖采各 done-run 的原始 op 分类耗时(持久、可复现),还原为最小事件后经 D1 口径算出 `MetricsSnapshot` 的 `verificationMs`/`implementationMs`/`verificationTax`/per-US 明细(per-US 以 commit 短 hash 为键);**不再读 ephemeral 的 `.runtime/events.jsonl`**。无任何 `Metrics-Phase-Ms:` trailer(无实现耗时)时 `verificationTax` 回落 null(沿用"待埋点",不臆造)。

#### Scenario: 有 trailer → 出真值且可复现
- **WHEN** 仓库有一个含 `Metrics-Phase-Ms: dev=95000 test=595000` 的 done-run squash 提交
- **THEN** 快照 verificationTax 为真实比率(=验证/(验证+实现)),且 fresh checkout 重算一致(源于 git 持久)

#### Scenario: 无 trailer → 回落 null
- **WHEN** 仓库无任何 `Metrics-Phase-Ms:` trailer
- **THEN** 快照 verificationTax 为 null,看板显示"待埋点"而非伪造数值

#### Scenario: per-US 以 commit 为键
- **WHEN** 有多个 done-run squash 提交各带 `Metrics-Phase-Ms:`
- **THEN** per-US Verification Tax 明细按 commit 短 hash 分组,各自独立算比率

### Requirement: 从 OpenSpec archive + git 自动织追溯链
系统 SHALL 提供纯函数,从已读好的归档 change 结构化输入组装 `TraceLink[]`(`changeId→spec→tests→commit`),每个字段可溯源到真实归档 commit:`changeId` = archive 目录名去日期前缀;`spec` = 该 change `specs/` 下 capability 目录名(多个按字典序斜杠拼接);`commit` = 归档该 change 的 git commit 短 hash;`tests` = 该 commit diff 中改动的 `*.test.ts`/`*.spec.ts` 文件名(basename,按字典序去重)。不读手维护的 traces.json。

#### Scenario: 单 capability change 织链
- **WHEN** 传入一个归档 change(目录 `2026-06-17-fincards-m0-bloomberg-cards`,specs 下含 `news-fetch`,归档 commit `adbac4a` 改动了 `parse.test.ts`)
- **THEN** 返回 `{ changeId: "fincards-m0-bloomberg-cards", spec: "news-fetch", tests: ["parse.test.ts"], commit: "adbac4a" }`

#### Scenario: 多 capability 按字典序拼接 spec
- **WHEN** 一个 change 的 `specs/` 下含多个 capability 目录(如 `news-fetch`、`news-parse`)
- **THEN** `spec` 字段为各 capability 目录名按字典序斜杠拼接(如 `news-fetch/news-parse`)

#### Scenario: 归档 commit 内无测试文件 → tests 诚实退化
- **WHEN** 某 change 的归档 commit diff 中无 `*.test.ts`/`*.spec.ts` 文件
- **THEN** 该 TraceLink 的 `tests` 为 `[]`(不臆造测试文件名)

#### Scenario: 归档 commit 无法确定 → 跳过该 change
- **WHEN** 某归档目录找不到对应的归档 commit
- **THEN** 该 change 不出现在结果中(不臆造 commit hash),其余 change 正常织链

#### Scenario: 只织已归档 change
- **WHEN** 仓库同时存在归档 change 与未归档(活跃)change
- **THEN** 结果只含已归档 change;未归档 change(无确定归档 commit)不织

### Requirement: 采集时以自动派生追溯链替代手维护文件
系统 SHALL 在采集快照时通过扫描 `docs/openspec/changes/archive/` 目录结构与 `git log`/`git show` 自动派生 `TraceLink[]` 填充 `MetricsSnapshot.traces`,替代读取手维护的 `data/traces.json`;并 SHALL 提供 CLI 把派生结果写出到 `data/traces.json` 作为可检视产物(每次重生成,供人眼审计,非采集依赖)。

#### Scenario: 快照 traces 来自实时派生
- **WHEN** 采集快照
- **THEN** `MetricsSnapshot.traces` 为从 archive + git 实时派生的 `TraceLink[]`,不读 `data/traces.json`

#### Scenario: 写出可检视产物
- **WHEN** 运行织链 CLI
- **THEN** 把当前派生的 `TraceLink[]` 写出到 `data/traces.json`(覆盖重生成),内容与采集所用派生值一致

### Requirement: 从 inner-loop 运行与 git trailer 自动喂缺陷记录
系统 SHALL 提供纯函数,从 git trailer 组装 `DefectRecord[]`,取代手维护 defects.json:**caught** = 每条 `Defect-Caught:` trailer 一条(`where:'caught'`);**escaped** = 每条 `Defect-Escaped:` trailer 一条(`where:'escaped'`,note=trailer 值)。caught 与 escaped 同源于 git(持久、同口径),两侧每行一记录对称处理。每条记录 id 稳定可溯源(含 commit)。

#### Scenario: caught trailer 派生
- **WHEN** 传入一条 `{commit:'abc1234', desc:'inner-loop 回修轮 1'}` 的 caught trailer
- **THEN** 产出 1 条 `{where:'caught', note:'inner-loop 回修轮 1'}`,id 含 commit

#### Scenario: escaped trailer 派生
- **WHEN** 传入一条 `{commit:'def5678', desc:'卡片渲染漏 today 过滤'}` 的 escape trailer
- **THEN** 产出 1 条 `{where:'escaped', note:'卡片渲染漏 today 过滤'}`,id 含 commit

#### Scenario: 两侧皆空
- **WHEN** 无 caught 且无 escaped trailer
- **THEN** 产出空数组(不臆造)

### Requirement: Defect Escape Rate 总数为零时回落 null
系统 SHALL 在缺陷总数(caught+escaped)为 0 时令 `defectEscapeRate` 返回 `null`(沿用"待埋点"语义,不伪造 0%);总数>0 时返回 `escaped/总数`。看板 SHALL 分别显示 caught 数与 escaped 数并标注各自时间口径(caught=当前 runtime/ephemeral,escaped=git 全历史/持久);率为 null 时显示"待埋点"。

#### Scenario: 有缺陷 → 出真实率
- **WHEN** caught=3、escaped=1
- **THEN** `defectEscapeRate` = 1/4 = 0.25

#### Scenario: 无缺陷 → null
- **WHEN** caught=0、escaped=0
- **THEN** `defectEscapeRate` = null,看板该指标显示"待埋点"而非 0%

### Requirement: 采集时以自动派生缺陷替代手维护文件
系统 SHALL 在采集快照时从 `git log` 挖采 `Defect-Caught:` 与 `Defect-Escaped:` trailer 自动派生 `DefectRecord[]` 填充 `MetricsSnapshot`,替代读取手维护 `data/defects.json` 与切片③ 的 inner-loop runtime run 派生(已被持久 trailer 取代)。

#### Scenario: 快照 defects 来自 git trailer
- **WHEN** 采集快照
- **THEN** `MetricsSnapshot.defects` 的 caught/escaped 计数均来自 git trailer 挖采(同口径持久),不读 `data/defects.json`、不依赖 `.runtime/runs`

### Requirement: 通用 git trailer 挖采
系统 SHALL 提供薄 IO 通用函数,从 `git log` 挖采指定 key 的 trailer(逐行匹配 `<key>: <value>`),返回 `{commit, desc}[]`;git 失败返回空数组(不抛、不臆造)。caught 与 escaped 挖采复用此函数。

#### Scenario: 挖采指定 key
- **WHEN** 仓库有一个含 `Defect-Caught: 回修轮 1` 的提交,挖采 key `Defect-Caught`
- **THEN** 返回含该 `{commit, desc:'回修轮 1'}` 的数组

#### Scenario: git 失败 → 空
- **WHEN** git 命令失败(非仓库等)
- **THEN** 返回 `[]`(不抛)

### Requirement: 解析 Metrics-Phase-Ms trailer
系统 SHALL 提供纯函数,把 `Metrics-Phase-Ms:` trailer 值(`<cat>=<ms>` 空格分隔)解析为分类耗时映射,并还原为最小事件序列供 D1 口径复用;畸形片段(无 `=`、非数字 ms)跳过(不臆造)。

#### Scenario: 解析为分类耗时
- **WHEN** 传入 trailer 值 `dev=95000 test=113000 gate=12000`
- **THEN** 还原出等价最小事件:dev/test phase 与 gate,各带对应 durationMs

#### Scenario: 跳过畸形片段
- **WHEN** 传入 `dev=95000 garbage test=abc`
- **THEN** 只产出 dev=95000 对应事件(garbage 无 `=`、test=abc 非数字 → 跳过)

### Requirement: inner-loop 运行统计来自持久 ledger
系统 SHALL 在采集快照时从持久 `docs/metrics/runs-ledger.jsonl`(机器 append 的 run 记录)读取 inner-loop 运行,**按 jobId 去重(后写记录覆盖,幂等)** 后经 `innerLoopStats` 聚合(总数/状态分布/升级率/回修轮次分布/成本)填充 `MetricsSnapshot.innerLoop`;替代从 ephemeral `.runtime/runs/*/state.json` 读取。无 ledger 或空 → `innerLoop` 省略(看板不渲染该区,不臆造)。

#### Scenario: 从 ledger 聚合
- **WHEN** ledger 含 3 条 run 记录(2 done、1 blocked-escalated)
- **THEN** 快照 innerLoop.total=3、byStatus 正确、escalationRate=1/3

#### Scenario: 按 jobId 去重(幂等)
- **WHEN** ledger 含同 jobId 两条(先 failed 后 done,重试覆盖)
- **THEN** 该 jobId 只计最新一条(done),不重复计数

#### Scenario: 空 ledger → 省略 inner-loop 区
- **WHEN** ledger 不存在或为空
- **THEN** 快照 innerLoop 为 undefined,看板省略 inner-loop 区(不臆造)

### Requirement: 读取 run ledger（薄 IO + 去重）
系统 SHALL 提供薄 IO 函数,逐行 parse `runs-ledger.jsonl`(跳畸形行),按 jobId 去重保留最后一条,返回 `InnerLoopRunRecord[]`;缺文件返回 `[]`(不抛、不臆造)。

#### Scenario: 跳畸形行
- **WHEN** ledger 含一行畸形 JSON 与两行合法记录
- **THEN** 返回 2 条合法记录(畸形行跳过)

