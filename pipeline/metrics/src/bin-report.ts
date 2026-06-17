import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collect } from './collect.js';
import { renderBoard } from './board.js';

const here = dirname(fileURLToPath(import.meta.url));
// repoRoot 默认从 pipeline/metrics/src 上溯三级到仓库根；可用 argv[2] 覆盖。
const repoRoot = resolve(process.argv[2] ?? join(here, '..', '..', '..'));
const dataDir = join(here, '..', 'data');
const outPath = join(repoRoot, 'docs', 'metrics', 'dashboard.md');

const snap = collect(repoRoot, dataDir, new Date().toISOString());
const md = renderBoard(snap);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, md, 'utf8');
console.log(`[metrics] 看板 → ${outPath}`);
console.log(
  JSON.stringify({
    resolved: snap.resolved,
    attempted: snap.attempted,
    churn: snap.codeChurn,
    defectEscapeRate: snap.defectEscapeRate,
    traces: snap.traces.length,
  }),
);
