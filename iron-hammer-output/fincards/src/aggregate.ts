import type { NewsItem } from './types.js';

/**
 * 纯函数：合并多源新闻并规整。
 * - 合并所有源后按 `link` 去重，同一 link 保留首次出现的条目。
 * - 按 `pubDate` 倒序（新 → 旧）排序；Invalid Date 一律垫底，排序过程不抛错。
 * - 无副作用、不读时钟、不发起网络请求。
 */
export function aggregate(sources: NewsItem[][]): NewsItem[] {
  const seen = new Set<string>();
  const deduped: NewsItem[] = [];

  for (const source of sources) {
    for (const item of source) {
      if (seen.has(item.link)) continue;
      seen.add(item.link);
      deduped.push(item);
    }
  }

  // 规整：有效项按时间倒序在前；Invalid Date 按输入相对顺序垫底。
  // 用分区而非"比较器内判 NaN"——避免 NaN 进入比较器导致依赖排序实现的未定义
  // 行为(评审#2 根因修复)。NaN 永不参与比较，行为确定、可被变异测试覆盖。
  const valid = deduped.filter((i) => !Number.isNaN(i.pubDate.getTime()));
  const invalid = deduped.filter((i) => Number.isNaN(i.pubDate.getTime()));
  valid.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
  return [...valid, ...invalid];
}
