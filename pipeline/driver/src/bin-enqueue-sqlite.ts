import { openQueue } from './queue-sqlite.js';

/**
 * 往 SQLite 队列投递一个请求(= 触发一个事件)。
 * 用法: tsx src/bin-enqueue-sqlite.ts <dbPath> <id> <kind> <prompt>
 *   - kind='inner-loop' 时 prompt 为 InnerLoopJobSpec 的 JSON 串(driver dispatch 会 JSON.parse)。
 *   - 其它 kind 时 prompt 为喂给 claude -p 的文本。
 */
const [, , dbPath, id, kind, ...promptParts] = process.argv;
if (!dbPath || !id || !kind || promptParts.length === 0) {
  console.error('用法: enqueue-sqlite <dbPath> <id> <kind> <prompt>');
  process.exit(1);
}

const queue = openQueue(dbPath);
const added = queue.enqueue({ id, kind, prompt: promptParts.join(' ') });
queue.close();
console.log(`[enqueue-sqlite] ${id} (${kind}) → ${dbPath} ${added ? '已入队' : '已存在(幂等忽略)'}`);
