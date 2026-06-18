import { describe, it, expect } from 'vitest';
import { truncateTitle } from '../src/truncateTitle.js';

// 省略号锚点：单个码位 U+2026（'…'），JS .length 记为 1。
// 显式声明以区别于三个 ASCII 点 '...'（长度 3），便于杀变异。
const ELLIPSIS = '…';

describe('truncateTitle (news-title-truncate)', () => {
  describe('title.length <= maxLen → 原样返回', () => {
    it('length < maxLen 原样返回', () => {
      expect(truncateTitle('abc', 10)).toBe('abc');
    });

    it('length === maxLen（边界）原样返回，且不追加省略号', () => {
      const out = truncateTitle('hello', 5);
      expect(out).toBe('hello');
      expect(out).not.toContain(ELLIPSIS);
    });

    it('空 title + 正 maxLen → 空串原样返回', () => {
      expect(truncateTitle('', 5)).toBe('');
    });

    it('中文标题未超长时原样返回', () => {
      // 每个 BMP 汉字 .length 记为 1，共 4 字符 <= 6。
      expect(truncateTitle('财经快讯', 6)).toBe('财经快讯');
    });
  });

  describe('title.length > maxLen → 截断为恰好 maxLen 个字符，末位为 …', () => {
    it('截断结果 = 前 maxLen-1 字符 + 省略号', () => {
      // 'abcdef'(6) > 5 → 前 4 字符 'abcd' + '…'
      expect(truncateTitle('abcdef', 5)).toBe('abcd…');
    });

    it('截断后总长度恰好等于 maxLen', () => {
      const out = truncateTitle('abcdef', 5);
      expect(out.length).toBe(5);
    });

    it('末位恰为单码位省略号 …（而非三点 ...）', () => {
      const out = truncateTitle('abcdef', 5);
      expect(out.at(-1)).toBe(ELLIPSIS);
      // 三点实现会让长度变为 maxLen+2，这里再钉一次长度。
      expect(out.length).toBe(5);
    });

    it('保留的前缀正是原标题的前 maxLen-1 个字符', () => {
      const title = 'abcdef';
      const maxLen = 5;
      const out = truncateTitle(title, maxLen);
      expect(out.slice(0, maxLen - 1)).toBe(title.slice(0, maxLen - 1));
    });

    it('length === maxLen + 1（刚超一位）触发截断', () => {
      // 'hello!'(6) > 5 → 'hell…'
      expect(truncateTitle('hello!', 5)).toBe('hell…');
    });

    it('远超长的中文标题截断到 maxLen', () => {
      const title = '这是一条非常长的彭博财经新闻标题';
      const out = truncateTitle(title, 6);
      expect(out).toBe('这是一条非…');
      expect(out.length).toBe(6);
    });

    it('maxLen === 1（边界）→ 仅省略号', () => {
      // 前 0 字符 + '…'，总长 1。
      const out = truncateTitle('abc', 1);
      expect(out).toBe('…');
      expect(out.length).toBe(1);
    });
  });

  describe('maxLen <= 0 → 空串（优先于长度判断）', () => {
    it('maxLen === 0 返回空串', () => {
      expect(truncateTitle('abc', 0)).toBe('');
    });

    it('maxLen 为负返回空串', () => {
      expect(truncateTitle('abc', -1)).toBe('');
    });

    it('maxLen 大负数返回空串', () => {
      expect(truncateTitle('hello', -100)).toBe('');
    });

    it('短 title（length <= maxLen 表面成立）+ maxLen=0 仍返回空串', () => {
      // 钉死分支顺序：maxLen<=0 必须先于「原样返回」判断。
      expect(truncateTitle('a', 0)).toBe('');
    });

    it('空 title + maxLen=0 返回空串', () => {
      expect(truncateTitle('', 0)).toBe('');
    });
  });
});
