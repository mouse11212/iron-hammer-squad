import type { TraceLink } from './types.js';

/** 正向查询：按 changeId 或 spec 名找 TraceLink。 */
export function forward(traces: TraceLink[], idOrSpec: string): TraceLink | undefined {
  return traces.find((t) => t.changeId === idOrSpec || t.spec === idOrSpec);
}

/** 反向查询：按 commit 找 TraceLink。 */
export function reverse(traces: TraceLink[], commit: string): TraceLink | undefined {
  return traces.find((t) => t.commit === commit);
}
