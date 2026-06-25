// M6-d 安全评审 agent:STRIDE/OWASP 方法论评审产出的结构化 findings 解析 + 确定性动作映射。
// 关键:LLM findings 非确定,但动作映射确定(有 high→升级人签、低危→advisory)——把不可靠 agent 纳入可靠 harness。
// 纯函数无 IO,仿 verdict.ts 严格校验。

/** STRIDE 6 类(注入/越权/失败副作用等映射到对应类)。 */
export type StrideCategory = 'spoofing' | 'tampering' | 'repudiation' | 'info-disclosure' | 'dos' | 'elevation';
export type Severity = 'high' | 'medium' | 'low';

/** 一条安全发现。 */
export interface Finding {
  category: StrideCategory;
  severity: Severity;
  desc: string;
  location?: string;
  recommendation?: string;
}

export interface SecurityReview {
  findings: Finding[];
}

const CATEGORIES: StrideCategory[] = ['spoofing', 'tampering', 'repudiation', 'info-disclosure', 'dos', 'elevation'];
const SEVERITIES: Severity[] = ['high', 'medium', 'low'];

/** 解析安全评审 findings JSON;非法即抛(带定位,不静默吞)。空 findings 合法(无威胁,不臆造)。 */
export function parseSecurityFindings(text: string): SecurityReview {
  let o: unknown;
  try {
    o = JSON.parse(text);
  } catch {
    throw new Error('security findings 不是合法 JSON');
  }
  if (typeof o !== 'object' || o === null) throw new Error('security findings 必须是对象');
  const raw = (o as Record<string, unknown>).findings;
  if (!Array.isArray(raw)) throw new Error('security findings.findings 必须是数组');
  const findings: Finding[] = raw.map((item, i) => {
    if (typeof item !== 'object' || item === null) throw new Error(`findings[${i}] 必须是对象`);
    const m = item as Record<string, unknown>;
    if (!CATEGORIES.includes(m.category as StrideCategory)) {
      throw new Error(`findings[${i}].category 非法(须 STRIDE 6 类): ${String(m.category)}`);
    }
    if (!SEVERITIES.includes(m.severity as Severity)) {
      throw new Error(`findings[${i}].severity 非法(须 high|medium|low): ${String(m.severity)}`);
    }
    if (typeof m.desc !== 'string') throw new Error(`findings[${i}].desc 必须是字符串`);
    const f: Finding = { category: m.category as StrideCategory, severity: m.severity as Severity, desc: m.desc };
    if (typeof m.location === 'string') f.location = m.location;
    if (typeof m.recommendation === 'string') f.recommendation = m.recommendation;
    return f;
  });
  return { findings };
}

/** 动作映射结果。 */
export interface FindingsAction {
  /** 有任一 high → 升级人签(复用 held/handoff)。 */
  escalate: boolean;
  /** 高危(阻断/升级)。 */
  high: Finding[];
  /** 中低危(handoff advisory,不阻断)。 */
  advise: Finding[];
}

/**
 * 纯:确定性按严重度决定动作。有 high → escalate 人签;medium/low → advise。
 * LLM findings 非确定,动作确定——agent 不单独硬阻断(漏报风险),高危人在环(红线7)。
 */
export function mapFindingsToAction(findings: Finding[]): FindingsAction {
  const high = findings.filter((f) => f.severity === 'high');
  const advise = findings.filter((f) => f.severity !== 'high');
  return { escalate: high.length > 0, high, advise };
}
