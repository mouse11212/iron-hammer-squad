import { describe, it, expect } from 'vitest';
import { traceCheck, type BrokenLink } from '../src/trace-check.js';
import type { TraceLink } from '../src/types.js';

const link = (over: Partial<TraceLink>): TraceLink => ({
  changeId: 'some-change',
  spec: 'some-capability',
  tests: ['some.test.ts'],
  commit: 'abc1234',
  ...over,
});

describe('traceCheck（纯:broken 计入 ok, warnings 不计入）', () => {
  it('空输入 → ok:true, broken:[], warnings:[]', () => {
    expect(traceCheck([])).toEqual({ ok: true, broken: [], warnings: [] });
  });

  it('完整链 → ok:true, broken:[], warnings:[]', () => {
    expect(traceCheck([link({})])).toEqual({ ok: true, broken: [], warnings: [] });
  });

  it('spec 无关联测试(tests=[]) → warnings 含 spec-without-tests, ok 仍 true(不阻断)', () => {
    expect(traceCheck([link({ tests: [] })])).toEqual({
      ok: true,
      broken: [],
      warnings: [{ changeId: 'some-change', kind: 'spec-without-tests' }],
    });
  });

  it('spec 无关联 commit(commit="") → broken 含 spec-without-commit, ok:false', () => {
    expect(traceCheck([link({ commit: '' })])).toEqual({
      ok: false,
      broken: [{ changeId: 'some-change', kind: 'spec-without-commit' }],
      warnings: [],
    });
  });

  it('spec 缺失(spec="") → broken 含 missing-spec, ok:false', () => {
    expect(traceCheck([link({ spec: '' })])).toEqual({
      ok: false,
      broken: [{ changeId: 'some-change', kind: 'missing-spec' }],
      warnings: [],
    });
  });

  it('一条链 spec/tests/commit 全缺 → broken=[missing-spec,spec-without-commit], warnings=[spec-without-tests]', () => {
    const out = traceCheck([link({ spec: '', tests: [], commit: '' })]);
    expect(out.broken).toEqual([
      { changeId: 'some-change', kind: 'missing-spec' },
      { changeId: 'some-change', kind: 'spec-without-commit' },
    ]);
    expect(out.warnings).toEqual([{ changeId: 'some-change', kind: 'spec-without-tests' }]);
    expect(out.ok).toBe(false);
  });

  it('多条链混合 → 按链顺序收集;完整链不产 broken/warnings', () => {
    expect(
      traceCheck([
        link({ changeId: 'a', tests: [] }),
        link({ changeId: 'b', commit: '' }),
        link({ changeId: 'c' }),
      ]),
    ).toEqual({
      ok: false,
      broken: [{ changeId: 'b', kind: 'spec-without-commit' }],
      warnings: [{ changeId: 'a', kind: 'spec-without-tests' }],
    });
  });

  it('warnings 非空但 broken 空 → ok:true（tests=0 不阻断）', () => {
    const out = traceCheck([link({ changeId: 'x', tests: [] })]);
    expect(out.ok).toBe(true);
    expect(out.warnings).toHaveLength(1);
    expect(out.broken).toEqual([]);
  });

  it('kind 枚举仅三种类型(类型层契约)', () => {
    const all: BrokenLink['kind'][] = ['missing-spec', 'spec-without-tests', 'spec-without-commit'];
    expect(all).toHaveLength(3);
  });
});
