import { execFileSync } from 'node:child_process';
import type { DefectRecord, InnerLoopStatus } from './types.js';

// Defect 自动喂(M4+ 续切片③):caught 从 inner-loop run 确定性派生、escaped 从 git trailer 挖采,取代手维护 defects.json。
// 分层=纯函数 + 薄 IO(仿 weave-traces.ts):纯组装可穷尽单测;跑 git 落 IO 边界。

/** 缺陷派生所需的 run 形状(caught 源)。 */
export interface DefectRunInput {
  jobId: string;
  status: InnerLoopStatus;
  /** 回修轮次:每轮=评审/门抓到的一批 must-fix(caught)。 */
  fixRounds: number;
  /** escalated 的 residual must-fix 数(抓到但升级未解,仍计 caught)。 */
  residualCount?: number;
}

/** 一条 git `Defect-Escaped:` trailer(escaped 源)。 */
export interface EscapeTrailer {
  /** 打 trailer 的提交 hash。 */
  commit: string;
  /** trailer 值=逃逸缺陷描述。 */
  desc: string;
}

/**
 * 纯函数:从 inner-loop run 与 escape trailer 组装 DefectRecord[]。
 * - caught = 每个 run 的 fixRounds 次回修各一条 + residualCount 条(escalated 抓到未解)
 * - escaped = 每条 trailer 一条
 * fixRounds=0 且无 residual 的干净 run 不产缺陷(不臆造)。
 */
export function deriveDefects(runs: DefectRunInput[], escapes: EscapeTrailer[]): DefectRecord[] {
  const out: DefectRecord[] = [];
  for (const r of runs) {
    for (let k = 1; k <= r.fixRounds; k++) {
      out.push({ id: `${r.jobId}#caught-fix${k}`, where: 'caught', note: `inner-loop 回修轮${k}抓到缺陷(${r.status})` });
    }
    const residual = r.residualCount ?? 0;
    for (let i = 1; i <= residual; i++) {
      out.push({ id: `${r.jobId}#caught-residual${i}`, where: 'caught', note: '评审 must-fix 升级未解(escalated)' });
    }
  }
  for (const [i, e] of escapes.entries()) {
    out.push({ id: `${e.commit}#escaped${i + 1}`, where: 'escaped', note: e.desc });
  }
  return out;
}

// ── 薄 IO 边界:从 git log 挖 Defect-Escaped: trailer ──────────────

/** commit 体逐行匹配 `Defect-Escaped: <desc>`。 */
const ESCAPE_TRAILER = /^Defect-Escaped:\s*(.+)$/;

/**
 * 薄 IO:`git log` 挖所有 `Defect-Escaped:` trailer(持久,全历史)。
 * 用 %x1f 分隔 hash 与 body、%x1e 分隔 commit;git 失败返回 [](不抛、不臆造)。
 */
export function readEscapeTrailers(repoRoot: string): EscapeTrailer[] {
  let out = '';
  try {
    out = execFileSync('git', ['log', '--format=%H%x1f%B%x1e'], { cwd: repoRoot, encoding: 'utf8' });
  } catch {
    return [];
  }
  const trailers: EscapeTrailer[] = [];
  for (const block of out.split('\x1e')) {
    const sep = block.indexOf('\x1f');
    if (sep < 0) continue;
    const commit = block.slice(0, sep).trim();
    if (!commit) continue;
    for (const line of block.slice(sep + 1).split('\n')) {
      const m = ESCAPE_TRAILER.exec(line.trim());
      if (m) trailers.push({ commit: commit.slice(0, 7), desc: (m[1] ?? '').trim() });
    }
  }
  return trailers;
}
