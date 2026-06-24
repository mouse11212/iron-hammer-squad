import { existsSync, readFileSync } from 'node:fs';
import type { InnerLoopRunRecord } from './types.js';

// 持久化 inner-loop 统计(M4+ 续切片⑥):从 committed runs-ledger.jsonl 读 run 记录,取代 ephemeral .runtime/runs。
// 跨包契约:driver append 的 ledger 行 schema = `{jobId,status,fixRounds,costUsd,ts}`;metrics 逐行 parse、按 jobId 去重。

/**
 * 薄 IO:逐行 parse runs-ledger.jsonl,跳畸形行,**按 jobId 去重(后写覆盖,幂等)**,返回 InnerLoopRunRecord[]。
 * 缺文件返回 [](不抛、不臆造)。同 jobId 重跑/重试取最新一条,report 多次不重复计数。
 */
export function readRunLedger(path: string): InnerLoopRunRecord[] {
  if (!existsSync(path)) return [];
  const byJob = new Map<string, InnerLoopRunRecord>();
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    let rec: Partial<InnerLoopRunRecord>;
    try {
      rec = JSON.parse(t) as Partial<InnerLoopRunRecord>;
    } catch {
      continue; // 畸形行跳过
    }
    if (typeof rec.jobId !== 'string' || rec.status === undefined || typeof rec.fixRounds !== 'number') continue;
    byJob.set(rec.jobId, { jobId: rec.jobId, status: rec.status, fixRounds: rec.fixRounds, costUsd: rec.costUsd });
  }
  return [...byJob.values()];
}
