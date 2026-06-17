import { spawn } from 'node:child_process';
import type { InvokeResult, InvokeFn } from './types.js';

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
