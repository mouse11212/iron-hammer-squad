import { describe, it, expect } from 'vitest';
import { aggregateAcceptanceItems, type FindingsSource } from '../src/acceptance.js';
import type { DesignFindings } from '../src/design-findings.js';

// 仿真实 #2「听音选词」反目标的 findings 工厂（判别力基准；US-1..8 跑在 design-soundness 之前，无真 artifact）。
function findings(over: Partial<DesignFindings> = {}): DesignFindings {
  return {
    intentRestatement: '听音选词：孩子靠听辨认英文词',
    antiGoals: [
      { desc: '答案不得在答题前以文本可得（须靠听）', testable: true },   // 杠杆1 已接,不入验收
      { desc: '不应让三年级孩子感到挫败', testable: false },              // 入验收(反目标)
    ],
    failureModes: ['静音也能答对'],
    suggestedAcceptance: ['静音玩一题应无法稳定答对'],
    ...over,
  };
}

describe('aggregateAcceptanceItems（纯：聚合非 testable findings → 验收清单项）', () => {
  it('只取非 testable 反目标 + 全部 suggestedAcceptance + 全部 failureModes，标来源', () => {
    const sources: FindingsSource[] = [{ source: 'us-1', findings: findings() }];
    const items = aggregateAcceptanceItems(sources);
    expect(items).toEqual([
      { id: 'a1', source: 'us-1', kind: 'anti-goal', desc: '不应让三年级孩子感到挫败' },
      { id: 'c1', source: 'us-1', kind: 'acceptance', desc: '静音玩一题应无法稳定答对' },
      { id: 'f1', source: 'us-1', kind: 'failure-mode', desc: '静音也能答对' },
    ]);
  });

  it('testable 反目标全部排除（那是杠杆1 的活）', () => {
    const f = findings({ antiGoals: [{ desc: 'X', testable: true }, { desc: 'Y', testable: true }] });
    const items = aggregateAcceptanceItems([{ source: 'us-1', findings: f }]);
    expect(items.filter((i) => i.kind === 'anti-goal')).toEqual([]);
  });

  it('多源聚合：id 按 kind 独立递增，跨源连续', () => {
    const fa = findings({ antiGoals: [{ desc: 'A挫败', testable: false }], suggestedAcceptance: [], failureModes: [] });
    const fb = findings({ antiGoals: [{ desc: 'B超纲', testable: false }], suggestedAcceptance: [], failureModes: [] });
    const items = aggregateAcceptanceItems([
      { source: 'us-1', findings: fa },
      { source: 'epic', findings: fb },
    ]);
    expect(items).toEqual([
      { id: 'a1', source: 'us-1', kind: 'anti-goal', desc: 'A挫败' },
      { id: 'a2', source: 'epic', kind: 'anti-goal', desc: 'B超纲' },
    ]);
  });

  it('去重：同 kind+desc 归一只留首现（来源取首现）', () => {
    const fa = findings({ antiGoals: [{ desc: '挫败', testable: false }], suggestedAcceptance: [], failureModes: [] });
    const fb = findings({ antiGoals: [{ desc: '挫败', testable: false }], suggestedAcceptance: [], failureModes: [] });
    const items = aggregateAcceptanceItems([
      { source: 'us-1', findings: fa },
      { source: 'us-2', findings: fb },
    ]);
    expect(items).toEqual([{ id: 'a1', source: 'us-1', kind: 'anti-goal', desc: '挫败' }]);
  });

  it('去重按 trim 归一（首尾空白视为同条）', () => {
    const fa = findings({ antiGoals: [{ desc: '挫败', testable: false }], suggestedAcceptance: [], failureModes: [] });
    const fb = findings({ antiGoals: [{ desc: '  挫败  ', testable: false }], suggestedAcceptance: [], failureModes: [] });
    const items = aggregateAcceptanceItems([
      { source: 'us-1', findings: fa },
      { source: 'us-2', findings: fb },
    ]);
    expect(items).toHaveLength(1);
  });

  it('空源 → []', () => {
    expect(aggregateAcceptanceItems([])).toEqual([]);
  });
});
