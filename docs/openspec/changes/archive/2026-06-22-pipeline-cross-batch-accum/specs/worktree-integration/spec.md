## ADDED Requirements

### Requirement: 集成分支跨批次累积
batchIntegrate SHALL 把 integration 分支当作跨批次累积的暂存区:当 integration 分支**不存在**时从 base 创建;当其**已存在**时复用(checkout 已累积分支,**不重置到 base**),在其之上合入本批 feature。使多轮/多批的已验证 feature 持续累积,不被后批覆盖。

#### Scenario: 首批从 base 创建
- **WHEN** integration 分支尚不存在,batchIntegrate 处理第一批 feature
- **THEN** 从 base 创建 integration 并合入本批 clean+green 的 feature

#### Scenario: 后批在已有 integration 上累积
- **WHEN** integration 分支已存在(含前批合入的 feature),batchIntegrate 处理新一批
- **THEN** 复用现有 integration(不重置到 base),把新批 feature 合到其上;前批已合入的 feature 仍在

### Requirement: 累积态下的冲突处置
新批 feature 与**已累积**内容冲突时,SHALL 沿用 per-feature 回滚(reset 到合前 HEAD)+ held 升级,不影响已累积内容与其它 feature。

#### Scenario: 新批 feature 冲突于已累积内容
- **WHEN** 新批某 feature 与 integration 已累积的内容冲突
- **THEN** 该 feature 回滚 held(conflict),integration 保留既有累积内容,其它新 feature 照常合入
