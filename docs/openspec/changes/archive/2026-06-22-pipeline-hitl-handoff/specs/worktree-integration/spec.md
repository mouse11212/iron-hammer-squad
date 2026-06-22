## ADDED Requirements

### Requirement: 集成交接报告(HITL)
批后集成完成后,系统 SHALL 产出一份 durable、人类可执行的集成交接报告,内容包含:已集成待合 main 的 feature 清单与建议的 squash 合并命令(人类执行)、挂起(held)的 feature 及其原因与处理指引、整体状态(全 ready / 部分挂起)。报告 SHALL 明确合并 main 是人类决策(军规 1/2),不自动合并。

#### Scenario: 全部已集成
- **WHEN** 批后集成 ready(held 空、merged 非空)
- **THEN** 报告列出 merged feature + 建议的人类 squash 合并命令,标注状态为可合 main

#### Scenario: 部分挂起
- **WHEN** 集成结果含 held(冲突/gate)
- **THEN** 报告分别列出已集成与挂起项;每个挂起项注明原因(conflict/gate)与处理指引;状态为部分挂起

#### Scenario: 本批无成功 feature
- **WHEN** 无 committed 分支(integration 为空)
- **THEN** 报告说明本批无集成产出

### Requirement: 交接产出可观测
drainBatchIsolated SHALL 在批后集成完成后调用交接钩子(产出报告 + 摘要),使结果 durable 落地而非仅内存返回。

#### Scenario: 集成后触发交接
- **WHEN** drainBatchIsolated 完成一批集成
- **THEN** 交接钩子被调用并收到该批集成结果的报告
