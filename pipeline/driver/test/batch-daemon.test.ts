import { describe, it, expect, vi } from 'vitest';
import { makeBatchDrainRound, isMainModule } from '../src/drive-parallel.js';
import { pathToFileURL } from 'node:url';
import { makeRealBatchDeps, runInnerLoopJobIsolated, type BatchDrainDeps, type BatchDrainResult } from '../src/inner-loop-runner.js';
import type { Queue } from '../src/queue-sqlite.js';

// 假队列:只关心 recover/close 被调,claim 直接抽干(drain 由注入替身负责)。
function fakeQueue(): Queue & { recoverCalls: number; closeCalls: number } {
  const q = {
    recoverCalls: 0,
    closeCalls: 0,
    recover(): number {
      q.recoverCalls++;
      return 0;
    },
    close(): void {
      q.closeCalls++;
    },
  };
  return q as unknown as Queue & { recoverCalls: number; closeCalls: number };
}

describe('makeBatchDrainRound（守护单轮:开队列→recover→批隔离 drain→close）', () => {
  it('一轮:开同一 dbPath、recover、drain、close,返回 handled', async () => {
    const q = fakeQueue();
    const openQueueFn = vi.fn(() => q);
    const drainBatch = vi.fn(async (): Promise<BatchDrainResult> => ({ handled: 3, integration: null }));
    const buildDeps = vi.fn(() => ({ tag: 'real-deps' }) as unknown as BatchDrainDeps);

    const round = makeBatchDrainRound('queue.db', { buildDeps, openQueueFn, drainBatch });
    const handled = await round();

    expect(handled).toBe(3);
    expect(openQueueFn).toHaveBeenCalledWith('queue.db');
    expect(q.recoverCalls).toBe(1);
    expect(q.closeCalls).toBe(1);
    // drain 收到本轮 buildDeps() 装配出的真实 deps
    expect(drainBatch).toHaveBeenCalledWith(q, { tag: 'real-deps' });
  });

  it('drain 抛错也关闭队列(不泄漏连接),并向上抛', async () => {
    const q = fakeQueue();
    const round = makeBatchDrainRound('queue.db', {
      buildDeps: () => ({}) as unknown as BatchDrainDeps,
      openQueueFn: () => q,
      drainBatch: async () => {
        throw new Error('drain 炸了');
      },
    });

    await expect(round()).rejects.toThrow('drain 炸了');
    expect(q.closeCalls).toBe(1);
  });

  it('每轮重新开/关队列(守护多轮不复用连接)', async () => {
    const queues: Array<ReturnType<typeof fakeQueue>> = [];
    const openQueueFn = vi.fn(() => {
      const q = fakeQueue();
      queues.push(q);
      return q;
    });
    const round = makeBatchDrainRound('queue.db', {
      buildDeps: () => ({}) as unknown as BatchDrainDeps,
      openQueueFn,
      drainBatch: async () => ({ handled: 0, integration: null }),
    });

    await round();
    await round();

    expect(queues).toHaveLength(2);
    expect(queues[0]!.closeCalls).toBe(1);
    expect(queues[1]!.closeCalls).toBe(1);
  });
});

describe('isMainModule（CLI 入口判定:兼容含中文/空格的 URL 编码路径）', () => {
  it('含中文路径:import.meta.url 已 URL 编码、argv1 未编码 → 仍判为入口', () => {
    const argv1 = '/Users/x/铁锤小队/pipeline/driver/src/drive-parallel.ts';
    const metaUrl = pathToFileURL(argv1).href; // 形如 file:///Users/x/%E9%93%81.../drive-parallel.ts
    expect(metaUrl).toContain('%'); // 确认确实被编码(否则测不到该 bug)
    expect(isMainModule(metaUrl, argv1)).toBe(true);
  });

  it('朴素拼接 `file://`+argv1 在中文路径下会漏判(回归基准,证明修复必要)', () => {
    const argv1 = '/Users/x/铁锤小队/src/a.ts';
    const metaUrl = pathToFileURL(argv1).href;
    expect(metaUrl === `file://${argv1}`).toBe(false); // 旧写法的缺陷
    expect(isMainModule(metaUrl, argv1)).toBe(true); // 新写法纠正
  });

  it('普通 ASCII 路径匹配 → true', () => {
    const argv1 = '/usr/local/app/src/drive-parallel.ts';
    expect(isMainModule(pathToFileURL(argv1).href, argv1)).toBe(true);
  });

  it('不同文件 → false(被 import 而非直接运行)', () => {
    const metaUrl = pathToFileURL('/usr/local/app/src/drive-parallel.ts').href;
    expect(isMainModule(metaUrl, '/usr/local/app/src/other.ts')).toBe(false);
  });

  it('argv1 缺失 → false', () => {
    expect(isMainModule('file:///x.ts', undefined)).toBe(false);
  });
});

describe('makeRealBatchDeps（真实 deps 装配:守住全链接线不被漏接）', () => {
  it('装齐 batchIntegrate / linkDeps / integrationGate / onHandoff,runOne=隔离派发', () => {
    const deps = makeRealBatchDeps();
    expect(deps.runOne).toBe(runInnerLoopJobIsolated); // 隔离 worktree 跑内循环
    expect(typeof deps.batchIntegrate).toBe('function'); // 批后集成(跨批累积/冲突 held)
    expect(typeof deps.linkDeps).toBe('function');
    expect(typeof deps.integrationGate).toBe('function');
    expect(typeof deps.onHandoff).toBe('function'); // HITL 交接报告(关键:不可漏接)
  });

  it('repoRoot/runtimeDir 为绝对路径,runtimeDir 落在 .runtime/worktrees', () => {
    const deps = makeRealBatchDeps();
    expect(deps.repoRoot.startsWith('/')).toBe(true);
    expect(deps.runtimeDir.startsWith('/')).toBe(true);
    expect(deps.runtimeDir.endsWith('/.runtime/worktrees')).toBe(true);
  });

  it('concurrency/baseRef 透传', () => {
    const deps = makeRealBatchDeps({ concurrency: 4, baseRef: 'origin/main' });
    expect(deps.concurrency).toBe(4);
    expect(deps.baseRef).toBe('origin/main');
  });

  it('integrationGate 在给定 projectDir 跑(注入式命令,green 全绿→ok)', async () => {
    const runs: Array<{ cmd: string; cwd: string }> = [];
    const deps = makeRealBatchDeps({
      cmd: async (cmd, _args, cwd) => {
        runs.push({ cmd, cwd });
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    });
    const g = await deps.integrationGate('/proj/x');
    expect(g.ok).toBe(true);
    expect(runs.every((r) => r.cwd === '/proj/x')).toBe(true); // gate 在该项目目录跑
    expect(runs.length).toBeGreaterThan(0);
  });
});
