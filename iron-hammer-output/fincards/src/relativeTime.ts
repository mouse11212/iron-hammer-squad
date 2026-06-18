const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * 纯函数：把 `pubDate` 相对 `now` 的时间差渲染成中文相对时间标签。
 * `now` 为显式入参（不读系统时钟），保证测试确定性。
 *
 * 分档（各档下界闭合，`Math.floor` 向下取整）：
 * - 差 < 60 秒        → "刚刚"
 * - 60 秒 ≤ 差 < 60 分 → "{N}分钟前"
 * - 60 分 ≤ 差 < 24 时 → "{N}小时前"
 * - 差 ≥ 24 小时       → "{N}天前"
 */
export function relativeTime(pubDate: Date, now: Date): string {
  const diff = now.getTime() - pubDate.getTime();

  if (diff >= DAY) return `${Math.floor(diff / DAY)}天前`;
  if (diff >= HOUR) return `${Math.floor(diff / HOUR)}小时前`;
  if (diff >= MINUTE) return `${Math.floor(diff / MINUTE)}分钟前`;
  return '刚刚';
}
