/* ==================== 年级顺序 ==================== */
export const GRADE_ORDER: string[] = [
  '初一上',
  '初一下',
  '初二上',
  '初二下',
  '初三上',
  '初三下',
  '高一上',
  '高一下',
  '高二上',
  '高二下',
  '高三上',
  '高三下',
];

export function gradeSortKey(g: string): number {
  const i = GRADE_ORDER.indexOf(g);
  return i < 0 ? 999 : i;
}
