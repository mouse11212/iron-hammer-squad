import { describe, it, expect } from 'vitest';
import { squashMessage } from '../src/squash-message.js';

describe('squashMessage（纯:构建 squash 提交消息,据 fixRounds emit Defect-Caught trailer）', () => {
  it('fixRounds=0 → 只基础标题,无 Defect-Caught trailer', () => {
    const msg = squashMessage('job-x', 0);
    expect(msg).toBe('feat(job-x): inner-loop 交付');
    expect(msg).not.toContain('Defect-Caught');
  });

  it('fixRounds=2 → 基础标题 + 2 行 Defect-Caught trailer(末尾连续块)', () => {
    const msg = squashMessage('job-x', 2);
    expect(msg).toBe(
      'feat(job-x): inner-loop 交付\n\nDefect-Caught: inner-loop 回修轮 1\nDefect-Caught: inner-loop 回修轮 2',
    );
  });

  it('fixRounds=1 → 单行 trailer,轮次索引从 1 起', () => {
    const msg = squashMessage('relativeTime', 1);
    expect(msg).toContain('feat(relativeTime): inner-loop 交付');
    expect((msg.match(/^Defect-Caught:/gm) ?? []).length).toBe(1);
    expect(msg).toContain('回修轮 1');
  });

  it('phaseMs(无回修)→ 含 Metrics-Phase-Ms 行(仅非零、保持顺序),无 Defect-Caught', () => {
    const msg = squashMessage('job-x', 0, { dev: 95000, test: 113000, review: 0, gate: 12000 });
    expect(msg).toBe('feat(job-x): inner-loop 交付\n\nMetrics-Phase-Ms: dev=95000 test=113000 gate=12000');
    expect(msg).not.toContain('Defect-Caught');
    expect(msg).not.toContain('review='); // 零项剔除
  });

  it('fixRounds + phaseMs → Defect-Caught 块在前,Metrics-Phase-Ms 在后', () => {
    const msg = squashMessage('job-x', 2, { dev: 1 });
    expect(msg).toBe(
      'feat(job-x): inner-loop 交付\n\nDefect-Caught: inner-loop 回修轮 1\nDefect-Caught: inner-loop 回修轮 2\nMetrics-Phase-Ms: dev=1',
    );
  });

  it('phaseMs 省略或全零 → 无 Metrics-Phase-Ms 行', () => {
    expect(squashMessage('job-x', 0)).toBe('feat(job-x): inner-loop 交付');
    expect(squashMessage('job-x', 0, { dev: 0, gate: 0 })).toBe('feat(job-x): inner-loop 交付');
  });
});
