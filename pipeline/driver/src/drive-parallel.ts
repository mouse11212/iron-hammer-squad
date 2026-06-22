import type { InvokeFn } from './types.js';
import { openQueue, type Queue } from './queue-sqlite.js';
import { makeClaudeInvoke } from './invoke.js';
import { runInnerLoopJob, runInnerLoopJobIsolated, type InnerLoopJobSpec } from './inner-loop-runner.js';
import type { InnerLoopResult } from './inner-loop.js';

// 并行多消费者驱动(M5-A/D9):取代 M3 单消费者文件队列 drain。
// 状态机由 SQLite 队列承担——幂等=claim 只认领 queued;running=claim 设置;
// done/failed=ack/fail。worker 按 kind 路由:'inner-loop'→ 多角色 PEV 内循环;其它→ 单次 invoke。
// 单进程内 N 个 worker 协程共享一个连接:claim 同步原子串行,不会自双领;
// 跨进程并发安全由 queue-sqlite 的事务认领保证(见 queue-concurrency 压测)。

/** inner-loop 派发器:据 job 跑多角色内循环,返回终态(测试可注入替身)。 */
export type InnerRunner = (jobId: string, prompt: string) => Promise<InnerLoopResult>;

/** 默认派发器:job.prompt 是 InnerLoopJobSpec 的 JSON。 */
const defaultRunInner: InnerRunner = (jobId, prompt) =>
  runInnerLoopJob(jobId, JSON.parse(prompt) as InnerLoopJobSpec);

/** 隔离派发器(M5-B):在独立 worktree 内跑 + squash + 集成兜底;返回 inner-loop 结果供 ack/fail。 */
export const defaultRunInnerIsolated: InnerRunner = (jobId, prompt) =>
  runInnerLoopJobIsolated(jobId, JSON.parse(prompt) as InnerLoopJobSpec).then((x) => x.result);

/** 单个 worker:循环认领→按 kind 派发→ack/fail,队列抽干即退出,返回处理数。 */
async function worker(name: string, q: Queue, invoke: InvokeFn, runInner?: InnerRunner): Promise<number> {
  let handled = 0;
  for (;;) {
    const job = q.claim(name);
    if (job === null) break; // drain 模式:队列空即退
    try {
      if (job.kind === 'inner-loop' && runInner) {
        const r = await runInner(job.id, job.prompt);
        if (r.status === 'done') q.ack(job.id, name, 0);
        else q.fail(job.id, name, `${r.status}: ${r.reason ?? ''}`.trim(), 1); // failed/blocked-escalated → 升级人类
      } else {
        const res = await invoke(job.prompt);
        if (res.exitCode === 0) q.ack(job.id, name, 0);
        else q.fail(job.id, name, res.stderr, res.exitCode);
      }
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
  runInner: InnerRunner = defaultRunInner,
): Promise<number> {
  const q = openQueue(dbPath);
  q.recover();
  try {
    const counts = await Promise.all(
      Array.from({ length: concurrency }, (_, k) => worker(`w${k}`, q, invoke, runInner)),
    );
    return counts.reduce((a, b) => a + b, 0);
  } finally {
    q.close();
  }
}

// 直接运行:node drive-parallel.js <dbPath> [concurrency]；IH_ISOLATION=1 → 每个 inner-loop 走 worktree 隔离(M5-B)
if (import.meta.url === `file://${process.argv[1]}`) {
  const dbPath = process.argv[2] ?? new URL('../../.runtime/queue.db', import.meta.url).pathname;
  const concurrency = Number(process.argv[3] ?? 2);
  const runInner = process.env.IH_ISOLATION ? defaultRunInnerIsolated : defaultRunInner;
  void driveParallelOnce(dbPath, makeClaudeInvoke(), concurrency, runInner).then((n) =>
    console.log(`[driver] 并行处理完成,共 ${n} 条${process.env.IH_ISOLATION ? '(worktree 隔离)' : ''}`),
  );
}
