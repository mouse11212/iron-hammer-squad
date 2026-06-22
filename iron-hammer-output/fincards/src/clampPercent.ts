/**
 * 纯函数：把比率 `ratio` 夹紧到 [0, 1] 并格式化为整数百分比字符串（卡片占比显示用）。
 * 无网络/时钟，确定性可测。
 *
 * 分支顺序（被规约钉死，不可调换）：
 * 1. ratio < 0            → "0%"   （下界，优先于任何计算）
 * 2. ratio > 1            → "100%" （上界）
 * 3. 0 <= ratio <= 1      → Math.round(ratio * 100) + "%"（四舍五入到整数百分比）
 *
 * 注：区间外直接返回字面量，故 Math.round 的入参恒落在 [0, 100]，
 * 不会越界；四舍五入（非截断）由 Math.round 保证（如 0.005 → "1%"）。
 */
export function clampPercent(ratio: number): string {
  // Stryker disable next-line EqualityOperator: 等价变异——`< 0`→`<= 0` 仅在 ratio===0 处不同，而 0 经 round 分支得 Math.round(0)+"%"="0%"，与本分支输出逐字相同，任何测试都杀不掉
  if (ratio < 0) return '0%';
  // Stryker disable next-line EqualityOperator: 等价变异——`> 1`→`>= 1` 仅在 ratio===1 处不同，而 1 经 round 分支得 Math.round(100)+"%"="100%"，与本分支输出逐字相同，任何测试都杀不掉
  if (ratio > 1) return '100%';
  return Math.round(ratio * 100) + '%';
}
