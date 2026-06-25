import { describe, it, expect } from 'vitest';
import {
  cosine,
  semanticConsistencySeries,
  computeSemanticDrift,
  type EmbedFn,
  type SemanticResponse,
} from '../src/semantic-sensor.js';

describe('cosine（纯:余弦相似度）', () => {
  it('同向 → 1', () => {
    expect(cosine([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
    expect(cosine([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 10); // 同向不同模
  });

  it('正交 → 0', () => {
    expect(cosine([1, 0], [0, 1])).toBe(0);
  });

  it('反向 → -1', () => {
    expect(cosine([1, 0], [-1, 0])).toBeCloseTo(-1, 10);
  });

  it('零向量 → 0(不臆造,避免 0/0)', () => {
    expect(cosine([0, 0], [1, 2])).toBe(0);
    expect(cosine([1, 2], [0, 0])).toBe(0);
  });

  it('维度不等 → 抛(契约违例,不静默吞)', () => {
    expect(() => cosine([1, 2], [1, 2, 3])).toThrow();
  });
});

describe('semanticConsistencySeries（纯:相对首基线 cosine）', () => {
  it('相对基线序列', () => {
    const base = [1, 0];
    const out = semanticConsistencySeries([base, [1, 0], [0, 1]]); // 同基线→1, 正交→0
    expect(out).toEqual([1, 0]);
  });

  it('不足 2 向量 → []', () => {
    expect(semanticConsistencySeries([])).toEqual([]);
    expect(semanticConsistencySeries([[1, 2]])).toEqual([]);
  });
});

describe('computeSemanticDrift（组装:注入 embed + 告警）', () => {
  const resp = (ts: string, text: string): SemanticResponse => ({ ts, traceId: 'u1', text });
  // 合成 embed:把 text 当作 "x,y" 解析为二维向量(测试自带 embedding,不依赖真模型)
  const fakeEmbed: EmbedFn = (text) => text.split(',').map(Number);

  it('无 embed provider → insufficient-data(不臆造)', () => {
    const r = computeSemanticDrift([resp('1', '1,0'), resp('2', '1,0')]);
    expect(r.status).toBe('insufficient-data');
    expect(r.alert.alert).toBe(false);
  });

  it('响应不足 2 → insufficient-data', () => {
    const r = computeSemanticDrift([resp('1', '1,0')], fakeEmbed);
    expect(r.status).toBe('insufficient-data');
  });

  it('渐进语义偏离(相对基线一致性连续 k 窗跌破 τ)→ 告警', () => {
    // 基线 [1,0];逐步旋转偏离:cos≈0.6/0.3/0(连续三个 <0.75)
    const responses = [
      resp('2026-06-25T00:00:01Z', '1,0'), // 基线
      resp('2026-06-25T00:00:02Z', '0.6,0.8'), // cos 0.6 <0.75
      resp('2026-06-25T00:00:03Z', '0.3,0.95'), // cos≈0.3
      resp('2026-06-25T00:00:04Z', '0,1'), // cos 0
    ];
    const r = computeSemanticDrift(responses, fakeEmbed, 0.75, 3);
    expect(r.status).toBe('ok');
    expect(r.alert.alert).toBe(true);
  });

  it('语义稳定 → 不告警', () => {
    const responses = [
      resp('2026-06-25T00:00:01Z', '1,0'),
      resp('2026-06-25T00:00:02Z', '1,0'),
      resp('2026-06-25T00:00:03Z', '1,0'),
      resp('2026-06-25T00:00:04Z', '1,0'),
    ];
    const r = computeSemanticDrift(responses, fakeEmbed, 0.75, 3);
    expect(r.status).toBe('ok');
    expect(r.alert.alert).toBe(false);
  });

  it('ts 乱序 → 先按 ts 排序再算', () => {
    const responses = [
      resp('2026-06-25T00:00:04Z', '0,1'),
      resp('2026-06-25T00:00:01Z', '1,0'), // 真正的基线(最早)
      resp('2026-06-25T00:00:02Z', '1,0'),
    ];
    const r = computeSemanticDrift(responses, fakeEmbed, 0.75, 3);
    // 排序后基线=[1,0],序列=[cos(1,0 vs 1,0)=1, cos(0,1 vs 1,0)=0]
    expect(r.consistencies).toEqual([1, 0]);
  });
});
