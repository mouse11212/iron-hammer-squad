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
  implementationMs: null,
  defectEscapeRate: 0,
  defects: { total: 3, escaped: 0 },
  traces,
  taxByTrace: [],
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
  it('无 inner-loop 数据时不渲染该区块', () => {
    expect(renderBoard(snap)).not.toContain('inner-loop');
  });
  it('无 taxByTrace 数据时不渲染「按 US」区块', () => {
    expect(renderBoard(snap)).not.toContain('按 US');
  });
  it('有 Verification Tax 真值时显示实现/验证 ms 与 per-US 明细', () => {
    const md = renderBoard({
      ...snap,
      verificationTax: 0.75,
      verificationMs: 300,
      implementationMs: 100,
      taxByTrace: [{ traceId: 'job-1', implementationMs: 100, verificationMs: 300, tax: 0.75 }],
    });
    expect(md).toMatch(/Verification Tax.*75\.0%/);
    expect(md).toContain('验证 300ms / 实现 100ms');
    expect(md).toContain('按 US');
    expect(md).toContain('job-1');
  });
  it('有 inner-loop 数据时渲染 KPI(运行数/状态/升级率/回修分布/成本)', () => {
    const md = renderBoard({
      ...snap,
      innerLoop: {
        total: 3,
        byStatus: { done: 2, failed: 0, blockedEscalated: 1 },
        escalationRate: 1 / 3,
        fixRoundsDistribution: { 0: 1, 1: 2 },
        totalCostUsd: 1.23,
        avgCostUsd: 0.41,
      },
    });
    expect(md).toContain('inner-loop');
    expect(md).toContain('done 2');
    expect(md).toMatch(/升级率.*33\.3%/);
    expect(md).toContain('1.23'); // 总成本
    expect(md).toContain('0:1'); // 回修轮次分布
    expect(md).toContain('1:2');
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
