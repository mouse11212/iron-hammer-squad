import { describe, it, expect } from 'vitest';
import { parseDesignFindings, extractTestableAntiGoals, extractJsonBlock } from '../src/design-findings.js';

// 合法 findings 工厂（造一份完整的，再按需破坏某字段）。
function validRaw(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    intentRestatement: '听音选词：孩子必须靠听辨认英文词',
    antiGoals: [
      { desc: '答案不得在答题前以文本可得（须靠听）', testable: true },
      { desc: '不应让孩子感到挫败', testable: false },
    ],
    failureModes: ['静音也能答对', '选项中文释义泄漏答案'],
    suggestedAcceptance: ['静音玩一题应无法答对'],
    ...over,
  });
}

describe('parseDesignFindings（纯：校验/解析设计合理性 findings，非法即抛指向字段）', () => {
  it('合法 findings → 字段一一对应解析', () => {
    const f = parseDesignFindings(validRaw());
    expect(f.intentRestatement).toContain('听音');
    expect(f.antiGoals).toHaveLength(2);
    expect(f.antiGoals[0]).toEqual({ desc: '答案不得在答题前以文本可得（须靠听）', testable: true });
    expect(f.antiGoals[1]!.testable).toBe(false);
    expect(f.failureModes).toEqual(['静音也能答对', '选项中文释义泄漏答案']);
    expect(f.suggestedAcceptance).toEqual(['静音玩一题应无法答对']);
  });

  it('failureModes/suggestedAcceptance 为空数组 + 其余合法 → 正常解析（不抛）', () => {
    const f = parseDesignFindings(validRaw({ failureModes: [], suggestedAcceptance: [] }));
    expect(f.failureModes).toEqual([]);
    expect(f.suggestedAcceptance).toEqual([]);
  });

  it('intentRestatement 为空串 → 抛错，信息指向 intentRestatement', () => {
    expect(() => parseDesignFindings(validRaw({ intentRestatement: '' }))).toThrow(/intentRestatement/);
  });

  it('intentRestatement 非字符串 → 抛错，信息指向 intentRestatement', () => {
    expect(() => parseDesignFindings(validRaw({ intentRestatement: 123 }))).toThrow(/intentRestatement/);
  });

  it('antiGoals 非数组 → 抛错，信息指向 antiGoals', () => {
    expect(() => parseDesignFindings(validRaw({ antiGoals: 'nope' }))).toThrow(/antiGoals/);
  });

  it('antiGoal.desc 为空串 → 抛错，信息指向 desc', () => {
    expect(() =>
      parseDesignFindings(validRaw({ antiGoals: [{ desc: '', testable: true }] })),
    ).toThrow(/desc/);
  });

  it('antiGoal.testable 非布尔 → 抛错，信息指向 testable', () => {
    expect(() =>
      parseDesignFindings(validRaw({ antiGoals: [{ desc: 'x', testable: 'yes' }] })),
    ).toThrow(/testable/);
  });

  it('antiGoal.testable 缺失 → 抛错，信息指向 testable', () => {
    expect(() =>
      parseDesignFindings(validRaw({ antiGoals: [{ desc: 'x' }] })),
    ).toThrow(/testable/);
  });

  it('failureModes 含非字符串项 → 抛错，信息指向 failureModes', () => {
    expect(() => parseDesignFindings(validRaw({ failureModes: ['ok', 7] }))).toThrow(/failureModes/);
  });

  it('failureModes 非数组（字符串）→ 抛错，信息指向 failureModes', () => {
    expect(() => parseDesignFindings(validRaw({ failureModes: 'nope' }))).toThrow(/failureModes/);
  });

  it('suggestedAcceptance 非数组 → 抛错，信息指向 suggestedAcceptance', () => {
    expect(() => parseDesignFindings(validRaw({ suggestedAcceptance: 'nope' }))).toThrow(/suggestedAcceptance/);
  });

  it('raw 非合法 JSON → 抛错', () => {
    expect(() => parseDesignFindings('not json {{{')).toThrow(/JSON/);
  });

  it('raw 顶层为 null → 抛错，信息指向「对象」（钉死 o===null 守卫，不靠下游属性访问）', () => {
    expect(() => parseDesignFindings('null')).toThrow(/对象/);
  });

  it('raw 顶层为数组 → 抛错，信息指向「对象」（钉死 Array.isArray 守卫）', () => {
    expect(() => parseDesignFindings('[]')).toThrow(/对象/);
  });
});

describe('extractTestableAntiGoals（纯：取 testable 反目标的 desc，喂 test phase）', () => {
  const findings = {
    intentRestatement: 'x',
    antiGoals: [
      { desc: '可测反目标A', testable: true },
      { desc: '需人判反目标B', testable: false },
      { desc: '可测反目标C', testable: true },
    ],
    failureModes: [],
    suggestedAcceptance: [],
  };

  it('只取 testable 的 desc，保序', () => {
    expect(extractTestableAntiGoals(findings)).toEqual(['可测反目标A', '可测反目标C']);
  });

  it('无 testable → []', () => {
    expect(
      extractTestableAntiGoals({ ...findings, antiGoals: [{ desc: 'b', testable: false }] }),
    ).toEqual([]);
  });

  it('空 antiGoals → []', () => {
    expect(extractTestableAntiGoals({ ...findings, antiGoals: [] })).toEqual([]);
  });
});

describe('extractJsonBlock（纯：从 agent 输出提取 JSON，容 markdown ```json 包裹）', () => {
  it('提取 ```json 块', () => {
    expect(extractJsonBlock('前言\n```json\n{"a":1}\n```\n后记')).toBe('{"a":1}');
  });
  it('提取无 json 标记的 ``` 块', () => {
    expect(extractJsonBlock('```\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it('无 fence → 返回 trim 后原文', () => {
    expect(extractJsonBlock('  {"a":1}  ')).toBe('{"a":1}');
  });
});
