// 并发压测用的独立消费者进程:打开同一个 db 文件,循环原子认领直到队列抽干,
// 把认领到的 id 列表以 JSON 写回 stdout。多个该进程并发运行 = D9 关心的"多进程并发认领"。
//
// 启动屏障(可选,argv[4]=barrierDir argv[5]=N):每个进程开库后写 ready 标记,
// 轮询到 N 个进程全部就位再开始认领——消除"tsx 冷启动序列化导致某进程趁他人未 boot 就抽干"
// 的时序 flaky,让"确有并发瓜分"成为确定性事实(而非弱化该见证)。
import { writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { openQueue } from '../../src/queue-sqlite.js';

const dbPath = process.argv[2];
const worker = process.argv[3] ?? `w-${process.pid}`;
const barrierDir = process.argv[4];
const n = Number(process.argv[5] ?? 0);
if (!dbPath) {
  process.stderr.write('usage: claim-worker <dbPath> <worker> [barrierDir] [N]\n');
  process.exit(2);
}

const q = openQueue(dbPath);

// 启动屏障:全部进程开库就位后再放行
if (barrierDir && n > 0) {
  mkdirSync(barrierDir, { recursive: true });
  writeFileSync(join(barrierDir, `${worker}.ready`), '1');
  const deadline = Date.now() + 10_000;
  for (;;) {
    const ready = readdirSync(barrierDir).filter((f) => f.endsWith('.ready')).length;
    if (ready >= n || Date.now() > deadline) break;
    await new Promise((r) => setTimeout(r, 5));
  }
}

const claimed: string[] = [];
for (;;) {
  const r = q.claim(worker);
  if (r === null) break;
  claimed.push(r.id);
  // 模拟真实 worker 认领后去干活(spawn claude 等)——让出写锁,使多进程公平竞争。
  // 真实 worker 每条间隔很大,绝不紧凑空转;紧凑循环会让单进程独占写锁(非真实场景)。
  // 8ms:抽干 500 条约 1s,给 CPU 饥饿下被暂缓调度的进程足够窗口抢到锁(稳定"确有并发"见证)。
  await new Promise((r) => setTimeout(r, 8));
}
q.close();
process.stdout.write(JSON.stringify(claimed));
