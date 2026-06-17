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

  it('畸形 XML 抛错', () => {
    expect(() => parse(fx('malformed.xml'))).toThrow();
  });
});
