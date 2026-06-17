import { describe, it, expect } from 'vitest';
import { renderBoard } from '../src/board.js';
import { forward, reverse } from '../src/trace.js';
import type { MetricsSnapshot, TraceLink } from '../src/types.js';

const traces: TraceLink[] = [
  { changeId: 'm0', spec: 'news-fetch', tests: ['parse.test.ts'], commit: 'adbac4a' },
  { changeId: 'm1', spec: 'mutation-gate', tests: ['stryker'], commit: '1504b19' },
];

const snap: MetricsSnapshot = {
  generatedAt: '2026-06-17T00:00:00.000Z',
  taskResolutionRate: 1,
  resolved: 5,
  attempted: 5,
  codeChurn: { added: 100, removed: 10, total: 110, files: 12 },
  verificationTax: null,
  verificationMs: 1700,
  defectEscapeRate: 0,
  defects: { total: 3, escaped: 0 },
  traces,
};

describe('看板渲染(纯函数)', () => {
  it('含四指标表与追溯链表', () => {
    const md = renderBoard(snap);
    expect(md).toContain('Task Resolution Rate');
    expect(md).toContain('Code Churn');
    expect(md).toContain('Verification Tax');
    expect(md).toContain('Defect Escape Rate');
    expect(md).toContain('adbac4a'); // 追溯链 commit
    expect(md).toContain('news-fetch');
  });
  it('缺口指标显示"待埋点"而非伪造数值', () => {
    const md = renderBoard(snap);
    expect(md).toMatch(/Verification Tax.*待埋点/s);
    expect(md).not.toContain('Verification Tax | null');
  });
});

describe('追溯链 正/反查(纯函数)', () => {
  it('正向:spec/change → tests+commit', () => {
    expect(forward(traces, 'm1')?.commit).toBe('1504b19');
    expect(forward(traces, 'mutation-gate')?.commit).toBe('1504b19');
  });
  it('反向:commit → change/spec', () => {
    expect(reverse(traces, 'adbac4a')?.spec).toBe('news-fetch');
  });
  it('查不到返回 undefined', () => {
    expect(forward(traces, 'nope')).toBeUndefined();
    expect(reverse(traces, 'zzz')).toBeUndefined();
  });
});
