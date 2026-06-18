// 卡片省略号锚点：单个码位 U+2026（'…'，.length === 1）。
// 显式具名以区别于三个 ASCII 点 '...'（长度 3）——保证截断后总长度恰为 maxLen。
const ELLIPSIS = '…';

/**
 * 纯函数：把新闻 `title` 截断到至多 `maxLen` 个字符（卡片显示用）。
 * 无网络/时钟，确定性可测。
 *
 * 分支顺序（被规约钉死，不可调换）：
 * 1. maxLen <= 0          → 空串 ''（优先于任何长度判断）
 * 2. title.length <= maxLen → 原样返回 title（不追加省略号）
 * 3. title.length > maxLen  → 前 maxLen-1 个字符 + '…'，总长度恰为 maxLen
 *
 * 注：长度以 JS 的 UTF-16 码元（String.length）为准；BMP 汉字与单码位
 * 省略号均记为 1，与卡片按字符计数的显示口径一致。
 */
export function truncateTitle(title: string, maxLen: number): string {
  if (maxLen <= 0) return '';
  if (title.length <= maxLen) return title;
  return title.slice(0, maxLen - 1) + ELLIPSIS;
}
