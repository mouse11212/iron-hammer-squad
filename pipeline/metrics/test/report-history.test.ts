import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { historySnapshot, appendHistory, readHistory } from '../src/report-history.js';
import type { MetricsSnapshot } from '../src/types.js';

const snap: MetricsSnapshot = {
  generatedAt: '2026-06-24T00:00:00Z',
  taskResolutionRate: 1,
  resolved: 23,
  attempted: 23,
  codeChurn: { added: 100, removed: 10, total: 110, files: 12 },
  verificationTax: null,
  verificationMs: null,
  implementationMs: null,
  defectEscapeRate: 0.25,
  defects: { total: 4, escaped: 1 },
  traces: [{ changeId: 'c', spec: 's', tests: ['t.test.ts'], commit: 'abc' }],
  taxByTrace: [{ traceId: 'x', implementationMs: 1, verificationMs: 2, tax: 0.66 }],
};

describe('historySnapshot（纯:投影 slim 趋势记录）', () => {
  it('只保留趋势 KPI,null 保留,不含 traces/taxByTrace 大字段', () => {
    const rec = historySnapshot(snap);
    expect(rec).toEqual({
      generatedAt: '2026-06-24T00:00:00Z',
      taskResolutionRate: 1,
      verificationTax: null,
      defectEscapeRate: 0.25,
      codeChurnTotal: 110,
      resolved: 23,
      attempted: 23,
    });
    expect(rec).not.toHaveProperty('traces');
    expect(rec).not.toHaveProperty('taxByTrace');
  });
});

describe('readHistory（薄 IO:逐行 parse、跳畸形、缺文件 []）', () => {
  it('合法行 → HistoryRecord[],跳畸形行', () => {
    const dir = mkdtempSync(join(tmpdir(), 'history-'));
    const path = join(dir, 'history.jsonl');
    writeFileSync(path, [JSON.stringify(historySnapshot(snap)), '{畸形', JSON.stringify(historySnapshot(snap))].join('\n') + '\n');
    try {
      expect(readHistory(path)).toHaveLength(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('appendHistory 追加一行,readHistory 读回', () => {
    const dir = mkdtempSync(join(tmpdir(), 'history-'));
    const path = join(dir, 'history.jsonl');
    try {
      appendHistory(path, historySnapshot(snap));
      appendHistory(path, historySnapshot({ ...snap, generatedAt: '2026-06-25T00:00:00Z' }));
      const out = readHistory(path);
      expect(out).toHaveLength(2);
      expect(out[1]?.generatedAt).toBe('2026-06-25T00:00:00Z');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('缺文件 → []', () => {
    expect(readHistory('/nonexistent/history.jsonl')).toEqual([]);
  });
});
