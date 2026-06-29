// 杠杆2 验收关纯核：聚合 per-US 的「非 testable」findings → 验收清单；解析 agent verdict；据模式分流。
// 消费杠杆1 的 DesignFindings 的「非 testable」半边（杠杆1 消费 testable 半边）——同一份评审产物两个时点。
// 纯函数无 IO，仿 design-findings.ts 严格校验：非法即抛指向字段。

import type { DesignFindings } from './design-findings.js';

export type AcceptanceKind = 'anti-goal' | 'acceptance' | 'failure-mode';

/** 一条验收清单项（来自非 testable 反目标 / suggestedAcceptance / failureModes）。 */
export interface AcceptanceItem {
  id: string;          // 稳定 id（供 verdict 回指），形如 a1/c1/f1
  source: string;      // 来源：US id 或 'epic'
  kind: AcceptanceKind;
  desc: string;
}

/** 带来源标签的一份 findings（聚合时多源合并）。 */
export interface FindingsSource {
  source: string;      // US id 或 'epic'
  findings: DesignFindings;
}

const KIND_PREFIX: Record<AcceptanceKind, string> = {
  'anti-goal': 'a',
  acceptance: 'c',
  'failure-mode': 'f',
};

/**
 * 聚合多源 DesignFindings 的「非 testable 反目标 + suggestedAcceptance + failureModes」成验收清单。
 * - testable 反目标排除（杠杆1 已接成确定性测试）。
 * - 去重：同 (kind, trim 后 desc) 只留首现，来源取首现。
 * - 稳定 id：每 kind 独立前缀 + 递增序号（a1/c1/f1），跨源连续，确定可测。
 */
export function aggregateAcceptanceItems(sources: FindingsSource[]): AcceptanceItem[] {
  const seen = new Set<string>();
  const items: AcceptanceItem[] = [];
  const counters: Record<AcceptanceKind, number> = { 'anti-goal': 0, acceptance: 0, 'failure-mode': 0 };

  const push = (source: string, kind: AcceptanceKind, rawDesc: string) => {
    const desc = rawDesc.trim();
    const key = `${kind}::${desc}`;
    if (seen.has(key)) return;
    seen.add(key);
    counters[kind] += 1;
    items.push({ id: `${KIND_PREFIX[kind]}${counters[kind]}`, source, kind, desc });
  };

  for (const { source, findings } of sources) {
    for (const ag of findings.antiGoals) {
      if (!ag.testable) push(source, 'anti-goal', ag.desc);
    }
    for (const acc of findings.suggestedAcceptance) push(source, 'acceptance', acc);
    for (const fm of findings.failureModes) push(source, 'failure-mode', fm);
  }
  return items;
}

/** agent 对一条验收项的判定。 */
export interface AcceptanceVerdict {
  itemId: string;
  tier: 'blocker' | 'advise' | 'pass';
  evidence: string;   // 截图路径 / snapshot 摘要 / 观察
  reason: string;
}

const VERDICT_TIERS = ['blocker', 'advise', 'pass'] as const;

/**
 * 解析 acceptance-agent 产的 verdict JSON 数组；非法即抛（带定位，不静默）。
 * 契约严：顶层数组；每项 itemId 非空串、tier ∈ {blocker,advise,pass}、evidence/reason 为字符串。
 */
export function parseAcceptanceVerdicts(raw: string): AcceptanceVerdict[] {
  let o: unknown;
  try {
    o = JSON.parse(raw);
  } catch {
    throw new Error('acceptance verdicts 不是合法 JSON');
  }
  if (!Array.isArray(o)) {
    throw new Error('acceptance verdicts 必须是数组');
  }
  return o.map((item, i) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new Error(`acceptance verdicts[${i}] 必须是对象`);
    }
    const v = item as Record<string, unknown>;
    if (typeof v.itemId !== 'string' || v.itemId.trim() === '') {
      throw new Error(`acceptance verdicts[${i}].itemId 必须是非空字符串`);
    }
    if (typeof v.tier !== 'string' || !VERDICT_TIERS.includes(v.tier as (typeof VERDICT_TIERS)[number])) {
      throw new Error(`acceptance verdicts[${i}].tier 必须是 blocker|advise|pass`);
    }
    if (typeof v.evidence !== 'string') {
      throw new Error(`acceptance verdicts[${i}].evidence 必须是字符串`);
    }
    if (typeof v.reason !== 'string') {
      throw new Error(`acceptance verdicts[${i}].reason 必须是字符串`);
    }
    return { itemId: v.itemId, tier: v.tier as AcceptanceVerdict['tier'], evidence: v.evidence, reason: v.reason };
  });
}

/** 验收关分流结果（2b epic 入口据此落账：escalate→升级人类 / pass→放行；advised 始终归档不阻）。 */
export interface AcceptanceDecision {
  action: 'pass' | 'escalate' | 'hold';
  escalated: string[];   // blocker 项 itemId（升级人类裁决）
  advised: string[];     // advise 项 itemId（归档，不阻塞放行——issue#13）
}

/**
 * 纯：据 IH_ACCEPTANCE 模式 + 人工确认态，决定放行/升级/hold 及升级/归档项。
 * - auto：用 agent verdicts。有 blocker→escalate（列 blocker），否则 pass；advise 始终归档。
 * - block + 未确认(null)：hold（待人复核 verdict）。
 * - block + 人确认(数组,含空)：用确认后的 verdicts 分流（人可改 tier，增删）。
 * - 其它(off/未知)：pass（不跑即放行，安全兜底）。
 */
export function resolveAcceptance(
  mode: string,
  agentVerdicts: AcceptanceVerdict[],
  humanConfirmed: AcceptanceVerdict[] | null,
): AcceptanceDecision {
  if (mode === 'block' && humanConfirmed === null) {
    return { action: 'hold', escalated: [], advised: [] };
  }
  if (mode !== 'auto' && mode !== 'block') {
    return { action: 'pass', escalated: [], advised: [] };
  }
  const effective = mode === 'block' ? (humanConfirmed as AcceptanceVerdict[]) : agentVerdicts;
  const escalated = effective.filter((v) => v.tier === 'blocker').map((v) => v.itemId);
  const advised = effective.filter((v) => v.tier === 'advise').map((v) => v.itemId);
  return { action: escalated.length > 0 ? 'escalate' : 'pass', escalated, advised };
}
