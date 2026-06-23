import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeEventSink } from '../src/events.js';
import { instrumentRunPhase, instrumentGateCmd, emitSquash, type InstrumentCtx } from '../src/instrument.js';
import { readEvents, groupByTrace, formatReplay } from '../src/replay.js';
import { makeGates, type CmdResult } from '../src/gates.js';
import { runInnerLoop, type PhaseOutput } from '../src/inner-loop.js';
import type { Verdict } from '../src/types.js';

// 集成:用注入的 phaseInvoke/cmd（无需真 claude）跑一遍 runInnerLoop → 真 sink 落盘 →
// 按 jobId(=traceId) 回放重建 phase→gate→squash 有序链。验证 events+instrument+replay 协同。

describe('事件全链集成（runInnerLoop → events.jsonl → 按 traceId 回放）', () => {
  it('happy-path:落盘 phase/gate/squash 事件，traceId 一致，回放重建有序链', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ih-int-'));
    try {
      const path = join(dir, 'events.jsonl');
      const sink = makeEventSink(path);
      let t = 0;
      const ctx: InstrumentCtx = { traceId: 'job-int', emit: sink, clock: () => (t += 1) };

      // 注入假 runPhase（恒成功）
      const runPhase = instrumentRunPhase(
        async (i): Promise<PhaseOutput> => ({ exitCode: 0, sessionId: `s-${i.role}` }),
        ctx,
      );

      // 脚本化假 cmd（按 happy-path 调用序）：
      // red 跑 npm test(须非0=如期红) → green 跑 lint/tc/test(全0) → mutation 跑 git show-prefix/status(空=跳变异)
      const queue: CmdResult[] = [
        { exitCode: 1, stdout: '', stderr: 'tests fail' }, // red: npm test → 非0(RED ok)
        { exitCode: 0, stdout: '', stderr: '' }, // green: lint
        { exitCode: 0, stdout: '', stderr: '' }, // green: typecheck
        { exitCode: 0, stdout: '', stderr: '' }, // green: test
        { exitCode: 0, stdout: '', stderr: '' }, // mutation: git rev-parse --show-prefix
        { exitCode: 0, stdout: '', stderr: '' }, // mutation: git status --porcelain（空→跳 stryker）
      ];
      let ci = 0;
      const cmd = instrumentGateCmd(async (): Promise<CmdResult> => queue[ci++]!, ctx);
      const gates = makeGates(cmd, { cwd: '/proj' });

      const readVerdict = async (): Promise<Verdict> => ({ decision: 'pass', mustFix: [] });

      const result = await runInnerLoop({ id: 'job-int' }, { runPhase, gates, readVerdict });
      expect(result.status).toBe('done');

      // squash 在隔离编排里发（这里模拟 done 后的单点发射）
      emitSquash(ctx, { committed: true, branch: 'agent/job-int' });

      // 读回 + 回放
      const trace = groupByTrace(readEvents(path)).get('job-int');
      expect(trace).toBeDefined();
      expect(trace!.every((e) => e.traceId === 'job-int')).toBe(true);

      const ops = trace!.map((e) => e.op);
      expect(ops[0]).toBe('phase'); // 首个是 test phase
      expect(ops[ops.length - 1]).toBe('squash'); // 末尾是 squash
      expect(ops.filter((o) => o === 'gate').length).toBe(6); // 6 条 gate 命令

      const phases = trace!.filter((e) => e.op === 'phase').map((e) => e.phase);
      expect(phases).toEqual(['test', 'dev', 'review']); // phase 按链路顺序

      const formatted = formatReplay(trace!);
      expect(formatted).toContain('phase/test');
      expect(formatted).toContain('squash');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
