## ADDED Requirements

### Requirement: orchestrator 域确定性代修
评审产出的 must-fix 可标 `orchestrator` 域并携带白名单结构化 `action`(首类 `register-mutation-target`:把本切片新交付的纯逻辑文件登记进产品 stryker.conf 的 mutate 列表,使其在交付后获得持续变异覆盖)。inner-loop 遇 orchestrator 域 must-fix 时 SHALL 调用注入的**确定性代修器**(非 agent——改门禁配置不在 test/dev 授权边界,红线4 角色不混同);代修成功则继续回修循环(SHALL 重跑 gate + review 确认 must-fix 已闭环);代修失败、`action` 不在白名单、或未注入该能力时 SHALL `blocked-escalated`(红线6 阻塞升级,**不静默吞**),residual 保留该 must-fix。代修 SHALL 白名单驱动、确定性、可审计(对冲自演进 harness 回归不可预见的风险)。

#### Scenario: orchestrator 代修成功后继续并收敛
- **WHEN** review 标 orchestrator 域 + `register-mutation-target` action,且代修器成功登记文件进 stryker.conf
- **THEN** 继续回修循环,下一轮 review 复审确认 must-fix 已闭环 → done;登记改动随动态 squash 一并交付

#### Scenario: 不识别的 action 或无能力即升级
- **WHEN** orchestrator 域 must-fix 的 action 不在白名单(或无 action,或未注入 orchestratorFix 能力)
- **THEN** blocked-escalated,residual 保留该 must-fix(不静默吞、不让 agent 越权代劳)

#### Scenario: orchestrator 域 must-fix 仅由评审提出
- **WHEN** must-fix 为 orchestrator 域
- **THEN** 其来源为 review verdict(GREEN gate / 变异门内部产生的 must-fix 只归 impl/test 域,不会冒充 orchestrator 域,防逃逸阀)
