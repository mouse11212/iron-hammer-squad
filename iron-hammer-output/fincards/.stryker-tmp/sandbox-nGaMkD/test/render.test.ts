// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { render } from '../src/render.js';
import type { NewsItem } from '../src/types.js';

function item(over: Partial<NewsItem> = {}): NewsItem {
  return {
    title: 'Title',
    link: 'https://www.bloomberg.com/news/articles/x',
    pubDate: new Date('2026-06-17T04:20:03Z'),
    summary: 'A summary',
    source: 'Bloomberg',
    ...over,
  };
}

describe('render (news-card-render)', () => {
  it('输出自包含 HTML，N 条新闻渲染 N 张卡片', () => {
    const html = render([item({ title: 'A' }), item({ title: 'B' }), item({ title: 'C' })]);
    expect(html).toContain('<!DOCTYPE html>');
    expect((html.match(/<article class="card">/g) ?? []).length).toBe(3);
  });

  it('卡片标题为指向原文 link 的超链接，且不内联正文全文', () => {
    const html = render([item({ title: 'Headline', link: 'https://www.bloomberg.com/news/articles/abc' })]);
    expect(html).toMatch(/<a[^>]+href="https:\/\/www\.bloomberg\.com\/news\/articles\/abc"[^>]*>[^<]*Headline/);
    // 合规：只展示摘要，不内联正文容器
    expect(html).not.toContain('article-body');
  });

  it('对 title/summary 中的 HTML 特殊字符全量转义，防注入', () => {
    const html = render([item({ title: `<script>alert("x")</script>`, summary: `a & b "c" 'd'` })]);
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;/script&gt;');
    expect(html).toContain('a &amp; b');
    expect(html).toContain('&quot;c&quot;');
    expect(html).toContain('&#39;d&#39;');
  });

  it('卡片渲染日期为 "YYYY-MM-DD HH:mm UTC" 格式（钉死日期格式化）', () => {
    const html = render([item({ pubDate: new Date('2026-06-17T04:20:03Z') })]);
    expect(html).toContain('2026-06-17 04:20 UTC');
  });

  it('卡片含摘要文本与来源（钉死卡片内容拼装）', () => {
    const html = render([item({ summary: 'UNIQUE_SUMMARY_TOKEN', source: 'Bloomberg' })]);
    expect(html).toContain('UNIQUE_SUMMARY_TOKEN');
    expect(html).toContain('Bloomberg');
    expect(html).toMatch(/<time>[^<]+<\/time>/);
  });

  it('多张卡片之间以换行分隔（钉死 join 分隔符）', () => {
    const html = render([item({ title: 'A' }), item({ title: 'B' })]);
    expect(html).toMatch(/<\/article>\n {4}<article class="card">/);
  });

  it('无效 pubDate 不抛错且时间显示为空（钉死 NaN 守卫）', () => {
    const html = render([item({ pubDate: new Date('not-a-date') })]);
    expect(html).toContain('<article class="card">');
    expect(html).toMatch(/<time><\/time>/);
  });

  it('空列表输出合法页面并显示占位提示', () => {
    const html = render([]);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('今日暂无新闻');
    expect((html.match(/<article class="card">/g) ?? []).length).toBe(0);
  });
});
