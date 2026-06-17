// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse } from '../src/parse.js';

const here = dirname(fileURLToPath(import.meta.url));
const fx = (name: string): string =>
  readFileSync(join(here, '..', 'fixtures', name), 'utf8');

describe('parse (news-parse)', () => {
  it('解析正常多条 feed：字段齐全、source 为 Bloomberg', () => {
    const items = parse(fx('bloomberg-markets.rss'));
    expect(items.length).toBe(30);
    const first = items[0]!;
    expect(typeof first.title).toBe('string');
    expect(first.title.length).toBeGreaterThan(0);
    expect(first.link).toMatch(/^https:\/\/www\.bloomberg\.com\/news\/articles\//);
    expect(first.summary.length).toBeGreaterThan(0);
    expect(first.source).toBe('Bloomberg');
    expect(first.pubDate instanceof Date).toBe(true);
    expect(Number.isNaN(first.pubDate.getTime())).toBe(false);
  });

  it('空 feed（合法结构、无 item）返回 []', () => {
    expect(parse(fx('empty-feed.rss'))).toEqual([]);
  });

  it('缺 description 的 item：summary 为空字符串，其余正常', () => {
    const xml =
      '<?xml version="1.0"?><rss version="2.0"><channel><item>' +
      '<title>No Desc</title>' +
      '<link>https://www.bloomberg.com/news/articles/x</link>' +
      '<pubDate>Wed, 17 Jun 2026 04:20:03 GMT</pubDate>' +
      '</item></channel></rss>';
    const items = parse(xml);
    expect(items.length).toBe(1);
    expect(items[0]!.summary).toBe('');
    expect(items[0]!.title).toBe('No Desc');
  });

  it('单条 item（非数组）也返回长度为 1 的数组', () => {
    const xml =
      '<?xml version="1.0"?><rss version="2.0"><channel><item>' +
      '<title>Only One</title>' +
      '<link>https://www.bloomberg.com/news/articles/one</link>' +
      '<description>d</description>' +
      '<pubDate>Wed, 17 Jun 2026 04:20:03 GMT</pubDate>' +
      '</item></channel></rss>';
    expect(parse(xml).length).toBe(1);
  });

  it('畸形 XML 抛错且错误信息可识别', () => {
    expect(() => parse(fx('malformed.xml'))).toThrow(/Invalid RSS XML/);
  });

  it('首条 item 字段精确匹配 fixture（钉死字段映射）', () => {
    const first = parse(fx('bloomberg-markets.rss'))[0]!;
    expect(first.title).toBe('Iron Ore Sinks Back Below $100 as Abundant Supplies Hurt Outlook');
    expect(first.link).toBe(
      'https://www.bloomberg.com/news/articles/2026-06-17/iron-ore-sinks-back-below-100-as-abundant-supplies-hurt-outlook',
    );
    expect(first.summary).toContain('Iron ore sank below $100');
    expect(first.pubDate.toISOString()).toBe('2026-06-17T04:20:03.000Z');
  });

  it('缺 title/link 的 item：回退为空字符串（钉死 ?? 回退）', () => {
    const xml =
      '<?xml version="1.0"?><rss version="2.0"><channel><item>' +
      '<description>only desc</description>' +
      '<pubDate>Wed, 17 Jun 2026 04:20:03 GMT</pubDate>' +
      '</item></channel></rss>';
    const it0 = parse(xml)[0]!;
    expect(it0.title).toBe('');
    expect(it0.link).toBe('');
    expect(it0.summary).toBe('only desc');
  });

  it('缺 channel 的合法 rss 返回 []（钉死可选链防御）', () => {
    expect(parse('<?xml version="1.0"?><rss version="2.0"></rss>')).toEqual([]);
  });

  it('非 rss 根的合法 XML 返回 []（钉死 rss 可选链）', () => {
    expect(parse('<?xml version="1.0"?><feed></feed>')).toEqual([]);
  });

  it('缺 pubDate 的 item：pubDate 为 Invalid Date（覆盖 ?? 回退）', () => {
    const xml =
      '<?xml version="1.0"?><rss version="2.0"><channel><item>' +
      '<title>No Date</title><link>https://www.bloomberg.com/news/articles/nd</link>' +
      '<description>d</description></item></channel></rss>';
    expect(Number.isNaN(parse(xml)[0]!.pubDate.getTime())).toBe(true);
  });

  it('纯数字标题保持字符串（钉死 parseTagValue=false）', () => {
    const xml =
      '<?xml version="1.0"?><rss version="2.0"><channel><item>' +
      '<title>12345</title><link>https://www.bloomberg.com/news/articles/n</link>' +
      '<description>d</description><pubDate>Wed, 17 Jun 2026 04:20:03 GMT</pubDate>' +
      '</item></channel></rss>';
    expect(typeof parse(xml)[0]!.title).toBe('string');
    expect(parse(xml)[0]!.title).toBe('12345');
  });

  it('标题首尾空白被裁剪（钉死 trimValues=true）', () => {
    const xml =
      '<?xml version="1.0"?><rss version="2.0"><channel><item>' +
      '<title>  Spaced Title  </title><link>https://www.bloomberg.com/news/articles/s</link>' +
      '<description>d</description><pubDate>Wed, 17 Jun 2026 04:20:03 GMT</pubDate>' +
      '</item></channel></rss>';
    expect(parse(xml)[0]!.title).toBe('Spaced Title');
  });
});
