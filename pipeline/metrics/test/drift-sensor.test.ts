import { describe, it, expect } from 'vitest';
import { opSequence, levenshtein, seqConsistency, driftAlert, computeDrift, type DriftEvent } from '../src/drift-sensor.js';

const ev = (ts: string, op: string, traceId: string, phase?: string): DriftEvent => ({ ts, op, traceId, ...(phase ? { phase } : {}) });

describe('opSequence（纯:按 ts 排序取 US 的 token 序列）', () => {
  it('按 ts 排序,phase→phase:<role>,其余用 op;只取匹配 traceId', () => {
    const events = [
      ev('2026-06-25T00:00:03Z', 'gate', 'u1'),
      ev('2026-06-25T00:00:01Z', 'phase', 'u1', 'test'),
      ev('2026-06-25T00:00:05Z', 'phase', 'u1', 'review'),
      ev('2026-06-25T00:00:02Z', 'gate', 'u1'),
      ev('2026-06-25T00:00:04Z', 'phase', 'u1', 'dev'),
      ev('2026-06-25T00:00:09Z', 'phase', 'other', 'dev'), // 别的 US → 不算
    ];
    expect(opSequence(events, 'u1')).toEqual(['phase:test', 'gate', 'gate', 'phase:dev', 'phase:review']);
  });

  it('无匹配 traceId → []', () => {
    expect(opSequence([ev('t', 'gate', 'a')], 'u1')).toEqual([]);
  });
});

describe('levenshtein / seqConsistency（纯）', () => {
  it('相同 → dist 0 / consistency 1', () => {
    const s = ['a', 'b', 'c'];
    expect(levenshtein(s, [...s])).toBe(0);
    expect(seqConsistency(s, [...s])).toBe(1);
  });

  it('1 处 token 改动(长 4) → dist 1 / consistency 0.75', () => {
    expect(levenshtein(['a', 'b', 'c', 'd'], ['a', 'x', 'c', 'd'])).toBe(1);
    expect(seqConsistency(['a', 'b', 'c', 'd'], ['a', 'x', 'c', 'd'])).toBe(0.75);
  });

  it('增删 → dist 计正确', () => {
    expect(levenshtein(['a', 'b'], ['a', 'b', 'c'])).toBe(1); // 增一个
    expect(levenshtein(['a', 'b', 'c'], ['a', 'c'])).toBe(1); // 删一个
  });

  it('双空 → 1;一空一非空 → 0', () => {
    expect(seqConsistency([], [])).toBe(1);
    expect(seqConsistency([], ['a', 'b', 'c'])).toBe(0);
  });
});

describe('driftAlert（纯:连续 k 个 < τ 告警）', () => {
  it('连续 k 个低于 τ → alert + 首触发位', () => {
    expect(driftAlert([0.9, 0.7, 0.6, 0.5], 0.75, 3)).toEqual({ alert: true, triggerIndex: 1 });
  });

  it('未连续 k 个 → 不告警', () => {
    expect(driftAlert([0.6, 0.9, 0.6, 0.9], 0.75, 3)).toEqual({ alert: false });
  });

  it('长度 < k → 不告警(数据不足,不臆造)', () => {
    expect(driftAlert([0.5, 0.5], 0.75, 3)).toEqual({ alert: false });
    expect(driftAlert([], 0.75, 3)).toEqual({ alert: false });
  });

  it('默认 τ=0.75 k=3', () => {
    expect(driftAlert([0.7, 0.7, 0.7]).alert).toBe(true);
  });
});

describe('computeDrift（组装:按 US 分组 → 相对基线一致性 → 告警）', () => {
  // 构造一个 US 的事件(3 token 序列;tokens 指定各 op)
  const us = (id: string, tsBase: number, tokens: string[]): DriftEvent[] =>
    tokens.map((tk, i) => ({ ts: `2026-06-25T00:${String(tsBase + i).padStart(2, '0')}:00Z`, op: tk, traceId: id }));

  it('US 数 < k+1 → insufficient-data(诚实,不臆造)', () => {
    const events = [...us('u1', 0, ['a', 'b', 'c']), ...us('u2', 10, ['a', 'b', 'c'])];
    expect(computeDrift(events).status).toBe('insufficient-data');
  });

  it('渐变漂移(相对基线一致性连续跌破 τ)→ 告警', () => {
    const events = [
      ...us('u1', 0, ['a', 'b', 'c']), // 基线
      ...us('u2', 10, ['a', 'b', 'c']), // 一致性 1
      ...us('u3', 20, ['a', 'x', 'c']), // 1-1/3≈0.667 <0.75
      ...us('u4', 30, ['a', 'x', 'y']), // 1-2/3≈0.333
      ...us('u5', 40, ['p', 'q', 'r']), // 0
    ];
    const r = computeDrift(events);
    expect(r.status).toBe('ok');
    expect(r.consistencies[0]).toBe(1); // u2 vs 基线
    expect(r.alert.alert).toBe(true); // 0.667/0.333/0 连续三个 < 0.75
  });

  it('稳定序列 → 不告警', () => {
    const events = [0, 10, 20, 30, 40].map((t) => us(`u${t}`, t, ['a', 'b', 'c'])).flat();
    const r = computeDrift(events);
    expect(r.status).toBe('ok');
    expect(r.alert.alert).toBe(false); // 全 1
  });
});
