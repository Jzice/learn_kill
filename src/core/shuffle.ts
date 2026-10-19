/* ==================== 随机打乱工具 ==================== */
/** Fisher–Yates 洗牌：返回原数组下标的一个随机排列（不修改入参）。
 *  用于出题时打乱选项顺序，使同一题多次出现选项位置不固定，
 *  但判定始终以「原始正确下标」为准（见 quiz.ts / ui/study.ts）。 */
export function shuffledIndices(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
