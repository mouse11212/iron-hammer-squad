import type { Numstat, ChurnResult, InnerLoopRunRecord, InnerLoopStats } from './types.js';

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

/** 逃逸 / 总；总为 0 返回 null(待埋点,不伪造 0%——无缺陷≠门有效,可能只是没在看)。 */
export function defectEscapeRate(escaped: number, total: number): number | null {
  return total === 0 ? null : escaped / total;
}

/** 聚合 inner-loop 运行 KPI(纯)：状态分布 / 升级率 / 回修轮次分布 / 成本。 */
export function innerLoopStats(records: InnerLoopRunRecord[]): InnerLoopStats {
  const byStatus = { done: 0, failed: 0, blockedEscalated: 0 };
  const fixRoundsDistribution: Record<number, number> = {};
  let totalCostUsd = 0;

  for (const r of records) {
    if (r.status === 'done') byStatus.done++;
    else if (r.status === 'failed') byStatus.failed++;
    else byStatus.blockedEscalated++;
    fixRoundsDistribution[r.fixRounds] = (fixRoundsDistribution[r.fixRounds] ?? 0) + 1;
    totalCostUsd += r.costUsd ?? 0;
  }

  const total = records.length;
  return {
    total,
    byStatus,
    escalationRate: total === 0 ? 0 : byStatus.blockedEscalated / total,
    fixRoundsDistribution,
    totalCostUsd,
    avgCostUsd: total === 0 ? null : totalCostUsd / total,
  };
}
