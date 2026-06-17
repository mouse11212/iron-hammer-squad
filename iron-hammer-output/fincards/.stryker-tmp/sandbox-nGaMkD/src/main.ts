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
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchFeed } from './fetch.js';
import { parse } from './parse.js';
import { filterToday } from './filterToday.js';
import { render } from './render.js';
const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, stryMutAct_9fa48("24") ? "" : (stryCov_9fa48("24"), '..'), stryMutAct_9fa48("25") ? "" : (stryCov_9fa48("25"), 'dist'), stryMutAct_9fa48("26") ? "" : (stryCov_9fa48("26"), 'index.html'));

/** 组合层：fetch → parse → filterToday → render → 写文件，并输出一行 run log。 */
async function main(): Promise<void> {
  if (stryMutAct_9fa48("27")) {
    {}
  } else {
    stryCov_9fa48("27");
    const start = Date.now();
    let fetched = 0;
    let todayCount = 0;
    let status: 'ok' | 'fail' = stryMutAct_9fa48("28") ? "" : (stryCov_9fa48("28"), 'ok');
    try {
      if (stryMutAct_9fa48("29")) {
        {}
      } else {
        stryCov_9fa48("29");
        const xml = await fetchFeed();
        const items = parse(xml);
        fetched = items.length;
        const todays = filterToday(items, new Date());
        todayCount = todays.length;
        const html = render(todays);
        mkdirSync(dirname(outPath), stryMutAct_9fa48("30") ? {} : (stryCov_9fa48("30"), {
          recursive: stryMutAct_9fa48("31") ? false : (stryCov_9fa48("31"), true)
        }));
        writeFileSync(outPath, html, stryMutAct_9fa48("32") ? "" : (stryCov_9fa48("32"), 'utf8'));
      }
    } catch (err) {
      if (stryMutAct_9fa48("33")) {
        {}
      } else {
        stryCov_9fa48("33");
        status = stryMutAct_9fa48("34") ? "" : (stryCov_9fa48("34"), 'fail');
        console.error(stryMutAct_9fa48("35") ? "" : (stryCov_9fa48("35"), 'fincards run error:'), err instanceof Error ? err.message : err);
        process.exitCode = 1;
      }
    }

    // run log（M0 最小可观测；字段为 M4 指标采集留接口雏形）
    console.log(JSON.stringify(stryMutAct_9fa48("36") ? {} : (stryCov_9fa48("36"), {
      run: stryMutAct_9fa48("37") ? "" : (stryCov_9fa48("37"), 'fincards'),
      fetched,
      today: todayCount,
      output: outPath,
      elapsedMs: stryMutAct_9fa48("38") ? Date.now() + start : (stryCov_9fa48("38"), Date.now() - start),
      status
    })));
  }
}
void main();