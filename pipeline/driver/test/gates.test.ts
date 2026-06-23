import { describe, it, expect, vi } from 'vitest';
import { makeGates, mutateTargetsFromStatus, changedPathsFromStatus } from '../src/gates.js';
import type { CmdResult } from '../src/gates.js';

const okRes: CmdResult = { exitCode: 0, stdout: '', stderr: '' };
const failRes = (stderr: string): CmdResult => ({ exitCode: 1, stdout: '', stderr });

/** 据命令字符串(cmd + args 拼接)映射结果的 runner 替身。 */
function runnerByCmd(map: Record<string, CmdResult>) {
  return vi.fn(async (cmd: string, args: string[]): Promise<CmdResult> => {
    const key = [cmd, ...args].join(' ');
    return map[key] ?? okRes;
  });
}

describe('makeGates（注入命令执行器，确定性判定）', () => {
  it('GREEN gate:lint/tsc/test 全 0 → ok', async () => {
    const gates = makeGates(runnerByCmd({}), { cwd: '/x' });
    expect((await gates.green()).ok).toBe(true);
  });

  it('GREEN gate:任一命令非 0 → 不 ok,summary 指出失败命令', async () => {
    const gates = makeGates(runnerByCmd({ 'npm run typecheck': failRes('tsc 报错') }), { cwd: '/x' });
    const r = await gates.green();
    expect(r.ok).toBe(false);
    expect(r.summary).toMatch(/typecheck/);
  });

  it('RED gate:测试非 0(如期红)→ ok', async () => {
    const gates = makeGates(runnerByCmd({ 'npm test': failRes('1 failed') }), { cwd: '/x' });
    expect((await gates.red()).ok).toBe(true);
  });

  it('RED gate:测试却通过(没红)→ 不 ok', async () => {
    const gates = makeGates(runnerByCmd({}), { cwd: '/x' }); // 默认全 0 → test 通过
    expect((await gates.red()).ok).toBe(false);
  });

  // 动态变异范围:gate 跑 stryker 前据 git status 算出本切片改动的源文件,用 --mutate 覆盖静态配置
  function gitAnd(statusStdout: string, mutationResult: CmdResult = okRes, prefix = '') {
    return vi.fn(async (cmd: string, args: string[]): Promise<CmdResult> => {
      if (cmd === 'git' && args.includes('rev-parse')) return { exitCode: 0, stdout: prefix, stderr: '' };
      if (cmd === 'git') return { exitCode: 0, stdout: statusStdout, stderr: '' };
      if (cmd === 'npm' && args.includes('mutation')) return mutationResult;
      return okRes;
    });
  }

  it('变异门:有 src 改动 + stryker exit 0 → ok,且把改动源文件传给 --mutate(排除测试文件)', async () => {
    const run = gitAnd(' M src/foo.ts\n?? test/foo.test.ts\n');
    const r = await makeGates(run, { cwd: '/x' }).mutation();
    expect(r.ok).toBe(true);
    expect(r.summary).toMatch(/覆盖.*1/); // 摘要含覆盖文件数
    expect(run).toHaveBeenCalledWith('git', ['status', '--porcelain'], '/x'); // 据 git 算范围
    const mutationCall = run.mock.calls.find((c) => c[0] === 'npm' && (c[1] as string[]).includes('mutation'));
    const args = mutationCall![1] as string[];
    expect(args).toContain('--'); // npm 透传分隔符
    const mIdx = args.indexOf('--mutate');
    expect(args[mIdx + 1]).toBe('src/foo.ts'); // 仅源文件,测试文件被排除
  });

  it('变异门:多个改动源文件 → --mutate 以逗号连接', async () => {
    const run = gitAnd(' M src/a.ts\n?? src/b.ts\n');
    await makeGates(run, { cwd: '/x' }).mutation();
    const args = run.mock.calls.find((c) => c[0] === 'npm' && (c[1] as string[]).includes('mutation'))![1] as string[];
    expect(args[args.indexOf('--mutate') + 1]).toBe('src/a.ts,src/b.ts');
  });

  it('变异门:子目录工程,据 git prefix 把仓库根相对路径剥成工程相对再传 --mutate', async () => {
    const run = gitAnd('?? sub/proj/src/foo.ts\n', okRes, 'sub/proj/');
    await makeGates(run, { cwd: '/repo/sub/proj' }).mutation();
    const args = run.mock.calls.find((c) => c[0] === 'npm' && (c[1] as string[]).includes('mutation'))![1] as string[];
    expect(args[args.indexOf('--mutate') + 1]).toBe('src/foo.ts'); // 工程相对,非仓库根相对
  });

  it('变异门:有 src 改动 + stryker 非 0 → 不 ok,summary 透传', async () => {
    const run = gitAnd(' M src/foo.ts\n', failRes('2 survived'));
    const r = await makeGates(run, { cwd: '/x' }).mutation();
    expect(r.ok).toBe(false);
    expect(r.summary).toContain('2 survived');
  });

  it('变异门:无源文件改动 → 跳过(ok),不调 stryker', async () => {
    const run = gitAnd('?? test/only-test.test.ts\n M README.md\n'); // 无 src/*.ts
    const r = await makeGates(run, { cwd: '/x' }).mutation();
    expect(r.ok).toBe(true);
    expect(r.summary).toMatch(/跳过/);
    expect(run.mock.calls.some((c) => c[0] === 'npm' && (c[1] as string[]).includes('mutation'))).toBe(false);
  });

  it('在注入的 cwd 下执行命令', async () => {
    const run = runnerByCmd({});
    const gates = makeGates(run, { cwd: '/proj' });
    await gates.green();
    expect(run).toHaveBeenCalledWith('npm', expect.arrayContaining(['run', 'lint']), '/proj');
  });

  it('GREEN 依次跑默认三步:npm run lint / npm run typecheck / npm test', async () => {
    const run = runnerByCmd({});
    await makeGates(run, { cwd: '/x' }).green();
    const calls = run.mock.calls.map((c) => [c[0], (c[1] as string[]).join(' ')].join(' '));
    expect(calls).toEqual(['npm run lint', 'npm run typecheck', 'npm test']);
  });

  it('GREEN summary 透传失败命令的输出(brief)', async () => {
    const gates = makeGates(runnerByCmd({ 'npm run typecheck': failRes('tsc 报错 TS1234') }), { cwd: '/x' });
    expect((await gates.green()).summary).toContain('tsc 报错 TS1234');
  });

  it('GREEN lint 失败 → summary 标注 lint 步', async () => {
    expect((await makeGates(runnerByCmd({ 'npm run lint': failRes('eslint err') }), { cwd: '/x' }).green()).summary).toMatch(/lint/);
  });

  it('GREEN test(第三步) 失败 → summary 标注 test 步', async () => {
    expect((await makeGates(runnerByCmd({ 'npm test': failRes('1 failed') }), { cwd: '/x' }).green()).summary).toMatch(/test/);
  });

  it('GREEN summary 仅在 stderr 空时回落 stdout', async () => {
    const gates = makeGates(runnerByCmd({ 'npm run lint': { exitCode: 1, stdout: 'STDOUT问题', stderr: '' } }), { cwd: '/x' });
    expect((await gates.green()).summary).toContain('STDOUT问题');
  });

  it('RED 用默认 npm test;如期红时 summary 标注 RED', async () => {
    const run = runnerByCmd({ 'npm test': failRes('1 failed') });
    const r = await makeGates(run, { cwd: '/x' }).red();
    expect(run).toHaveBeenCalledWith('npm', ['test'], '/x');
    expect(r.summary).toContain('RED');
  });

  it('RED 没红时 summary 提示测试无效/越界', async () => {
    const r = await makeGates(runnerByCmd({}), { cwd: '/x' }).red();
    expect(r.summary).toMatch(/越界|无效|未失败/);
  });

  it('brief 在无输出时回落到 exit 码', async () => {
    const gates = makeGates(runnerByCmd({ 'npm run lint': { exitCode: 7, stdout: '', stderr: '' } }), { cwd: '/x' });
    expect((await gates.green()).summary).toContain('exit 7');
  });
});

describe('mutateTargetsFromStatus（纯解析 git status → 待变异源文件）', () => {
  it('只取 src/*.ts,排除测试文件与非源文件', () => {
    const out = mutateTargetsFromStatus(' M src/a.ts\n?? src/b.ts\n?? test/b.test.ts\n M README.md\n');
    expect(out).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('排除非 src 目录的 .ts(如 lib/)', () => {
    expect(mutateTargetsFromStatus(' M lib/x.ts\n')).toEqual([]);
  });

  it('排除 src 下的非 .ts(.js/.json)', () => {
    expect(mutateTargetsFromStatus(' M src/x.js\n M src/y.json\n')).toEqual([]);
  });

  it('去引号(porcelain 对含空格路径加引号)', () => {
    expect(mutateTargetsFromStatus('?? "src/a b.ts"\n')).toEqual(['src/a b.ts']);
  });

  it('子目录工程:用 prefix 把仓库根相对路径剥成工程相对,工程外改动被排除', () => {
    const porcelain =
      ' M pipeline/driver/src/x.ts\n' + // 工程外(无 prefix)→ 排除
      '?? iron-hammer-output/fincards/src/clampPercent.ts\n' + // 工程内 src → 取,剥成 src/...
      '?? iron-hammer-output/fincards/test/clampPercent.test.ts\n'; // 工程内 test → 排除
    expect(mutateTargetsFromStatus(porcelain, 'iron-hammer-output/fincards/')).toEqual(['src/clampPercent.ts']);
  });

  it('排除 src 下的 *.test.ts', () => {
    expect(mutateTargetsFromStatus('?? src/c.test.ts\n')).toEqual([]);
  });

  it('排除已删除文件(D，无法变异)', () => {
    expect(mutateTargetsFromStatus(' D src/gone.ts\n M src/keep.ts\n')).toEqual(['src/keep.ts']);
  });

  it('重命名取新路径', () => {
    expect(mutateTargetsFromStatus('R  src/old.ts -> src/new.ts\n')).toEqual(['src/new.ts']);
  });

  it('空 / 仅空行 → []', () => {
    expect(mutateTargetsFromStatus('')).toEqual([]);
    expect(mutateTargetsFromStatus('\n\n')).toEqual([]);
  });

  it('去重(同文件多状态行只算一次)', () => {
    expect(mutateTargetsFromStatus('MM src/a.ts\n M src/a.ts\n')).toEqual(['src/a.ts']);
  });
});

describe('changedPathsFromStatus（纯解析 git status → 本切片全部改动路径,供动态 squash add）', () => {
  it('捕获所有改动,不限扩展名/目录(src + test + 配置都进)', () => {
    const out = changedPathsFromStatus('?? src/formatCompactNumber.ts\n?? test/formatCompactNumber.test.ts\n M src/x.json\n');
    expect(out).toEqual(['src/formatCompactNumber.ts', 'test/formatCompactNumber.test.ts', 'src/x.json']);
  });

  it('包括已删除文件(D)——squash 须提交删除,这是与 mutate 解析的关键区别', () => {
    expect(changedPathsFromStatus(' D src/gone.ts\n M src/keep.ts\n')).toEqual(['src/gone.ts', 'src/keep.ts']);
  });

  it('子目录工程:prefix 剥成工程相对,工程外改动排除', () => {
    const porcelain =
      ' M pipeline/driver/src/x.ts\n' + // 工程外 → 排除
      '?? iron-hammer-output/fincards/src/formatCompactNumber.ts\n' +
      '?? iron-hammer-output/fincards/test/formatCompactNumber.test.ts\n'; // test 也要(不像 mutate 排除)
    expect(changedPathsFromStatus(porcelain, 'iron-hammer-output/fincards/')).toEqual([
      'src/formatCompactNumber.ts',
      'test/formatCompactNumber.test.ts',
    ]);
  });

  it('重命名取新路径', () => {
    expect(changedPathsFromStatus('R  src/old.ts -> src/new.ts\n')).toEqual(['src/new.ts']);
  });

  it('去引号(含空格路径)', () => {
    expect(changedPathsFromStatus('?? "test/a b.test.ts"\n')).toEqual(['test/a b.test.ts']);
  });

  it('空 / 仅空行 → []', () => {
    expect(changedPathsFromStatus('')).toEqual([]);
    expect(changedPathsFromStatus('\n\n')).toEqual([]);
  });

  it('去重', () => {
    expect(changedPathsFromStatus('MM src/a.ts\n M src/a.ts\n')).toEqual(['src/a.ts']);
  });

  it('排除依赖软链 node_modules(linkDeps 的 symlink,非切片产物;因 .gitignore 带斜杠只匹配目录而漏网)', () => {
    const porcelain =
      '?? iron-hammer-output/fincards/node_modules\n' + // linkDeps 创建的 symlink(非目录→未被 ignore)
      '?? iron-hammer-output/fincards/src/x.ts\n';
    expect(changedPathsFromStatus(porcelain, 'iron-hammer-output/fincards/')).toEqual(['src/x.ts']);
  });

  it('排除嵌套 node_modules 路径(如 a/node_modules/b)', () => {
    expect(changedPathsFromStatus(' M src/a.ts\n?? pkg/node_modules/x.js\n')).toEqual(['src/a.ts']);
  });
});
