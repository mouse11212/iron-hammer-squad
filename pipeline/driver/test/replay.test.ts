import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeEvent } from '../src/events.js';
import { groupByTrace, formatReplay, readEvents } from '../src/replay.js';

const at = (ts: string, traceId: string, op: 'phase' | 'gate' | 'squash' | 'integrate'): ReturnType<typeof makeEvent> =>
  makeEvent({ ts, traceId, op });

describe('groupByTrace（纯:按 traceId 分组，组内按 ts 升序）', () => {
  it('多 traceId 分到各自组', () => {
    const m = groupByTrace([at('t2', 'a', 'gate'), at('t1', 'b', 'phase'), at('t1', 'a', 'phase')]);
    expect([...m.keys()].sort()).toEqual(['a', 'b']);
    expect(m.get('a')!.map((e) => e.ts)).toEqual(['t1', 't2']); // 组内 ts 升序
    expect(m.get('b')!.map((e) => e.op)).toEqual(['phase']);
  });

  it('降序输入 → 严格升序输出(钉死 a>b 比较分支)', () => {
    const m = groupByTrace([at('t3', 'a', 'gate'), at('t2', 'a', 'gate'), at('t1', 'a', 'gate')]);
    expect(m.get('a')!.map((e) => e.ts)).toEqual(['t1', 't2', 't3']);
  });

  it('同 ts 保持输入顺序(钉死相等边界:比较器须返回 0)', () => {
    const m = groupByTrace([at('t1', 'a', 'phase'), at('t1', 'a', 'gate'), at('t1', 'a', 'squash')]);
    expect(m.get('a')!.map((e) => e.op)).toEqual(['phase', 'gate', 'squash']); // 稳定
  });
});

describe('formatReplay（纯:按 ts 排序渲染一个 US 的有序事件链）', () => {
  it('乱序输入 → 输出按 ts 排序，op 序列 phase→gate→squash', () => {
    const out = formatReplay([
      at('2026-06-23T10:00:02Z', 'a', 'squash'),
      at('2026-06-23T10:00:00Z', 'a', 'phase'),
      at('2026-06-23T10:00:01Z', 'a', 'gate'),
    ]);
    expect(out.indexOf('phase')).toBeLessThan(out.indexOf('gate'));
    expect(out.indexOf('gate')).toBeLessThan(out.indexOf('squash'));
  });

  it('全字段事件 → 精确渲染(钉死分隔符/各字段/换行)', () => {
    const out = formatReplay([
      makeEvent({
        ts: '2026-06-23T10:00:00.000Z',
        traceId: 'a',
        op: 'phase',
        phase: 'dev',
        status: 'ok',
        durationMs: 1000,
        payload: { x: 1 },
      }),
    ]);
    expect(out).toBe('[2026-06-23T10:00:00.000Z] phase/dev ok (1000ms) {"x":1}');
  });

  it('最小事件(仅必填)→ 不渲染可选片段(钉死空分支)', () => {
    const out = formatReplay([makeEvent({ ts: '2026-06-23T10:00:00.000Z', traceId: 'a', op: 'squash' })]);
    expect(out).toBe('[2026-06-23T10:00:00.000Z] squash');
  });

  it('多事件 → 用换行连接(钉死 join 分隔符)', () => {
    const out = formatReplay([at('t1', 'a', 'phase'), at('t2', 'a', 'gate')]);
    expect(out.split('\n')).toHaveLength(2);
  });
});

describe('readEvents（薄 IO:逐行 parse，跳畸形行不抛错）', () => {
  it('混入一行非法 JSON → 跳过该行返回其余合法事件', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ih-rep-'));
    try {
      const path = join(dir, 'events.jsonl');
      writeFileSync(
        path,
        ['{"ts":"t1","traceId":"a","op":"phase"}', 'NOT JSON {{{', '', '{"ts":"t2","traceId":"a","op":"gate"}'].join('\n'),
        'utf8',
      );
      const evs = readEvents(path);
      expect(evs.map((e) => e.op)).toEqual(['phase', 'gate']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('文件不存在 → 返回空数组(不抛错)', () => {
    expect(readEvents(join(tmpdir(), 'ih-rep-nope', 'missing.jsonl'))).toEqual([]);
  });
});
