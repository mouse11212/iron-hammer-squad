// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { filterToday } from '../src/filterToday.js';
import type { NewsItem } from '../src/types.js';

function item(pubISO: string, title = 't'): NewsItem {
  return { title, link: 'https://x', pubDate: new Date(pubISO), summary: '', source: 'Bloomberg' };
}

// 时区基准：按 UTC 自然日筛选（Bloomberg pubDate 为 GMT）。today 为显式入参，不读系统时钟。
const today = new Date('2026-06-17T12:00:00Z');

describe('filterToday (news-filter-today)', () => {
  it('保留当天、过滤其它日期，且保持输入顺序', () => {
    const items = [
      item('2026-06-16T23:00:00Z', 'yesterday'),
      item('2026-06-17T01:00:00Z', 'a'),
      item('2026-06-18T01:00:00Z', 'tomorrow'),
      item('2026-06-17T20:00:00Z', 'b'),
    ];
    const out = filterToday(items, today);
    expect(out.map((i) => i.title)).toEqual(['a', 'b']);
  });

  it('当天无条目返回 []', () => {
    const items = [item('2026-06-16T10:00:00Z'), item('2026-06-18T10:00:00Z')];
    expect(filterToday(items, today)).toEqual([]);
  });

  it('边界时刻 00:00:00 与 23:59:59（UTC）算当天', () => {
    const items = [
      item('2026-06-17T00:00:00Z', 'start'),
      item('2026-06-17T23:59:59Z', 'end'),
    ];
    expect(filterToday(items, today).map((i) => i.title)).toEqual(['start', 'end']);
  });

  it('空输入返回 []', () => {
    expect(filterToday([], today)).toEqual([]);
  });
});
