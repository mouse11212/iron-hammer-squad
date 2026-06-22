## ADDED Requirements

### Requirement: 瞬时 API 错误判别
系统 SHALL 提供纯判别:给定 phase 结果文本,识别其是否为**瞬时基础设施错误**(如 socket/连接断开、超时、overloaded、rate limit、5xx、closed unexpectedly)。判别 MUST 不把普通失败(测试断言失败、实现错误等无瞬时信号的文本)误判为瞬时。

#### Scenario: 识别瞬时错误
- **WHEN** 结果文本为 "API Error: The socket connection was closed unexpectedly"
- **THEN** 判为瞬时(可重试)

#### Scenario: 不误判普通失败
- **WHEN** 结果文本为普通失败描述(无瞬时信号)
- **THEN** 判为非瞬时(不重试)

### Requirement: phase 瞬时错误有限重试
新会话 phase 遇瞬时 API 错误时,系统 SHALL 有限重试(上限可配,默认 2)并在重试间退避;**每次重试使用全新 session-id**(避免同 id 残留冲突)。非瞬时错误 SHALL NOT 重试。重试耗尽仍错误则按失败处置。

#### Scenario: 瞬时错误后重试成功
- **WHEN** 某 phase 首次返回瞬时错误、重试返回成功
- **THEN** 该 phase 视为成功,且重试用了不同的 session-id

#### Scenario: 非瞬时错误不重试
- **WHEN** 某 phase 返回非瞬时错误
- **THEN** 不重试,直接按失败处置

#### Scenario: 重试耗尽仍瞬时错误
- **WHEN** 瞬时错误持续超过重试上限
- **THEN** 按失败处置(exitCode 非 0),不无限重试
