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
});
