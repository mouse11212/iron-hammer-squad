import { createRequire } from 'node:module';
import type { RunStatus } from './types.js';

// vite/vitest 的依赖解析会把 `import 'node:sqlite'` 的 specifier strip 成 'sqlite',
// 而其(过时的)builtin 列表里只有 'node:sqlite' → 报 "Failed to load url sqlite"。
// 用 createRequire 在运行时加载内置模块,绕过 vite 静态解析;类型仍由 typeof import 提供。
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

// 决策 D9（docs/plan/D9-message-component-decision.md）:并行多消费者的消息组件
// = 嵌入式 SQLite 队列。落地用 Node 内置 node:sqlite（BOSS 2026-06-17 签字,
// 取代原首选 better-sqlite3，省原生编译、最贴合可分发 CC 插件）。
// 零双领的保证在 SQLite 写事务层:claim 用单条 UPDATE...(SELECT...LIMIT 1) RETURNING,
// 写事务串行化使"选一条 + 置 running + 绑 worker"原子完成,多连接并发认领不会双领。

/** 投递入队的请求负载。 */
export interface QueueRequest {
  id: string;
  kind: string;
  prompt: string;
}

/** 被认领的请求(携带认领它的 worker)。 */
export interface ClaimedRequest extends QueueRequest {
  worker: string;
}

/** 各状态计数。 */
export type Counts = Record<RunStatus, number>;

/** 队列句柄:核心操作纯依赖一个 db 连接,可用临时/内存 db 确定性测试。 */
export interface Queue {
  /** 幂等入队:同 id 已存在则忽略(返回 false),新入队返回 true。 */
  enqueue(req: QueueRequest): boolean;
  /** 原子认领一条 queued → running 并绑定 worker;无可认领返回 null。 */
  claim(worker: string): ClaimedRequest | null;
  /** 确认完成:仅对本 worker 持有的 running 生效。 */
  ack(id: string, worker: string, exitCode?: number): boolean;
  /** 标记失败:仅对本 worker 持有的 running 生效。 */
  fail(id: string, worker: string, error: string, exitCode?: number): boolean;
  /** 崩溃恢复:把残留 running 全部回收为 queued,返回回收数。 */
  recover(): number;
  /** 查询单请求当前状态。 */
  status(id: string): RunStatus | undefined;
  /** 各状态计数。 */
  counts(): Counts;
  /** 关闭连接。 */
  close(): void;
}

interface ClaimRow {
  id: string;
  kind: string;
  prompt: string;
  worker: string;
}

/** 注入时钟(默认系统时钟,IO 边界);测试可传固定 now。 */
export type Clock = () => string;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS requests (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,
  prompt      TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'queued',
  worker      TEXT,
  created_at  TEXT NOT NULL,
  started_at  TEXT,
  finished_at TEXT,
  exit_code   INTEGER,
  error       TEXT
);
`;

/**
 * 打开(或新建)SQLite 队列。
 * @param dbPath 文件路径;':memory:' 用于快速单元测试(注:内存库不支持 WAL,并发压测须用文件)。
 * @param now 注入时钟。
 */
export function openQueue(dbPath = ':memory:', now: Clock = () => new Date().toISOString()): Queue {
  const db = new DatabaseSync(dbPath);
  // 文件库启用 WAL + busy_timeout 以承受多连接并发写锁竞争;内存库 WAL 不适用,忽略其返回。
  if (dbPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec(SCHEMA);

  const insert = db.prepare(
    `INSERT OR IGNORE INTO requests (id, kind, prompt, status, created_at)
     VALUES (?, ?, ?, 'queued', ?)`,
  );
  // 单条原子认领:子查询挑最早一条 queued,外层 UPDATE 在同一写事务内占住并返回。
  const claimStmt = db.prepare(
    `UPDATE requests
       SET status = 'running', worker = ?, started_at = ?
     WHERE id = (
       SELECT id FROM requests WHERE status = 'queued'
       ORDER BY created_at ASC, rowid ASC LIMIT 1
     )
     RETURNING id, kind, prompt, worker`,
  );
  const ackStmt = db.prepare(
    `UPDATE requests SET status = 'done', finished_at = ?, exit_code = ?
     WHERE id = ? AND worker = ? AND status = 'running'`,
  );
  const failStmt = db.prepare(
    `UPDATE requests SET status = 'failed', finished_at = ?, error = ?, exit_code = ?
     WHERE id = ? AND worker = ? AND status = 'running'`,
  );
  const recoverStmt = db.prepare(
    `UPDATE requests SET status = 'queued', worker = NULL, started_at = NULL
     WHERE status = 'running'`,
  );
  const statusStmt = db.prepare(`SELECT status FROM requests WHERE id = ?`);
  const countsStmt = db.prepare(`SELECT status, COUNT(*) AS c FROM requests GROUP BY status`);

  return {
    enqueue(req) {
      const r = insert.run(req.id, req.kind, req.prompt, now());
      return r.changes > 0;
    },
    claim(worker) {
      const row = claimStmt.get(worker, now()) as ClaimRow | undefined;
      return row ? { id: row.id, kind: row.kind, prompt: row.prompt, worker: row.worker } : null;
    },
    ack(id, worker, exitCode = 0) {
      return ackStmt.run(now(), exitCode, id, worker).changes > 0;
    },
    fail(id, worker, error, exitCode = 1) {
      return failStmt.run(now(), error, exitCode, id, worker).changes > 0;
    },
    recover() {
      return Number(recoverStmt.run().changes);
    },
    status(id) {
      const row = statusStmt.get(id) as { status: RunStatus } | undefined;
      return row?.status;
    },
    counts() {
      const base: Counts = { queued: 0, running: 0, done: 0, failed: 0 };
      for (const r of countsStmt.all() as { status: RunStatus; c: number }[]) {
        base[r.status] = Number(r.c);
      }
      return base;
    },
    close() {
      db.close();
    },
  };
}
