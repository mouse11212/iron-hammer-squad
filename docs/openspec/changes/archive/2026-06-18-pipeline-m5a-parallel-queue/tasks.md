## 1. 队列骨架与 schema

- [x] 1.1 在 `pipeline/driver/` 建 `queue-sqlite.ts`:打开 `node:sqlite` 句柄,设 `journal_mode=WAL` + `busy_timeout`,建 `requests` 表(id PK, kind, prompt, status, worker, created_at, started_at, finished_at, exit_code, error)
- [x] 1.2 新增类型:`QueueRequest`/`ClaimedRequest`/复用 `RunStatus`;导出 `openQueue(dbPath, now?)` 返回 `Queue` 句柄(内存/临时文件可注入,便于测试)

## 2. 核心队列逻辑(TDD:每个先写测试再实现)

- [x] 2.1 `enqueue(req)`:`INSERT OR IGNORE` 幂等去重(同 id 不产生第二条;已终态 id 再入队被忽略)
- [x] 2.2 `claim(worker)`:单条 `UPDATE...WHERE id=(SELECT...WHERE status='queued' LIMIT 1) RETURNING` 原子认领;空队列返回 null
- [x] 2.3 `ack(id,worker)` / `fail(id,worker,error)`:仅对本 worker 持有的 running 生效,落 done/failed + 时间戳
- [x] 2.4 `recover()`:启动时把残留 running 回收为 queued
- [x] 2.5 `status(id)` / `counts()`:查询单请求与各状态计数

## 3. 并发安全验收(决定性 gate 关键)

- [x] 3.1 **并发压测**(`test/queue-concurrency.test.ts`):4 进程并发抢 500 条,断言总认领==500、无双领、≥2 进程瓜分(防假绿)、子进程零崩溃
- [x] 3.2 崩溃恢复测试:残留 running → recover → 可重新 claim(单元 + drive-parallel 集成各一)

## 4. driver 并行 worker pool

- [x] 4.1 `drive-parallel.ts`:`driveParallelOnce(dbPath, invoke, concurrency)` 起 N 个 worker,各 claim → 跑 invoke 薄边界 → ack/fail。**实现微调**:用 queue 的 claim/ack/fail 取代 `runOnce` 状态机(幂等/running/终态已由队列承担),仅复用 `invoke`
- [x] 4.2 注入替身测 2 并行 worker:全部 done、无重复执行、`maxActive==2`(对齐 M5 DoD=2);另测 fail 路径与 recover

## 5. stdio MCP 封装

- [x] 5.1 `mcp-server.ts`:用官方 `@modelcontextprotocol/sdk` 建 stdio MCP server,`registerTool` 暴露 enqueue/claim/ack/fail/status,薄封装 `queue-sqlite`。**实现微调**:放 driver 工程内(与队列内聚、共享类型/SDK),非独立 `pipeline/mcp/`——E5 抽取时若需独立再移
- [x] 5.2 集成测试(`mcp-server.test.ts`):InMemoryTransport 连 client/server,验证 5 工具暴露 + MCP 结果与核心函数一致 + 完整生命周期

## 6. 确定性 gate 与验证

- [x] 6.1 lint + tsc --noEmit + vitest 全绿(24 测试,含并发压测/恢复/并行/MCP)
- [x] 6.2 真实跑一次:tsx 运行时 + 真实文件 db,5 条入队 → 并行 N=2 → 全 done(脱 vitest 验证 createRequire/node:sqlite/WAL)
- [x] 6.3 记录追溯链;写 M5-A 复盘(`docs/plan/M5A-retro.md`)。**变异门决策**:queue 逻辑以 SQL/DB IO 为主,变异收益低、等价变异多 → 用多进程并发压测(覆盖变异测不到的并发正确性)替代,retro 记录

## 7. E5 抽取与归档

- [x] 7.1 E5:concurrent-queue + 并行 driver + MCP 已直接建于 `pipeline/driver/`(引擎基建即最终产物,无需物理抽取);更新 `pipeline/README.md`(E4→E5)与 `store.ts` D9 边界注释(指向已落地 SQLite 队列)
- [x] 7.2 `openspec validate --strict` 通过 → `openspec archive` → git commit + push
