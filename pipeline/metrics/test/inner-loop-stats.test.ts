import { describe, it, expect } from 'vitest';
import { innerLoopStats } from '../src/compute.js';
import type { InnerLoopRunRecord } from '../src/types.js';

const rec = (over: Partial<InnerLoopRunRecord>): InnerLoopRunRecord => ({
  jobId: 'j',
  status: 'done',
  fixRounds: 0,
  ...over,
});

describe('innerLoopStats（纯聚合 inner-loop 运行 KPI）', () => {
  it('空输入 → 全零,均成本 null,升级率 0(不除零)', () => {
    const s = innerLoopStats([]);
    expect(s.total).toBe(0);
    expect(s.escalationRate).toBe(0);
    expect(s.avgCostUsd).toBeNull();
    expect(s.byStatus).toEqual({ done: 0, failed: 0, blockedEscalated: 0 });
  });

  it('按状态分类计数', () => {
    const s = innerLoopStats([
      rec({ status: 'done' }),
      rec({ status: 'done' }),
      rec({ status: 'failed' }),
      rec({ status: 'blocked-escalated' }),
    ]);
    expect(s.total).toBe(4);
    expect(s.byStatus).toEqual({ done: 2, failed: 1, blockedEscalated: 1 });
  });

  it('升级率 = blocked-escalated / 总', () => {
    const s = innerLoopStats([rec({ status: 'blocked-escalated' }), rec({ status: 'done' })]);
    expect(s.escalationRate).toBe(0.5);
  });

  it('回修轮次分布', () => {
    const s = innerLoopStats([rec({ fixRounds: 0 }), rec({ fixRounds: 0 }), rec({ fixRounds: 1 })]);
    expect(s.fixRoundsDistribution).toEqual({ 0: 2, 1: 1 });
  });

  it('成本累加 + 均值', () => {
    const s = innerLoopStats([rec({ costUsd: 0.1 }), rec({ costUsd: 0.3 })]);
    expect(s.totalCostUsd).toBeCloseTo(0.4, 6);
    expect(s.avgCostUsd).toBeCloseTo(0.2, 6);
  });

  it('缺 costUsd 的记录按 0 计入累加', () => {
    const s = innerLoopStats([rec({ costUsd: 0.2 }), rec({})]);
    expect(s.totalCostUsd).toBeCloseTo(0.2, 6);
  });
});
