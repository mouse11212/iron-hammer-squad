import { existsSync, readFileSync } from 'node:fs';
import { verificationTax } from './compute.js';

// 从统一事件流(driver 写的 events.jsonl)派生 Verification Tax 输入。
// 跨包契约:metrics 不 import driver,按本地最小 event 形状逐行 parse events.jsonl。
// 口径(D1):实现=dev phase;验证=test/review phase + gate + orchestrator-fix;squash/integrate 不计。

/** 本地最小 event 形状(只取算 tax 所需字段;driver 端 schema 的稳定子集)。 */
export interface TaxEvent {
  op: string;
  phase?: string;
  durationMs?: number;
  traceId: string;
}

export interface DurationSplit {
  implementationMs: number;
  verificationMs: number;
}

/** 纯:按 D1 口径累加;缺 durationMs / 非实现非验证 op 跳过。 */
export function categorizeDuration(events: TaxEvent[]): DurationSplit {
  let implementationMs = 0;
  let verificationMs = 0;
  for (const e of events) {
    if (e.durationMs === undefined) continue;
    if (e.op === 'phase' && e.phase === 'dev') {
      implementationMs += e.durationMs;
    } else if (
      (e.op === 'phase' && (e.phase === 'test' || e.phase === 'review')) ||
      e.op === 'gate' ||
      e.op === 'orchestrator-fix'
    ) {
      verificationMs += e.durationMs;
    }
    // 其余(squash/integrate/未知 op/异常 phase)不计入任一类
  }
  return { implementationMs, verificationMs };
}

/** 实现耗时为 0(无 dev 事件)→ 视作未埋点,tax 回落 null(不臆造);否则用既有 verificationTax 纯函数。 */
export function taxOf(split: DurationSplit): number | null {
  return verificationTax(split.verificationMs, split.implementationMs === 0 ? null : split.implementationMs);
}

/** 纯:按 traceId(每个 US) 分组累加并算 tax。 */
export function taxByTrace(events: TaxEvent[]): Map<string, DurationSplit & { tax: number | null }> {
  const groups = new Map<string, TaxEvent[]>();
  for (const e of events) {
    const arr = groups.get(e.traceId);
    if (arr) arr.push(e);
    else groups.set(e.traceId, [e]);
  }
  const out = new Map<string, DurationSplit & { tax: number | null }>();
  for (const [traceId, evs] of groups) {
    const split = categorizeDuration(evs);
    out.set(traceId, { ...split, tax: taxOf(split) });
  }
  return out;
}

/** 薄 IO:逐行 parse events.jsonl,跳畸形行,缺文件返回 []。 */
export function readEventsJsonl(path: string): TaxEvent[] {
  if (!existsSync(path)) return [];
  const out: TaxEvent[] = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as TaxEvent);
    } catch {
      continue;
    }
  }
  return out;
}
