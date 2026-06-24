import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MetricsSnapshot, Numstat, InnerLoopRunRecord, TraceTax } from './types.js';
import { taskResolutionRate, codeChurn, verificationTax, defectEscapeRate, innerLoopStats } from './compute.js';
import { categorizeDuration, taxByTrace, parsePhaseMsTrailer } from './events-tax.js';
import { weaveTraces, readArchivedChanges } from './weave-traces.js';
import { deriveDefects, mineTrailers, readCaughtTrailers, readEscapeTrailers } from './defects-feed.js';

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
  const runs = readInnerLoopRuns(join(repoRoot, 'pipeline', '.runtime', 'runs'));
  // 缺陷自动喂(M4+ 续切片③→④):caught(机器写 Defect-Caught:)与 escaped(人写 Defect-Escaped:)均从 git trailer 挖采——同口径持久,率完全可比。取代手维护 defects.json 与切片③ 的 runtime run 派生。
  const defects = deriveDefects(readCaughtTrailers(repoRoot), readEscapeTrailers(repoRoot));
  const escaped = defects.filter((d) => d.where === 'escaped').length;
  // Verification Tax(M4+ 续切片⑤):从 git `Metrics-Phase-Ms:` trailer 挖采各 done-run 阶段耗时(持久、可复现),
  // 还原最小事件后经 D1 口径算 tax——取代 ephemeral 的 `.runtime/events.jsonl`。per-US 以 commit 短 hash 为键。
  const events = mineTrailers(repoRoot, 'Metrics-Phase-Ms').flatMap((t) => parsePhaseMsTrailer(t.desc, t.commit));
  const split = categorizeDuration(events);
  // 无实现事件(无 events 或无 dev)→ implementationMs=null,tax 回落 null(待埋点语义,不臆造)。
  const implementationMs: number | null = split.implementationMs === 0 ? null : split.implementationMs;
  const verificationMs: number | null = events.length === 0 ? null : split.verificationMs;
  const taxRows: TraceTax[] = [...taxByTrace(events)].map(([traceId, t]) => ({ traceId, ...t }));
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
