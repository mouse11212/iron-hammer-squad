import { describe, it, expect } from 'vitest';
import { deriveDefects, type DefectRunInput } from '../src/defects-feed.js';

const run = (over: Partial<DefectRunInput>): DefectRunInput => ({
  jobId: 'job-1',
  status: 'done',
  fixRounds: 0,
  ...over,
});

describe('deriveDefects（纯:从 run + trailer 组装 DefectRecord）', () => {
  it('done run fixRounds:2 → 2 条 caught,id 含 jobId', () => {
    const out = deriveDefects([run({ jobId: 'job-x', fixRounds: 2 })], []);
    expect(out).toHaveLength(2);
    expect(out.every((d) => d.where === 'caught')).toBe(true);
    expect(out.every((d) => d.id.includes('job-x'))).toBe(true);
    expect(new Set(out.map((d) => d.id)).size).toBe(2); // id 唯一
  });

  it('fixRounds:0 无 residual → 干净 run 不产缺陷', () => {
    const out = deriveDefects([run({ fixRounds: 0 })], []);
    expect(out).toEqual([]);
  });

  it('blocked-escalated fixRounds:1 + residualCount:2 → 3 条 caught', () => {
    const out = deriveDefects([run({ jobId: 'job-e', status: 'blocked-escalated', fixRounds: 1, residualCount: 2 })], []);
    expect(out).toHaveLength(3);
    expect(out.every((d) => d.where === 'caught')).toBe(true);
    expect(new Set(out.map((d) => d.id)).size).toBe(3);
  });

  it('escape trailer → 1 条 escaped,where/note/id 正确', () => {
    const out = deriveDefects([], [{ commit: 'abc123', desc: '卡片渲染漏 today 过滤' }]);
    expect(out).toHaveLength(1);
    expect(out[0]?.where).toBe('escaped');
    expect(out[0]?.note).toBe('卡片渲染漏 today 过滤');
    expect(out[0]?.id).toContain('abc123');
  });

  it('两侧皆空 → []', () => {
    expect(deriveDefects([], [])).toEqual([]);
  });

  it('caught + escaped 混合 → 计数正确(顺序:caught 先, escaped 后)', () => {
    const out = deriveDefects(
      [run({ jobId: 'j1', fixRounds: 1 }), run({ jobId: 'j2', fixRounds: 0 })],
      [{ commit: 'c1', desc: 'd1' }, { commit: 'c2', desc: 'd2' }],
    );
    expect(out.filter((d) => d.where === 'caught')).toHaveLength(1);
    expect(out.filter((d) => d.where === 'escaped')).toHaveLength(2);
  });
});
