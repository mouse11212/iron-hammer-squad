import { XMLParser, XMLValidator } from 'fast-xml-parser';
import type { NewsItem } from './types.js';

interface RawItem {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
}

/**
 * 纯函数：把 RSS XML 字符串解析为 NewsItem[]。
 * 无副作用、不发起网络请求；畸形 XML 抛错；空 feed 返回 []。
 */
export function parse(xml: string): NewsItem[] {
  const valid = XMLValidator.validate(xml);
  if (valid !== true) {
    throw new Error(`Invalid RSS XML: ${valid.err.msg}`);
  }

  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false, // 所有标签值保持字符串，避免纯数字标题被转成 number
    trimValues: true,
  });

  const doc = parser.parse(xml) as {
    rss?: { channel?: { item?: RawItem | RawItem[] } };
  };

  const rawItem = doc.rss?.channel?.item;
  if (rawItem === undefined) {
    return [];
  }
  const rawItems: RawItem[] = Array.isArray(rawItem) ? rawItem : [rawItem];

  return rawItems.map((it) => ({
    title: it.title ?? '',
    link: it.link ?? '',
    pubDate: new Date(it.pubDate ?? ''),
    summary: it.description ?? '',
    source: 'Bloomberg',
  }));
}
