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

/**
 * 纯:把 UTC ISO 时间戳渲染为北京时间(UTC+8)显示串，如 `2026-06-27 22:55:58 +08`。
 * 存储仍是 UTC(时区无关/可排序)，仅在「显示层」转北京时间(issue#10)。
 * 显式 ms 算术 + UTC getter 读北京墙钟 → 确定性、不依赖主机时区。
 * 宽容降级:无法解析的 ts 原样返回(不中断回放，同 readEvents 跳畸形哲学)。
 */
export function formatBeijing(isoUtc: string): string {
  const ms = Date.parse(isoUtc);
  if (Number.isNaN(ms)) return isoUtc;
  const d = new Date(ms + 8 * 3600 * 1000); // 移到北京墙钟，下面用 UTC getter 读出
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} +08`;
}

/** 纯:把一组事件(同一 US)按 ts 排序渲染为可读链(时间显示为北京时间)。 */
export function formatReplay(events: Event[]): string {
  return [...events]
    .sort(byTs)
    .map((e) => {
      const head = e.phase ? `${e.op}/${e.phase}` : e.op;
      const status = e.status ? ` ${e.status}` : '';
      const dur = e.durationMs !== undefined ? ` (${e.durationMs}ms)` : '';
      const payload = e.payload ? ` ${JSON.stringify(e.payload)}` : '';
      return `[${formatBeijing(e.ts)}] ${head}${status}${dur}${payload}`;
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
