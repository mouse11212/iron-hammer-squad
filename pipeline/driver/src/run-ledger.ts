import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { InnerLoopResult, InnerLoopStatus } from './inner-loop.js';

// 持久化 inner-loop 统计(M4+ 续切片⑥,收尾):每个 run 完成时 append slim 记录到 committed runs-ledger.jsonl。
// 它无法走 trailer——升级率需 escalated run,而 escalated/failed run 不产生提交、git 无痕。
// ledger 持久但不可 git 复现(累积记录),是非提交型 run 的固有性质。纯投影 + 薄 IO。

/** ledger 一行:只取统计所需字段(丢 sessions/residual/reason 噪声)。 */
export interface RunLedgerRecord {
  jobId: string;
  status: InnerLoopStatus;
  fixRounds: number;
  costUsd: number;
  /** ISO8601;注入,不读系统时钟。 */
  ts: string;
}

/** 纯:InnerLoopResult → slim ledger 记录。 */
export function runLedgerRecord(jobId: string, result: InnerLoopResult, costUsd: number, ts: string): RunLedgerRecord {
  return { jobId, status: result.status, fixRounds: result.fixRounds, costUsd, ts };
}

/** 薄 IO:append 一行 JSON(目标目录不存在先建)。append-only 行级原子。 */
export function appendRunLedger(path: string, record: RunLedgerRecord): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(record) + '\n');
}
