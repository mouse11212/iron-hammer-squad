/** Bloomberg 官方 markets RSS（实测可用、合规公开 feed）。 */
export const BLOOMBERG_MARKETS_RSS = 'https://feeds.bloomberg.com/markets/news.rss';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124 Safari/537.36';

/**
 * 薄 IO 适配器：HTTPS GET RSS 原文。隔离网络的非确定性，不做解析。
 * 200 返回原始 XML 字符串；非 200 / 超时 / 网络错误抛出可识别错误。
 */
export async function fetchFeed(
  url: string = BLOOMBERG_MARKETS_RSS,
  timeoutMs = 15000,
): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml' },
    });
    if (!res.ok) {
      throw new Error(`fetchFeed: HTTP ${res.status} ${res.statusText} for ${url}`);
    }
    return await res.text();
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`fetchFeed: timeout after ${timeoutMs}ms for ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
