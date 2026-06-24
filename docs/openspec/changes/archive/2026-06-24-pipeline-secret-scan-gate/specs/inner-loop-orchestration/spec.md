## ADDED Requirements

### Requirement: green 门可选接入密钥扫描（向后兼容）
系统 SHALL 允许在 green 门**可选注入**密钥扫描 step:注入时,green 在 lint/typecheck/test 之外追加密钥扫描,命中即 green 失败(纳入既有 must-fix 回修流,由 dev 移除/参数化密钥——不升级人类);**不注入时 green 行为与既有完全一致**(默认 no-op,既有调用方/测试零变化)。

#### Scenario: 未注入 → green 行为不变
- **WHEN** makeGates 未注入 secret-scan
- **THEN** green 仅跑 lint/typecheck/test,行为与本切片前完全一致(既有测试零改动通过)

#### Scenario: 注入且改动含密钥 → green 失败
- **WHEN** 注入 secret-scan 且本次改动含硬编码密钥
- **THEN** green 返回失败,inner-loop 据 must-fix 让 dev 回修移除密钥

#### Scenario: 注入且改动干净 → green 照常通过
- **WHEN** 注入 secret-scan 且本次改动无密钥
- **THEN** green 通过(lint/typecheck/test 全绿 + 扫描无命中),交付不受影响
