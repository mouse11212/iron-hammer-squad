## ADDED Requirements

### Requirement: 统一事件 schema 与确定性构造
系统 SHALL 提供纯函数构造统一操作事件 Event，字段为 `{ ts, traceId, op, phase?, status?, durationMs?, payload? }`：`ts` 为 ISO8601 字符串且由注入时钟提供（不在构造器内读系统时钟），`traceId` 贯穿一个 US 全链，`op` 取 `'phase'|'gate'|'squash'|'integrate'|'orchestrator-fix'`。构造器无副作用、确定可测。

#### Scenario: 构造一条 phase 事件
- **WHEN** 以注入时钟 ts、traceId、op='phase'、phase='dev'、status='ok'、durationMs、payload 调用构造器
- **THEN** 返回包含全部传入字段的 Event 对象，且不调用系统时钟、不产生 IO

#### Scenario: 可选字段缺省
- **WHEN** 仅传必填字段（ts/traceId/op）构造一条 squash 事件
- **THEN** 返回的 Event 不含 phase/status/durationMs/payload 键（或为 undefined），不臆造默认值

### Requirement: append-only 事件落盘（薄 IO 边界）
系统 SHALL 提供薄 IO sink，把一条 Event 序列化为单行 JSON 追加写入中心事件文件 `pipeline/.runtime/events.jsonl`。sink 仅做序列化与追加，不含计算逻辑；目标目录不存在时先创建。

#### Scenario: 追加一条事件
- **WHEN** 对一个空（或已有内容的）事件文件调用 sink 写入一条 Event
- **THEN** 文件末尾新增恰好一行合法 JSON，既有行不被改动

#### Scenario: 多次写入保持顺序
- **WHEN** 依次写入多条 Event
- **THEN** 文件中各行顺序与写入顺序一致，每行可独立 JSON 解析

### Requirement: 操作埋点发射
系统 SHALL 在 inner-loop 全链的关键操作处发射对应事件，traceId 取该 US 的 jobId：`phase`（每个角色 phase 起止，记 role/attempt/resumed/exitCode/costUsd/durationMs）、`gate`（每条 gate 命令，记 cmd/args/exitCode/durationMs）、`squash`（记 jobId/committed/branch）、`integrate`（每个被集成分支，记 branch/traceId/status=merged|held/reason）、`orchestrator-fix`（记 action/target/ok）。

#### Scenario: phase 与 gate 事件携带 traceId=jobId
- **WHEN** 一个 jobId 的 inner-loop 跑完 test→dev→review 与阶段间 gate
- **THEN** 事件文件含该 jobId 为 traceId 的 phase 与 gate 事件，gate 事件含 exitCode 与 durationMs

#### Scenario: 集成事件挂回各 US 的 traceId
- **WHEN** 批后集成对若干 feature 分支判定 merged/held
- **THEN** 每个分支产出一条 integrate 事件，其 traceId 经 branch→jobId 映射回填为该分支所属 US 的 jobId，status 为 merged 或 held（held 含 reason）

### Requirement: 按 traceId 全链路回放
系统 SHALL 提供纯函数按 traceId 分组事件并渲染为按 ts 排序的可读链，及薄 IO 读取与 CLI 入口。读取 SHALL 跳过畸形行而非中断。

#### Scenario: 按 traceId 分组
- **WHEN** 对含多个 traceId 事件的列表调用分组函数
- **THEN** 返回 traceId → 该 traceId 事件列表的映射，组内按 ts 升序

#### Scenario: 渲染一个 US 的全链
- **WHEN** 对某 traceId 的事件列表调用渲染函数
- **THEN** 输出按 ts 排序、含 op 序列（phase→gate→squash→可选 integrate）的可读文本

#### Scenario: 容错读取畸形行
- **WHEN** 事件文件中混入一行非法 JSON
- **THEN** 读取函数跳过该行并返回其余合法事件，不抛错

#### Scenario: CLI 回放指定 traceId
- **WHEN** 以一个存在的 traceId 调用回放 CLI
- **THEN** 打印该 US 的有序事件链；traceId 不存在时输出明确的空结果提示而非报错
