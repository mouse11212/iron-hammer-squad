import { describe, it, expect } from 'vitest';
import { gateSpecCoverage } from '../src/spec-coverage.js';

// --- scenario 1: capability src changed, no openspec change path → offender ---
describe('gateSpecCoverage', () => {
  it('场景1: 能力源变更，无 OpenSpec change → offender，ok=false', () => {
    const result = gateSpecCoverage({
      changedPaths: ['pipeline/driver/src/acceptance.ts'],
    });
    expect(result.ok).toBe(false);
    expect(result.offenders).toEqual(['pipeline/driver/src/acceptance.ts']);
  });

  // --- scenario 2: capability src + openspec in-progress change → ok ---
  it('场景2: 能力源变更 + in-progress OpenSpec change → ok=true, offenders=[]', () => {
    const result = gateSpecCoverage({
      changedPaths: [
        'pipeline/driver/src/acceptance.ts',
        'docs/openspec/changes/2026-06-29-x/proposal.md',
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.offenders).toEqual([]);
  });

  // --- scenario 3: no capability src in changedPaths → gate not triggered ---
  it('场景3: 无能力源（test 文件 / role 文件 / docs）→ ok=true, offenders=[]', () => {
    const result = gateSpecCoverage({
      changedPaths: [
        'pipeline/driver/test/acceptance.test.ts',
        'pipeline/roles/x.md',
        'docs/foo.md',
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.offenders).toEqual([]);
  });

  // --- scenario 4: bin shim and mcp-server.ts are NOT capability sources ---
  it('场景4: bin shim 和 mcp-server.ts 不是能力源 → ok=true, offenders=[]', () => {
    const result = gateSpecCoverage({
      changedPaths: [
        'pipeline/driver/src/bin-enqueue.ts',
        'pipeline/driver/src/mcp-server.ts',
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.offenders).toEqual([]);
  });

  // --- scenario 5: capability src with valid @spec-exempt reason → not offender ---
  it('场景5: 能力源有有效 @spec-exempt（非空 reason）→ ok=true, offenders=[]', () => {
    const result = gateSpecCoverage({
      changedPaths: ['pipeline/driver/src/acceptance.ts'],
      contents: {
        'pipeline/driver/src/acceptance.ts':
          '// some code\n// @spec-exempt: 纯重构无行为变更\nexport function foo() {}',
      },
    });
    expect(result.ok).toBe(true);
    expect(result.offenders).toEqual([]);
  });

  // --- scenario 6: @spec-exempt with whitespace-only reason → still offender ---
  it('场景6: @spec-exempt 后 reason 为纯空白 → 仍是 offender，ok=false', () => {
    const result = gateSpecCoverage({
      changedPaths: ['pipeline/driver/src/acceptance.ts'],
      contents: {
        'pipeline/driver/src/acceptance.ts':
          '// some code\n// @spec-exempt:   \nexport function foo() {}',
      },
    });
    expect(result.ok).toBe(false);
    expect(result.offenders).toEqual(['pipeline/driver/src/acceptance.ts']);
  });

  // --- scenario 7: archive path does NOT count as in-progress openspec change ---
  it('场景7: archive 下的 OpenSpec change 不算 in-progress → 能力源仍为 offender', () => {
    const result = gateSpecCoverage({
      changedPaths: [
        'pipeline/driver/src/acceptance.ts',
        'docs/openspec/changes/archive/2026-01-01-old/proposal.md',
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.offenders).toEqual(['pipeline/driver/src/acceptance.ts']);
  });

  // --- scenario 8: multiple capability srcs, one exempted one not ---
  it('场景8: 多能力源，一个有豁免一个没有 → 只有未豁免的是 offender', () => {
    const result = gateSpecCoverage({
      changedPaths: [
        'pipeline/driver/src/acceptance.ts',
        'pipeline/driver/src/gates.ts',
      ],
      contents: {
        'pipeline/driver/src/acceptance.ts':
          '// @spec-exempt: 纯重构无行为变更\nexport function foo() {}',
        // gates.ts has no exemption
      },
    });
    expect(result.ok).toBe(false);
    expect(result.offenders).toEqual(['pipeline/driver/src/gates.ts']);
  });

  // --- extra edge: bin- prefix on a deeply nested path ---
  it('边缘: pipeline/<pkg>/src/bin-something.ts（任意 pkg）不是能力源', () => {
    const result = gateSpecCoverage({
      changedPaths: ['pipeline/roles/src/bin-init.ts'],
    });
    expect(result.ok).toBe(true);
    expect(result.offenders).toEqual([]);
  });

  // --- extra edge: .test.ts inside src/ is NOT capability source ---
  it('边缘: src/ 下的 .test.ts 不是能力源', () => {
    const result = gateSpecCoverage({
      changedPaths: ['pipeline/driver/src/something.test.ts'],
    });
    expect(result.ok).toBe(true);
    expect(result.offenders).toEqual([]);
  });
});
