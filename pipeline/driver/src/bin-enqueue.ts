import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Request } from './types.js';

/**
 * 投递一个请求到队列(= 触发一个事件)。
 * 用法: tsx src/bin-enqueue.ts <root> <id> <kind> <prompt...>
 */
const [, , root, id, kind, ...promptParts] = process.argv;
if (!root || !id || !kind || promptParts.length === 0) {
  console.error('用法: enqueue <root> <id> <kind> <prompt...>');
  process.exit(1);
}

const queue = join(root, 'queue');
mkdirSync(queue, { recursive: true });
const req: Request = { id, kind, prompt: promptParts.join(' '), createdAt: new Date().toISOString() };
writeFileSync(join(queue, `${id}.json`), JSON.stringify(req, null, 2), 'utf8');
console.log(`[enqueue] ${id} → ${queue}`);
