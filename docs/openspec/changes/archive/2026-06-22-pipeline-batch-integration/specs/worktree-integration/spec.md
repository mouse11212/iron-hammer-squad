## ADDED Requirements

### Requirement: 批量多分支集成
系统 SHALL 支持把 N 个 feature 分支汇入集成分支:在独立 integration worktree(从 base 重置)内,依次对每个 feature 执行 squash-merge;clean-merge 且集成 gate 全绿的保留,其余回滚。全程不切换主检出 HEAD、不写 main。

#### Scenario: 多个无冲突 feature 全部合入
- **WHEN** 三个互不冲突的 feature 分支批量集成且各自集成 gate 全绿
- **THEN** integration 分支含三者(各一 squash commit),ready 为真,held 为空

### Requirement: 冲突不自动解决、回滚升级
merge 冲突的 feature,系统 SHALL 回滚该次合并(`reset --hard` 到合并前)并标记为 held(reason=conflict),**不自动解决冲突**(军规 1:代码归人),**不阻塞其它 feature** 继续集成。

#### Scenario: 某 feature 与已集成内容冲突
- **WHEN** 批量集成中某 feature 与先前已合入的 feature 冲突
- **THEN** 该 feature 被回滚并列入 held(reason=conflict),其余无冲突 feature 仍照常合入;integration 不残留冲突标记

### Requirement: 逐 feature 集成 gate
系统 SHALL 在每个 feature 合入后跑集成 gate;gate 不通过的 feature SHALL 回滚并标记 held(reason=gate),不污染 integration。

#### Scenario: 某 feature 合入后 gate 红
- **WHEN** 某 feature clean-merge 但集成 gate 未通过
- **THEN** 该 feature 被回滚并列入 held(reason=gate),integration 保持该 feature 合入前的状态

### Requirement: 部分推进与就绪信号
系统 SHALL 返回 `merged`(已合入分支)与 `held`(挂起分支及原因)。仅当 held 为空且 merged 非空时 ready 为真(可供人类合 main);held 非空时 SHALL 产出挂起清单供人类处理。系统 SHALL NOT 自动合并 integration 到 main。

#### Scenario: 部分合入
- **WHEN** 批量集成后部分 feature 合入、部分 held
- **THEN** ready 为假,merged 与 held 清单如实返回,main 无任何写操作
