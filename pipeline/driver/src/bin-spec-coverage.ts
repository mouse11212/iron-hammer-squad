import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gateSpecCoverage } from './spec-coverage.js';

// spec-coverage 门 CLI（薄 IO 包装纯核 gateSpecCoverage）:
// 读暂存文件 → 调纯核 → 违规非零退出 + 打印 offenders。
// 供 git pre-commit 钩子（scripts/gate-spec-coverage）+ harness 门复用（单一真相 = gateSpecCoverage）。
// 规约:spec-coverage-gate capability（change 2026-06-29-pipeline-process-guardrails）。

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();

// 暂存文件（仓库根相对）
const staged = execFileSync('git', ['-C', repoRoot, 'diff', '--cached', '--name-only'], {
  encoding: 'utf8',
})
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean);

// 对 .ts（非 .test.ts）乐观读内容,供 @spec-exempt 扫描;读失败(如已删)= 无内容 = 无豁免
const contents: Record<string, string> = {};
for (const p of staged) {
  if (p.endsWith('.ts') && !p.endsWith('.test.ts')) {
    try {
      contents[p] = readFileSync(join(repoRoot, p), 'utf8');
    } catch {
      /* 无内容:gateSpecCoverage 视为无豁免 */
    }
  }
}

const result = gateSpecCoverage({ changedPaths: staged, contents });

if (result.ok) {
  console.log('[spec-coverage] 通过（无能力源违规,或同批含 OpenSpec change / 已豁免）');
  process.exit(0);
}

console.error(`[spec-coverage] 违规（${result.offenders.length} 个能力源无进行中 change 且无 @spec-exempt 豁免）:`);
for (const o of result.offenders) {
  console.error(`  ${o}`);
}
console.error('  → 修复:为本批能力源改动建 OpenSpec change（/opsx:propose）,或加 // @spec-exempt: <非空理由>');
process.exit(1);
