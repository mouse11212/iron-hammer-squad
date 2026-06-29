import { describe, it, expect } from 'vitest';
import { aggregateAcceptanceItems, parseAcceptanceVerdicts, resolveAcceptance, type FindingsSource, type AcceptanceVerdict } from '../src/acceptance.js';
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

// 合法 verdict 工厂（造一条完整的，再按需破坏某字段）。
function verdictRaw(over: Record<string, unknown> = {}): string {
  return JSON.stringify([
    { itemId: 'a1', tier: 'blocker', evidence: '截图 a1.png：静音仍稳定答对', reason: '违反听辨意图', ...over },
  ]);
}

describe('parseAcceptanceVerdicts（纯：解析 agent 产 verdict JSON，非法即抛指向字段）', () => {
  it('合法数组 → 字段一一对应解析', () => {
    const vs = parseAcceptanceVerdicts(verdictRaw());
    expect(vs).toEqual([
      { itemId: 'a1', tier: 'blocker', evidence: '截图 a1.png：静音仍稳定答对', reason: '违反听辨意图' },
    ]);
  });

  it('三档 tier 均合法解析', () => {
    const raw = JSON.stringify([
      { itemId: 'a1', tier: 'blocker', evidence: 'e', reason: 'r' },
      { itemId: 'c1', tier: 'advise', evidence: 'e', reason: 'r' },
      { itemId: 'f1', tier: 'pass', evidence: 'e', reason: 'r' },
    ]);
    expect(parseAcceptanceVerdicts(raw).map((v) => v.tier)).toEqual(['blocker', 'advise', 'pass']);
  });

  it('空数组 → []（合法：无项可判）', () => {
    expect(parseAcceptanceVerdicts('[]')).toEqual([]);
  });

  it('raw 非合法 JSON → 抛错，信息含 JSON', () => {
    expect(() => parseAcceptanceVerdicts('not json {{{')).toThrow(/JSON/);
  });

  it('raw 顶层非数组 → 抛错，信息含「数组」', () => {
    expect(() => parseAcceptanceVerdicts('{}')).toThrow(/数组/);
  });

  it('项非对象（数组）→ 抛错，信息含 [0]', () => {
    expect(() => parseAcceptanceVerdicts('[[]]')).toThrow(/\[0\]/);
  });

  it('项为 null → 抛错，信息含 [0]', () => {
    expect(() => parseAcceptanceVerdicts('[null]')).toThrow(/\[0\]/);
  });

  it('itemId 为空串 → 抛错，信息指向 itemId', () => {
    expect(() => parseAcceptanceVerdicts(verdictRaw({ itemId: '' }))).toThrow(/itemId/);
  });

  it('tier 非枚举 → 抛错，信息指向 tier', () => {
    expect(() => parseAcceptanceVerdicts(verdictRaw({ tier: 'maybe' }))).toThrow(/tier/);
  });

  it('tier 缺失 → 抛错，信息指向 tier', () => {
    const raw = JSON.stringify([{ itemId: 'a1', evidence: 'e', reason: 'r' }]);
    expect(() => parseAcceptanceVerdicts(raw)).toThrow(/tier/);
  });

  it('evidence 非字符串 → 抛错，信息指向 evidence', () => {
    expect(() => parseAcceptanceVerdicts(verdictRaw({ evidence: 7 }))).toThrow(/evidence/);
  });

  it('reason 非字符串 → 抛错，信息指向 reason', () => {
    expect(() => parseAcceptanceVerdicts(verdictRaw({ reason: 7 }))).toThrow(/reason/);
  });
});

describe('resolveAcceptance（纯：据模式+人确认决定 pass/escalate/hold + 升级/归档项）', () => {
  const vs: AcceptanceVerdict[] = [
    { itemId: 'a1', tier: 'blocker', evidence: 'e', reason: 'r' },
    { itemId: 'c1', tier: 'advise', evidence: 'e', reason: 'r' },
    { itemId: 'f1', tier: 'pass', evidence: 'e', reason: 'r' },
  ];
  const allPass: AcceptanceVerdict[] = [{ itemId: 'a1', tier: 'pass', evidence: 'e', reason: 'r' }];

  it('auto + 含 blocker → escalate，列 blocker，advise 归档', () => {
    expect(resolveAcceptance('auto', vs, null)).toEqual({ action: 'escalate', escalated: ['a1'], advised: ['c1'] });
  });

  it('auto + 无 blocker → pass，advise 仍归档', () => {
    const noBlock: AcceptanceVerdict[] = [{ itemId: 'c1', tier: 'advise', evidence: 'e', reason: 'r' }];
    expect(resolveAcceptance('auto', noBlock, null)).toEqual({ action: 'pass', escalated: [], advised: ['c1'] });
  });

  it('block + 无人工确认(null) → hold（待人复核，不分流）', () => {
    expect(resolveAcceptance('block', vs, null)).toEqual({ action: 'hold', escalated: [], advised: [] });
  });

  it('block + 人确认(改过 tier)→ 用确认的分流（人可降级 blocker）', () => {
    const confirmed: AcceptanceVerdict[] = [
      { itemId: 'a1', tier: 'advise', evidence: 'e', reason: '人判：非阻断' },
      { itemId: 'c1', tier: 'advise', evidence: 'e', reason: 'r' },
    ];
    expect(resolveAcceptance('block', vs, confirmed)).toEqual({ action: 'pass', escalated: [], advised: ['a1', 'c1'] });
  });

  it('block + 人确认仍含 blocker → escalate', () => {
    expect(resolveAcceptance('block', vs, vs)).toEqual({ action: 'escalate', escalated: ['a1'], advised: ['c1'] });
  });

  it('block + 人确认空数组 → pass（人判无任何 blocker/advise）', () => {
    expect(resolveAcceptance('block', vs, [])).toEqual({ action: 'pass', escalated: [], advised: [] });
  });

  it('off → pass（不跑即放行，安全兜底，忽略 verdict）', () => {
    expect(resolveAcceptance('off', vs, null)).toEqual({ action: 'pass', escalated: [], advised: [] });
  });

  it('未知模式 → pass（安全兜底）', () => {
    expect(resolveAcceptance('weird', vs, null)).toEqual({ action: 'pass', escalated: [], advised: [] });
  });

  it('auto 全 pass → pass 无升级无归档', () => {
    expect(resolveAcceptance('auto', allPass, null)).toEqual({ action: 'pass', escalated: [], advised: [] });
  });
});
