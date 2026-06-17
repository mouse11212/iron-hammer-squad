import type { Request, RunState, InvokeFn } from './types.js';
import { startRun, completeRun, isTerminal } from './state.js';

/** 当前时刻（注入点：默认系统时钟，IO 边界）。 */
function nowIso(): string {
  return new Date().toISOString();
}

/**
 * 调度单个请求：幂等(已终态跳过)→ running → 调 claude 边界 → done|failed。
 * 纯逻辑 + 注入的 invoke/persist，便于确定性测试；自身不直接做文件 IO。
 * @param prior 该 id 的既有 run-state（无则视为新请求）
 * @param invoke claude -p 薄边界（测试注入替身）
 * @param persist 持久化回调（测试可收集；运行时写文件）
 */
export async function runOnce(
  req: Request,
  prior: RunState | undefined,
  invoke: InvokeFn,
  persist: (s: RunState) => void,
): Promise<RunState> {
  // 幂等：已 done（或失败终态）不重跑
  if (prior && isTerminal(prior)) {
    return prior;
  }

  const running = startRun({ id: req.id, status: 'queued' }, nowIso());
  persist(running);

  try {
    const res = await invoke(req.prompt);
    const final = completeRun(running, res, nowIso());
    persist(final);
    return final;
  } catch (err) {
    const final = completeRun(
      running,
      { exitCode: 1, stdout: '', stderr: err instanceof Error ? err.message : String(err) },
      nowIso(),
    );
    persist(final);
    return final;
  }
}
