import { describe, it, expect } from 'vitest';
import { buildPhasePrompt } from '../src/prompts.js';

const base = {
  roleDoc: '# 角色:测试 Agent\n只写测试文件',
  conventionsDoc: '# 约定\n纯逻辑 test-first',
  context: { specSlice: 'WHEN 空输入 THEN 报错', targetPaths: ['src/foo.ts', 'test/foo.test.ts'], projectDir: '/proj' },
};

describe('buildPhasePrompt（纯组合角色 spawn prompt）', () => {
  it('基础:嵌入角色文档 + 约定 + 规约切片 + 目标路径', () => {
    const p = buildPhasePrompt({ role: 'test', ...base });
    expect(p).toContain('只写测试文件'); // roleDoc
    expect(p).toContain('纯逻辑 test-first'); // conventionsDoc
    expect(p).toContain('WHEN 空输入 THEN 报错'); // specSlice
    expect(p).toContain('src/foo.ts'); // targetPaths
  });

  it('回修:嵌入每条 must-fix 描述 + 回修标记', () => {
    const p = buildPhasePrompt({
      role: 'dev',
      ...base,
      mustFix: [{ domain: 'impl', desc: '失败路径覆盖产物' }],
    });
    expect(p).toContain('失败路径覆盖产物');
    expect(p).toMatch(/回修|must-fix/i);
  });

  it('评审角色:含把 verdict JSON 写到指定路径的指示', () => {
    const p = buildPhasePrompt({
      role: 'review',
      ...base,
      context: { ...base.context, verdictPath: '/proj/.verdict.json' },
    });
    expect(p).toContain('/proj/.verdict.json');
    expect(p).toMatch(/verdict/i);
  });

  it('非回修时不含回修区块', () => {
    const p = buildPhasePrompt({ role: 'test', ...base });
    expect(p).not.toMatch(/must-fix 清单/);
  });
});
