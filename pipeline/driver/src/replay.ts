import { existsSync, readFileSync } from 'node:fs';
import type { Event } from './events.js';

// 按 traceId 回放一个 US 的全链事件。纯分组/渲染 + 薄 IO 读取(跳畸形行)。

/** 按 ts 升序(字符串比较;ISO8601 天然字典序=时间序)。 */
function byTs(a: Event, b: Event): number {
  return a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0;
}

/** 纯:按 traceId 分组,组内按 ts 升序。 */
export function groupByTrace(events: Event[]): Map<string, Event[]> {
  const m = new Map<string, Event[]>();
  for (const e of events) {
    const arr = m.get(e.traceId);
    if (arr) arr.push(e);
    else m.set(e.traceId, [e]);
  }
  for (const arr of m.values()) arr.sort(byTs);
  return m;
}

/** 纯:把一组事件(同一 US)按 ts 排序渲染为可读链。 */
export function formatReplay(events: Event[]): string {
  return [...events]
    .sort(byTs)
    .map((e) => {
      const head = e.phase ? `${e.op}/${e.phase}` : e.op;
      const status = e.status ? ` ${e.status}` : '';
      const dur = e.durationMs !== undefined ? ` (${e.durationMs}ms)` : '';
      const payload = e.payload ? ` ${JSON.stringify(e.payload)}` : '';
      return `[${e.ts}] ${head}${status}${dur}${payload}`;
    })
    .join('\n');
}

/** 薄 IO:逐行 parse 事件文件,跳过畸形行;文件不存在返回空。 */
export function readEvents(path: string): Event[] {
  if (!existsSync(path)) return [];
  const events: Event[] = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line) as Event);
    } catch {
      continue; // 跳畸形行(并发交错/截断兜底),不中断回放
    }
  }
  return events;
}
