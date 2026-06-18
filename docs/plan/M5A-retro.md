# M5-A + E5 复盘（pipeline-m5a-parallel-queue）

> 日期 2026-06-18。M5-A=并行内循环的消息组件(D9 落地);E5=抽取为 `pipeline/driver/` 的并发队列 + 并行驱动 + MCP。对应 V4 §3.1(D9)、backlog M5。

## 交付

- `pipeline/driver/queue-sqlite.ts`:嵌入式 SQLite 任务队列(`node:sqlite`),事务原子认领 + WAL + `busy_timeout`;enqueue 幂等去重 / claim / ack / fail / recover / status / counts。
- `drive-parallel.ts`:N 路并行 worker pool(claim → invoke 薄边界 → ack/fail),启动 recover。
- `mcp-server.ts`:官方 `@modelcontextprotocol/sdk` stdio MCP server,暴露 5 个队列工具(薄封装)。
- 24 测试全绿(新增 16:9 队列单元 + 1 多进程并发压测 + 3 并行驱动 + 3 MCP);真实文件 db + tsx 端到端冒烟通过。
- 决策记录就地修正:D9 实现库 `better-sqlite3` → `node:sqlite`(BOSS 签字)。

## 关键洞察

- **零双领的保证在 SQLite 写事务层,不在 JS。** 单条 `UPDATE...WHERE id=(SELECT...LIMIT 1) RETURNING` 让"选+占"原子完成,写事务串行化 + WAL + `busy_timeout` 顶住多连接并发。同进程内多 worker 的 `claim` 是同步串行(JS 单线程),天然不双领——真正的双领风险只在多 OS 进程。
- **并发测试必须用真子进程,否则是假绿。** 若在同线程起"多 worker"测,`claim` 串行执行,等于没测并发。压测用 `node --import tsx` spawn 4 个进程抢同一 db 文件,并加 `≥2 进程瓜分` 断言防"一个进程抢光"的假并发。延续 M1「揭穿弱测试」纪律。
- **变异门按场景取舍,不机械套用。** queue 逻辑以 SQL/DB IO 为主,Stryker 变异 JS AST 碰不到 SQL 语义 → 等价变异多、收益低。本切片护栏=并发压测(覆盖变异测不到的并发正确性维度)+ fail/recover 全路径 + MCP 一致性。**未跑变异门,诚实记录,非遗漏。**
- **决策记录是真相源但非教条。** 落地实测 Node 24 内置 `node:sqlite`,对"可分发 CC 插件"严格优于原生 `better-sqlite3`(免 node-gyp/预编译/离线包重)。就地修正 D9 并标注原因+签字——dogfood「抽取≠冻结 / 求真纪律」。

## 踩坑（→ 固化进 RESUME 地雷区）

- **vite/vitest 不识别新内置 `node:sqlite`**:其 builtin 列表过时,把 specifier strip 成 `sqlite` 找不到 → "Failed to load url sqlite"。配置层 `external` 不可靠。解法:`createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')`——运行时加载绕过 vite 静态解析,`typeof import` 保留类型,一行满足 vite/tsc/运行时三方。此坑随 Node 内置增多会复现。
- **MCP SDK 装入带 transitive 漏洞告警**(5 项):非本切片范围,留 M6 安全门(OWASP/Dependabot)处理,此处记录不静默。

## 待完善(→ 后续)

1. **M5-B**:Git worktree 隔离 + 集成分支兜底 + squash 合并(M5 DoD 的另一半)。
2. 并行 driver 接完整内/外循环(事件自动拉起多角色全流程),取代"调一次 claude"。
3. 角色纠错路由回拥有域(E5 提及,受 SendMessage 限制,待后续)。
4. recover 当前单机假设"启动即无存活旧 worker";多实例存活判定(心跳/租约)留后续。

## 追溯链

spec `pipeline-m5a-parallel-queue`(concurrent-queue)→ test(queue-sqlite/queue-concurrency/drive-parallel/mcp-server)→ 实现(queue-sqlite/drive-parallel/mcp-server)→ gate 24 绿 + 端到端冒烟 → commit(待提交)。
