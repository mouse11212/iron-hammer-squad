import { existsSync, readFileSync } from 'node:fs';

// 人工干预率（HIR）drift sensor（M7-b）。
// KB（arXiv:2601.04170）把 Human Intervention Rate 列为 ASI 的 drift「终极指标」(~200 交互后 +216%)。
// 系统已有 escalationRate(全时段标量,无时间维),无法测 drift 趋势——本 sensor 给同一「干预」定义
// 加时间窗趋势 + 上升告警,复用 M7-a「连续 k 窗」框架(反向:HIR 升过 θ 告警)。
// 全确定性纯函数 + 组装;无数据 → insufficient-data,不臆造已发生干预上升(红线1)。

/** runs-ledger 行的最小投影(对齐 RunLedgerRecord 的 ts/status)。 */
export interface HirRun {
  ts: string;
  status: string;
}

/** 干预终态:红线6 显式升级人类(blocked-escalated 是 inner-loop 唯一「交还人类」终态)。 */
const INTERVENED = 'blocked-escalated';

/**
 * 纯:人工干预率 = 干预数 / 总数。总数 0 → null(不臆造,同 avgCostUsd)。
 * 定义对齐既有 InnerLoopStats.escalationRate(单一真相)。
 */
export function hir(runs: HirRun[]): number | null {
  if (runs.length === 0) return null;
  const intervened = runs.filter((r) => r.status === INTERVENED).length;
  return intervened / runs.length;
}

/**
 * 纯:按 ts 升序排序 → 切不重叠(tumbling)窗 → 每个满窗算 HIR,返回 number[]。
 * 不足一窗的尾部丢弃。给 HIR 加时间维度,使其可测 drift 趋势。
 */
export function hirSeries(runs: HirRun[], windowSize: number): number[] {
  if (windowSize <= 0) return [];
  const sorted = [...runs].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
  const out: number[] = [];
  for (let i = 0; i + windowSize <= sorted.length; i += windowSize) {
    const win = sorted.slice(i, i + windowSize);
    out.push(hir(win) ?? 0); // 满窗必非空,?? 仅为类型收窄
  }
  return out;
}

/**
 * 纯:连续 k 个值 ≥ theta → alert + 首触发位;不足 k → 不告警(数据不足,不臆造)。
 * M7-a driftAlert「跌破 τ」的上升方向镜像(HIR 升过 θ = drift)。
 */
export function risingAlert(series: number[], theta: number, k: number): { alert: boolean; triggerIndex?: number } {
  let streak = 0;
  for (let i = 0; i < series.length; i++) {
    if ((series[i] ?? -Infinity) >= theta) {
      streak++;
      if (streak >= k) return { alert: true, triggerIndex: i - k + 1 };
    } else {
      streak = 0;
    }
  }
  return { alert: false };
}

export interface HirReport {
  status: 'ok' | 'insufficient-data';
  rate: number | null;
  series: number[];
  alert: { alert: boolean; triggerIndex?: number };
}

/**
 * 组装:从 run 记录算 HIR 总率 + 时间窗序列 + 上升趋势告警。
 * runs 不足一窗(< windowSize) → insufficient-data(诚实,不臆造已发生干预上升)。
 * 默认 windowSize=5 / theta=0.5 为**保守占位待长程标定**(KB 未给 HIR 绝对阈值);k=3 用 KB「连续三窗」。
 */
export function computeHir(runs: HirRun[], windowSize = 5, theta = 0.5, k = 3): HirReport {
  if (runs.length < windowSize) {
    return { status: 'insufficient-data', rate: hir(runs), series: [], alert: { alert: false } };
  }
  const series = hirSeries(runs, windowSize);
  return { status: 'ok', rate: hir(runs), series, alert: risingAlert(series, theta, k) };
}

/**
 * 薄 IO:逐行 parse runs-ledger.jsonl,**保 ts**(窗口排序需要)+ 按 jobId 去重(后写覆盖,
 * 对齐 readRunLedger/escalationRate 的幂等语义),跳畸形/缺字段行。缺文件 → [](不抛,不臆造)。
 * 注:既有 readRunLedger 的投影丢了 ts,无法做时间窗,故本 sensor 用专用 reader(同 M7-a readDriftEvents)。
 */
export function readHirRuns(path: string): HirRun[] {
  if (!existsSync(path)) return [];
  const byJob = new Map<string, HirRun>();
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    let rec: { jobId?: unknown; status?: unknown; ts?: unknown };
    try {
      rec = JSON.parse(t) as typeof rec;
    } catch {
      continue; // 畸形行跳过
    }
    if (typeof rec.jobId !== 'string' || typeof rec.status !== 'string' || typeof rec.ts !== 'string') continue;
    byJob.set(rec.jobId, { ts: rec.ts, status: rec.status });
  }
  return [...byJob.values()];
}
