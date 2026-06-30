// trace-check 纯核：追溯链一致门——断链即收集，ok = 无阻断级断链。
// 规则：无 IO，无 LLM，纯字段判定。
// 断链（broken，计入 ok）：missing-spec（spec 空串）/ spec-without-commit（commit 空串）。
// 警告（warnings，不计入 ok）：spec-without-tests（tests 空数组）。
//   原因：weave 的 tests 派生（归档 commit 改的 test 文件）对"单独归档 commit"工作流失效，
//   且 prose capability 天然无 *.test.ts —— tests=0 不作为阻断条件（BOSS 2026-06-30 裁决）。
// 规约来源：traceability capability「追溯链一致门」（change 2026-06-29-pipeline-process-guardrails）。

import type { TraceLink } from './types.js';

/** 断链/警告类型。 */
export type BrokenKind = 'missing-spec' | 'spec-without-tests' | 'spec-without-commit';

/** 一条断链/警告记录。 */
export interface BrokenLink {
  changeId: string;
  kind: BrokenKind;
}

/** 一致门结果。ok = broken 为空（warnings 不影响 ok，仅报告）。 */
export interface TraceCheckResult {
  ok: boolean;
  /** 阻断级断链：missing-spec / spec-without-commit。 */
  broken: BrokenLink[];
  /** 警告级：spec-without-tests（tests 派生不可靠 / prose capability，不阻断）。 */
  warnings: BrokenLink[];
}

/**
 * 追溯链一致校验（纯函数，无 IO/LLM）。
 * - spec 缺失 → broken(missing-spec)
 * - commit 缺失 → broken(spec-without-commit)
 * - tests 缺失 → warnings(spec-without-tests)，不计入 ok
 * ok = broken 为空。供 CLI `npm run trace:check` 与 harness 报告门复用（单一真相）。
 */
export function traceCheck(links: TraceLink[]): TraceCheckResult {
  const broken: BrokenLink[] = [];
  const warnings: BrokenLink[] = [];
  for (const link of links) {
    if (!link.spec) {
      broken.push({ changeId: link.changeId, kind: 'missing-spec' });
    }
    if (link.tests.length === 0) {
      warnings.push({ changeId: link.changeId, kind: 'spec-without-tests' });
    }
    if (!link.commit) {
      broken.push({ changeId: link.changeId, kind: 'spec-without-commit' });
    }
  }
  return { ok: broken.length === 0, broken, warnings };
}
