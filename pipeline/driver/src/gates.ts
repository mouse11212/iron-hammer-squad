import type { GateResult } from './inner-loop.js';

// 确定性 gate runner:三个 gate 都归约成"跑命令 + 看退出码"。
// 命令执行器(CmdRunner)注入 → 判定逻辑纯,IO 锁在一个注入点(便于确定性测试)。
//   GREEN   = lint/tsc/test 全 exit 0
//   RED     = test 非 0(测试如期红)
//   变异门  = stryker(--break 阈值)exit 0

export interface CmdResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type CmdRunner = (cmd: string, args: string[], cwd: string) => Promise<CmdResult>;

interface Step {
  label: string;
  cmd: string;
  args: string[];
}

const DEFAULT_GREEN: Step[] = [
  { label: 'lint', cmd: 'npm', args: ['run', 'lint'] },
  { label: 'typecheck', cmd: 'npm', args: ['run', 'typecheck'] },
  { label: 'test', cmd: 'npm', args: ['test'] },
];
const DEFAULT_TEST: Step = { label: 'test', cmd: 'npm', args: ['test'] };
const DEFAULT_MUTATION: Step = { label: 'mutation', cmd: 'npm', args: ['run', 'mutation'] };

export interface GateOptions {
  /** 目标工程目录(gate 在被测产品里跑，不在 driver 里跑)。 */
  cwd: string;
  green?: Step[];
  test?: Step;
  mutation?: Step;
}

const brief = (r: CmdResult): string => (r.stderr || r.stdout || `exit ${r.exitCode}`).trim().slice(0, 500);

/** 据注入的命令执行器构建 red/green/mutation 三个 gate。 */
export function makeGates(run: CmdRunner, opts: GateOptions): {
  red: () => Promise<GateResult>;
  green: () => Promise<GateResult>;
  mutation: () => Promise<GateResult>;
} {
  const green = opts.green ?? DEFAULT_GREEN;
  const test = opts.test ?? DEFAULT_TEST;
  const mutation = opts.mutation ?? DEFAULT_MUTATION;

  return {
    async green(): Promise<GateResult> {
      for (const s of green) {
        const r = await run(s.cmd, s.args, opts.cwd);
        if (r.exitCode !== 0) return { ok: false, summary: `${s.label} 失败: ${brief(r)}` };
      }
      return { ok: true };
    },

    async red(): Promise<GateResult> {
      const r = await run(test.cmd, test.args, opts.cwd);
      if (r.exitCode !== 0) return { ok: true, summary: '测试如期失败(RED)' };
      return { ok: false, summary: '测试未失败——测试可能无效,或实现已存在(测试 agent 越界)' };
    },

    async mutation(): Promise<GateResult> {
      const r = await run(mutation.cmd, mutation.args, opts.cwd);
      if (r.exitCode === 0) return { ok: true };
      return { ok: false, summary: `变异门未达标: ${brief(r)}` };
    },
  };
}
