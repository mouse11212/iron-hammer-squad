import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { categorizeDuration, taxByTrace, readEventsJsonl, type TaxEvent } from '../src/events-tax.js';

const ev = (op: string, durationMs: number | undefined, phase?: string, traceId = 't1'): TaxEvent => ({
  op,
  ...(phase ? { phase } : {}),
  ...(durationMs !== undefined ? { durationMs } : {}),
  traceId,
});

describe('categorizeDuration（纯:按 D1 口径累加实现/验证耗时）', () => {
  it('dev→实现;test/review/gate/orchestrator-fix→验证;squash/integrate 不计', () => {
    const split = categorizeDuration([
      ev('phase', 100, 'dev'),
      ev('phase', 50, 'dev'), // 回修 dev 也累加
      ev('phase', 200, 'test'),
      ev('phase', 300, 'review'),
      ev('gate', 10),
      ev('orchestrator-fix', 5),
      ev('squash', undefined), // 无 durationMs 不计
      ev('integrate', undefined),
    ]);
    expect(split).toEqual({ implementationMs: 150, verificationMs: 515 });
  });

  it('跳过缺 durationMs 的事件(即便是 dev/gate)', () => {
    const split = categorizeDuration([ev('phase', undefined, 'dev'), ev('gate', undefined), ev('phase', 40, 'dev')]);
    expect(split).toEqual({ implementationMs: 40, verificationMs: 0 });
  });

  it('空列表 → 全 0(不臆造)', () => {
    expect(categorizeDuration([])).toEqual({ implementationMs: 0, verificationMs: 0 });
  });

  it('未知 op 不计入任何类', () => {
    expect(categorizeDuration([ev('unknown', 999)])).toEqual({ implementationMs: 0, verificationMs: 0 });
  });

  it('phase 但非 dev/test/review(异常 phase)不计入', () => {
    expect(categorizeDuration([ev('phase', 999, 'weird')])).toEqual({ implementationMs: 0, verificationMs: 0 });
  });
});

describe('taxByTrace（纯:按 traceId 分组算 tax）', () => {
  it('多 US 各自累加并算 tax(=验证/(验证+实现))', () => {
    const m = taxByTrace([
      ev('phase', 100, 'dev', 'A'),
      ev('gate', 300, undefined, 'A'), // A: impl100 verif300 → tax 0.75
      ev('phase', 200, 'dev', 'B'),
      ev('phase', 200, 'review', 'B'), // B: impl200 verif200 → tax 0.5
    ]);
    expect(m.get('A')).toEqual({ implementationMs: 100, verificationMs: 300, tax: 0.75 });
    expect(m.get('B')).toEqual({ implementationMs: 200, verificationMs: 200, tax: 0.5 });
  });

  it('某 US 无实现事件 → tax=null(待埋点语义,不臆造)', () => {
    const m = taxByTrace([ev('gate', 100, undefined, 'C')]);
    expect(m.get('C')).toEqual({ implementationMs: 0, verificationMs: 100, tax: null });
  });
});

describe('readEventsJsonl（薄 IO:逐行 parse、跳畸形行、缺文件→[]）', () => {
  it('混入畸形行 → 跳过返回其余合法事件', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ih-tax-'));
    try {
      const path = join(dir, 'events.jsonl');
      writeFileSync(
        path,
        ['{"op":"phase","phase":"dev","durationMs":10,"traceId":"a"}', 'BAD{{{', '', '{"op":"gate","durationMs":5,"traceId":"a"}'].join('\n'),
        'utf8',
      );
      expect(readEventsJsonl(path).map((e) => e.op)).toEqual(['phase', 'gate']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('文件不存在 → []', () => {
    expect(readEventsJsonl(join(tmpdir(), 'ih-tax-none', 'x.jsonl'))).toEqual([]);
  });
});
