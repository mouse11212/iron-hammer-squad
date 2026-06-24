import { execFileSync } from 'node:child_process';
import type { DefectRecord } from './types.js';

// Defect 自动喂(M4+ 续切片③→④):caught 与 escaped 均从 git commit trailer 挖采(同口径持久),取代手维护 defects.json。
// caught=机器写的 `Defect-Caught:`(driver squash 时据 fixRounds emit);escaped=人写的 `Defect-Escaped:`(发现合并后缺陷时)。
// 分层=纯函数 + 薄 IO(仿 weave-traces.ts):纯组装可穷尽单测;跑 git 落 IO 边界。

/** 一条 git commit trailer(caught/escaped 通用)。 */
export interface Trailer {
  /** 打 trailer 的提交短 hash。 */
  commit: string;
  /** trailer 值=缺陷描述。 */
  desc: string;
}

/**
 * 纯函数:从 caught/escaped trailer 组装 DefectRecord[],两侧每行一记录、对称处理。
 * caught → where:'caught';escaped → where:'escaped'。id 含 commit + 序号(同 commit 多条不撞)。
 */
export function deriveDefects(caught: Trailer[], escapes: Trailer[]): DefectRecord[] {
  const out: DefectRecord[] = [];
  for (const [i, c] of caught.entries()) {
    out.push({ id: `${c.commit}#caught${i + 1}`, where: 'caught', note: c.desc });
  }
  for (const [i, e] of escapes.entries()) {
    out.push({ id: `${e.commit}#escaped${i + 1}`, where: 'escaped', note: e.desc });
  }
  return out;
}

// ── 薄 IO 边界:从 git log 通用挖采 trailer ──────────────

/**
 * 薄 IO 通用:`git log` 挖某 key 的所有 trailer 行(逐行匹配 `<key>: <value>`,全历史)。
 * 用 %x1f 分隔 hash 与 body、%x1e 分隔 commit;git 失败返回 [](不抛、不臆造)。
 */
export function mineTrailers(repoRoot: string, key: string): Trailer[] {
  let out = '';
  try {
    out = execFileSync('git', ['log', '--format=%H%x1f%B%x1e'], { cwd: repoRoot, encoding: 'utf8' });
  } catch {
    return [];
  }
  const re = new RegExp(`^${key}:\\s*(.+)$`);
  const trailers: Trailer[] = [];
  for (const block of out.split('\x1e')) {
    const sep = block.indexOf('\x1f');
    if (sep < 0) continue;
    const commit = block.slice(0, sep).trim();
    if (!commit) continue;
    for (const line of block.slice(sep + 1).split('\n')) {
      const m = re.exec(line.trim());
      if (m) trailers.push({ commit: commit.slice(0, 7), desc: (m[1] ?? '').trim() });
    }
  }
  return trailers;
}

/** caught 挖采:机器写的 `Defect-Caught:` trailer(driver squash emit)。 */
export function readCaughtTrailers(repoRoot: string): Trailer[] {
  return mineTrailers(repoRoot, 'Defect-Caught');
}

/** escaped 挖采:人写的 `Defect-Escaped:` trailer。 */
export function readEscapeTrailers(repoRoot: string): Trailer[] {
  return mineTrailers(repoRoot, 'Defect-Escaped');
}
