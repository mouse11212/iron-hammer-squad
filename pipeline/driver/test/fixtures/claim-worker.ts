// 并发压测用的独立消费者进程:打开同一个 db 文件,循环原子认领直到队列抽干,
// 把认领到的 id 列表以 JSON 写回 stdout。多个该进程并发运行 = D9 关心的"多进程并发认领"。
import { openQueue } from '../../src/queue-sqlite.js';

const dbPath = process.argv[2];
const worker = process.argv[3] ?? `w-${process.pid}`;
if (!dbPath) {
  process.stderr.write('usage: claim-worker <dbPath> <worker>\n');
  process.exit(2);
}

const q = openQueue(dbPath);
const claimed: string[] = [];
for (;;) {
  const r = q.claim(worker);
  if (r === null) break;
  claimed.push(r.id);
}
q.close();
process.stdout.write(JSON.stringify(claimed));
