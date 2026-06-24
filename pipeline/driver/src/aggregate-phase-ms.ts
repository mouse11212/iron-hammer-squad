import type { Event } from './events.js';

// 持久化 VTax(M4+ 续切片⑤):done run squash 时把本 run 各阶段耗时聚合为原始 op 分类映射,
// 经 Metrics-Phase-Ms: trailer 持久进 git。**只报机械事实(各 op 花了多少 ms),不应用 impl/verif 口径**——
// 口径(哪类算验证)归 metrics。纯函数,无 IO。

/**
 * 聚合某 run(traceId=jobId)的事件:按分类(phase 事件用 phase 名,其余用 op)累加 durationMs。
 * 跳过缺 durationMs 的事件;只算 traceId 匹配的。返回 `{ dev, test, review, gate, 'orchestrator-fix' }` 子集(仅出现的非零项)。
 */
export function aggregatePhaseMs(events: Event[], jobId: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of events) {
    if (e.traceId !== jobId || e.durationMs === undefined) continue;
    const cat = e.op === 'phase' ? e.phase : e.op;
    if (cat === undefined) continue;
    out[cat] = (out[cat] ?? 0) + e.durationMs;
  }
  return out;
}
