/** git numstat 单条(一个文件的增删)。 */
export interface Numstat {
  added: number;
  removed: number;
}

export interface ChurnResult {
  added: number;
  removed: number;
  total: number;
  files: number;
}

/** 缺陷记录:caught=合并前发现，escaped=合并后才发现。 */
export interface DefectRecord {
  id: string;
  where: 'caught' | 'escaped';
  note?: string;
}

/** 追溯链:changeId → spec → tests → commit。 */
export interface TraceLink {
  changeId: string;
  spec: string;
  tests: string[];
  commit: string;
}

/** 一次 inner-loop 运行记录(从 .runtime/runs/<jobId>/state.json 读)。 */
export interface InnerLoopRunRecord {
  jobId: string;
  status: 'done' | 'failed' | 'blocked-escalated';
  fixRounds: number;
  costUsd?: number;
}

/** inner-loop 运行聚合 KPI(自主 run 的可度量画像)。 */
export interface InnerLoopStats {
  total: number;
  byStatus: { done: number; failed: number; blockedEscalated: number };
  /** blocked-escalated / 总(升级人类比例)。 */
  escalationRate: number;
  /** 回修轮次 → run 数。 */
  fixRoundsDistribution: Record<number, number>;
  totalCostUsd: number;
  /** 均成本;无 run 时 null(不臆造)。 */
  avgCostUsd: number | null;
}

/** harness 四指标快照(V4 §7)。null = 待埋点/待标定，不臆造。 */
export interface MetricsSnapshot {
  generatedAt: string;
  taskResolutionRate: number; // 已解决/尝试
  resolved: number;
  attempted: number;
  codeChurn: ChurnResult;
  verificationTax: number | null; // 验证耗时/(验证+实现);实现耗时待埋点→null
  verificationMs: number | null;
  defectEscapeRate: number; // 逃逸/总
  defects: { total: number; escaped: number };
  traces: TraceLink[];
  /** inner-loop 自主运行聚合(无 run 时 undefined,看板省略该区)。 */
  innerLoop?: InnerLoopStats;
}
