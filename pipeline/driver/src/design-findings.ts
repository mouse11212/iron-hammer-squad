// design-review 能力：设计合理性评审 agent 产出的结构化 findings 解析。
// 关键：评审"规约是否达成产品意图"（issue#9/#12）——agent findings 非确定，但解析/校验确定。
// 纯函数无 IO，仿 security-findings.ts 严格校验：非法即抛（信息指向违规字段，不静默吞）。

/** 一条反目标：行为正确但失败的条件。testable=true 可后续转确定性测试，false 转人工试玩项。 */
export interface AntiGoal {
  desc: string;
  testable: boolean;
}

/** 设计合理性评审产出。 */
export interface DesignFindings {
  /** 意图复述：一句话，这功能为谁、达成什么（用户视角）。 */
  intentRestatement: string;
  /** 反目标：正确但失败的条件。 */
  antiGoals: AntiGoal[];
  /** 用户会注意到的失败方式。 */
  failureModes: string[];
  /** 建议验收标准（用户视角"算成了"）。 */
  suggestedAcceptance: string[];
}

/** 校验"非空字符串数组"，非法即抛（带字段名定位）。 */
function parseStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new Error(`design findings.${field} 必须是数组`);
  return value.map((item, i) => {
    if (typeof item !== 'string') throw new Error(`design findings.${field}[${i}] 必须是字符串`);
    return item;
  });
}

/**
 * 解析设计合理性 findings JSON；非法即抛（带定位，不静默）。
 * 契约严：intentRestatement 非空串、antiGoals 各含非空 desc + 布尔 testable；
 * failureModes/suggestedAcceptance 为字符串数组（可空）。
 */
export function parseDesignFindings(raw: string): DesignFindings {
  let o: unknown;
  try {
    o = JSON.parse(raw);
  } catch {
    throw new Error('design findings 不是合法 JSON');
  }
  if (typeof o !== 'object' || o === null || Array.isArray(o)) {
    throw new Error('design findings 必须是对象');
  }
  const m = o as Record<string, unknown>;

  if (typeof m.intentRestatement !== 'string' || m.intentRestatement.trim() === '') {
    throw new Error('design findings.intentRestatement 必须是非空字符串');
  }

  if (!Array.isArray(m.antiGoals)) {
    throw new Error('design findings.antiGoals 必须是数组');
  }
  const antiGoals: AntiGoal[] = m.antiGoals.map((item, i) => {
    if (typeof item !== 'object' || item === null) {
      throw new Error(`design findings.antiGoals[${i}] 必须是对象`);
    }
    const a = item as Record<string, unknown>;
    if (typeof a.desc !== 'string' || a.desc.trim() === '') {
      throw new Error(`design findings.antiGoals[${i}].desc 必须是非空字符串`);
    }
    if (typeof a.testable !== 'boolean') {
      throw new Error(`design findings.antiGoals[${i}].testable 必须是布尔`);
    }
    return { desc: a.desc, testable: a.testable };
  });

  const failureModes = parseStringArray(m.failureModes, 'failureModes');
  const suggestedAcceptance = parseStringArray(m.suggestedAcceptance, 'suggestedAcceptance');

  return { intentRestatement: m.intentRestatement, antiGoals, failureModes, suggestedAcceptance };
}

/** 纯:取 testable 反目标的 desc（杠杆1:这些自动注入 test phase，由 test-agent 写成确定性测试）。 */
export function extractTestableAntiGoals(findings: DesignFindings): string[] {
  return findings.antiGoals.filter((a) => a.testable).map((a) => a.desc);
}

/** 纯:从 agent 输出提取 JSON 串（LLM 常把 JSON 包进 markdown ```json 块）。无 fence 则返回 trim 后原文。 */
export function extractJsonBlock(text: string): string {
  const inner = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1];
  return (inner ?? text).trim();
}

/** design-review 决策（杠杆1-1b 人审检查点）。 */
export interface DesignReviewDecision {
  /** proceed=注入反目标继续;hold=待人审,不进 test/dev。 */
  action: 'proceed' | 'hold';
  antiGoals: string[];
}

/**
 * 纯:据 IH_DESIGN_REVIEW 模式 + 人工确认态，决定 proceed/hold 及注入哪些反目标。
 * - auto：全自动，注入全部 testable 反目标。
 * - block + 人工确认(数组,含空)：proceed 用确认的反目标（人可增删）。
 * - block + 未确认(null)：hold（待人审，不进 test/dev）。
 * - 其它(off/未知)：proceed 无反目标（安全兜底）。
 */
export function resolveDesignReview(
  mode: string,
  findings: DesignFindings,
  confirmed: string[] | null,
): DesignReviewDecision {
  if (mode === 'auto') {
    return { action: 'proceed', antiGoals: extractTestableAntiGoals(findings) };
  }
  if (mode === 'block') {
    return confirmed === null
      ? { action: 'hold', antiGoals: [] }
      : { action: 'proceed', antiGoals: confirmed };
  }
  return { action: 'proceed', antiGoals: [] };
}
