// @ts-nocheck
import type { NewsItem } from './types.js';

/** HTML 转义，防注入。 */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(d: Date): string {
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

function card(it: NewsItem): string {
  return `    <article class="card">
      <h2><a href="${esc(it.link)}" target="_blank" rel="noopener noreferrer">${esc(it.title)}</a></h2>
      <p class="summary">${esc(it.summary)}</p>
      <footer><span class="src">${esc(it.source)}</span><time>${esc(fmtDate(it.pubDate))}</time></footer>
    </article>`;
}

/**
 * 纯函数：把 NewsItem[] 渲染为自包含 HTML 卡片页。
 * 无副作用、不读时钟、不写文件；所有文本经 HTML 转义；空列表显示占位。
 * 合规：仅展示 标题(链接回原文)+摘要+时间，不内联正文全文。
 */
export function render(items: NewsItem[]): string {
  const body =
    items.length === 0
      ? '    <p class="empty">今日暂无新闻</p>'
      : items.map(card).join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>fincards · Bloomberg 今日财经</title>
  <style>
    body{font-family:system-ui,sans-serif;background:#f6f7f9;margin:0;padding:24px;color:#16181d}
    h1{font-size:1.4rem}
    .grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
    .card{background:#fff;border:1px solid #e3e6ea;border-radius:10px;padding:16px}
    .card h2{font-size:1rem;margin:0 0 8px}
    .card a{color:#1a56db;text-decoration:none}
    .card a:hover{text-decoration:underline}
    .summary{font-size:.9rem;color:#444;margin:0 0 12px}
    footer{display:flex;justify-content:space-between;font-size:.75rem;color:#888}
    .empty{color:#888}
  </style>
</head>
<body>
  <h1>Bloomberg 今日财经 · fincards</h1>
  <div class="grid">
${body}
  </div>
</body>
</html>`;
}
