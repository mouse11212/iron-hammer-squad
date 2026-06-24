import { describe, it, expect } from 'vitest';
import { parsePhaseMsTrailer } from '../src/events-tax.js';

describe('parsePhaseMsTrailer（纯:Metrics-Phase-Ms trailer 值 → 还原最小 TaxEvent[]）', () => {
  it('phase 类(dev/test/review)→ op:phase+phase 名;op 类(gate/orchestrator-fix)→ op=cat', () => {
    const out = parsePhaseMsTrailer('dev=95000 test=113000 review=476000 gate=12000 orchestrator-fix=5000', 'c1');
    expect(out).toEqual([
      { op: 'phase', phase: 'dev', durationMs: 95000, traceId: 'c1' },
      { op: 'phase', phase: 'test', durationMs: 113000, traceId: 'c1' },
      { op: 'phase', phase: 'review', durationMs: 476000, traceId: 'c1' },
      { op: 'gate', durationMs: 12000, traceId: 'c1' },
      { op: 'orchestrator-fix', durationMs: 5000, traceId: 'c1' },
    ]);
  });

  it('畸形片段跳过(无 = / 非数字 ms)', () => {
    const out = parsePhaseMsTrailer('dev=95000 garbage test=abc gate=12000', 'c1');
    expect(out).toEqual([
      { op: 'phase', phase: 'dev', durationMs: 95000, traceId: 'c1' },
      { op: 'gate', durationMs: 12000, traceId: 'c1' },
    ]);
  });

  it('空值 → []', () => {
    expect(parsePhaseMsTrailer('', 'c1')).toEqual([]);
  });
});
