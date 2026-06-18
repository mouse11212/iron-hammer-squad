import type { MetricsSnapshot } from './types.js';

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

/** 纯函数：把指标快照渲染为 markdown 看板。缺口指标显示"待埋点"，不伪造数值。 */
export function renderBoard(s: MetricsSnapshot): string {
  const vt = s.verificationTax === null ? '待埋点(实现耗时未采集)' : pct(s.verificationTax);
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
    `| Verification Tax | ${vt} | 验证耗时 ${s.verificationMs ?? '—'}ms |`,
    `| Defect Escape Rate | ${pct(s.defectEscapeRate)} | 逃逸 ${s.defects.escaped} / 总 ${s.defects.total} |`,
    '',
    '## 追溯链（change → spec → tests → commit）',
    '',
    '| change | spec | tests | commit |',
    '|---|---|---|---|',
    ...s.traces.map((t) => `| ${t.changeId} | ${t.spec} | ${t.tests.join(', ')} | ${t.commit} |`),
    '',
  ];

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

  return lines.join('\n');
}
