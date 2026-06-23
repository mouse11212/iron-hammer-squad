import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeEvent, makeEventSink } from '../src/events.js';

describe('makeEvent（纯:确定性构造统一操作事件，时钟注入、无 IO）', () => {
  it('构造一条 phase 事件:含全部传入字段，ts 用注入值(不读系统时钟)', () => {
    const ev = makeEvent({
      ts: '2026-06-23T10:00:00.000Z',
      traceId: 'job-1',
      op: 'phase',
      phase: 'dev',
      status: 'ok',
      durationMs: 1234,
      payload: { attempt: 0, resumed: false, exitCode: 0 },
    });
    expect(ev).toEqual({
      ts: '2026-06-23T10:00:00.000Z',
      traceId: 'job-1',
      op: 'phase',
      phase: 'dev',
      status: 'ok',
      durationMs: 1234,
      payload: { attempt: 0, resumed: false, exitCode: 0 },
    });
  });

  it('可选字段缺省:仅传必填(ts/traceId/op)→ 不臆造 phase/status/durationMs/payload 键', () => {
    const ev = makeEvent({ ts: '2026-06-23T10:00:00.000Z', traceId: 'job-1', op: 'squash' });
    expect(ev).toEqual({ ts: '2026-06-23T10:00:00.000Z', traceId: 'job-1', op: 'squash' });
    expect('phase' in ev).toBe(false);
    expect('status' in ev).toBe(false);
    expect('durationMs' in ev).toBe(false);
    expect('payload' in ev).toBe(false);
  });
});

describe('makeEventSink（薄 IO:append-only 单行 JSON，建目录、不动既有行）', () => {
  const ev = (traceId: string, op: 'phase' | 'squash'): ReturnType<typeof makeEvent> =>
    makeEvent({ ts: '2026-06-23T10:00:00.000Z', traceId, op });

  it('追加一条:目标目录不存在时先建，文件末尾新增恰好一行合法 JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ih-evt-'));
    try {
      const path = join(dir, 'nested', 'events.jsonl'); // nested 不存在 → sink 须 mkdir -p
      makeEventSink(path)(ev('job-1', 'phase'));
      const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean);
      expect(lines.length).toBe(1);
      expect(JSON.parse(lines[0]!)).toEqual({ ts: '2026-06-23T10:00:00.000Z', traceId: 'job-1', op: 'phase' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('对已有内容追加:既有行不被改动，新行追加在末尾', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ih-evt-'));
    try {
      const path = join(dir, 'events.jsonl');
      writeFileSync(path, '{"pre":true}\n', 'utf8');
      makeEventSink(path)(ev('job-2', 'squash'));
      const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean);
      expect(lines.length).toBe(2);
      expect(JSON.parse(lines[0]!)).toEqual({ pre: true });
      expect(JSON.parse(lines[1]!).traceId).toBe('job-2');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('多次写入保持顺序，每行可独立解析', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ih-evt-'));
    try {
      const path = join(dir, 'events.jsonl');
      const sink = makeEventSink(path);
      sink(ev('a', 'phase'));
      sink(ev('b', 'phase'));
      sink(ev('c', 'squash'));
      const ids = readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).traceId);
      expect(ids).toEqual(['a', 'b', 'c']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
