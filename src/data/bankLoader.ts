/* ==================== 题库懒加载器 ====================
 * 内置题库按年级拆分为独立配置模块（src/data/banks/gNN.ts），
 * 仅在真正需要某年级题目时才动态 import 并解析，避免开局一次性载入全部年级。
 */
import type { Question, QuestionBank } from '../core/types';
import { GRADE_BANK_META, GRADE_LOADERS } from './banks/manifest';
import { GRADE_ORDER } from './grades';

/** 运行态题库：已加载年级的内置题 + 外部导入题（外部导入可直接创建年级键） */
export const QUESTION_BANK: QuestionBank = {};

/** 各年级外部导入题数统计 */
export const EXTERNAL_STATS: Record<string, number> = { total: 0 };

/** 已完成动态加载的年级 */
const loaded = new Set<string>();

/** 正在加载中的 Promise（并发去重） */
const inflight = new Map<string, Promise<Question[]>>();

export function gradeSortKey(g: string): number {
  const i = GRADE_ORDER.indexOf(g);
  return i < 0 ? 999 : i;
}

/** 内置题库中该年级的题数（来自清单，不触发加载） */
export function builtinCount(grade: string): number {
  return GRADE_BANK_META.find((x) => x.grade === grade)?.count ?? 0;
}

/** 是否存在该年级（内置清单或已有外部/已加载数据） */
export function hasGrade(grade: string): boolean {
  return builtinCount(grade) > 0 || !!QUESTION_BANK[grade]?.length;
}

/** 全部可用年级：内置清单 ∪ 外部导入/已加载年级，按年级顺序排序 */
export function allGrades(): string[] {
  const set = new Set<string>(GRADE_BANK_META.map((x) => x.grade));
  for (const g of Object.keys(QUESTION_BANK)) {
    if (QUESTION_BANK[g]?.length) set.add(g);
  }
  return [...set].sort((a, b) => {
    const d = gradeSortKey(a) - gradeSortKey(b);
    return d !== 0 ? d : a.localeCompare(b, 'zh');
  });
}

export function sortedGrades(): string[] {
  return allGrades();
}

/** 该年级当前可用题数（已加载的才计入） */
export function gradeQuestionCount(grade: string): number {
  return QUESTION_BANK[grade]?.length ?? 0;
}

export function isGradeLoaded(grade: string): boolean {
  return loaded.has(grade);
}

export function loadedGrades(): string[] {
  return [...loaded];
}

/** 动态加载指定年级的内置题目（幂等，重复调用直接命中缓存） */
export function loadGrade(grade: string): Promise<Question[]> {
  if (loaded.has(grade)) return Promise.resolve(QUESTION_BANK[grade] ?? []);
  const pending = inflight.get(grade);
  if (pending) return pending;

  const loader = GRADE_LOADERS[grade];
  if (!loader) {
    // 内置清单中没有该年级：视为仅外部题库年级
    loaded.add(grade);
    if (!QUESTION_BANK[grade]) QUESTION_BANK[grade] = [];
    return Promise.resolve(QUESTION_BANK[grade]);
  }
  const p = loader()
    .then((mod) => {
      const qs = mod.default ?? [];
      const bank = QUESTION_BANK[grade] ?? (QUESTION_BANK[grade] = []);
      // 内置题置前，外部导入题保持其后（不覆盖已有条目）
      const existing = bank.length;
      if (existing) {
        const seen = new Set(bank.map((q) => q.q));
        for (const q of qs) if (!seen.has(q.q)) bank.unshift(q);
      } else {
        bank.push(...qs);
      }
      loaded.add(grade);
      inflight.delete(grade);
      return bank;
    })
    .catch((e) => {
      inflight.delete(grade);
      console.warn('[学堂杀] 年级题库加载失败：', grade, e);
      if (!QUESTION_BANK[grade]) QUESTION_BANK[grade] = [];
      return QUESTION_BANK[grade];
    });
  inflight.set(grade, p);
  return p;
}

/** 预取多个年级（后台并行，不阻塞） */
export function prefetchGrades(grades: string[]): void {
  for (const g of grades) {
    if (!loaded.has(g) && GRADE_LOADERS[g]) void loadGrade(g);
  }
}

export function ensureGrade(grade: string): Question[] {
  if (!QUESTION_BANK[grade]) QUESTION_BANK[grade] = [];
  return QUESTION_BANK[grade];
}

export function resetExternalStats(): void {
  for (const k of Object.keys(EXTERNAL_STATS)) delete EXTERNAL_STATS[k];
  EXTERNAL_STATS.total = 0;
}

export { GRADE_BANK_META };
