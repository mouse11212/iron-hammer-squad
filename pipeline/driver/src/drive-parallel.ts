import type { InvokeFn } from './types.js';
import { openQueue, type Queue } from './queue-sqlite.js';
import { makeClaudeInvoke } from './invoke.js';

// 并行多消费者驱动(M5-A/D9):取代 M3 单消费者文件队列 drain。
// 状态机由 SQLite 队列承担——幂等=claim 只认领 queued;running=claim 设置;
// done/failed=ack/fail。worker 仅复用 invoke 薄边界跑 claude -p。
// 单进程内 N 个 worker 协程共享一个连接:claim 同步原子串行,不会自双领;
// 跨进程并发安全由 queue-sqlite 的事务认领保证(见 queue-concurrency 压测)。

/** 单个 worker:循环认领→跑 invoke→ack/fail,队列抽干即退出,返回处理数。 */
async function worker(name: string, q: Queue, invoke: InvokeFn): Promise<number> {
  let handled = 0;
  for (;;) {
    const job = q.claim(name);
    if (job === null) break; // drain 模式:队列空即退
    try {
      const res = await invoke(job.prompt);
      if (res.exitCode === 0) q.ack(job.id, name, 0);
      else q.fail(job.id, name, res.stderr, res.exitCode);
    } catch (err) {
      q.fail(job.id, name, err instanceof Error ? err.message : String(err), 1);
    }
    handled++;
  }
  return handled;
}

/**
 * 并行 drain:起 concurrency 个 worker 各自认领并跑 invoke,直到队列抽干。
 * 启动先 recover 回收上次残留 running。返回总处理数。
 * @param dbPath SQLite 队列文件
 * @param invoke claude -p 薄边界(测试注入替身)
 * @param concurrency 并行内循环数(M5 DoD=2)
 */
export async function driveParallelOnce(
  dbPath: string,
  invoke: InvokeFn = makeClaudeInvoke(),
  concurrency = 2,
): Promise<number> {
  const q = openQueue(dbPath);
  q.recover();
  try {
    const counts = await Promise.all(
      Array.from({ length: concurrency }, (_, k) => worker(`w${k}`, q, invoke)),
    );
    return counts.reduce((a, b) => a + b, 0);
  } finally {
    q.close();
  }
}

// 直接运行:node drive-parallel.js <dbPath> [concurrency]
if (import.meta.url === `file://${process.argv[1]}`) {
  const dbPath = process.argv[2] ?? new URL('../../.runtime/queue.db', import.meta.url).pathname;
  const concurrency = Number(process.argv[3] ?? 2);
  void driveParallelOnce(dbPath, makeClaudeInvoke(), concurrency).then((n) =>
    console.log(`[driver] 并行处理完成,共 ${n} 条`),
  );
}
