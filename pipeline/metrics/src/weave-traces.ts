import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { TraceLink } from './types.js';

// 追溯链自动织链(M4+ 续切片②):从归档 change 派生 TraceLink,取代手维护 traces.json。
// 分层=纯函数 + 薄 IO(仿 events-tax.ts):本文件只放纯组装逻辑,可穷尽单测;扫目录/跑 git 落 IO 边界。

/** 已读好的一个归档 change(薄 IO 的原始产物;commit 非空,无 commit 的 change 在 IO 层已剔除)。 */
export interface ArchivedChange {
  /** 原始 archive 目录名,如 "2026-06-17-fincards-m0-bloomberg-cards"。 */
  dir: string;
  /** specs/ 下 capability 目录名(原始,未排序)。 */
  specs: string[];
  /** 归档该 change 的 git commit 短 hash。 */
  commit: string;
  /** 归档 commit 改动的所有文件路径(IO 原样传入,过滤逻辑在此纯函数内)。 */
  changedFiles: string[];
}

/** 日期前缀 `YYYY-MM-DD-`。 */
const DATE_PREFIX = /^\d{4}-\d{2}-\d{2}-/;
/** 测试文件:`*.test.ts`/`*.spec.ts`/`.js`。 */
const TEST_FILE = /\.(test|spec)\.[tj]s$/;

/**
 * 纯函数:把归档 change 列表组装为 TraceLink[],每字段同源于真实归档 commit。
 * - changeId = 目录名去日期前缀
 * - spec = capability 目录名按字典序斜杠拼接(无则空串)
 * - tests = 改动文件中的测试文件 basename,去重后按字典序排序(无则 [])
 * - commit = 归档 commit 短 hash
 */
export function weaveTraces(changes: ArchivedChange[]): TraceLink[] {
  return changes.map((c) => ({
    changeId: c.dir.replace(DATE_PREFIX, ''),
    spec: [...c.specs].sort().join('/'),
    tests: [...new Set(c.changedFiles.filter((f) => TEST_FILE.test(f)).map((f) => basename(f)))].sort(),
    commit: c.commit,
  }));
}

// ── 薄 IO 边界:扫归档目录 + 跑 git,产出 ArchivedChange[] ──────────────

/** 跑 git,失败(命令出错/路径无历史)返回空串——绝不抛、绝不臆造。 */
function git(repoRoot: string, args: string[]): string {
  try {
    return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

/** 取多行输出的最后一非空行(git log 最新在前 → 末行=最早一条)。 */
function lastLine(out: string): string {
  const lines = out.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines[lines.length - 1] ?? '';
}

/**
 * 归档某 change 的 commit 短 hash:把 proposal.md 加到 archive 路径的那次提交(最早一条)。
 * 主路径 `--diff-filter=A`;若因 rename 取空,回退不限 filter;仍空返回 ''(调用方据此跳过)。
 */
function archiveCommit(repoRoot: string, dir: string): string {
  const rel = `docs/openspec/changes/archive/${dir}/proposal.md`;
  const added = lastLine(git(repoRoot, ['log', '--diff-filter=A', '--format=%h', '--', rel]));
  if (added) return added;
  return lastLine(git(repoRoot, ['log', '--format=%h', '--', rel]));
}

/** 一次 commit 改动的所有文件路径(仓库根相对)。 */
function commitChangedFiles(repoRoot: string, commit: string): string[] {
  return git(repoRoot, ['show', '--name-only', '--format=', commit])
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * 薄 IO:扫 `docs/openspec/changes/archive/*`,每个归档 change 收集
 * { dir, specs(capability 目录名), commit(归档 commit), changedFiles }。
 * 无确定归档 commit 的 change 在此剔除(不臆造 hash);缺 archive 目录返回 []。
 */
export function readArchivedChanges(repoRoot: string): ArchivedChange[] {
  const archiveDir = join(repoRoot, 'docs', 'openspec', 'changes', 'archive');
  if (!existsSync(archiveDir)) return [];
  const result: ArchivedChange[] = [];
  for (const d of readdirSync(archiveDir, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const commit = archiveCommit(repoRoot, d.name);
    if (!commit) continue; // 无确定归档 commit → 跳过
    const specsDir = join(archiveDir, d.name, 'specs');
    const specs = existsSync(specsDir)
      ? readdirSync(specsDir, { withFileTypes: true }).filter((s) => s.isDirectory()).map((s) => s.name)
      : [];
    result.push({ dir: d.name, specs, commit, changedFiles: commitChangedFiles(repoRoot, commit) });
  }
  return result;
}
