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
