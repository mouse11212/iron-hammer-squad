import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collect } from './collect.js';
import { renderBoard } from './board.js';
import { readHistory } from './report-history.js';

const here = dirname(fileURLToPath(import.meta.url));
// repoRoot 默认从 pipeline/metrics/src 上溯三级到仓库根；可用 argv[2] 覆盖。
const repoRoot = resolve(process.argv[2] ?? join(here, '..', '..', '..'));
const dataDir = join(here, '..', 'data');
const outPath = join(repoRoot, 'docs', 'metrics', 'dashboard.md');

const snap = collect(repoRoot, dataDir, new Date().toISOString());
// 读 report 历史归档(M4+⑦)渲趋势区;无 history.jsonl → 省略,看板不变。
const history = readHistory(join(repoRoot, 'docs', 'metrics', 'history.jsonl'));
const md = renderBoard(snap, history);
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
