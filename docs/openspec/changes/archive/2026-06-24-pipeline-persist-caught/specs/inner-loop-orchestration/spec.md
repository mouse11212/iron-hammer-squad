## ADDED Requirements

### Requirement: squash 提交持久化 caught 缺陷
系统 SHALL 在 done run squash 出 feature 分支时,据该 run 的 `fixRounds` 在 squash 提交消息追加 `Defect-Caught:` trailer——每个回修轮一行(`Defect-Caught: inner-loop 回修轮 <k>`),`fixRounds=0` 不追加任何 trailer。trailer 由系统(机器)写入,使 caught 缺陷随提交持久进 git 历史,供 metrics 与 escaped 同口径挖采。

#### Scenario: 有回修轮 → 追加 trailer
- **WHEN** 一个 done run 的 `fixRounds=2` 触发 squash
- **THEN** squash 提交消息含基础标题 + 2 行 `Defect-Caught: inner-loop 回修轮 1` / `... 回修轮 2`

#### Scenario: 干净 run → 不追加 trailer
- **WHEN** 一个 done run 的 `fixRounds=0` 触发 squash
- **THEN** squash 提交消息只含基础标题,无 `Defect-Caught:` 行(不臆造缺陷)

#### Scenario: escalated run 不持久 caught
- **WHEN** 一个 run 状态为 `blocked-escalated`(不 squash、无提交)
- **THEN** 不产生 `Defect-Caught:` trailer(无提交可挂;其 caught 不持久,为已知边界)
