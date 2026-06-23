import type { Verdict, MustFix, FixDomain, VerdictDecision } from './types.js';

// 评审 phase 产出的结构化 verdict 解析器。
// 这是"非确定性模型输出 → 确定性 gate 输入"的咽喉:纯函数,文件读取留在 IO 边界。
// 任何不合 schema 的输入都明确抛错,而非静默吞掉(宁可阻塞升级也不放过)。

const DECISIONS: readonly VerdictDecision[] = ['pass', 'conditional', 'block'];
const DOMAINS: readonly FixDomain[] = ['impl', 'test', 'orchestrator'];

/** 解析并校验 verdict 文本;非法即抛错(带定位信息)。 */
export function parseVerdict(text: string): Verdict {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('verdict 不是合法 JSON');
  }
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('verdict 必须是对象');
  }
  const o = raw as Record<string, unknown>;

  if (!DECISIONS.includes(o.decision as VerdictDecision)) {
    throw new Error(`verdict.decision 非法(须 pass|conditional|block): ${String(o.decision)}`);
  }
  if (!Array.isArray(o.mustFix)) {
    throw new Error('verdict.mustFix 必须是数组');
  }

  const mustFix: MustFix[] = o.mustFix.map((item, i) => {
    if (typeof item !== 'object' || item === null) {
      throw new Error(`mustFix[${i}] 必须是对象`);
    }
    const m = item as Record<string, unknown>;
    if (!DOMAINS.includes(m.domain as FixDomain)) {
      throw new Error(`mustFix[${i}].domain 非法(须 impl|test|orchestrator): ${String(m.domain)}`);
    }
    if (typeof m.desc !== 'string') {
      throw new Error(`mustFix[${i}].desc 必须是字符串`);
    }
    const fix: MustFix = { domain: m.domain as FixDomain, desc: m.desc };
    if (typeof m.file === 'string') fix.file = m.file;
    // orchestrator 代修指令:仅白名单 type + 合法 file 才采纳;否则省略(不静默吞——留给 orchestratorFix 判不识别→escalated)
    if (m.action !== null && typeof m.action === 'object') {
      const a = m.action as Record<string, unknown>;
      if (a.type === 'register-mutation-target' && typeof a.file === 'string') {
        fix.action = { type: 'register-mutation-target', file: a.file };
      }
    }
    return fix;
  });

  const v: Verdict = { decision: o.decision as VerdictDecision, mustFix };
  if (Array.isArray(o.niceToHave)) {
    v.niceToHave = o.niceToHave.filter((x): x is string => typeof x === 'string');
  }
  return v;
}
