import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchFeed } from './fetch.js';
import { parse } from './parse.js';
import { aggregate } from './aggregate.js';
import { filterToday } from './filterToday.js';
import { render } from './render.js';
import type { NewsItem } from './types.js';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, '..', 'dist', 'index.html');

/** 要抓取的 Bloomberg topic feed。 */
const FEEDS: { topic: string; url: string }[] = [
  { topic: 'markets', url: 'https://feeds.bloomberg.com/markets/news.rss' },
  { topic: 'economics', url: 'https://feeds.bloomberg.com/economics/news.rss' },
  { topic: 'technology', url: 'https://feeds.bloomberg.com/technology/news.rss' },
];

interface SourceLog {
  topic: string;
  status: 'ok' | 'fail';
  count: number;
  error?: string;
}

/**
 * 组合层：多源 fetch → parse → aggregate → filterToday → render → 写文件。
 * 单源失败具备韧性：逐源 try/catch，失败源跳过并记入 run log，不致整体崩溃。
 */
async function main(): Promise<void> {
  const start = Date.now();
  const sources: NewsItem[][] = [];
  const sourceLogs: SourceLog[] = [];

  for (const feed of FEEDS) {
    try {
      const xml = await fetchFeed(feed.url);
      const items = parse(xml);
      sources.push(items);
      sourceLogs.push({ topic: feed.topic, status: 'ok', count: items.length });
    } catch (err) {
      sourceLogs.push({
        topic: feed.topic,
        status: 'fail',
        count: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  let fetched = 0;
  let todayCount = 0;
  let status: 'ok' | 'partial' | 'fail' = 'ok';

  const failCount = sourceLogs.filter((s) => s.status === 'fail').length;
  if (failCount === FEEDS.length) {
    status = 'fail';
    process.exitCode = 1;
  } else if (failCount > 0) {
    status = 'partial';
  }

  try {
    if (sources.length === 0) {
      // 数据安全(评审#2 must-fix):全部源失败时不渲染、不写文件，
      // 保留上次成功的 dist/index.html，避免一次失败抓取毁掉既有产物。
      console.error('fincards: all sources failed; preserving previous dist/index.html');
    } else {
      const merged = aggregate(sources);
      fetched = merged.length;
      const todays = filterToday(merged, new Date());
      todayCount = todays.length;
      const html = render(todays);
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, html, 'utf8');
    }
  } catch (err) {
    status = 'fail';
    console.error('fincards run error:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }

  // run log（M0 最小可观测；含每源成功/失败明细）
  console.log(
    JSON.stringify({
      run: 'fincards',
      sources: sourceLogs,
      fetched,
      today: todayCount,
      output: outPath,
      elapsedMs: Date.now() - start,
      status,
    }),
  );
}

void main();
