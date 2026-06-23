import { pathToFileURL } from 'node:url';
import type { InvokeFn } from './types.js';
import { openQueue, type Queue } from './queue-sqlite.js';
import { makeClaudeInvoke } from './invoke.js';
import {
  runInnerLoopJob,
  runInnerLoopJobIsolated,
  drainBatchIsolated,
  makeRealBatchDeps,
  type InnerLoopJobSpec,
  type BatchDrainDeps,
  type BatchDrainResult,
} from './inner-loop-runner.js';
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

export interface DriveLoopOpts {
  /** 跑一轮 drain,返回本轮处理数。 */
  drainRound: () => Promise<number>;
  /** 注入的等待(可测)。 */
  sleep: (ms: number) => Promise<void>;
  pollMs?: number;
  /** 连续空轮达此数即停(防无限空转)。 */
  maxEmptyRounds?: number;
}

/**
 * 轮询守护(②):循环 drainRound → 计空轮 → sleep,连续空轮达上限退出。
 * drain/sleep 注入,确定性可测;真实组合见 main 块。
 */
export async function driveParallelLoop(opts: DriveLoopOpts): Promise<{ rounds: number; totalHandled: number }> {
  const maxEmpty = opts.maxEmptyRounds ?? 2;
  const pollMs = opts.pollMs ?? 1000;
  let emptyRounds = 0;
  let rounds = 0;
  let totalHandled = 0;
  for (;;) {
    const handled = await opts.drainRound();
    rounds++;
    totalHandled += handled;
    if (handled === 0) {
      emptyRounds++;
      if (emptyRounds >= maxEmpty) break;
    } else {
      emptyRounds = 0;
    }
    await opts.sleep(pollMs);
  }
  return { rounds, totalHandled };
}

/** 守护单轮:开队列→recover→批隔离 drain(隔离跑+批后集成+HITL 交接)→close。注入 open/drain 可测。 */
export interface BatchRoundDeps {
  /** 每轮装配真实 BatchDrainDeps(默认 makeRealBatchDeps)。 */
  buildDeps: () => BatchDrainDeps;
  openQueueFn?: (dbPath: string) => Queue;
  drainBatch?: (q: Queue, deps: BatchDrainDeps) => Promise<BatchDrainResult>;
}

/**
 * 组装"全链单轮"为 driveParallelLoop 的 drainRound:每轮开队列→recover→drainBatchIsolated→close,
 * 返回本轮处理数。finally 保证异常也关闭连接(守护多轮不复用/不泄漏)。
 */
export function makeBatchDrainRound(dbPath: string, deps: BatchRoundDeps): () => Promise<number> {
  const openQ = deps.openQueueFn ?? openQueue;
  const drain = deps.drainBatch ?? drainBatchIsolated;
  return async () => {
    const q = openQ(dbPath);
    try {
      q.recover();
      const r = await drain(q, deps.buildDeps());
      return r.handled;
    } finally {
      q.close();
    }
  };
}

/**
 * CLI 入口判定:本模块是否被直接运行(而非 import)。
 * 不能用 `import.meta.url === \`file://\` + process.argv[1]`——含中文/空格的路径下
 * import.meta.url 是 URL 编码的(%E9...),argv1 是未编码原始路径,朴素拼接永不相等
 * → main 块整段不执行(daemon 静默不启动)。用 pathToFileURL 归一化两侧编码后比较。
 */
export function isMainModule(metaUrl: string, argv1: string | undefined): boolean {
  if (!argv1) return false;
  return pathToFileURL(argv1).href === metaUrl;
}

// 直接运行:node drive-parallel.js <dbPath> [concurrency]
//   IH_ISOLATION=1            → 单批全链(隔离 worktree 跑内循环 → batchIntegrate → HITL 交接报告)
//   IH_DAEMON=1               → 常驻守护:轮询全链单轮,连续空轮上限即停(隐含隔离+集成+交接)
//   (默认,无 flag)           → legacy 非隔离单次 drain(per-job,无集成,廉价回归用)
if (isMainModule(import.meta.url, process.argv[1])) {
  const dbPath = process.argv[2] ?? new URL('../../.runtime/queue.db', import.meta.url).pathname;
  const concurrency = Number(process.argv[3] ?? 2);
  const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
  if (process.env.IH_DAEMON) {
    const round = makeBatchDrainRound(dbPath, { buildDeps: () => makeRealBatchDeps({ concurrency }) });
    void driveParallelLoop({ drainRound: round, sleep, pollMs: Number(process.env.IH_POLL_MS ?? 2000) }).then((r) =>
      console.log(`[driver] 守护退出:${r.rounds} 轮,共 ${r.totalHandled} 条(全链:隔离→集成→交接)`),
    );
  } else if (process.env.IH_ISOLATION) {
    const round = makeBatchDrainRound(dbPath, { buildDeps: () => makeRealBatchDeps({ concurrency }) });
    void round().then((n) => console.log(`[driver] 单批全链完成,共 ${n} 条(隔离→集成→交接,报告见 .runtime/integration-report.md)`));
  } else {
    void driveParallelOnce(dbPath, makeClaudeInvoke(), concurrency, defaultRunInner).then((n) =>
      console.log(`[driver] 并行处理完成,共 ${n} 条`),
    );
  }
}
