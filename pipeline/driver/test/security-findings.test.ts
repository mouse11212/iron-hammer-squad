import { describe, it, expect } from 'vitest';
import { parseSecurityFindings, mapFindingsToAction, type Finding } from '../src/security-findings.js';

const F = (over: Partial<Finding>): Finding => ({ category: 'tampering', severity: 'high', desc: 'x', ...over });

describe('parseSecurityFindings（纯:解析安全评审 findings JSON，仿 verdict 严格校验）', () => {
  it('解析合法 findings(STRIDE 类 + 严重度 + desc + 可选 location/recommendation)', () => {
    const r = parseSecurityFindings(
      JSON.stringify({ findings: [{ category: 'tampering', severity: 'high', desc: '未参数化 SQL', location: 'src/db.ts:10', recommendation: '用参数化查询' }] }),
    );
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]).toEqual({ category: 'tampering', severity: 'high', desc: '未参数化 SQL', location: 'src/db.ts:10', recommendation: '用参数化查询' });
  });

  it('空 findings 合法(无威胁)', () => {
    expect(parseSecurityFindings(JSON.stringify({ findings: [] })).findings).toEqual([]);
  });

  it('非 JSON → 抛', () => {
    expect(() => parseSecurityFindings('不是 json')).toThrow();
  });

  it('severity 越界(critical) → 抛带定位', () => {
    expect(() => parseSecurityFindings(JSON.stringify({ findings: [{ category: 'dos', severity: 'critical', desc: 'x' }] }))).toThrow(/severity/);
  });

  it('category 越界 / 缺 desc → 抛', () => {
    expect(() => parseSecurityFindings(JSON.stringify({ findings: [{ category: 'unknown', severity: 'low', desc: 'x' }] }))).toThrow(/category/);
    expect(() => parseSecurityFindings(JSON.stringify({ findings: [{ category: 'elevation', severity: 'low' }] }))).toThrow(/desc/);
  });

  it('findings 非数组 → 抛', () => {
    expect(() => parseSecurityFindings(JSON.stringify({ findings: 'x' }))).toThrow();
  });
});

describe('mapFindingsToAction（纯:确定性按严重度决定动作）', () => {
  it('有 high → escalate=true,high 列入 high、余入 advise', () => {
    const r = mapFindingsToAction([F({ severity: 'high', desc: 'a' }), F({ severity: 'medium', desc: 'b' }), F({ severity: 'low', desc: 'c' })]);
    expect(r.escalate).toBe(true);
    expect(r.high.map((f) => f.desc)).toEqual(['a']);
    expect(r.advise.map((f) => f.desc)).toEqual(['b', 'c']);
  });

  it('仅 medium/low → escalate=false 全入 advise', () => {
    const r = mapFindingsToAction([F({ severity: 'medium', desc: 'b' }), F({ severity: 'low', desc: 'c' })]);
    expect(r.escalate).toBe(false);
    expect(r.high).toEqual([]);
    expect(r.advise).toHaveLength(2);
  });

  it('空 findings → 无动作', () => {
    expect(mapFindingsToAction([])).toEqual({ escalate: false, high: [], advise: [] });
  });
});
