// 持久化 caught(M4+ 续切片④):done run squash 时据 fixRounds emit Defect-Caught: trailer,
// 使 caught 缺陷随提交持久进 git,与人写的 Defect-Escaped: 同口径供 metrics 挖采。纯函数,无 IO。

/**
 * 构建 squash 提交消息。基础标题 `feat(<jobId>): inner-loop 交付`;
 * fixRounds>0 时追加 N 行 `Defect-Caught: inner-loop 回修轮 <k>`(每个回修轮=评审/门抓到的一处缺陷)。
 * fixRounds=0 不追加(干净 run 不臆造缺陷)。trailer 块在消息末尾、连续 `Key: value` 行=合法 git trailer。
 */
export function squashMessage(jobId: string, fixRounds: number): string {
  const base = `feat(${jobId}): inner-loop 交付`;
  if (fixRounds <= 0) return base;
  const trailers = Array.from({ length: fixRounds }, (_, i) => `Defect-Caught: inner-loop 回修轮 ${i + 1}`);
  return `${base}\n\n${trailers.join('\n')}`;
}
