import { existsSync, readFileSync } from 'node:fs';

// M7 drift 监控首切片:Tool Sequencing Consistency sensor(Levenshtein)+ 滚动窗口 τ 告警框架。
// KB 接地(agent-drift / arxiv-agent-drift-2026, ASI 框架):Behavioral 类 Tool Sequencing Consistency 用 Levenshtein;
// τ=0.75 连续三窗触发。纯函数无 IO;诚实:无长程数据→不告警(不臆造已发生 drift)。

/** drift 所需的最小事件形状(events.jsonl 的稳定子集;含 ts 以排序)。 */
export interface DriftEvent {
  ts: string;
  op: string;
  phase?: string;
  traceId: string;
}

/** 纯:取一个 US(traceId)的 op token 序列,按 ts 升序;token = phase 事件用 `phase:<role>`,否则 op。 */
export function opSequence(events: DriftEvent[], traceId: string): string[] {
  return events
    .filter((e) => e.traceId === traceId)
    .slice()
    .sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0))
    .map((e) => (e.op === 'phase' && e.phase !== undefined ? `phase:${e.phase}` : e.op));
}

/** 纯:token 数组的 Levenshtein 编辑距离(经典 DP)。 */
export function levenshtein(a: string[], b: string[]): number {
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i, ...Array<number>(n).fill(0)];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min((cur[j - 1] ?? 0) + 1, (prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    prev = cur;
  }
  return prev[n] ?? 0;
}

/** 纯:归一化一致性 `1 - dist/max(len)` ∈[0,1](1=完全一致;双空=1;一空一非空=0)。 */
export function seqConsistency(a: string[], b: string[]): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1; // 双空 = 完全一致
  return 1 - levenshtein(a, b) / maxLen;
}

/** 滚动窗口漂移告警结果。 */
export interface DriftAlertResult {
  alert: boolean;
  /** alert 时连续低于 τ 的起始位(series 下标)。 */
  triggerIndex?: number;
}

/**
 * 纯:一致性序列中存在**连续 k 个** < tau 即告警(KB「τ=0.75 连续三窗触发」),报首触发位。
 * 长度 < k(数据不足)→ 不告警(不臆造已发生 drift)。
 */
export function driftAlert(series: number[], tau = 0.75, k = 3): DriftAlertResult {
  if (series.length < k) return { alert: false };
  let run = 0;
  for (let i = 0; i < series.length; i++) {
    run = (series[i] ?? Infinity) < tau ? run + 1 : 0;
    if (run >= k) return { alert: true, triggerIndex: i - k + 1 };
  }
  return { alert: false };
}

// ── 薄 IO + 组装 ──────────────

/** drift 采集结果(诚实:无足够数据时 status='待长程数据')。 */
export interface DriftReport {
  status: 'ok' | 'insufficient-data';
  /** 各 US 相对基线的一致性序列。 */
  consistencies: number[];
  alert: DriftAlertResult;
}

/** 薄 IO:逐行读 events.jsonl 为 DriftEvent[](跳畸形,缺文件 [])。 */
export function readDriftEvents(path: string): DriftEvent[] {
  if (!existsSync(path)) return [];
  const out: DriftEvent[] = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      const o = JSON.parse(t) as Partial<DriftEvent>;
      if (typeof o.ts === 'string' && typeof o.op === 'string' && typeof o.traceId === 'string') {
        out.push({ ts: o.ts, op: o.op, traceId: o.traceId, ...(typeof o.phase === 'string' ? { phase: o.phase } : {}) });
      }
    } catch {
      continue;
    }
  }
  return out;
}

/**
 * 组装:按 traceId 分组 → 各 US op 序列(按首事件 ts 排序)→ 相对基线(首 US)算一致性序列 → driftAlert。
 * US 数 < k+1(不足以判连续漂移)→ status='insufficient-data'(诚实,不臆造)。
 */
export function computeDrift(events: DriftEvent[], tau = 0.75, k = 3): DriftReport {
  // 各 traceId 的首事件 ts(用于按 US 时间排序)
  const firstTs = new Map<string, string>();
  for (const e of events) {
    const cur = firstTs.get(e.traceId);
    if (cur === undefined || e.ts < cur) firstTs.set(e.traceId, e.ts);
  }
  const traceIds = [...firstTs.keys()].sort((a, b) => {
    const ta = firstTs.get(a)!;
    const tb = firstTs.get(b)!;
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
  if (traceIds.length < k + 1) {
    return { status: 'insufficient-data', consistencies: [], alert: { alert: false } };
  }
  const sequences = traceIds.map((id) => opSequence(events, id));
  const baseline = sequences[0] ?? [];
  const consistencies = sequences.slice(1).map((s) => seqConsistency(s, baseline));
  return { status: 'ok', consistencies, alert: driftAlert(consistencies, tau, k) };
}
