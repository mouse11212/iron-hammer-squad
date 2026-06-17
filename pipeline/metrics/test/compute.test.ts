import { describe, it, expect } from 'vitest';
import { taskResolutionRate, codeChurn, verificationTax, defectEscapeRate } from '../src/compute.js';

describe('harness 四指标(纯函数)', () => {
  it('TaskResolutionRate = 已解决/尝试', () => {
    expect(taskResolutionRate(3, 4)).toBe(0.75);
  });
  it('TRR：尝试为 0 返回 0(不除零)', () => {
    expect(taskResolutionRate(0, 0)).toBe(0);
  });

  it('CodeChurn 汇总 added/removed/total/files', () => {
    const c = codeChurn([
      { added: 10, removed: 2 },
      { added: 5, removed: 5 },
    ]);
    expect(c).toEqual({ added: 15, removed: 7, total: 22, files: 2 });
  });
  it('CodeChurn 空输入', () => {
    expect(codeChurn([])).toEqual({ added: 0, removed: 0, total: 0, files: 0 });
  });

  it('VerificationTax = 验证/(验证+实现)', () => {
    expect(verificationTax(2, 8)).toBe(0.2);
  });
  it('VerificationTax 实现耗时为 null → null(待埋点，不臆造)', () => {
    expect(verificationTax(2, null)).toBeNull();
  });

  it('DefectEscapeRate = 逃逸/总', () => {
    expect(defectEscapeRate(1, 4)).toBe(0.25);
  });
  it('DefectEscapeRate 总为 0 → 0(不除零)', () => {
    expect(defectEscapeRate(0, 0)).toBe(0);
  });
});
