import { describe, it, expect } from 'vitest';
import { aggregate } from '../src/aggregate.js';
import type { NewsItem } from '../src/types.js';

/**
 * 内联构造 NewsItem。link 与 pubDate 是被测关注点，其余给稳定默认值。
 * pub 可为 ISO 字符串、Date，或 'invalid' 表示 Invalid Date。
 */
function item(
  link: string,
  pub: string | Date,
  extra: Partial<NewsItem> = {},
): NewsItem {
  const pubDate =
    pub === 'invalid'
      ? new Date('not-a-date')
      : pub instanceof Date
        ? pub
        : new Date(pub);
  return {
    title: extra.title ?? `title-${link}`,
    link,
    pubDate,
    summary: extra.summary ?? '',
    source: extra.source ?? 'Bloomberg',
  };
}

describe('aggregate (news-aggregate)', () => {
  // 规约 1：按 link 去重 —— 多源合并后同一 link 只保留一条
  it('按 link 去重：跨源相同 link 只保留一条', () => {
    const a = [item('https://x/1', '2026-06-17T05:00:00Z')];
    const b = [item('https://x/1', '2026-06-17T06:00:00Z')];
    const out = aggregate([a, b]);

    expect(out).toHaveLength(1);
    expect(out[0]!.link).toBe('https://x/1');
    // 该 link 在结果中确实仅出现一次
    expect(out.filter((i) => i.link === 'https://x/1')).toHaveLength(1);
  });

  it('按 link 去重：同源内重复 link 也只保留一条', () => {
    const a = [
      item('https://x/dup', '2026-06-17T05:00:00Z'),
      item('https://x/dup', '2026-06-17T06:00:00Z'),
      item('https://x/other', '2026-06-17T07:00:00Z'),
    ];
    const out = aggregate([a]);

    expect(out).toHaveLength(2);
    expect(out.filter((i) => i.link === 'https://x/dup')).toHaveLength(1);
    expect(out.map((i) => i.link).sort()).toEqual([
      'https://x/dup',
      'https://x/other',
    ]);
  });

  // 规约 2：不同 link 全保留 —— 数量等于各源之和
  it('不同 link 全保留：结果数量等于各源条数之和', () => {
    const a = [
      item('https://a/1', '2026-06-17T01:00:00Z'),
      item('https://a/2', '2026-06-17T02:00:00Z'),
    ];
    const b = [
      item('https://b/1', '2026-06-17T03:00:00Z'),
      item('https://b/2', '2026-06-17T04:00:00Z'),
      item('https://b/3', '2026-06-17T05:00:00Z'),
    ];
    const out = aggregate([a, b]);

    expect(out).toHaveLength(5);
    expect(new Set(out.map((i) => i.link)).size).toBe(5);
    expect([...out.map((i) => i.link)].sort()).toEqual([
      'https://a/1',
      'https://a/2',
      'https://b/1',
      'https://b/2',
      'https://b/3',
    ]);
  });

  // 规约 3：按 pubDate 倒序（从新到旧）
  it('按 pubDate 倒序排序（从新到旧）', () => {
    const a = [
      item('https://x/old', '2026-06-15T00:00:00Z'),
      item('https://x/new', '2026-06-17T00:00:00Z'),
    ];
    const b = [item('https://x/mid', '2026-06-16T00:00:00Z')];
    const out = aggregate([a, b]);

    expect(out.map((i) => i.link)).toEqual([
      'https://x/new',
      'https://x/mid',
      'https://x/old',
    ]);
    // 相邻项时间单调不增
    for (let k = 0; k + 1 < out.length; k++) {
      expect(out[k]!.pubDate.getTime()).toBeGreaterThanOrEqual(
        out[k + 1]!.pubDate.getTime(),
      );
    }
  });

  // 规约 4：Invalid Date 垫底且排序不抛错
  it('Invalid Date 排到末尾且不抛错', () => {
    const a = [
      item('https://x/invalid', 'invalid'),
      item('https://x/old', '2026-06-15T00:00:00Z'),
    ];
    const b = [item('https://x/new', '2026-06-17T00:00:00Z')];

    let out!: NewsItem[];
    expect(() => {
      out = aggregate([a, b]);
    }).not.toThrow();

    expect(out).toHaveLength(3);
    // 有效项按倒序排在前，Invalid Date 垫底
    expect(out.map((i) => i.link)).toEqual([
      'https://x/new',
      'https://x/old',
      'https://x/invalid',
    ]);
    expect(Number.isNaN(out[out.length - 1]!.pubDate.getTime())).toBe(true);
  });

  // 强化(评审#2 must-fix):单个 Invalid 夹在有效项中间，必须被强制垫底
  it('单个 Invalid 居中输入：仍被强制排到末尾', () => {
    const out = aggregate([
      [
        item('https://x/new', '2026-06-17T00:00:00Z'),
        item('https://x/inv', 'invalid'),
        item('https://x/old', '2026-06-15T00:00:00Z'),
      ],
    ]);
    expect(out.map((i) => i.link)).toEqual([
      'https://x/new',
      'https://x/old',
      'https://x/inv',
    ]);
  });

  it('多个 Invalid Date 均垫底，有效项仍按倒序', () => {
    const a = [
      item('https://x/inv1', 'invalid'),
      item('https://x/new', '2026-06-17T00:00:00Z'),
    ];
    const b = [
      item('https://x/inv2', 'invalid'),
      item('https://x/old', '2026-06-10T00:00:00Z'),
    ];

    let out!: NewsItem[];
    expect(() => {
      out = aggregate([a, b]);
    }).not.toThrow();

    expect(out).toHaveLength(4);
    // 前两位为有效项倒序
    expect(out.slice(0, 2).map((i) => i.link)).toEqual([
      'https://x/new',
      'https://x/old',
    ]);
    // 后两位均为 Invalid Date，且保持输入相对顺序（契约：双 Invalid 返回 0）
    const tail = out.slice(2);
    expect(tail.every((i) => Number.isNaN(i.pubDate.getTime()))).toBe(true);
    expect(tail.map((i) => i.link)).toEqual([
      'https://x/inv1',
      'https://x/inv2',
    ]);
  });

  // 规约(接线 canonicalizeUrl)：按规范化 URL 去重——同一文章因跟踪参数/大小写/尾斜杠差异跨源仍判同一条
  it('规范化去重：跟踪参数差异视为同一条', () => {
    const a = [item('https://x.com/a?utm_source=news&id=1', '2026-06-17T05:00:00Z')];
    const b = [item('https://x.com/a?id=1', '2026-06-17T06:00:00Z')];
    expect(aggregate([a, b])).toHaveLength(1);
  });

  it('规范化去重：host 大小写与尾斜杠差异视为同一条', () => {
    const a = [item('https://X.com/a/', '2026-06-17T05:00:00Z')];
    const b = [item('https://x.com/a', '2026-06-17T06:00:00Z')];
    expect(aggregate([a, b])).toHaveLength(1);
  });

  it('规范化去重保留首条原始 link（不改写展示链接）', () => {
    const a = [item('https://x.com/a?utm_source=news', '2026-06-17T05:00:00Z')];
    const b = [item('https://x.com/a', '2026-06-17T06:00:00Z')];
    expect(aggregate([a, b])[0]!.link).toBe('https://x.com/a?utm_source=news');
  });

  // 规约 5：边界 —— 空输入返回 []
  it('空输入 aggregate([]) 返回 []', () => {
    expect(aggregate([])).toEqual([]);
  });

  it('全空来源 aggregate([[], []]) 返回 []', () => {
    expect(aggregate([[], []])).toEqual([]);
  });
});
