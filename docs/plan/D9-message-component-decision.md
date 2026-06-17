# 决策记录:D9 消息/事件组件选型

> 日期 2026-06-17 · 状态:已锁定 · 依据:两份一手核实调研(Inngest 深挖 + 轻量本地队列对比)
> 关联:V4 §3.1 D9、backlog E5、`pipeline/driver/`

## 决策

铁锤小队流水线的**消息/事件/任务队列组件** = **嵌入式 SQLite 队列(`better-sqlite3`,事务原子认领 + WAL 崩溃恢复)封装为 stdio MCP server**。

- **基线(单消费者,driver 现状)**:保留**文件队列**(目录投递 + JSON 状态)——单 orchestrator 驱动下安全、零依赖。
- **并行(M5/D9,多消费者)**:切 **SQLite 嵌入式队列 + MCP**。
- **排除**:Inngest、Redis/BullMQ、NATS、Postgres/pg-boss/Graphile —— 均需常驻服务或外部 DB,对"可分发、轻量 CC 插件"太重。

## 关键技术结论(决定性)

1. **"多 Agent" ≠ "多消费者"。** 不可靠的触发条件是**多个进程并发从同一队列认领**,不是 agent 角色数量。当前 Planner-Workers-Judge 是"单 orchestrator 认领 + spawn 子 agent",**单消费者 → 文件队列安全**。
2. **文件队列的致命坑**:`rename` 在 Linux **不是可靠的多消费者互斥锁**(多进程可同时 rename 成功 → 双认领)。多消费者要么用 `link/unlink` 原子认领,要么(更优)用 SQLite 事务。
3. **SQLite 是唯一同时满足**零守护进程 + 真持久化 + WAL 崩溃恢复 + 事务原子认领/幂等的方案;一个 `.db` 文件随插件分发。限制:多读单写、无 `SKIP LOCKED`——对单机少量 agent 完全够用(配 `busy_timeout`、单写连接)。
4. **Inngest**:durable execution 平台(对标 Temporal),即使自托管单二进制/Connect 也**必须常驻独立 server + 反向调用**,无法纯进程内嵌;SSPL 许可。是"平台级工具解库级问题"。仅当将来真需要"数月级持久工作流编排"才考虑。
5. **CC 插件 idiomatic**:markdown skills 为主 + 少量 node 工具 + 一个 stdio MCP server(多 Skills、少 MCP)。消息组件应是嵌入式 SQLite + stdio MCP(暴露 enqueue/dequeue/ack/status),不让用户装/保活任何服务。

## 主要来源(一手)

- node:sqlite 文档 https://nodejs.org/api/sqlite.html · better-sqlite3 https://github.com/WiseLibs/better-sqlite3
- SQLite 并发/单写 https://tenthousandmeters.com/blog/sqlite-concurrent-writes-and-database-is-locked-errors/
- 文件队列竞态 https://lkml.iu.edu/hypermail/linux/kernel/0304.3/0151.html · Directory::Queue(link/unlink 正解) https://metacpan.org/pod/Directory::Queue
- Inngest 自托管/执行模型/许可 https://www.inngest.com/docs/self-hosting · https://github.com/inngest/inngest
- pg-boss https://github.com/timgit/pg-boss · BullMQ/Redis · NATS https://github.com/nats-io/nats.js
- CC 插件/MCP 形态 https://code.claude.com/docs/en/mcp
