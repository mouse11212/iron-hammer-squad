import { driftAlert } from './drift-sensor.js';

// 语义相似度 drift sensor（M7-c）。
// KB（arXiv:2601.04170）的 Semantic Drift = agent 输出渐进偏离原始任务意图但语法仍有效,
// 检测法 = Output Semantic Similarity（embedding cosine similarity),属 ASI Response Consistency 类(0.30)。
// 首次引入外部依赖(embedding)+ 响应文本当前未采集 → 双重待埋点:首切片只交付确定性纯核 + 接口契约,
// embed 缺省 / 无文本 → insufficient-data,不臆造已发生语义漂移(红线1)。

/** embedding provider 接口:注入,不绑定具体模型(离线纪律 + 把不确定性关在纯核外)。 */
export type EmbedFn = (text: string) => number[];

/** 一条 agent 响应(待采集:invoke stream-json 落 assistant 文本,留后续独立切片)。 */
export interface SemanticResponse {
  ts: string;
  traceId: string;
  text: string;
}

/**
 * 纯:余弦相似度 dot(a,b)/(‖a‖·‖b‖)。
 * 任一零向量 → 0(不臆造,避免 0/0 NaN);维度不等 → 抛(embedding provider 契约违例,红线6 不静默吞)。
 */
export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error(`cosine: 维度不等 ${a.length} vs ${b.length}`);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * 纯:以首向量为语义基线,返回 vecs[1..] 各自对基线的 cosine 序列。
 * 向量数 < 2 → []。同 M7-a 的「相对首基线」(可测可解释;rolling 留真实数据后切)。
 */
export function semanticConsistencySeries(vecs: number[][]): number[] {
  if (vecs.length < 2) return [];
  const base = vecs[0] ?? [];
  return vecs.slice(1).map((v) => cosine(base, v));
}

export interface SemanticDriftReport {
  status: 'ok' | 'insufficient-data';
  consistencies: number[];
  alert: { alert: boolean; triggerIndex?: number };
}

/**
 * 组装:注入 embedding + 算相对基线语义一致性序列 + driftAlert(跌破 τ)判定。
 * embed 缺省 / responses 不足 2 → insufficient-data(诚实,不臆造已发生语义漂移)。
 * τ=0.75/k=3 沿用 ASI 框架默认(KB 未给语义专用阈值,待长程标定)。
 */
export function computeSemanticDrift(
  responses: SemanticResponse[],
  embed?: EmbedFn,
  tau = 0.75,
  k = 3,
): SemanticDriftReport {
  if (!embed || responses.length < 2) {
    return { status: 'insufficient-data', consistencies: [], alert: { alert: false } };
  }
  const sorted = [...responses].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
  const vecs = sorted.map((r) => embed(r.text));
  const consistencies = semanticConsistencySeries(vecs);
  return { status: 'ok', consistencies, alert: driftAlert(consistencies, tau, k) };
}
