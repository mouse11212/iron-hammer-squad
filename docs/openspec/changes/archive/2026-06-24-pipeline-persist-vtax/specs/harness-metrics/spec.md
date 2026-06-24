## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: 解析 Metrics-Phase-Ms trailer
系统 SHALL 提供纯函数,把 `Metrics-Phase-Ms:` trailer 值(`<cat>=<ms>` 空格分隔)解析为分类耗时映射,并还原为最小事件序列供 D1 口径复用;畸形片段(无 `=`、非数字 ms)跳过(不臆造)。

#### Scenario: 解析为分类耗时
- **WHEN** 传入 trailer 值 `dev=95000 test=113000 gate=12000`
- **THEN** 还原出等价最小事件:dev/test phase 与 gate,各带对应 durationMs

#### Scenario: 跳过畸形片段
- **WHEN** 传入 `dev=95000 garbage test=abc`
- **THEN** 只产出 dev=95000 对应事件(garbage 无 `=`、test=abc 非数字 → 跳过)
