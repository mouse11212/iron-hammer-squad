import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collect } from './collect.js';
import { historySnapshot, appendHistory } from './report-history.js';

// report 历史归档 CLI(M4+⑦):opt-in 追加一份当前指标快照到持久 history.jsonl(里程碑级采样)。
// 与 npm run report(只重生看板)分开——普通 report 不污染历史。

const here = dirname(fileURLToPath(import.meta.url));
// repoRoot 默认从 pipeline/metrics/src 上溯三级到仓库根;可用 argv[2] 覆盖。
const repoRoot = resolve(process.argv[2] ?? join(here, '..', '..', '..'));
const dataDir = join(here, '..', 'data');
const historyPath = join(repoRoot, 'docs', 'metrics', 'history.jsonl');

const snap = collect(repoRoot, dataDir, new Date().toISOString());
const rec = historySnapshot(snap);
appendHistory(historyPath, rec);
console.log(`[metrics] 归档指标快照(${rec.generatedAt}) → ${historyPath}`);
