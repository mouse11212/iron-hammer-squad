import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchFeed } from './fetch.js';
import { parse } from './parse.js';
import { filterToday } from './filterToday.js';
import { render } from './render.js';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, '..', 'dist', 'index.html');

/** 组合层：fetch → parse → filterToday → render → 写文件，并输出一行 run log。 */
async function main(): Promise<void> {
  const start = Date.now();
  let fetched = 0;
  let todayCount = 0;
  let status: 'ok' | 'fail' = 'ok';

  try {
    const xml = await fetchFeed();
    const items = parse(xml);
    fetched = items.length;
    const todays = filterToday(items, new Date());
    todayCount = todays.length;
    const html = render(todays);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, html, 'utf8');
  } catch (err) {
    status = 'fail';
    console.error('fincards run error:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }

  // run log（M0 最小可观测；字段为 M4 指标采集留接口雏形）
  console.log(
    JSON.stringify({
      run: 'fincards',
      fetched,
      today: todayCount,
      output: outPath,
      elapsedMs: Date.now() - start,
      status,
    }),
  );
}

void main();
