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
