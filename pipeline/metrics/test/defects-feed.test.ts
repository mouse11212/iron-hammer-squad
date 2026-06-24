import { describe, it, expect } from 'vitest';
import { deriveDefects, type Trailer } from '../src/defects-feed.js';

const tr = (commit: string, desc: string): Trailer => ({ commit, desc });

describe('deriveDefects（纯:从 caught/escaped trailer 组装 DefectRecord，两侧对称）', () => {
  it('caught trailer → where:caught,note=desc,id 含 commit', () => {
    const out = deriveDefects([tr('abc1234', 'inner-loop 回修轮 1')], []);
    expect(out).toHaveLength(1);
    expect(out[0]?.where).toBe('caught');
    expect(out[0]?.note).toBe('inner-loop 回修轮 1');
    expect(out[0]?.id).toContain('abc1234');
  });

  it('escaped trailer → where:escaped,note=desc,id 含 commit', () => {
    const out = deriveDefects([], [tr('def5678', '卡片渲染漏 today 过滤')]);
    expect(out).toHaveLength(1);
    expect(out[0]?.where).toBe('escaped');
    expect(out[0]?.note).toBe('卡片渲染漏 today 过滤');
    expect(out[0]?.id).toContain('def5678');
  });

  it('caught + escaped 混合 → 计数对称,顺序 caught 先 escaped 后', () => {
    const out = deriveDefects(
      [tr('c1', '回修轮 1'), tr('c1', '回修轮 2')],
      [tr('e1', '逃逸 A')],
    );
    expect(out.filter((d) => d.where === 'caught')).toHaveLength(2);
    expect(out.filter((d) => d.where === 'escaped')).toHaveLength(1);
    expect(out.map((d) => d.where)).toEqual(['caught', 'caught', 'escaped']);
  });

  it('同 commit 多条 trailer → id 唯一(带序号)', () => {
    const out = deriveDefects([tr('c1', '回修轮 1'), tr('c1', '回修轮 2')], []);
    expect(new Set(out.map((d) => d.id)).size).toBe(2);
  });

  it('两侧皆空 → []', () => {
    expect(deriveDefects([], [])).toEqual([]);
  });
});
