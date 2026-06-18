/**
 * 移除清单：精确命名的跟踪参数（utm_ 前缀单独按前缀判定，见 `isTrackingParam`）。
 * 来源：业界常见广告/分析平台 click-id 与会话标识。
 */
const NAMED_TRACKERS = new Set<string>([
  'fbclid',
  'gclid',
  'gbraid',
  'wbraid',
  'dclid',
  'msclkid',
  'twclid',
  'ttclid',
  'igshid',
  'yclid',
  '_ga',
  '_gl',
]);

/** 跟踪参数判定：utm_ 前缀（精确，需带下划线）或落在具名清单内。 */
function isTrackingParam(key: string): boolean {
  return key.startsWith('utm_') || NAMED_TRACKERS.has(key);
}

/**
 * 纯函数：把新闻 URL 规范化成跨源去重用的 canonical key。
 * 无网络/时钟/随机，确定性可测；坏 URL 优雅降级（返回 trim 后原串，不抛错），
 * 以保证 `aggregate` 的去重链不因单条坏 URL 崩溃。
 *
 * 规范化规则（依据 RFC 3986 §6 + 业界跟踪参数剥离实践）：
 * - scheme 与 host 转小写；**path 与 query 大小写原样保留**（path 大小写敏感）。
 * - 默认端口去除（http:80 / https:443），非默认端口保留——交由 WHATWG `URL.host`。
 * - 去除 fragment（`#` 及其后内容）。
 * - 移除跟踪参数（utm_ 前缀 + 具名 click-id/会话标识），保留功能参数。
 * - 剩余参数按键名字典序升序；同名重复键保彼此相对顺序；**value 原样保留，不解码**。
 * - 移空参数后不残留 `?`。
 * - 去 path 尾斜杠（根 `/` 也归一为空），使 `a.com/` 与 `a.com` 结果相同。
 *
 * 实现注记：仅用 `new URL` 做合法性校验与取 scheme/host（其 `host` 已处理默认端口与
 * host 小写化）；path 取 `pathname`（大小写被保留）；query 从**原始串**手工切分，避免
 * `URLSearchParams` 对 value 解码/再编码造成失真。不对 URL 做二次解析以防改变 path 大小写。
 */
export function canonicalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    // 非合法绝对 URL（相对路径/畸形/空串）：优雅降级，返回 trim 后原串。
    return trimmed;
  }

  const scheme = parsed.protocol; // 形如 "http:"，已小写
  const host = parsed.host; // 已小写、默认端口已剥离、非默认端口保留

  // path：`pathname` 保留原始大小写。去尾斜杠（根 "/" 一并归一为空）。
  let path = parsed.pathname;
  if (path.endsWith('/')) path = path.slice(0, -1);

  return `${scheme}//${host}${path}${canonicalQuery(trimmed)}`;
}

/**
 * 从原始串提取并规范化 query：剥跟踪参数、按键名排序、value 原样保留。
 * 直接切原始串而非用 `parsed.search`/`URLSearchParams`，以免 value 被解码或重编码。
 * 返回值含前导 `?`；无剩余参数时返回空串（不残留 `?`）。
 */
function canonicalQuery(trimmed: string): string {
  // 先去 fragment（query 在 fragment 之前），再取首个 "?" 之后为原始 query。
  const hashIdx = trimmed.indexOf('#');
  const beforeHash = hashIdx === -1 ? trimmed : trimmed.slice(0, hashIdx);
  const qIdx = beforeHash.indexOf('?');
  if (qIdx === -1) return '';
  const rawQuery = beforeHash.slice(qIdx + 1);
  if (rawQuery === '') return '';

  // 切分为 segment，记录键名与原始下标（下标作排序 tiebreaker → 同名键保相对顺序）。
  const kept = rawQuery
    .split('&')
    .map((segment, idx) => {
      const eqIdx = segment.indexOf('=');
      const key = eqIdx === -1 ? segment : segment.slice(0, eqIdx);
      return { key, segment, idx };
    })
    .filter((p) => !isTrackingParam(p.key));

  if (kept.length === 0) return '';

  // 键名字典序升序；同名键以原始下标稳定保序（comparator 全序，便于变异覆盖）。
  kept.sort((a, b) => {
    if (a.key < b.key) return -1;
    if (a.key > b.key) return 1;
    return a.idx - b.idx;
  });

  return `?${kept.map((p) => p.segment).join('&')}`;
}
