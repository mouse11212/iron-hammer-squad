import type { Numstat, ChurnResult } from './types.js';

/** 已解决 / 尝试；attempted=0 返回 0(不除零)。 */
export function taskResolutionRate(resolved: number, attempted: number): number {
  return attempted === 0 ? 0 : resolved / attempted;
}

/** 汇总 git numstat 为 churn(added/removed/total/files)。 */
export function codeChurn(stats: Numstat[]): ChurnResult {
  const added = stats.reduce((a, s) => a + s.added, 0);
  const removed = stats.reduce((a, s) => a + s.removed, 0);
  return { added, removed, total: added + removed, files: stats.length };
}

/** 验证耗时 / (验证+实现)；实现耗时为 null(未埋点)→ 返回 null(不臆造)。 */
export function verificationTax(verificationMs: number, implementationMs: number | null): number | null {
  if (implementationMs === null) return null;
  const denom = verificationMs + implementationMs;
  return denom === 0 ? 0 : verificationMs / denom;
}

/** 逃逸 / 总；总为 0 返回 0(不除零)。 */
export function defectEscapeRate(escaped: number, total: number): number {
  return total === 0 ? 0 : escaped / total;
}
