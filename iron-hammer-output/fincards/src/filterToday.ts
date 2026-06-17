import type { NewsItem } from './types.js';

/** 取某时刻在 UTC 下的自然日键（YYYY-MM-DD）。 */
function utcDayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

/**
 * 纯函数：保留 pubDate 与 `today` 处于同一 UTC 自然日的条目，保持输入顺序。
 * `today` 为显式入参（不读系统时钟），保证测试确定性。
 */
export function filterToday(items: NewsItem[], today: Date): NewsItem[] {
  const todayKey = utcDayKey(today);
  return items.filter((it) => utcDayKey(it.pubDate) === todayKey);
}
