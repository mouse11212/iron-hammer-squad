import type { RunState, InvokeResult } from './types.js';

/** 纯转移：queued → running。 */
export function startRun(s: RunState, now: string): RunState {
  return { ...s, status: 'running', startedAt: now };
}

/** 纯转移：running → done | failed（据退出码）。 */
export function completeRun(s: RunState, res: InvokeResult, now: string): RunState {
  if (res.exitCode === 0) {
    return { ...s, status: 'done', exitCode: 0, finishedAt: now };
  }
  return {
    ...s,
    status: 'failed',
    exitCode: res.exitCode,
    finishedAt: now,
    error: res.stderr || `exit ${res.exitCode}`,
  };
}

/** done/failed 为终态。 */
export function isTerminal(s: RunState): boolean {
  return s.status === 'done' || s.status === 'failed';
}

/** 崩溃恢复：把残留 running 回收为 queued（可重新调度），其余不变。 */
export function recover(states: RunState[]): RunState[] {
  return states.map((s) =>
    s.status === 'running' ? { ...s, status: 'queued', startedAt: undefined } : s,
  );
}
