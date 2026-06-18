## ADDED Requirements

### Requirement: 事务原子认领——多消费者零双领
队列 SHALL 用单条事务性 SQL 完成"选一条 queued 请求并置为 running 且绑定 worker"的认领操作,使得在多个消费者并发认领时,**每个请求至多被一个消费者认领**(零双领)。认领 MUST 是原子的:要么完整拿到一条并独占,要么拿到空(无可认领)。

#### Scenario: N 个消费者并发认领 M 条请求
- **WHEN** 队列中有 M 条 queued 请求,N 个消费者并发反复调用 claim 直到队列空
- **THEN** 每条请求恰好被认领一次,认领总次数等于 M,无任何请求被两个消费者同时认领

#### Scenario: 队列空时认领
- **WHEN** 队列中无 queued 请求,一个消费者调用 claim
- **THEN** 返回空(null),不阻塞、不抛错

### Requirement: 幂等去重——同 id 不重复执行
队列 SHALL 以请求 id 为唯一键。重复 enqueue 同一 id MUST 不产生第二条可认领记录;已处于终态(done/failed)的 id 再次入队 MUST 被忽略或保持终态,不被重新认领执行。

#### Scenario: 重复投递同一 id
- **WHEN** 同一 id 被 enqueue 两次
- **THEN** 队列中该 id 只有一条记录,只会被认领执行一次

#### Scenario: 已完成 id 再次入队
- **WHEN** 一个已 done 的 id 再次 enqueue
- **THEN** 该 id 不重新进入可认领状态,保持 done

### Requirement: ack 与 fail——认领后的结果落定
队列 SHALL 提供 ack(标记 done)与 fail(标记 failed)操作,只能对处于 running 且由本消费者持有的请求生效。fail MAY 携带错误信息。

#### Scenario: 认领后成功确认
- **WHEN** 消费者认领一条请求并执行成功后调用 ack
- **THEN** 该请求状态变为 done,记录结束时间,不再可被认领

#### Scenario: 认领后失败
- **WHEN** 消费者认领一条请求,执行失败后调用 fail 并附错误信息
- **THEN** 该请求状态变为 failed,记录错误信息,不再可被认领

### Requirement: WAL 崩溃恢复——回收残留 running
队列 SHALL 启用 WAL 模式并设置 `busy_timeout`。系统启动时 SHALL 能识别上次中断遗留的 running 请求(其持有 worker 已不存在),将其回收为 queued 可重新认领,不静默丢弃。

#### Scenario: 启动时存在残留 running
- **WHEN** 上次运行在某请求 running 中途崩溃,重新启动并执行恢复
- **THEN** 该 running 请求被回收为 queued,可被重新认领;数据库无损坏

### Requirement: stdio MCP 封装队列操作
系统 SHALL 把队列操作封装为 stdio MCP server,暴露 enqueue / claim / ack / fail / status 工具,使外部进程或 agent 可投递与认领任务,无需常驻独立服务。MCP 层 MUST 是薄封装,核心队列逻辑可脱离 MCP 被直接测试。

#### Scenario: 经 MCP 投递并查询
- **WHEN** 外部通过 MCP 的 enqueue 投递一个请求,再调用 status
- **THEN** status 返回该请求处于 queued,且核心队列函数与 MCP 工具返回一致的结果
