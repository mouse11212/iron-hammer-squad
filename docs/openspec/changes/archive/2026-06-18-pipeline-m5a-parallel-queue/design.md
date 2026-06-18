## Context

driver(M3)用文件队列 + `rename` 认领,仅单消费者安全(D9 决策第 2 条:`rename` 多进程非互斥 → 双领)。M5 要 2 个并行内循环,需并发安全的认领后端。D9 已锁定"嵌入式 SQLite + stdio MCP",落地选 `node:sqlite`(2026-06-17 BOSS 签字,见 `docs/plan/D9-message-component-decision.md`)。

## Goals / Non-Goals

**Goals:**
- 事务原子认领,N 消费者并发零双领(可压测验证)。
- 队列核心逻辑可脱离 MCP / claude 做确定性测试(用临时 `.db`)。
- driver 升级为并行 worker pool;文件队列保留为单消费者回退。

**Non-Goals:**
- Git worktree 隔离 + 集成分支 + squash(M5-B)。
- 分布式/跨机队列、SKIP LOCKED 级高并发(SQLite 多读单写,单机少量 worker 足够,D9 第 3 条)。
- 角色纠错路由回拥有域(留 M5/后续,SendMessage 限制见 RESUME §6)。

## Decisions

**D-1:用 `node:sqlite` 而非 better-sqlite3。** 内置零依赖、零原生编译,最贴合"可分发 CC 插件"。替代:better-sqlite3(API 成熟但需 node-gyp/预编译二进制,离线包重)。已 BOSS 签字。

**D-2:原子认领用单条 `UPDATE ... WHERE id = (SELECT ... LIMIT 1) RETURNING`。** 在一条事务性语句内"选 + 占",借 SQLite 写锁串行化保证零双领。替代:`SELECT` 后 `UPDATE`(两步有 TOCTOU 窗口,需显式 BEGIN IMMEDIATE,更易错)。配 `journal_mode=WAL` + `busy_timeout` 吸收写锁竞争。

**D-3:队列逻辑与 MCP/driver 分层。** `queue-sqlite.ts` 纯队列(enqueue/claim/ack/fail/recover/status,只依赖一个 db 句柄)→ 可用临时 db 确定性测试,含并发压测;MCP server 与 worker pool 是薄消费者。延续项目"纯核心可测 + 薄边界"模式。

**D-4:worker pool 复用既有 `runOnce` + `invoke` 薄边界。** 每个 worker 循环:claim → 有则 `runOnce`(已是幂等 + 注入式 invoke)→ ack/fail。并发度 N 可配(M5 DoD = 2)。

## Risks / Trade-offs

- [并发认领仍双领] → 用 RETURNING 单语句 + WAL + busy_timeout;**写并发认领压测**(N worker 抢 M 任务,断言总认领数==M、无重复)作为决定性 gate 的一部分。
- [SQLite database is locked] → 设 `busy_timeout`(如 5s)+ 单写连接;认领语句短事务。
- [node:sqlite 仍标实验性] → 本机 Node 24 稳定可用;回退 better-sqlite3 已在 D9 记录;API 隔离在 `queue-sqlite.ts` 一处,替换面小。
- [崩溃恢复误判存活 worker] → 最小切片用"启动时全部 running→queued"回收(单机假设:启动即无存活旧 worker);多实例存活判定留后续。

## Migration Plan

- 新增文件,不改 M3 文件队列路径(回退保留)。driver 暴露并行模式入口(走 SQLite)与原单消费者模式(走文件队列)。
- 回滚:并行模式有问题则继续用 M3 文件队列单消费者,无数据迁移。

## Open Questions

- MCP server 是否纳入本切片的确定性 gate,还是仅手动冒烟?(倾向:核心队列进 gate + 并发压测;MCP 薄封装做集成冒烟,与 fetch 薄边界一致。)
