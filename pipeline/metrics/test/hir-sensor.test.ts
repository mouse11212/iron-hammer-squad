import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hir, hirSeries, risingAlert, computeHir, readHirRuns, type HirRun } from '../src/hir-sensor.js';

const run = (ts: string, status: string): HirRun => ({ ts, status });

function withLedger(lines: string[], fn: (path: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'hirledger-'));
  const path = join(dir, 'runs-ledger.jsonl');
  writeFileSync(path, lines.join('\n') + '\n');
  try {
    fn(path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const ledgerLine = (jobId: string, status: string, ts: string): string =>
  JSON.stringify({ jobId, status, fixRounds: 0, costUsd: 0, ts });

describe('hir（纯:干预数/总数,对齐 escalationRate）', () => {
  it('有干预 → 比例', () => {
    const runs = [run('1', 'done'), run('2', 'blocked-escalated'), run('3', 'done'), run('4', 'failed')];
    expect(hir(runs)).toBe(0.25);
  });

  it('全干预 → 1;无干预 → 0', () => {
    expect(hir([run('1', 'blocked-escalated'), run('2', 'blocked-escalated')])).toBe(1);
    expect(hir([run('1', 'done'), run('2', 'failed')])).toBe(0);
  });

  it('无 run → null(不臆造)', () => {
    expect(hir([])).toBeNull();
  });
});

describe('hirSeries（纯:tumbling 满窗 HIR 序列,按 ts 升序）', () => {
  it('切满窗算 HIR(ts 乱序也先排序)', () => {
    const runs = [
      run('2026-06-25T00:00:06Z', 'blocked-escalated'),
      run('2026-06-25T00:00:01Z', 'done'),
      run('2026-06-25T00:00:02Z', 'done'),
      run('2026-06-25T00:00:03Z', 'done'),
      run('2026-06-25T00:00:04Z', 'blocked-escalated'),
      run('2026-06-25T00:00:05Z', 'blocked-escalated'),
    ];
    // 排序后:前 3 条 done(HIR 0),后 3 条 escalated(HIR 1)
    expect(hirSeries(runs, 3)).toEqual([0, 1]);
  });

  it('不足一窗 → [](尾部丢弃)', () => {
    expect(hirSeries([run('1', 'done'), run('2', 'done')], 3)).toEqual([]);
  });

  it('非整除:尾部不足一窗丢弃', () => {
    const runs = [run('1', 'blocked-escalated'), run('2', 'blocked-escalated'), run('3', 'done'), run('4', 'done')];
    expect(hirSeries(runs, 2)).toEqual([1, 0]); // 第 5/6 条不存在,只两满窗
  });
});

describe('risingAlert（纯:连续 k 个 ≥ θ 告警）', () => {
  it('连续 k 个升过 θ → alert + 首触发位', () => {
    expect(risingAlert([0.1, 0.5, 0.6, 0.7], 0.5, 3)).toEqual({ alert: true, triggerIndex: 1 });
  });

  it('未连续 k 个 → 不告警', () => {
    expect(risingAlert([0.6, 0.1, 0.6, 0.1], 0.5, 3)).toEqual({ alert: false });
  });

  it('长度 < k → 不告警(数据不足,不臆造)', () => {
    expect(risingAlert([0.9, 0.9], 0.5, 3)).toEqual({ alert: false });
    expect(risingAlert([], 0.5, 3)).toEqual({ alert: false });
  });

  it('边界:正好等于 θ 也算升过(≥)', () => {
    expect(risingAlert([0.5, 0.5, 0.5], 0.5, 3).alert).toBe(true);
  });
});

describe('computeHir（组装:总率 + 时间窗趋势告警）', () => {
  // 构造 n 条 run,前 frac 比例非干预、其余干预,按 ts 升序
  const ramp = (specs: Array<[number, boolean]>): HirRun[] => {
    let i = 0;
    const out: HirRun[] = [];
    for (const [count, intervened] of specs) {
      for (let j = 0; j < count; j++) {
        out.push(run(`2026-06-25T00:${String(i++).padStart(2, '0')}:00Z`, intervened ? 'blocked-escalated' : 'done'));
      }
    }
    return out;
  };

  it('runs 不足一窗 → insufficient-data(诚实)', () => {
    const r = computeHir([run('1', 'done'), run('2', 'done')], 5, 0.5, 3);
    expect(r.status).toBe('insufficient-data');
    expect(r.alert.alert).toBe(false);
  });

  it('渐升干预(连续 k 窗 ≥ θ)→ 告警', () => {
    // window=2,θ=0.5,k=3:窗序列需连续 3 个 ≥0.5。10 条→5 窗:[0,0,0.5,1,1],尾 3 窗 ≥0.5
    const runs = ramp([[4, false], [1, true], [1, false], [4, true]]); // 10 条
    const r = computeHir(runs, 2, 0.5, 3);
    expect(r.status).toBe('ok');
    expect(r.alert.alert).toBe(true);
  });

  it('稳定低干预 → 不告警', () => {
    const runs = ramp([[10, false]]); // 全 done
    const r = computeHir(runs, 2, 0.5, 3);
    expect(r.status).toBe('ok');
    expect(r.rate).toBe(0);
    expect(r.alert.alert).toBe(false);
  });
});

describe('readHirRuns（薄 IO:保 ts + 按 jobId 去重）', () => {
  it('缺文件 → [](不抛,不臆造)', () => {
    expect(readHirRuns(join(tmpdir(), 'no-such-hir-ledger.jsonl'))).toEqual([]);
  });

  it('多条 → HirRun[](保 ts/status)', () => {
    withLedger([ledgerLine('j1', 'done', 't1'), ledgerLine('j2', 'blocked-escalated', 't2')], (p) => {
      const out = readHirRuns(p);
      expect(out).toHaveLength(2);
      expect(out).toContainEqual({ ts: 't1', status: 'done' });
      expect(out).toContainEqual({ ts: 't2', status: 'blocked-escalated' });
    });
  });

  it('同 jobId 重复 → 后写覆盖(对齐 escalationRate 去重语义)', () => {
    withLedger([ledgerLine('j1', 'failed', 't1'), ledgerLine('j1', 'blocked-escalated', 't2')], (p) => {
      const out = readHirRuns(p);
      expect(out).toHaveLength(1);
      expect(out[0]?.status).toBe('blocked-escalated');
      expect(out[0]?.ts).toBe('t2');
    });
  });

  it('跳畸形行 / 缺字段行', () => {
    withLedger([ledgerLine('j1', 'done', 't1'), '{坏 json', JSON.stringify({ jobId: 'j3', ts: 't3' })], (p) => {
      const out = readHirRuns(p);
      expect(out).toHaveLength(1); // 只 j1 合法(j3 缺 status)
      expect(out[0]?.status).toBe('done');
    });
  });
});
