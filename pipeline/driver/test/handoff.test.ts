import { describe, it, expect } from 'vitest';
import { renderHandoffReport } from '../src/handoff.js';
import type { BatchIntegrateResult } from '../src/worktree.js';

const opts = { integrationBranch: 'integration', generatedAt: '2026-06-22T00:00:00Z' };

describe('renderHandoffReport（集成交接报告,纯渲染）', () => {
  it('null(无产出)→ 说明本批无集成', () => {
    const md = renderHandoffReport(null, opts);
    expect(md).toMatch(/无集成产出|本批无/);
  });

  it('全 ready → 列 merged + 建议 squash 合并命令 + HITL 不自动合 main', () => {
    const r: BatchIntegrateResult = { ready: true, merged: ['agent/a', 'agent/b'], held: [] };
    const md = renderHandoffReport(r, opts);
    expect(md).toContain('agent/a');
    expect(md).toContain('agent/b');
    expect(md).toMatch(/merge --squash integration/); // 合并辅助命令
    expect(md).toMatch(/人类|签字|HITL/); // 明确人类决策
    expect(md).not.toMatch(/挂起|held/i); // 无挂起区
  });

  it('部分挂起 → 已集成 + 挂起(原因 + 指引)', () => {
    const r: BatchIntegrateResult = {
      ready: false,
      merged: ['agent/a'],
      held: [
        { branch: 'agent/b', reason: 'conflict' },
        { branch: 'agent/c', reason: 'gate' },
      ],
    };
    const md = renderHandoffReport(r, opts);
    expect(md).toContain('agent/a'); // 已集成
    expect(md).toContain('agent/b');
    expect(md).toContain('agent/c');
    expect(md).toMatch(/冲突|conflict/); // b 原因
    expect(md).toMatch(/门禁|gate/); // c 原因
    expect(md).toMatch(/重投|解决|修复/); // 处理指引
    expect(md).toMatch(/部分挂起|需.*处理/);
  });

  it('held-only(无 merged)→ 仅挂起区,无合并命令', () => {
    const r: BatchIntegrateResult = { ready: false, merged: [], held: [{ branch: 'agent/x', reason: 'conflict' }] };
    const md = renderHandoffReport(r, opts);
    expect(md).toContain('agent/x');
    expect(md).not.toMatch(/merge --squash/);
  });

  it('合并命令用指定 main 分支名', () => {
    const r: BatchIntegrateResult = { ready: true, merged: ['agent/a'], held: [] };
    const md = renderHandoffReport(r, { ...opts, mainBranch: 'trunk' });
    expect(md).toMatch(/checkout trunk/);
  });
});
