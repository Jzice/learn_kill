/* ==================== 题库导入 / 合并 / URL 加载 ====================
 * 年级题目的按需加载见 data/bankLoader.ts（内置题库按年级拆分后动态 import）。
 * 本模块负责外部题库（本地文件 / URL）的解析与合并，以及运行态题库的写入。
 */
import type { Question } from '../core/types';
import {
  EXTERNAL_STATS,
  QUESTION_BANK,
  builtinCount,
  ensureGrade,
  isGradeLoaded,
  loadGrade,
  prefetchGrades,
  resetExternalStats,
  sortedGrades,
} from './bankLoader';
import { SELECTED_GRADE, updateBankInfo, renderGradePicker } from '../ui/lobby';

export {
  QUESTION_BANK,
  EXTERNAL_STATS,
  ensureGrade,
  resetExternalStats,
  loadGrade,
  prefetchGrades,
  sortedGrades,
  builtinCount,
  isGradeLoaded,
};

/** 外部题库 URL 配置（留空即不加载） */
export const EXTERNAL_BANK_URLS: string[] = [
  // 'https://example.com/xuetang-sha-bank.json',
];

export function addQuestionsToBank(
  qs: unknown,
  grade: string,
): { added: number; dup: number; invalid: number } {
  if (!Array.isArray(qs)) return { added: 0, dup: 0, invalid: 0 };
  let added = 0,
    dup = 0,
    invalid = 0;
  const bank = ensureGrade(grade);
  const ex = new Set(bank.map((q) => q.q));
  for (const it of qs) {
    if (!it || typeof it !== 'object' || !(it as Question).q || !Array.isArray((it as Question).o) || (it as Question).o.length < 2) {
      invalid++;
      continue;
    }
    const q = it as Question;
    if (typeof q.a !== 'number' || q.a < 0 || q.a >= q.o.length) {
      invalid++;
      continue;
    }
    if (ex.has(q.q)) {
      dup++;
      continue;
    }
    bank.push({ s: q.s || '语文', kp: q.kp || (q as unknown as { knowledge?: string }).knowledge || '综合', q: q.q, o: q.o.slice(), a: q.a });
    ex.add(q.q);
    added++;
  }
  return { added, dup, invalid };
}

export function mergeBankData(
  data: unknown,
): { added: number; dup: number; invalid: number; reps: string[] } {
  let added = 0,
    dup = 0,
    invalid = 0;
  const reps: string[] = [];
  const put = (grade: string, arr: unknown): void => {
    const r = addQuestionsToBank(arr, grade);
    added += r.added;
    dup += r.dup;
    invalid += r.invalid;
    if (r.added > 0) {
      EXTERNAL_STATS[grade] = (EXTERNAL_STATS[grade] || 0) + r.added;
      EXTERNAL_STATS.total += r.added;
    }
    reps.push(`${grade}：新增 ${r.added}，重复 ${r.dup}，无效 ${r.invalid}`);
  };
  if (Array.isArray(data)) {
    put(SELECTED_GRADE, data);
  } else if (data && typeof data === 'object') {
    let any = false;
    for (const g of Object.keys(data as Record<string, unknown>)) {
      if (Array.isArray((data as Record<string, unknown>)[g])) {
        put(g, (data as Record<string, unknown>)[g]);
        any = true;
      }
    }
    if (!any) throw new Error('未找到任何有效的年级数组');
  } else throw new Error('题库格式无法识别');
  return { added, dup, invalid, reps };
}

export function parseBankText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (_) {
    /* 尝试作为 JS 执行 */
  }
  const code =
    text +
    '\n;return (typeof EXTERNAL_BANK!=="undefined")?EXTERNAL_BANK:(typeof window!=="undefined"&&window.EXTERNAL_BANK?window.EXTERNAL_BANK:null);';
  return new Function(code)();
}

export async function loadBankFromUrl(
  url: string,
  silent: boolean,
): Promise<{ added: number; dup: number; invalid: number; reps: string[] } | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    const data = parseBankText(text);
    if (!data) throw new Error('未解析出题库数据');
    const r = mergeBankData(data);
    updateBankInfo();
    renderGradePicker();
    if (!silent)
      alert(`✅ URL 题库加载完成\n\n${r.reps.join('\n')}\n\n总计：新增 ${r.added}，重复 ${r.dup}，无效 ${r.invalid}`);
    return r;
  } catch (e) {
    console.warn('[学堂杀] URL 题库加载失败：', url, e);
    if (!silent) alert('❌ 加载失败：' + (e as Error).message);
    return null;
  }
}
