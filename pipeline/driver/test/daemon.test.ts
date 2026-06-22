import { describe, it, expect, vi } from 'vitest';
import { driveParallelLoop } from '../src/drive-parallel.js';

/** 顺序返回每轮 handled 数。 */
function seqDrain(counts: number[]) {
  let i = 0;
  return vi.fn(async () => counts[Math.min(i++, counts.length - 1)]!);
}

describe('driveParallelLoop（轮询守护:注入 drainRound/sleep）', () => {
  it('连续空轮达上限即停(不无限空转)', async () => {
    const drainRound = seqDrain([2, 1, 0, 0]); // 第 3、4 轮空
    const sleep = vi.fn(async () => {});
    const r = await driveParallelLoop({ drainRound, sleep, maxEmptyRounds: 2 });
    expect(r.rounds).toBe(4); // 第 2 个连续空轮后停
    expect(r.totalHandled).toBe(3);
  });

  it('启动即空且达上限 → 立即停', async () => {
    const r = await driveParallelLoop({ drainRound: seqDrain([0, 0]), sleep: vi.fn(async () => {}), maxEmptyRounds: 2 });
    expect(r.rounds).toBe(2);
    expect(r.totalHandled).toBe(0);
  });

  it('持续有活则不停(空轮计数被重置)', async () => {
    const r = await driveParallelLoop({ drainRound: seqDrain([1, 1, 0, 1, 0, 0]), sleep: vi.fn(async () => {}), maxEmptyRounds: 2 });
    expect(r.rounds).toBe(6); // 中间单个空轮不触发停止(被随后非空重置)
    expect(r.totalHandled).toBe(3);
  });

  it('每轮之间 sleep(轮询间隔)', async () => {
    const sleep = vi.fn(async () => {});
    await driveParallelLoop({ drainRound: seqDrain([0, 0]), sleep, pollMs: 500, maxEmptyRounds: 2 });
    expect(sleep).toHaveBeenCalledWith(500);
  });
});
