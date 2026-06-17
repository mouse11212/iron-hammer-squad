import { describe, it, expect } from 'vitest';
import { startRun, completeRun, isTerminal, recover } from '../src/state.js';
import type { RunState } from '../src/types.js';

const NOW = '2026-06-17T00:00:00.000Z';
const LATER = '2026-06-17T00:00:05.000Z';

describe('state machine (纯转移逻辑)', () => {
  it('queued → running（startRun）', () => {
    const s = startRun({ id: 'a', status: 'queued' }, NOW);
    expect(s.status).toBe('running');
    expect(s.startedAt).toBe(NOW);
  });

  it('running → done（exitCode 0）', () => {
    const s = completeRun({ id: 'a', status: 'running' }, { exitCode: 0, stdout: 'ok', stderr: '' }, LATER);
    expect(s.status).toBe('done');
    expect(s.exitCode).toBe(0);
    expect(s.finishedAt).toBe(LATER);
  });

  it('running → failed（非零退出码，含 error）', () => {
    const s = completeRun({ id: 'a', status: 'running' }, { exitCode: 2, stdout: '', stderr: 'boom' }, LATER);
    expect(s.status).toBe('failed');
    expect(s.exitCode).toBe(2);
    expect(s.error).toContain('boom');
  });

  it('isTerminal：done/failed 为终态，queued/running 非终态', () => {
    expect(isTerminal({ id: 'a', status: 'done' })).toBe(true);
    expect(isTerminal({ id: 'a', status: 'failed' })).toBe(true);
    expect(isTerminal({ id: 'a', status: 'queued' })).toBe(false);
    expect(isTerminal({ id: 'a', status: 'running' })).toBe(false);
  });

  it('recover：残留 running 回收为 queued（崩溃恢复），终态/queued 不变', () => {
    const states: RunState[] = [
      { id: 'a', status: 'running', startedAt: NOW },
      { id: 'b', status: 'done', exitCode: 0 },
      { id: 'c', status: 'queued' },
    ];
    const recovered = recover(states);
    expect(recovered.find((s) => s.id === 'a')!.status).toBe('queued');
    expect(recovered.find((s) => s.id === 'b')!.status).toBe('done');
    expect(recovered.find((s) => s.id === 'c')!.status).toBe('queued');
  });
});
