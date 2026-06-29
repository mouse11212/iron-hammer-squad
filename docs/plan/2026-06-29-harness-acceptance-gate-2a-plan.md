# 杠杆2 验收关 · 切片 2a 实现计划（纯核 + 持久化 + 角色）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付杠杆2 验收关的纯逻辑核（聚合非 testable findings→验收清单 / 解析 agent verdict / 据模式分流）+ design-soundness 总持久化 + 视觉验收 agent 角色，全部独立可交付、不接 epic 入口（那是 2b）。

**Architecture:** 新建纯函数模块 `acceptance.ts`（仿 `design-findings.ts` 严格校验范式），消费杠杆1 已产的 `DesignFindings` 的「非 testable」半边。改 `inner-loop-runner.ts` 让 design-soundness 跑完**总持久化** `design-findings.json`（现仅 block-hold 路径写），为 2b epic 聚合备料。新增 `acceptance-agent.md` 角色（2b 才调用，2a 先就位）。

**Tech Stack:** TypeScript（strict, NodeNext 模块，import 带 `.js` 后缀）、vitest（`vitest run`）、StrykerJS 变异门。

## Global Constraints

- TypeScript strict；driver 是 NodeNext 模块，**同包 import 必须带 `.js` 后缀**（如 `from './design-findings.js'`）——见 `pipeline/guides/agent-conventions.md`。
- 纯函数无 IO；非法输入**即抛 Error，信息指向违规字段**（仿 `src/design-findings.ts`）。
- 新文件 `src/acceptance.ts` **必须加入** `stryker.conf.json` 的 `mutate` 列表；变异门聚合 ≥90。
- **禁止 `git add -A`**（`.stryker-tmp` 沙箱地雷）——每次 commit 只 `git add` 明确列出的文件。
- 工作目录 `pipeline/driver`；测试命令 `npm run test`（= `vitest run`），单文件 `npx vitest run test/<file>`，门禁 `npm run gate`（lint+typecheck+test）。
- 复用既有类型：`DesignFindings` 从 `./design-findings.js` import，**不重定义**。

---

## File Structure

| 文件 | 动作 | 职责 |
|---|---|---|
| `pipeline/driver/src/acceptance.ts` | 创建 | 三纯函数 + 类型（aggregate / parseVerdicts / resolve） |
| `pipeline/driver/test/acceptance.test.ts` | 创建 | 三函数全覆盖 + #2-仿真 fixture 判别力断言 |
| `pipeline/driver/stryker.conf.json` | 修改 | `mutate` 列表加 `src/acceptance.ts` |
| `pipeline/driver/src/inner-loop-runner.ts` | 修改 | design-soundness 解析后**总持久化** findings（上移既有 writeFileSync） |
| `pipeline/roles/acceptance-agent.md` | 创建 | epic 级视觉验收 agent 角色（2b 调用，2a 就位） |

> **YAGNI 说明（对 spec 的精化）**：spec 列「四纯函数」含 `buildAcceptanceChecklist`。实现时把"装配清单"折进 `aggregateAcceptanceItems`——它直接产出带稳定 id 的 `AcceptanceItem[]` 即是清单，无需单独 wrapper（`AcceptanceChecklist` 退化为 `{items}` 平凡包装，不值一个函数）。最终 **3 纯函数**。

---

### Task 1: `acceptance.ts` 类型 + `aggregateAcceptanceItems`（聚合即清单）

**Files:**
- Create: `pipeline/driver/src/acceptance.ts`
- Test: `pipeline/driver/test/acceptance.test.ts`
- Modify: `pipeline/driver/stryker.conf.json`

**Interfaces:**
- Consumes: `DesignFindings`（from `./design-findings.js`：`{intentRestatement, antiGoals:{desc,testable}[], failureModes:string[], suggestedAcceptance:string[]}`）。
- Produces:
  - `type AcceptanceKind = 'anti-goal' | 'acceptance' | 'failure-mode'`
  - `interface AcceptanceItem { id: string; source: string; kind: AcceptanceKind; desc: string }`
  - `interface FindingsSource { source: string; findings: DesignFindings }`
  - `function aggregateAcceptanceItems(sources: FindingsSource[]): AcceptanceItem[]`

- [ ] **Step 1: 写失败测试**

创建 `pipeline/driver/test/acceptance.test.ts`：

```ts
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd pipeline/driver && npx vitest run test/acceptance.test.ts`
Expected: FAIL，报 `aggregateAcceptanceItems` 无法从 `../src/acceptance.js` 解析（模块不存在）。

- [ ] **Step 3: 写最小实现**

创建 `pipeline/driver/src/acceptance.ts`：

```ts
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
```

> 注意：测试断言 `desc: '不应让三年级孩子感到挫败'`（无空白）与实现 `desc = rawDesc.trim()` 一致；去重 trim 用例靠此 trim 生效。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd pipeline/driver && npx vitest run test/acceptance.test.ts`
Expected: PASS（6 个用例全绿）。

- [ ] **Step 5: 把 `acceptance.ts` 加入变异门 mutate 列表**

修改 `pipeline/driver/stryker.conf.json`，在 `mutate` 数组末尾（`"src/design-findings.ts"` 之后）加一行 `"src/acceptance.ts"`：

```json
    "src/design-findings.ts",
    "src/acceptance.ts"
```

- [ ] **Step 6: 提交**

```bash
cd pipeline/driver
git add src/acceptance.ts test/acceptance.test.ts stryker.conf.json
git commit -m "feat(acceptance): 杠杆2-2a aggregateAcceptanceItems 聚合非testable findings→验收清单

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `parseAcceptanceVerdicts`（严格解析 agent verdict）

**Files:**
- Modify: `pipeline/driver/src/acceptance.ts`
- Test: `pipeline/driver/test/acceptance.test.ts`

**Interfaces:**
- Produces:
  - `interface AcceptanceVerdict { itemId: string; tier: 'blocker' | 'advise' | 'pass'; evidence: string; reason: string }`
  - `function parseAcceptanceVerdicts(raw: string): AcceptanceVerdict[]`

- [ ] **Step 1: 写失败测试**

在 `test/acceptance.test.ts` 顶部 import 增补 `parseAcceptanceVerdicts`，文件末尾追加：

```ts
import { parseAcceptanceVerdicts } from '../src/acceptance.js'; // 合并进首行 import

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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd pipeline/driver && npx vitest run test/acceptance.test.ts`
Expected: FAIL，`parseAcceptanceVerdicts` 未导出。

- [ ] **Step 3: 写最小实现**

在 `src/acceptance.ts` 追加（`aggregateAcceptanceItems` 之后）：

```ts
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
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd pipeline/driver && npx vitest run test/acceptance.test.ts`
Expected: PASS（全部用例，含 Task 1 的 6 个）。

- [ ] **Step 5: 提交**

```bash
cd pipeline/driver
git add src/acceptance.ts test/acceptance.test.ts
git commit -m "feat(acceptance): 杠杆2-2a parseAcceptanceVerdicts 严格解析三级verdict

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `resolveAcceptance`（据模式+人确认分流）+ 变异门

**Files:**
- Modify: `pipeline/driver/src/acceptance.ts`
- Test: `pipeline/driver/test/acceptance.test.ts`

**Interfaces:**
- Consumes: `AcceptanceVerdict[]`（Task 2）。
- Produces:
  - `interface AcceptanceDecision { action: 'pass' | 'escalate' | 'hold'; escalated: string[]; advised: string[] }`
  - `function resolveAcceptance(mode: string, agentVerdicts: AcceptanceVerdict[], humanConfirmed: AcceptanceVerdict[] | null): AcceptanceDecision`

- [ ] **Step 1: 写失败测试**

在 `test/acceptance.test.ts` 顶部 import 增补 `resolveAcceptance, type AcceptanceVerdict`，文件末尾追加：

```ts
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd pipeline/driver && npx vitest run test/acceptance.test.ts`
Expected: FAIL，`resolveAcceptance` 未导出。

- [ ] **Step 3: 写最小实现**

在 `src/acceptance.ts` 追加（`parseAcceptanceVerdicts` 之后）：

```ts
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
```

- [ ] **Step 4: 跑测试确认通过 + 全门禁**

Run: `cd pipeline/driver && npx vitest run test/acceptance.test.ts`
Expected: PASS（三 describe 全绿）。

Run: `cd pipeline/driver && npm run gate`
Expected: lint + typecheck + 全测试套件全绿（零回归）。

- [ ] **Step 5: 变异门验证 `acceptance.ts`**

Run: `cd pipeline/driver && npm run mutation`
Expected: stryker 跑完，`src/acceptance.ts` 变异得分 ≥90（聚合）。若有存活变异：读 stryker 报告定位 → 补杀变异的断言（仿 design-findings 当年补 `failureModes 非数组` / `顶层 null` 守卫用例）→ 重跑至 ≥90。**不得为凑分删/弱化测试（红线5）。**

- [ ] **Step 6: 提交**

```bash
cd pipeline/driver
git add src/acceptance.ts test/acceptance.test.ts
git commit -m "feat(acceptance): 杠杆2-2a resolveAcceptance 三级verdict分流(blocker升级/advise不阻/pass放行)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: design-soundness **总持久化** findings（为 2b epic 聚合备料）

**Files:**
- Modify: `pipeline/driver/src/inner-loop-runner.ts`（design-soundness 块，约 line 176–196）

**Interfaces:**
- Consumes: 既有 `findings`（`parseDesignFindings` 产出，line 176）、`runsDir`、`writeFileSync`（已 import）。
- Produces: `<runsDir>/design-findings.json` 在 **off 以外所有跑 design-soundness 的模式**下都落盘（2b `bin-acceptance` 据此按 US 聚合）。

> **测试说明（诚实对待 TDD）**：design-soundness 块嵌在 `runInnerLoop` 里、带重 IO（spawn claude、readFileSync 角色），既有 `inner-loop-runner.test.ts` 只单测 `makeRunPhase`，**该块本身靠 e2e 验证**（杠杆1-1b 即如此）。本任务是**纯结构性移动**（把已存在的 `writeFileSync(design-findings.json)` 从 hold 分支上移到解析后无条件执行），不引入新逻辑分支。验证靠：typecheck + 既有套件零回归 + 2b epic e2e 真验产物存在（2b 计划覆盖）。**这是既有代码 IO 边界的现实，不为它硬造脆弱单测。**

- [ ] **Step 1: 上移持久化到无条件位置**

在 `src/inner-loop-runner.ts`，定位 line 176：
```ts
      const findings = parseDesignFindings(extractJsonBlock(r.result));
```
紧随其后**插入**一行无条件持久化（2b epic 聚合的真相源）：
```ts
      const findings = parseDesignFindings(extractJsonBlock(r.result));
      // 杠杆2-2a:design-soundness 跑过即持久化 findings(off 以外所有模式),供 2b epic 收口聚合。
      writeFileSync(join(runsDir, 'design-findings.json'), JSON.stringify(findings, null, 2), 'utf8');
```

- [ ] **Step 2: 删除 hold 分支里的重复持久化（DRY）**

定位 hold 分支内（原约 line 196）这一行并**删除**（已被上移的无条件写覆盖）：
```ts
        writeFileSync(join(runsDir, 'design-findings.json'), JSON.stringify(findings, null, 2), 'utf8');
```
hold 分支保留其后的 `design-review.md` 写入与 `held` 早返回不变。

- [ ] **Step 3: typecheck + 全门禁确认零回归**

Run: `cd pipeline/driver && npm run gate`
Expected: lint + typecheck + 全测试套件全绿（design-soundness 块无单测，结构移动不改既有断言结果）。

- [ ] **Step 4: 提交**

```bash
cd pipeline/driver
git add src/inner-loop-runner.ts
git commit -m "feat(acceptance): 杠杆2-2a design-soundness跑过即总持久化findings(供epic聚合)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: `acceptance-agent.md` 角色（视觉验收 agent，2b 调用，2a 就位）

**Files:**
- Create: `pipeline/roles/acceptance-agent.md`

**Interfaces:**
- Produces: 角色 prose——约束 agent 输入（验收清单 + 可玩增量 URL/启动方式）、行为（playwright 逐项跑+截图）、输出（`AcceptanceVerdict[]` JSON：`{itemId,tier,evidence,reason}`，tier∈blocker|advise|pass）。

> prose 角色文件，无测试。参照既有 `pipeline/roles/design-soundness-agent.md`、`pipeline/roles/ui-agent.md` 的风格与边界写法。

- [ ] **Step 1: 写角色文件**

创建 `pipeline/roles/acceptance-agent.md`：

```markdown
# 角色：验收 agent（acceptance-agent · 杠杆2 epic 实现后视觉验收）

你是**独立验收员**，站在终端用户（这里是三年级小学生 / 替他把关的家长）和对抗者视角，核对**已实现的可玩增量是否达成产品意图**——不是核对"功能有没有 bug"（那是单测/评审的活），而是核对"功能全对的前提下，**目的有没有达成**"。

## 铁律
- **只读，绝不改实现**（红线4 角色不混同：验收员 ≠ 实现者）。你只观察、截图、判定。
- **不臆造**（红线1）：每条判定必须挂可核对证据（截图路径 / DOM snapshot 摘要 / 你的实际操作与观察）。测不到就标 pass 并说明"未触发"，不编造失败。
- **不替人拍板**：你产**初判**；blocker 最终由人裁决（block 模式）或据信任度自动采纳（auto 模式）。

## 输入
1. **验收清单** `AcceptanceItem[]`：每项 `{id, source, kind, desc}`，kind ∈ `anti-goal`（不该发生的事）/ `acceptance`（"算成了"的样子）/ `failure-mode`（用户会注意到的失败）。
2. **可玩增量**：启动方式 / URL（用 playwright 打开）。

## 怎么做
逐条清单项：
- **anti-goal**：尝试让它**发生**（对抗）。能复现 → 该反目标未守住。
- **acceptance**：按描述操作，核对是否真"算成了"。
- **failure-mode**：检查这种失败用户是否会撞上。
用 playwright 真实操作（导航/点击/输入），关键步骤**截图**或取 DOM snapshot 作证据。

## 三级判定（tier）
- `blocker`：合目的性被破坏，用户会明显受损（如 #2「答题前就显示答案」使"听辨"玩法失效）。**升级人类**。
- `advise`：值得改进但不阻断交付（体验毛刺、边角）。**归档不阻**（升级可见、不卡放行）。
- `pass`：该项达成 / 未触发失败。

## 输出（只输出 JSON，无其它文字）
```json
[
  { "itemId": "a1", "tier": "blocker", "evidence": "截图 a1.png：静音状态下连点正确选项仍 100% 答对", "reason": "听辨意图失效——无需听音即可通关" },
  { "itemId": "c1", "tier": "pass", "evidence": "结算页列出今日掌握 4 词，与实际答对一致", "reason": "达成" }
]
```
`itemId` 必须回指输入清单的 `id`；`tier` 必须是 blocker|advise|pass；`evidence`/`reason` 必填非空。
```

- [ ] **Step 2: 提交**

```bash
cd "$(git rev-parse --show-toplevel)"
git add pipeline/roles/acceptance-agent.md
git commit -m "feat(acceptance): 杠杆2-2a acceptance-agent角色(视觉验收,三级初判,只读)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage（对 2a 验收逐条）**：
- design-findings 总持久化 → Task 4 ✅
- `acceptance.ts` 聚合/解析/分流 → Task 1/2/3 ✅（spec 的 buildChecklist 折进 aggregate，已在 File Structure 注明 YAGNI）
- 变异门 ≥90 + 入 mutate 列表 → Task 1 Step 5（列表）+ Task 3 Step 5（跑门）✅
- acceptance-agent 角色 → Task 5 ✅
- 离线判别力验证（#2-仿真 fixture）→ Task 1 测试（`findings()` 工厂含 #2 同型非 testable 反目标 + 静音类 suggestedAcceptance，断言被抽出）✅
- driver gate 全绿零回归 → Task 3 Step 4 + Task 4 Step 3 ✅
- **不做（2a）**：不接 epic 入口/不跑真 agent → 本计划无 `bin-acceptance`/无真 agent 调用 ✅

**2. Placeholder scan**：无 TBD/TODO；每步含真实代码与命令；变异补杀给了具体参照（design-findings 当年用例）而非"加适当测试"。✅

**3. Type consistency**：`DesignFindings` 全程 from `./design-findings.js` 不重定义；`AcceptanceItem.kind` 三值在 aggregate（产）与 role（消费）一致；`AcceptanceVerdict` 字段（itemId/tier/evidence/reason）在 Task 2（parse）、Task 3（resolve 消费 tier/itemId）、Task 5（agent 产）三处一致；`resolveAcceptance` 签名 `(mode, agentVerdicts, humanConfirmed)` 与 Task 3 测试调用一致。✅
