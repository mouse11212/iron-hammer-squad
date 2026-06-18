## Why

driver 现状是**单消费者文件队列**:`listQueued`+`archiveRequest` 用 `rename` 认领,`fs.watch` 单 drain。`rename` 在多进程下不是可靠互斥锁——多个消费者并发认领同一请求会**双领**(D9 决策已锁定此坑)。M5 要求"消息组件支持 2 个并行内循环",必须把认领后端换成**事务原子认领**,才能安全地并行跑多个内循环。

## What Changes

- 新增**嵌入式 SQLite 任务队列**(Node 内置 `node:sqlite`,WAL 模式 + `busy_timeout`),提供事务原子认领(claim)——**保证多消费者并发零双领**。
- 队列支持 enqueue / claim / ack(done)/ fail(可重入队)/ 幂等去重(同 id 不重复执行)/ 崩溃恢复(回收残留 running)。
- driver 从"单消费者 drain"升级为**并行 worker pool**(N 个并发消费者),各 worker 原子认领后 spawn `claude -p`。
- 把队列操作封装为 **stdio MCP server**(暴露 enqueue/claim/ack/status),让外部进程/agent 可投递与认领,不需常驻服务。
- **BREAKING**(driver 内部):并行模式下队列后端由文件目录切为 `.db` 文件;文件队列保留为单消费者回退路径。

## Capabilities

### New Capabilities
- `concurrent-queue`: 嵌入式 SQLite 任务队列——事务原子认领、多消费者并发零双领、ack/fail/requeue、幂等去重、WAL 崩溃恢复;封装为 stdio MCP。

### Modified Capabilities
<!-- event-driver 的状态机/幂等/恢复/薄边界需求在并行下仍成立;driver 实现升级属 Impact,非 spec-level 需求变更。无修改既有 capability。 -->

## Impact

- **代码**:`pipeline/driver/` 新增 SQLite 队列后端(`queue-sqlite.ts`)+ 并行 worker pool(升级 `loop.ts`);新增 `pipeline/mcp/`(stdio MCP server 封装队列)。
- **依赖**:`node:sqlite`(Node ≥22.5 内置,本机 v24.15.0;无新增 npm 原生依赖)。
- **抽取线**:对应 E5,验证后抽取/修正 `pipeline/`(消息组件 + 并行驱动)。
- **不在本切片**(留 M5-B):Git worktree 隔离 + 集成分支兜底 + squash 合并。
