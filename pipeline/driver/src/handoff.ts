import type { BatchIntegrateResult } from './worktree.js';

// 集成交接报告(HITL):把批后集成结果渲染成人类可执行的 markdown。
// 纯函数(generatedAt 注入)。明确"合 main 是人类决策"(军规 1/2),不自动合并。

export interface HandoffOpts {
  integrationBranch: string;
  mainBranch?: string;
  generatedAt: string;
}

const REASON_TEXT: Record<'conflict' | 'gate' | 'sensitive', string> = {
  conflict: '冲突(conflict):与已集成内容冲突,需人工解决后重投队列',
  gate: '门禁(gate):集成 gate 未过,需修复后重投队列',
  sensitive: '敏感改动(sensitive):触及敏感面,需人类签字后手动合(红线7/D1)',
};

/** 渲染集成交接报告。integration 为 null 表示本批无集成产出。 */
export function renderHandoffReport(integration: BatchIntegrateResult | null, opts: HandoffOpts): string {
  const main = opts.mainBranch ?? 'main';
  const lines: string[] = ['# 集成交接报告(HITL)', '', `> 生成于 ${opts.generatedAt} · 合并到 ${main} 是人类决策(军规 1/2),系统不自动合并`, ''];

  if (integration === null || (integration.merged.length === 0 && integration.held.length === 0)) {
    lines.push('本批无成功 feature,无集成产出。');
    return lines.join('\n');
  }

  lines.push(`状态:${integration.ready ? '✅ 全部已集成,可合 ' + main : '⚠️ 部分挂起,处理后重跑'}`, '');

  if (integration.merged.length > 0) {
    lines.push(`## ✅ 已集成(待人类合 ${main})`, '');
    lines.push(...integration.merged.map((b) => `- ${b}`));
    lines.push(
      '',
      '建议合并(人类执行,先 review diff——军规 7 永远看 diff、讲不清不发布):',
      '```',
      `git checkout ${main} && git merge --squash ${opts.integrationBranch} && git commit`,
      `# 合并后可删 ${opts.integrationBranch} 分支,下批自 base 重新累积`,
      '```',
      '',
    );
  }

  if (integration.held.length > 0) {
    lines.push('## ⚠️ 挂起(需人处理)', '');
    lines.push(...integration.held.map((h) => `- ${h.branch} — ${REASON_TEXT[h.reason]}${h.categories?.length ? `[${h.categories.join(', ')}]` : ''}`));
    lines.push('');
  }

  return lines.join('\n');
}
