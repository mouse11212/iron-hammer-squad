import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { weaveTraces, readArchivedChanges } from './weave-traces.js';

// 可检视产物 CLI:把自动织的追溯链写出到 data/traces.json,供人眼审计(每次重生成)。
// 采集(collect)用内存派生值,不依赖此落盘文件——产物纯为审计,不在采集路径上。

const here = dirname(fileURLToPath(import.meta.url));
// repoRoot 默认从 pipeline/metrics/src 上溯三级到仓库根;可用 argv[2] 覆盖。
const repoRoot = resolve(process.argv[2] ?? join(here, '..', '..', '..'));
const outPath = join(here, '..', 'data', 'traces.json');

const traces = weaveTraces(readArchivedChanges(repoRoot));
// 写干净 JSON 数组(合法 JSON,等于采集所用派生值);"自动生成勿手改"的溯源见 console + README,
// 不写进文件内(.json 不能带注释,且 spec 要求内容=TraceLink[])。
writeFileSync(outPath, JSON.stringify(traces, null, 2) + '\n', 'utf8');
console.log(`[metrics] 追溯链(${traces.length} 条,自动生成勿手改) → ${outPath}`);
