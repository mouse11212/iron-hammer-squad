import type { MetricsSnapshot } from './types.js';
import type { HistoryRecord } from './report-history.js';

/** 趋势区取最近 N 次归档(history.jsonl 留全量,N 仅截显示)。 */
const TREND_N = 10;

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

/** 纯函数：把指标快照渲染为 markdown 看板。缺口指标显示"待埋点"，不伪造数值。
 *  可选 history(report 历史归档)非空时渲染「指标趋势」区(取最近 N 次);不传/空则省略，既有调用零变化。 */
export function renderBoard(s: MetricsSnapshot, history?: HistoryRecord[]): string {
  const vt = s.verificationTax === null ? '待埋点(无 done-run 指标 trailer)' : pct(s.verificationTax);
  const der = s.defectEscapeRate === null ? '待埋点(无缺陷记录)' : pct(s.defectEscapeRate);
  const caught = s.defects.total - s.defects.escaped;
  const lines = [
    '# 铁锤小队 · Harness 看板',
    '',
    `> 生成于 ${s.generatedAt} · 四指标基线无标准值，需产线标定(V4 §7)`,
    '',
    '## harness 四指标',
    '',
    '| 指标 | 值 | 说明 |',
    '|---|---|---|',
    `| Task Resolution Rate | ${pct(s.taskResolutionRate)} | 已解决 ${s.resolved} / 尝试 ${s.attempted} |`,
    `| Code Churn | +${s.codeChurn.added} / -${s.codeChurn.removed}（${s.codeChurn.files} 文件） | diff 代理 |`,
    `| Verification Tax | ${vt} | 验证 ${s.verificationMs ?? '—'}ms / 实现 ${s.implementationMs ?? '—'}ms |`,
    `| Defect Escape Rate | ${der} | 逃逸 ${s.defects.escaped} / 拦截 ${caught}（均 git trailer） |`,
    '',
    '## 追溯链（change → spec → tests → commit）',
    '',
    '| change | spec | tests | commit |',
    '|---|---|---|---|',
    ...s.traces.map((t) => `| ${t.changeId} | ${t.spec} | ${t.tests.join(', ')} | ${t.commit} |`),
    '',
  ];

  if (s.taxByTrace.length > 0) {
    lines.push(
      '## Verification Tax 按 US（traceId）',
      '',
      '| traceId | 实现ms | 验证ms | tax |',
      '|---|---|---|---|',
      ...s.taxByTrace.map((t) => `| ${t.traceId} | ${t.implementationMs} | ${t.verificationMs} | ${t.tax === null ? '待埋点' : pct(t.tax)} |`),
      '',
    );
  }

  if (s.innerLoop) {
    const il = s.innerLoop;
    const dist = Object.keys(il.fixRoundsDistribution)
      .map(Number)
      .sort((a, b) => a - b)
      .map((k) => `${k}:${il.fixRoundsDistribution[k]}`)
      .join(', ');
    const avg = il.avgCostUsd === null ? '—' : `$${il.avgCostUsd.toFixed(4)}`;
    lines.push(
      '## inner-loop 自主运行（① Loop）',
      '',
      '| 指标 | 值 |',
      '|---|---|',
      `| 总运行 | ${il.total} |`,
      `| 状态 | done ${il.byStatus.done} / failed ${il.byStatus.failed} / blocked-escalated ${il.byStatus.blockedEscalated} |`,
      `| 升级率 | ${pct(il.escalationRate)} |`,
      `| 回修轮次分布 | ${dist} |`,
      `| 成本 | 总 $${il.totalCostUsd.toFixed(4)} / 均 ${avg} |`,
      '',
    );
  }

  if (history && history.length > 0) {
    const recent = history.slice(-TREND_N);
    lines.push(
      `## 指标趋势（最近 ${TREND_N} 次归档）`,
      '',
      '| 时间 | 解决率 | Verification Tax | Defect Escape | Churn |',
      '|---|---|---|---|---|',
      ...recent.map(
        (h) =>
          `| ${h.generatedAt} | ${pct(h.taskResolutionRate)} | ${h.verificationTax === null ? '待埋点' : pct(h.verificationTax)} | ${h.defectEscapeRate === null ? '待埋点' : pct(h.defectEscapeRate)} | ${h.codeChurnTotal} |`,
      ),
      '',
    );
  }

  return lines.join('\n');
}
