import { describe, it, expect } from 'vitest';
import { aggregatePhaseMs } from '../src/aggregate-phase-ms.js';
import type { Event } from '../src/events.js';

const ev = (over: Partial<Event>): Event => ({ ts: '2026-06-24T00:00:00Z', traceId: 'job-x', op: 'phase', ...over });

describe('aggregatePhaseMs（纯:按 op 分类累加本 run 的 durationMs，不应用 impl/verif 口径）', () => {
  it('按 op 分类累加(phase 用 phase 名,其余用 op),只算匹配 traceId', () => {
    const out = aggregatePhaseMs(
      [
        ev({ op: 'phase', phase: 'dev', durationMs: 95000 }),
        ev({ op: 'phase', phase: 'test', durationMs: 113000 }),
        ev({ op: 'phase', phase: 'dev', durationMs: 5000 }), // 同类累加
        ev({ op: 'gate', durationMs: 12000 }),
        ev({ op: 'orchestrator-fix', durationMs: 5000 }),
        ev({ traceId: 'other', op: 'phase', phase: 'dev', durationMs: 99999 }), // 别的 run → 不算
      ],
      'job-x',
    );
    expect(out).toEqual({ dev: 100000, test: 113000, gate: 12000, 'orchestrator-fix': 5000 });
  });

  it('缺 durationMs 的事件跳过', () => {
    const out = aggregatePhaseMs([ev({ op: 'phase', phase: 'dev' }), ev({ op: 'gate', durationMs: 10 })], 'job-x');
    expect(out).toEqual({ gate: 10 });
  });

  it('无匹配 traceId → {}', () => {
    expect(aggregatePhaseMs([ev({ traceId: 'a', op: 'gate', durationMs: 1 })], 'job-x')).toEqual({});
  });
});
