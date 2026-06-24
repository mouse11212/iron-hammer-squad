import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MetricsSnapshot, Numstat, DefectRecord, InnerLoopRunRecord, TraceTax } from './types.js';
import { taskResolutionRate, codeChurn, verificationTax, defectEscapeRate, innerLoopStats } from './compute.js';
import { categorizeDuration, taxByTrace, readEventsJsonl } from './events-tax.js';
import { weaveTraces, readArchivedChanges } from './weave-traces.js';

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

/** 扫描 inner-loop 运行目录(.runtime/runs/<jobId>/state.json)→ 运行记录。 */
function readInnerLoopRuns(runsDir: string): InnerLoopRunRecord[] {
  if (!existsSync(runsDir)) return [];
  const records: InnerLoopRunRecord[] = [];
  for (const d of readdirSync(runsDir, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const statePath = join(runsDir, d.name, 'state.json');
    if (!existsSync(statePath)) continue;
    const rec = JSON.parse(readFileSync(statePath, 'utf8')) as Partial<InnerLoopRunRecord>;
    if (rec.status === undefined || typeof rec.fixRounds !== 'number') continue; // 跳过未完成/畸形
    records.push({ jobId: rec.jobId ?? d.name, status: rec.status, fixRounds: rec.fixRounds, costUsd: rec.costUsd });
  }
  return records;
}

/** 采集真实仓库 → MetricsSnapshot。verificationMs 暂未按 change 埋点 → null。 */
export function collect(repoRoot: string, dataDir: string, now: string): MetricsSnapshot {
  const churn = codeChurn(gitNumstat(repoRoot));
  const { resolved, attempted } = countChanges(repoRoot);
  // 追溯链:从 OpenSpec archive + git 自动织链(M4+ 续切片②),取代手维护 traces.json。
  const traces = weaveTraces(readArchivedChanges(repoRoot));
  const defects = readJson<DefectRecord[]>(join(dataDir, 'defects.json'), []);
  const escaped = defects.filter((d) => d.where === 'escaped').length;
  // Verification Tax:从统一事件日志(events.jsonl)派生实现/验证耗时(M4+ 续切片,接 durationMs 钩子)。
  const events = readEventsJsonl(join(repoRoot, 'pipeline', '.runtime', 'events.jsonl'));
  const split = categorizeDuration(events);
  // 无实现事件(无 events 或无 dev)→ implementationMs=null,tax 回落 null(待埋点语义,不臆造)。
  const implementationMs: number | null = split.implementationMs === 0 ? null : split.implementationMs;
  const verificationMs: number | null = events.length === 0 ? null : split.verificationMs;
  const taxRows: TraceTax[] = [...taxByTrace(events)].map(([traceId, t]) => ({ traceId, ...t }));
  const runs = readInnerLoopRuns(join(repoRoot, 'pipeline', '.runtime', 'runs'));
  return {
    generatedAt: now,
    taskResolutionRate: taskResolutionRate(resolved, attempted),
    resolved,
    attempted,
    codeChurn: churn,
    verificationMs,
    implementationMs,
    verificationTax: verificationTax(split.verificationMs, implementationMs),
    defectEscapeRate: defectEscapeRate(escaped, defects.length),
    defects: { total: defects.length, escaped },
    traces,
    taxByTrace: taxRows,
    innerLoop: runs.length > 0 ? innerLoopStats(runs) : undefined,
  };
}
