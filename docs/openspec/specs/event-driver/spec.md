# event-driver Specification

## Purpose
TBD - created by archiving change pipeline-m3-event-driver. Update Purpose after archive.
## Requirements
### Requirement: 请求状态机
系统 SHALL 为每个请求维护外置 run-state，状态在 `queued → running → done | failed` 间转移。状态转移逻辑 MUST 为纯函数(给定当前状态+事件→下一状态)，便于确定性测试。

#### Scenario: 正常成功流转
- **WHEN** 一个 queued 请求被调度并成功执行
- **THEN** 状态依次变为 running 再到 done，并记录开始/结束时间与退出码 0

#### Scenario: 执行失败
- **WHEN** 调度执行返回非零退出码或抛错
- **THEN** 状态变为 failed，记录错误信息，不抛出导致驱动整体中断

### Requirement: 幂等——已完成请求不重复执行
系统 SHALL 在调度前检查 run-state；若该请求已是 done，MUST 跳过，不再次调用 `claude -p`。

#### Scenario: 重复投递同一已完成请求
- **WHEN** 一个 id 已是 done 的请求再次进入调度
- **THEN** 系统跳过执行(不调用 claude)，状态保持 done

### Requirement: 崩溃恢复——回收残留 running
系统 SHALL 在驱动启动时扫描 run-state，将上次未完成的 running 请求回收(重新入队或标记)，使中断的工作可恢复，不丢失。

#### Scenario: 启动时存在残留 running
- **WHEN** 上次运行在 running 中途崩溃，启动驱动
- **THEN** 该 running 请求被识别并回收为可重新调度状态(不静默丢弃)

### Requirement: claude -p 调用经薄边界隔离
系统 SHALL 把 `claude --print` 无头调用封装为单一薄边界(invoke)，可注入替身。确定性测试 MUST 用替身，不实际联网/调模型。

#### Scenario: 测试用替身
- **WHEN** 在测试中注入一个返回固定结果的 invoke 替身
- **THEN** 调度与状态流转可被完全确定性地验证，无需真实 claude 调用

