import { spawn } from 'node:child_process';
import type { InvokeResult, InvokeFn } from './types.js';

// ───────── inner-loop phase 边界(M5/PEV)─────────
// 用 `--output-format stream-json --verbose`:一条流既是 trace(含 phase 内子 agent 事件,
// 满足可观测硬约束),收尾的 type:result 事件又带 session_id(回修 resume)+ usage/cost(喂 metrics)。
// 纯逻辑(argv 构造 + 流解析)拆出可测;spawn 是薄边界(同 makeClaudeInvoke,脱测试由端到端覆盖)。

export interface PhaseArgsInput {
  prompt: string;
  /** 会话 id:新会话用作 --session-id;回修用作 --resume。 */
  sessionId: string;
  /** true=续接(--resume);false=新会话(--session-id)。 */
  resume: boolean;
}

/** 纯构造 claude argv;prompt 走末位位置参数。 */
export function buildPhaseArgs(i: PhaseArgsInput): string[] {
  // bypassPermissions:自主流水线 phase 须免审批运行;安全网=角色硬边界 + 确定性 gate + verdict + blocked-escalated 人类门。
  const base = ['--print', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'bypassPermissions'];
  const session = i.resume ? ['--resume', i.sessionId] : ['--session-id', i.sessionId];
  return [...base, ...session, i.prompt];
}

/** 从 stream-json 行里提取的 phase 元数据。 */
export interface PhaseMeta {
  sessionId?: string;
  isError: boolean;
  result: string;
  costUsd?: number;
}

/** 纯解析:扫描 stream-json 行,取最后一个 type:result 事件的元数据;无 result 视为出错。 */
export function parsePhaseResult(lines: string[]): PhaseMeta {
  let found: Record<string, unknown> | undefined;
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    let ev: unknown;
    try {
      ev = JSON.parse(t);
    } catch {
      continue;
    }
    if (typeof ev === 'object' && ev !== null && (ev as Record<string, unknown>).type === 'result') {
      found = ev as Record<string, unknown>;
    }
  }
  if (!found) return { isError: true, result: '' };
  return {
    sessionId: typeof found.session_id === 'string' ? found.session_id : undefined,
    isError: found.is_error === true,
    result: typeof found.result === 'string' ? found.result : '',
    costUsd: typeof found.total_cost_usd === 'number' ? found.total_cost_usd : undefined,
  };
}

// 瞬时基础设施错误信号(可重试):网络/连接/超时/过载/限流/5xx。
// 仅匹配明确瞬时信号,不把普通失败(测试断言失败、实现错误)误判为可重试。
const TRANSIENT = /socket|connection|econnreset|etimedout|timed?\s?out|overloaded|rate.?limit|fetch failed|network|closed unexpectedly|\b(?:429|500|502|503|529)\b/i;

/** 判别 phase 结果文本是否为瞬时基础设施错误(可重试)。纯函数。 */
export function isTransientApiError(text: string): boolean {
  return TRANSIENT.test(text);
}

export interface PhaseInvokeResult extends PhaseMeta {
  exitCode: number;
}

export interface PhaseInvokeInput extends PhaseArgsInput {
  /** 每条 stream-json 行的回调(用于落 trace JSONL)。 */
  onTraceLine?: (line: string) => void;
}

/** 薄边界:经 `claude -p stream-json` 跑一个 phase,逐行喂 trace,收尾解析元数据。 */
export function makePhaseInvoke(
  opts: { cwd?: string; timeoutMs?: number } = {},
): (input: PhaseInvokeInput) => Promise<PhaseInvokeResult> {
  return (input) =>
    new Promise((resolve) => {
      const child = spawn('claude', buildPhaseArgs(input), {
        cwd: opts.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const lines: string[] = [];
      let buf = '';
      const push = (line: string): void => {
        if (!line.trim()) return;
        lines.push(line);
        input.onTraceLine?.(line);
      };
      const timer =
        opts.timeoutMs !== undefined ? setTimeout(() => child.kill('SIGKILL'), opts.timeoutMs) : undefined;
      child.stdout.on('data', (d: Buffer) => {
        buf += d.toString();
        let idx: number;
        while ((idx = buf.indexOf('\n')) >= 0) {
          push(buf.slice(0, idx));
          buf = buf.slice(idx + 1);
        }
      });
      child.on('close', (code) => {
        if (timer) clearTimeout(timer);
        push(buf);
        const meta = parsePhaseResult(lines);
        resolve({ ...meta, exitCode: meta.isError ? 1 : code ?? 0 });
      });
      child.on('error', (err) => {
        if (timer) clearTimeout(timer);
        resolve({ exitCode: 1, isError: true, result: String(err) });
      });
    });
}

/**
 * 薄边界：经 `claude --print` 无头执行一个提示。
 * 这是流水线唯一接触非确定性(模型)的点；确定性测试用替身替代它。
 */
export function makeClaudeInvoke(opts: { cwd?: string; timeoutMs?: number } = {}): InvokeFn {
  return (prompt: string): Promise<InvokeResult> =>
    new Promise((resolve) => {
      const child = spawn('claude', ['--print', prompt], {
        cwd: opts.cwd,
        stdio: ['ignore', 'pipe', 'pipe'], // 忽略 stdin：prompt 走位置参数，避免 claude 等待 stdin
      });
      let stdout = '';
      let stderr = '';
      const timer =
        opts.timeoutMs !== undefined
          ? setTimeout(() => child.kill('SIGKILL'), opts.timeoutMs)
          : undefined;
      child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
      child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
      child.on('close', (code) => {
        if (timer) clearTimeout(timer);
        resolve({ exitCode: code ?? 1, stdout, stderr });
      });
      child.on('error', (err) => {
        if (timer) clearTimeout(timer);
        resolve({ exitCode: 1, stdout, stderr: String(err) });
      });
    });
}
