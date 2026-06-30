import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readArchivedChanges, weaveTraces } from './weave-traces.js';
import { traceCheck } from './trace-check.js';

// 追溯链一致门 CLI（报告门）:weave 当前归档 → traceCheck → 打印 broken + warnings。
// exit code 由 broken 决定（warnings 不影响）；本门作报告用,不接进集成阻断（spec-coverage 才阻断）。
// 规约:traceability capability「追溯链一致门」。

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(process.argv[2] ?? join(here, '..', '..', '..'));

const links = weaveTraces(readArchivedChanges(repoRoot));
const result = traceCheck(links);

// warnings 始终报告（供人审 tests 派生空 / prose capability）
if (result.warnings.length > 0) {
  console.warn(`[metrics] trace:check 警告(${result.warnings.length} 条 tests 缺失,不阻断):`);
  for (const w of result.warnings) {
    console.warn(`  ${w.changeId}  →  ${w.kind}`);
  }
}

if (result.ok) {
  console.log(`[metrics] trace:check 通过(${links.length} 条链,broken=0)`);
  process.exit(0);
}

console.error(`[metrics] trace:check 失败(${result.broken.length} 条断链,共 ${links.length} 条链):`);
for (const b of result.broken) {
  console.error(`  ${b.changeId}  →  ${b.kind}`);
}
process.exit(1);
