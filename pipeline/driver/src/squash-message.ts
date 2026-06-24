// 持久化 caught(M4+ 续切片④):done run squash 时据 fixRounds emit Defect-Caught: trailer,
// 使 caught 缺陷随提交持久进 git,与人写的 Defect-Escaped: 同口径供 metrics 挖采。纯函数,无 IO。

/**
 * 构建 squash 提交消息。基础标题 `feat(<jobId>): inner-loop 交付`,末尾追加机器写 trailer 块:
 * - `fixRounds>0` → N 行 `Defect-Caught: inner-loop 回修轮 <k>`(每个回修轮=评审/门抓到的一处缺陷;持久化 caught)。
 * - `phaseMs` 有非零项 → 一行 `Metrics-Phase-Ms: <cat>=<ms> ...`(原始 op 分类耗时,保持传入顺序、仅非零;持久化 VTax 输入,**不应用 impl/verif 口径**)。
 * 两者皆无则只返回基础标题。trailer 块连续 `Key: value` 行=合法 git trailer。
 */
export function squashMessage(jobId: string, fixRounds: number, phaseMs?: Record<string, number>): string {
  const base = `feat(${jobId}): inner-loop 交付`;
  const trailers: string[] = [];
  for (let k = 1; k <= fixRounds; k++) trailers.push(`Defect-Caught: inner-loop 回修轮 ${k}`);
  const phases = Object.entries(phaseMs ?? {}).filter(([, ms]) => ms > 0);
  if (phases.length > 0) trailers.push(`Metrics-Phase-Ms: ${phases.map(([c, ms]) => `${c}=${ms}`).join(' ')}`);
  return trailers.length > 0 ? `${base}\n\n${trailers.join('\n')}` : base;
}
