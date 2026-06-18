import { describe, it, expect } from 'vitest';
import { parseVerdict } from '../src/verdict.js';

describe('parseVerdict（纯解析 + schema 校验，确定性交接点）', () => {
  it('合法 verdict(pass，空 mustFix) → decision=pass, mustFix=[]', () => {
    const v = parseVerdict(JSON.stringify({ decision: 'pass', mustFix: [] }));
    expect(v.decision).toBe('pass');
    expect(v.mustFix).toEqual([]);
  });

  it('含 impl 与 test 两条 mustFix → 解析出域与描述', () => {
    const v = parseVerdict(
      JSON.stringify({
        decision: 'block',
        mustFix: [
          { domain: 'impl', desc: '失败路径覆盖既有产物', file: 'src/store.ts' },
          { domain: 'test', desc: '缺空输入边界测试' },
        ],
        niceToHave: ['抽公共工厂'],
      }),
    );
    expect(v.decision).toBe('block');
    expect(v.mustFix).toHaveLength(2);
    expect(v.mustFix[0]).toEqual({ domain: 'impl', desc: '失败路径覆盖既有产物', file: 'src/store.ts' });
    expect(v.mustFix[1]).toEqual({ domain: 'test', desc: '缺空输入边界测试' });
    expect(v.niceToHave).toEqual(['抽公共工厂']);
  });

  it('非法 JSON → 抛错', () => {
    expect(() => parseVerdict('{ not json')).toThrow();
  });

  it('decision 非法值 → 抛错', () => {
    expect(() => parseVerdict(JSON.stringify({ decision: 'maybe', mustFix: [] }))).toThrow(/decision/);
  });

  it('mustFix 不是数组 → 抛错', () => {
    expect(() => parseVerdict(JSON.stringify({ decision: 'pass', mustFix: 'none' }))).toThrow(/mustFix/);
  });

  it('mustFix 项缺 domain → 抛错', () => {
    expect(() =>
      parseVerdict(JSON.stringify({ decision: 'block', mustFix: [{ desc: '没写域' }] })),
    ).toThrow(/domain/);
  });

  it('mustFix 项 domain 非 impl/test → 抛错', () => {
    expect(() =>
      parseVerdict(JSON.stringify({ decision: 'block', mustFix: [{ domain: 'review', desc: 'x' }] })),
    ).toThrow(/domain/);
  });
});
