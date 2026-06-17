/** Bloomberg 官方 markets RSS（实测可用、合规公开 feed）。 */
// @ts-nocheck
function stryNS_9fa48() {
  var g = typeof globalThis === 'object' && globalThis && globalThis.Math === Math && globalThis || new Function("return this")();
  var ns = g.__stryker__ || (g.__stryker__ = {});
  if (ns.activeMutant === undefined && g.process && g.process.env && g.process.env.__STRYKER_ACTIVE_MUTANT__) {
    ns.activeMutant = g.process.env.__STRYKER_ACTIVE_MUTANT__;
  }
  function retrieveNS() {
    return ns;
  }
  stryNS_9fa48 = retrieveNS;
  return retrieveNS();
}
stryNS_9fa48();
function stryCov_9fa48() {
  var ns = stryNS_9fa48();
  var cov = ns.mutantCoverage || (ns.mutantCoverage = {
    static: {},
    perTest: {}
  });
  function cover() {
    var c = cov.static;
    if (ns.currentTestId) {
      c = cov.perTest[ns.currentTestId] = cov.perTest[ns.currentTestId] || {};
    }
    var a = arguments;
    for (var i = 0; i < a.length; i++) {
      c[a[i]] = (c[a[i]] || 0) + 1;
    }
  }
  stryCov_9fa48 = cover;
  cover.apply(null, arguments);
}
function stryMutAct_9fa48(id) {
  var ns = stryNS_9fa48();
  function isActive(id) {
    if (ns.activeMutant === id) {
      if (ns.hitCount !== void 0 && ++ns.hitCount > ns.hitLimit) {
        throw new Error('Stryker: Hit count limit reached (' + ns.hitCount + ')');
      }
      return true;
    }
    return false;
  }
  stryMutAct_9fa48 = isActive;
  return isActive(id);
}
export const BLOOMBERG_MARKETS_RSS = stryMutAct_9fa48("0") ? "" : (stryCov_9fa48("0"), 'https://feeds.bloomberg.com/markets/news.rss');
const UA = (stryMutAct_9fa48("1") ? "" : (stryCov_9fa48("1"), 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ')) + (stryMutAct_9fa48("2") ? "" : (stryCov_9fa48("2"), '(KHTML, like Gecko) Chrome/124 Safari/537.36'));

/**
 * 薄 IO 适配器：HTTPS GET RSS 原文。隔离网络的非确定性，不做解析。
 * 200 返回原始 XML 字符串；非 200 / 超时 / 网络错误抛出可识别错误。
 */
export async function fetchFeed(url: string = BLOOMBERG_MARKETS_RSS, timeoutMs = 15000): Promise<string> {
  if (stryMutAct_9fa48("3")) {
    {}
  } else {
    stryCov_9fa48("3");
    const ctrl = new AbortController();
    const timer = setTimeout(stryMutAct_9fa48("4") ? () => undefined : (stryCov_9fa48("4"), () => ctrl.abort()), timeoutMs);
    try {
      if (stryMutAct_9fa48("5")) {
        {}
      } else {
        stryCov_9fa48("5");
        const res = await fetch(url, stryMutAct_9fa48("6") ? {} : (stryCov_9fa48("6"), {
          signal: ctrl.signal,
          headers: stryMutAct_9fa48("7") ? {} : (stryCov_9fa48("7"), {
            'User-Agent': UA,
            Accept: stryMutAct_9fa48("8") ? "" : (stryCov_9fa48("8"), 'application/rss+xml, application/xml')
          })
        }));
        if (stryMutAct_9fa48("11") ? false : stryMutAct_9fa48("10") ? true : stryMutAct_9fa48("9") ? res.ok : (stryCov_9fa48("9", "10", "11"), !res.ok)) {
          if (stryMutAct_9fa48("12")) {
            {}
          } else {
            stryCov_9fa48("12");
            throw new Error(stryMutAct_9fa48("13") ? `` : (stryCov_9fa48("13"), `fetchFeed: HTTP ${res.status} ${res.statusText} for ${url}`));
          }
        }
        return await res.text();
      }
    } catch (err) {
      if (stryMutAct_9fa48("14")) {
        {}
      } else {
        stryCov_9fa48("14");
        if (stryMutAct_9fa48("17") ? err instanceof Error || err.name === 'AbortError' : stryMutAct_9fa48("16") ? false : stryMutAct_9fa48("15") ? true : (stryCov_9fa48("15", "16", "17"), err instanceof Error && (stryMutAct_9fa48("19") ? err.name !== 'AbortError' : stryMutAct_9fa48("18") ? true : (stryCov_9fa48("18", "19"), err.name === (stryMutAct_9fa48("20") ? "" : (stryCov_9fa48("20"), 'AbortError')))))) {
          if (stryMutAct_9fa48("21")) {
            {}
          } else {
            stryCov_9fa48("21");
            throw new Error(stryMutAct_9fa48("22") ? `` : (stryCov_9fa48("22"), `fetchFeed: timeout after ${timeoutMs}ms for ${url}`));
          }
        }
        throw err;
      }
    } finally {
      if (stryMutAct_9fa48("23")) {
        {}
      } else {
        stryCov_9fa48("23");
        clearTimeout(timer);
      }
    }
  }
}