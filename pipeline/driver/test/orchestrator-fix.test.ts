import { describe, it, expect, vi } from 'vitest';
import { registerMutationTarget, makeOrchestratorFix } from '../src/orchestrator-fix.js';
import type { MustFix } from '../src/types.js';

describe('registerMutationTarget（纯:登记文件进 stryker.conf mutate，幂等、保留其它字段）', () => {
  const conf = (mutate: string[]): string =>
    JSON.stringify({ testRunner: 'vitest', mutate, thresholds: { break: 90 } }, null, 2);

  it('把新文件加进 mutate 列表', () => {
    const out = JSON.parse(registerMutationTarget(conf(['src/a.ts']), 'src/b.ts'));
    expect(out.mutate).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('幂等:已存在不重复', () => {
    const out = JSON.parse(registerMutationTarget(conf(['src/a.ts']), 'src/a.ts'));
    expect(out.mutate).toEqual(['src/a.ts']);
  });

  it('保留其它字段(testRunner/thresholds)', () => {
    const out = JSON.parse(registerMutationTarget(conf(['src/a.ts']), 'src/b.ts'));
    expect(out.testRunner).toBe('vitest');
    expect(out.thresholds).toEqual({ break: 90 });
  });

  it('mutate 缺失时创建', () => {
    const out = JSON.parse(registerMutationTarget(JSON.stringify({ testRunner: 'vitest' }), 'src/a.ts'));
    expect(out.mutate).toEqual(['src/a.ts']);
  });
});

describe('makeOrchestratorFix（白名单代修:仅 register-mutation-target）', () => {
  function deps(confText: string): {
    d: Parameters<typeof makeOrchestratorFix>[0];
    writes: Array<[string, string]>;
  } {
    const writes: Array<[string, string]> = [];
    return {
      d: {
        projectDir: '/proj',
        readFile: vi.fn(() => confText),
        writeFile: vi.fn((p: string, c: string) => {
          writes.push([p, c]);
        }),
      },
      writes,
    };
  }
  const conf = JSON.stringify({ mutate: ['src/a.ts'] }, null, 2);

  it('register-mutation-target:读 stryker.conf → 写回含新文件 → ok', async () => {
    const { d, writes } = deps(conf);
    const fix: MustFix = { domain: 'orchestrator', desc: 'x', action: { type: 'register-mutation-target', file: 'src/b.ts' } };
    const r = await makeOrchestratorFix(d)([fix]);
    expect(r.ok).toBe(true);
    expect(d.readFile).toHaveBeenCalledWith('/proj/stryker.conf.json');
    expect(writes[0]![0]).toBe('/proj/stryker.conf.json');
    expect(JSON.parse(writes[0]![1]).mutate).toContain('src/b.ts');
    expect(r.summary).toContain('src/b.ts'); // summary 报告登记了哪些文件(可审计)
  });

  it('不识别的 action(或无 action)→ ok:false(→escalated,不静默吞)', async () => {
    const { d } = deps(conf);
    const r = await makeOrchestratorFix(d)([{ domain: 'orchestrator', desc: 'x' }]);
    expect(r.ok).toBe(false);
    expect(r.summary).toMatch(/不识别/); // 明确不识别原因(不静默)
    expect(r.summary).toContain('无 action'); // 无 action 时报告具体缺因(钉死 fallback 文案)
    expect(d.writeFile).not.toHaveBeenCalled();
  });

  it('多个登记:逐个写回,summary 列全部', async () => {
    const { d, writes } = deps(conf);
    const r = await makeOrchestratorFix(d)([
      { domain: 'orchestrator', desc: 'x', action: { type: 'register-mutation-target', file: 'src/b.ts' } },
      { domain: 'orchestrator', desc: 'y', action: { type: 'register-mutation-target', file: 'src/c.ts' } },
    ]);
    expect(r.ok).toBe(true);
    expect(writes.length).toBe(2);
    expect(r.summary).toMatch(/src\/b\.ts, src\/c\.ts/); // 钉死 registered.join(', ') 分隔与顺序
  });
});
