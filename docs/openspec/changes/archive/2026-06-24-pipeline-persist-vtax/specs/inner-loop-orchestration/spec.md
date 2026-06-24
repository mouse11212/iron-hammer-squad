## MODIFIED Requirements

### Requirement: squash 提交持久化 caught 缺陷
系统 SHALL 在 done run squash 出 feature 分支时,在 squash 提交消息追加机器写的 trailer,使该 run 的可观测指标随提交持久进 git:(a) 据 `fixRounds` 追加 `Defect-Caught: inner-loop 回修轮 <k>`(每回修轮一行,fixRounds=0 不追加);(b) 据本 run 各阶段耗时追加一行 `Metrics-Phase-Ms: <cat>=<ms> ...`(原始 op 分类耗时:dev/test/review/gate/orchestrator-fix,仅非零项;**不应用 impl/verif 口径**,口径归 metrics)。trailer 由系统写入,供 metrics 与 escaped 同口径挖采、并据以复现 Verification Tax。

#### Scenario: 有回修轮 → 追加 Defect-Caught
- **WHEN** 一个 done run 的 `fixRounds=2` 触发 squash
- **THEN** squash 提交消息含 2 行 `Defect-Caught: inner-loop 回修轮 1`/`... 回修轮 2`

#### Scenario: 据阶段耗时追加 Metrics-Phase-Ms
- **WHEN** 一个 done run 各阶段耗时为 dev=95000、test=113000、gate=12000(review/orchestrator-fix=0)
- **THEN** squash 提交消息含一行 `Metrics-Phase-Ms: dev=95000 test=113000 gate=12000`(仅非零项,原始 op 分类、不预算 impl/verif)

#### Scenario: 干净 run → 无 Defect-Caught 但仍有 Metrics-Phase-Ms
- **WHEN** 一个 done run `fixRounds=0` 但有 dev/test 阶段耗时
- **THEN** 无 `Defect-Caught:` 行,但有 `Metrics-Phase-Ms:` 行(VTax 不依赖缺陷,每 done run 都持久阶段耗时)

#### Scenario: escalated run 不持久
- **WHEN** 一个 run 状态为 `blocked-escalated`(不 squash、无提交)
- **THEN** 不产生任何 trailer(其 caught 与 VTax 不持久,为已知边界)
