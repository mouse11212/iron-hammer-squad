## ADDED Requirements

### Requirement: 敏感改动集成时 held 升级人签
系统 SHALL 在批量集成时支持**可选注入**敏感改动检查:合某 feature 前对其改动路径分类,命中敏感面(鉴权/CI/基础设施)则将该 feature 标为 held(`reason='sensitive'`,带命中 `categories`)**不自动合**,路由人签(红线7 人类门禁不可绕过、军规7、D1);该 feature 工作保留为分支,人类签字后手动合。**不注入检查则批量集成行为与既有完全一致**(向后兼容)。与冲突/gate held 互不影响、可并存。

#### Scenario: 未注入检查 → 行为照旧
- **WHEN** 批量集成未注入敏感检查
- **THEN** 仅按 clean+green/冲突/gate 红判定,held reason 仅 conflict|gate(既有行为零变化)

#### Scenario: 注入且 feature 触及敏感面 → held(sensitive) 不自动合
- **WHEN** 注入检查,某 feature 改动含 `.github/workflows/x.yml`
- **THEN** 该 feature held(reason='sensitive',含 ci 类别),不并入 integration、不触 merge,路由人签

#### Scenario: 注入但 feature 仅普通源码 → 照常合入
- **WHEN** 注入检查,feature 仅改 `src/*.ts`(clean+green)
- **THEN** 正常合入 merged(敏感不命中,交付不受影响)

#### Scenario: 敏感 held 与 conflict/gate held 并存
- **WHEN** 一批中 a 触及敏感面、b 冲突、c 干净普通
- **THEN** a held(sensitive)、b held(conflict)、c merged;main 不动
