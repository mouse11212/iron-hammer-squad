import { describe, it, expect } from 'vitest';
import { relativeTime } from '../src/relativeTime.js';

// 固定基准时刻（不读系统时钟，确定性可测）。
const now = new Date('2026-06-18T12:00:00Z');

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** 造一个比 now 早 deltaMs 毫秒的 pubDate。 */
function ago(deltaMs: number): Date {
  return new Date(now.getTime() - deltaMs);
}

describe('relativeTime (news-card-relative-time)', () => {
  describe('差 < 60 秒 → "刚刚"', () => {
    it('差为 0 返回 "刚刚"', () => {
      expect(relativeTime(ago(0), now)).toBe('刚刚');
    });

    it('差 1 秒返回 "刚刚"', () => {
      expect(relativeTime(ago(1 * SEC), now)).toBe('刚刚');
    });

    it('差 59 秒（上界内）返回 "刚刚"', () => {
      expect(relativeTime(ago(59 * SEC), now)).toBe('刚刚');
    });
  });

  describe('60 秒 ≤ 差 < 60 分钟 → "{N}分钟前"（向下取整分钟）', () => {
    it('差恰好 60 秒 → "1分钟前"（边界归入分钟档）', () => {
      expect(relativeTime(ago(60 * SEC), now)).toBe('1分钟前');
    });

    it('差 90 秒向下取整 → "1分钟前"', () => {
      expect(relativeTime(ago(90 * SEC), now)).toBe('1分钟前');
    });

    it('差 119 秒向下取整 → "1分钟前"', () => {
      expect(relativeTime(ago(119 * SEC), now)).toBe('1分钟前');
    });

    it('差 5 分钟整 → "5分钟前"', () => {
      expect(relativeTime(ago(5 * MIN), now)).toBe('5分钟前');
    });

    it('差 59 分 59 秒（上界内）→ "59分钟前"', () => {
      expect(relativeTime(ago(59 * MIN + 59 * SEC), now)).toBe('59分钟前');
    });
  });

  describe('60 分钟 ≤ 差 < 24 小时 → "{N}小时前"（向下取整小时）', () => {
    it('差恰好 60 分钟 → "1小时前"（边界归入小时档）', () => {
      expect(relativeTime(ago(60 * MIN), now)).toBe('1小时前');
    });

    it('差 90 分钟向下取整 → "1小时前"', () => {
      expect(relativeTime(ago(90 * MIN), now)).toBe('1小时前');
    });

    it('差 5 小时整 → "5小时前"', () => {
      expect(relativeTime(ago(5 * HOUR), now)).toBe('5小时前');
    });

    it('差 23 小时 59 分（上界内）→ "23小时前"', () => {
      expect(relativeTime(ago(23 * HOUR + 59 * MIN), now)).toBe('23小时前');
    });
  });

  describe('差 ≥ 24 小时 → "{N}天前"（向下取整天）', () => {
    it('差恰好 24 小时 → "1天前"（边界归入天档）', () => {
      expect(relativeTime(ago(24 * HOUR), now)).toBe('1天前');
    });

    it('差 47 小时向下取整 → "1天前"', () => {
      expect(relativeTime(ago(47 * HOUR), now)).toBe('1天前');
    });

    it('差恰好 48 小时 → "2天前"', () => {
      expect(relativeTime(ago(48 * HOUR), now)).toBe('2天前');
    });

    it('差 10 天整 → "10天前"', () => {
      expect(relativeTime(ago(10 * DAY), now)).toBe('10天前');
    });
  });
});
