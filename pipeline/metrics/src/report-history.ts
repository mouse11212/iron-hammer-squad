import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { MetricsSnapshot } from './types.js';

// report 历史归档(M4+ 续切片⑦):每次 opt-in 归档留一份 slim 指标快照到持久 history.jsonl,看板渲趋势。
// 与 runs-ledger 同构:append-only JSONL、机器写、持久但不可 git 复现(归档的是过去某时刻算出的值)。

/** slim 趋势记录:只取四 KPI + 解决计数(丢 traces/taxByTrace/innerLoop 大字段)。 */
export interface HistoryRecord {
  generatedAt: string;
  taskResolutionRate: number;
  verificationTax: number | null;
  defectEscapeRate: number | null;
  codeChurnTotal: number;
  resolved: number;
  attempted: number;
}

/** 纯:从 MetricsSnapshot 投影 slim 趋势记录(null KPI 保留,不臆造)。 */
export function historySnapshot(snap: MetricsSnapshot): HistoryRecord {
  return {
    generatedAt: snap.generatedAt,
    taskResolutionRate: snap.taskResolutionRate,
    verificationTax: snap.verificationTax,
    defectEscapeRate: snap.defectEscapeRate,
    codeChurnTotal: snap.codeChurn.total,
    resolved: snap.resolved,
    attempted: snap.attempted,
  };
}

/** 薄 IO:append 一行 JSON(目标目录不存在先建)。append-only,不覆盖既有。 */
export function appendHistory(path: string, rec: HistoryRecord): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(rec) + '\n');
}

/** 薄 IO:逐行 parse history.jsonl,跳畸形行,缺文件返回 [](不抛、不臆造)。 */
export function readHistory(path: string): HistoryRecord[] {
  if (!existsSync(path)) return [];
  const out: HistoryRecord[] = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t) as HistoryRecord);
    } catch {
      continue; // 畸形行跳过
    }
  }
  return out;
}
