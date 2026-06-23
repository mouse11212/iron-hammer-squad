import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { readEvents, groupByTrace, formatReplay } from './replay.js';

/**
 * 按 traceId(=jobId) 回放一个 US 的全链事件。
 * 用法: tsx src/bin-replay.ts <traceId> [eventsPath]
 *   - eventsPath 缺省为 pipeline/.runtime/events.jsonl
 * 薄 glue:读取/分组/渲染全在已测纯函数(replay.ts),此处只做 argv 解析 + 打印。
 */
const [, , traceId, eventsPathArg] = process.argv;
if (!traceId) {
  console.error('用法: replay <traceId> [eventsPath]');
  process.exit(1);
}

const defaultPath = join(fileURLToPath(new URL('../../', import.meta.url)), '.runtime', 'events.jsonl'); // driver/src/.. -> pipeline/
const eventsPath = eventsPathArg ?? defaultPath;

const trace = groupByTrace(readEvents(eventsPath)).get(traceId);
if (!trace || trace.length === 0) {
  console.log(`[replay] traceId=${traceId} 无事件(检查 ${eventsPath})`);
} else {
  console.log(`# 回放 traceId=${traceId}（${trace.length} 条事件）\n`);
  console.log(formatReplay(trace));
}
