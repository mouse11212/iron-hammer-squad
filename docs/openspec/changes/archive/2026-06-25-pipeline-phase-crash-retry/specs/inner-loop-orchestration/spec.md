## MODIFIED Requirements

### Requirement: phase 瞬时错误有限重试
新会话 phase 遇瞬时 API 错误时,系统 SHALL 有限重试(上限可配,默认 2)并在重试间退避;**每次重试使用全新 session-id**(避免同 id 残留冲突)。瞬时错误的判别 MUST 同时覆盖两种形态:① phase 返回的 result 文本含瞬时基础设施信号(socket/连接断开、超时、overloaded、rate limit、5xx、closed unexpectedly 等);② phase 进程在发出 `type:result` 收尾事件**之前**异常退出(无 result 记录、result 文本为空、exitCode 非 0)——此情形视为基础设施崩溃,同样可重试。非瞬时错误(phase 发出了 `type:result` 但 is_error 且文本无瞬时信号,即模型/代码真失败)SHALL NOT 重试。重试耗尽仍错误则按失败处置。

#### Scenario: 瞬时错误后重试成功
- **WHEN** 某 phase 首次返回瞬时错误、重试返回成功
- **THEN** 该 phase 视为成功,且重试用了不同的 session-id

#### Scenario: 进程崩溃无 result 收尾 → 重试
- **WHEN** 某 phase 进程在发出 `type:result` 之前异常退出(无 result 记录、result 文本为空、exitCode 非 0)
- **THEN** 视为瞬时基础设施崩溃并重试;重试返回成功则该 phase 成功

#### Scenario: 非瞬时错误不重试
- **WHEN** 某 phase 发出了 `type:result` 但 is_error 且文本无瞬时信号(模型/代码真失败)
- **THEN** 不重试,直接按失败处置

#### Scenario: 重试耗尽仍瞬时错误
- **WHEN** 瞬时错误(含进程崩溃无 result)持续超过重试上限
- **THEN** 按失败处置(exitCode 非 0),不无限重试

## ADDED Requirements

### Requirement: phase 结果解析标记是否缺失 result 收尾事件
phase 结果解析 SHALL 报告该 phase 的 stream 是否**缺失** `type:result` 收尾事件(`noResult` 标志):无任何 result 事件时 `noResult=true`(进程崩溃前未收尾),否则 `false`。该标志供重试层区分"基础设施崩溃"(可重试)与"模型/代码真失败"(不可重试)。标志为可选字段,既有不读该标志的调用方行为不变。

#### Scenario: 无 result 事件
- **WHEN** stream 中无任何 `type:result` 事件
- **THEN** `noResult=true`,且 `isError=true`

#### Scenario: 有 result 事件
- **WHEN** stream 含一个 `type:result` 事件
- **THEN** `noResult=false`
