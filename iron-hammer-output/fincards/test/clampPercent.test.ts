import { describe, it, expect } from 'vitest';
import { clampPercent } from '../src/clampPercent.js';

/**
 * 规约（news-card 占比显示）：
 *   WHEN ratio < 0            THEN "0%"
 *   WHEN ratio > 1            THEN "100%"
 *   WHEN 0 <= ratio <= 1      THEN Math.round(ratio*100) + "%"（四舍五入到整数百分比）
 * 约束：纯函数、确定性可测。
 */
describe('clampPercent (card-percent-display)', () => {
  // 规约 1：ratio < 0 一律夹到下界 "0%"
  describe('WHEN ratio < 0 THEN "0%"', () => {
    it('明显的负值夹到 "0%"', () => {
      expect(clampPercent(-0.5)).toBe('0%');
    });

    it('紧贴 0 的负侧也夹到 "0%"（钉住"严格小于"边界）', () => {
      expect(clampPercent(-0.0001)).toBe('0%');
    });

    it('极端负值夹到 "0%"', () => {
      expect(clampPercent(-100)).toBe('0%');
    });
  });

  // 规约 2：ratio > 1 一律夹到上界 "100%"
  describe('WHEN ratio > 1 THEN "100%"', () => {
    it('明显超过 1 夹到 "100%"', () => {
      expect(clampPercent(2)).toBe('100%');
    });

    it('紧贴 1 的上侧也夹到 "100%"（钉住"严格大于"边界）', () => {
      expect(clampPercent(1.0001)).toBe('100%');
    });

    it('极端大值夹到 "100%"', () => {
      expect(clampPercent(999)).toBe('100%');
    });
  });

  // 规约 3：0 <= ratio <= 1 走四舍五入到整数百分比
  describe('WHEN 0 <= ratio <= 1 THEN Math.round(ratio*100) + "%"', () => {
    it('下界 0 → "0%"', () => {
      expect(clampPercent(0)).toBe('0%');
    });

    it('上界 1 → "100%"', () => {
      expect(clampPercent(1)).toBe('100%');
    });

    it('中间值 0.5 → "50%"', () => {
      expect(clampPercent(0.5)).toBe('50%');
    });

    it('0.25 → "25%"', () => {
      expect(clampPercent(0.25)).toBe('25%');
    });

    it('0.999 → "100%"（接近上界但仍在区间内，四舍五入到 100）', () => {
      expect(clampPercent(0.999)).toBe('100%');
    });

    // —— 以下三例专为区分 round / floor / ceil（杀变异）——
    it('0.126 → "13%"（向上进位：round=13 ≠ floor=12，钉死非 floor）', () => {
      expect(clampPercent(0.126)).toBe('13%');
    });

    it('0.124 → "12%"（向下舍去：round=12 ≠ ceil=13，钉死非 ceil）', () => {
      expect(clampPercent(0.124)).toBe('12%');
    });

    it('0.005 → "1%"（恰好 .5 向上：验证四舍五入而非截断）', () => {
      expect(clampPercent(0.005)).toBe('1%');
    });

    it('0.004 → "0%"（不足 .5 舍去）', () => {
      expect(clampPercent(0.004)).toBe('0%');
    });
  });

  // 返回值形态：恒为以 "%" 结尾的字符串
  describe('返回值形态', () => {
    it('恒返回 string 类型', () => {
      expect(typeof clampPercent(0.42)).toBe('string');
    });

    it('恒以 "%" 结尾', () => {
      expect(clampPercent(0.42).endsWith('%')).toBe(true);
    });
  });
});
