import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MetricsSnapshot, Numstat, DefectRecord, TraceLink } from './types.js';
import { taskResolutionRate, codeChurn, verificationTax, defectEscapeRate } from './compute.js';

/** 薄 IO：解析 git numstat 为 Numstat[]（二进制文件的 '-' 跳过）。 */
function gitNumstat(repoRoot: string): Numstat[] {
  const out = execSync('git log --numstat --pretty=tformat:', { cwd: repoRoot, encoding: 'utf8' });
  const stats: Numstat[] = [];
  for (const line of out.split('\n')) {
    const m = line.match(/^(\d+|-)\t(\d+|-)\t/);
    if (!m) continue;
    if (m[1] === '-' || m[2] === '-') continue;
    stats.push({ added: Number(m[1]), removed: Number(m[2]) });
  }
  return stats;
}

/** 数活跃/归档 change 数（OpenSpec）。 */
function countChanges(repoRoot: string): { resolved: number; attempted: number } {
  const changesDir = join(repoRoot, 'docs', 'openspec', 'changes');
  const archiveDir = join(changesDir, 'archive');
  const resolved = existsSync(archiveDir)
    ? readdirSync(archiveDir, { withFileTypes: true }).filter((d) => d.isDirectory()).length
    : 0;
  const active = existsSync(changesDir)
    ? readdirSync(changesDir, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== 'archive').length
    : 0;
  return { resolved, attempted: resolved + active };
}

function readJson<T>(path: string, fallback: T): T {
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : fallback;
}

/** 采集真实仓库 → MetricsSnapshot。verificationMs 暂未按 change 埋点 → null。 */
export function collect(repoRoot: string, dataDir: string, now: string): MetricsSnapshot {
  const churn = codeChurn(gitNumstat(repoRoot));
  const { resolved, attempted } = countChanges(repoRoot);
  const traces = readJson<TraceLink[]>(join(dataDir, 'traces.json'), []);
  const defects = readJson<DefectRecord[]>(join(dataDir, 'defects.json'), []);
  const escaped = defects.filter((d) => d.where === 'escaped').length;
  const verificationMs: number | null = null; // 待按 change 埋点
  return {
    generatedAt: now,
    taskResolutionRate: taskResolutionRate(resolved, attempted),
    resolved,
    attempted,
    codeChurn: churn,
    verificationMs,
    verificationTax: verificationTax(0, verificationMs),
    defectEscapeRate: defectEscapeRate(escaped, defects.length),
    defects: { total: defects.length, escaped },
    traces,
  };
}
