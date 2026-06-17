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

  it('对 title/summary 中的 HTML 特殊字符转义，防注入', () => {
    const html = render([item({ title: '<script>alert("x")</script>', summary: 'a & b "c"' })]);
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('a &amp; b');
  });

  it('空列表输出合法页面并显示占位提示', () => {
    const html = render([]);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('今日暂无新闻');
    expect((html.match(/<article class="card">/g) ?? []).length).toBe(0);
  });
});
