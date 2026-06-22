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

/** GREEN 多步:label 用于失败定位摘要。 */
interface GreenStep {
  label: string;
  cmd: string;
  args: string[];
}
/** 单命令(red/mutation):无 label(不进摘要,避免死字段)。 */
interface Cmd {
  cmd: string;
  args: string[];
}

const DEFAULT_GREEN: GreenStep[] = [
  { label: 'lint', cmd: 'npm', args: ['run', 'lint'] },
  { label: 'typecheck', cmd: 'npm', args: ['run', 'typecheck'] },
  { label: 'test', cmd: 'npm', args: ['test'] },
];
const DEFAULT_TEST: Cmd = { cmd: 'npm', args: ['test'] };
const DEFAULT_MUTATION: Cmd = { cmd: 'npm', args: ['run', 'mutation'] };

export interface GateOptions {
  /** 目标工程目录(gate 在被测产品里跑，不在 driver 里跑)。 */
  cwd: string;
  green?: GreenStep[];
  test?: Cmd;
  mutation?: Cmd;
}

const brief = (r: CmdResult): string => (r.stderr || r.stdout || `exit ${r.exitCode}`).trim().slice(0, 500);

/**
 * 纯解析 `git status --porcelain` → 本切片待变异的源文件(src/*.ts,排除测试/非源/已删除)。
 * 修 harness 缺口:inner-loop 变异门据此动态确定 mutate 范围,使 dev 新建文件也被把关,
 * 而非依赖静态 stryker.conf(新文件会逃门)。
 */
export function mutateTargetsFromStatus(porcelain: string): string[] {
  const out = new Set<string>();
  for (const raw of porcelain.split('\n')) {
    if (!raw.trim()) continue;
    if (raw[0] === 'D' || raw[1] === 'D') continue; // 已删除文件无法变异
    let path = raw.slice(3).trim();
    const arrow = path.indexOf(' -> ');
    if (arrow !== -1) path = path.slice(arrow + 4).trim(); // 重命名取新路径
    path = path.replace(/^"(.*)"$/, '$1'); // porcelain 对含空格路径加引号
    if (path.startsWith('src/') && path.endsWith('.ts') && !path.endsWith('.test.ts')) {
      out.add(path);
    }
  }
  return [...out];
}

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
      // 动态范围:据 git 改动确定本切片要变异的源文件,用 --mutate 覆盖静态 stryker.conf。
      const status = await run('git', ['status', '--porcelain'], opts.cwd);
      const targets = mutateTargetsFromStatus(status.stdout);
      if (targets.length === 0) return { ok: true, summary: '无源文件改动,跳过变异门' };
      const r = await run(mutation.cmd, [...mutation.args, '--', '--mutate', targets.join(',')], opts.cwd);
      if (r.exitCode === 0) return { ok: true, summary: `变异门覆盖 ${targets.length} 个改动源文件` };
      return { ok: false, summary: `变异门未达标: ${brief(r)}` };
    },
  };
}
