## ADDED Requirements

### Requirement: 集成 gate 按 feature 所属项目动态推导
批后集成的 per-feature gate SHALL 在**该 feature 所属 job 的项目目录**内运行(green + 依赖软链),而非整批共用一个固定目录。系统 SHALL 据各 job 的 spec.projectDir 推导 `branch → 项目目录` 映射,gate 时按当前 feature 的分支路由到对应目录。

#### Scenario: 单项目批(回归)
- **WHEN** 一批 feature 同属一个项目
- **THEN** 每个 feature 的集成 gate 在该项目目录跑,行为与此前一致

#### Scenario: 多项目混批
- **WHEN** 一批含分属不同项目的 feature(如 A→项目甲、B→项目乙)
- **THEN** A 的集成 gate 在项目甲目录跑、B 的在项目乙目录跑,各自在自己项目内被验证,不互相错用目录

### Requirement: gatePerFeature 携带分支标识
batchIntegrate 调用 gate 时 SHALL 传入当前 feature 的分支标识,使调用方能据此路由(项目目录等)。

#### Scenario: gate 收到分支
- **WHEN** batchIntegrate 对某 feature 分支跑集成 gate
- **THEN** gate 收到该分支标识
