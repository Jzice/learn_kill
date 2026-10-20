/* ==================== 题库懒加载器 ====================
 * 内置题库不再打进主产物，而是构建期产出「学期 + 学科」粒度的经典脚本
 * （public/banks/<学期>/<学科>.js，注入 window.__XTS_BANK__['<学期>/<学科>']）。
 * 运行时仅在真正需要某分片时才插入 <script> 加载，因此：
 *   - 主 HTML 体积与题量解耦（新增题目不会撑大单文件）
 *   - 首屏不加载任何题库分片（verify-lazy 不变式继续保持）
 *   - 用经典脚本而非 fetch，保证 file:// 双击打开也能加载（fetch 在 file:// 下受 CORS 限制）
 */
import type {
  KpRelation,
  KnowledgeNote,
  Question,
  QuestionBank,
  SubjectBankSlice,
} from '../core/types';
import {
  BANK_BASE,
  GRADE_BANK_META,
  SUBJECT_BANK_META,
  subjectsOf,
} from './banks/manifest';
import { GRADE_ORDER } from './grades';

/** 运行态题库：已加载学期的内置题 + 外部导入题（外部导入可直接创建学期键） */
export const QUESTION_BANK: QuestionBank = {};

/** 各学期外部导入题数统计 */
export const EXTERNAL_STATS: Record<string, number> = { total: 0 };

/** 已完成加载的学期 */
const loaded = new Set<string>();
/** 正在加载中的学期 Promise（并发去重） */
const inflight = new Map<string, Promise<Question[]>>();

/** 已加载的「学期/学科」分片缓存 */
const slices = new Map<string, SubjectBankSlice>();
/** 正在加载中的分片 Promise（并发去重） */
const inflightSlices = new Map<string, Promise<SubjectBankSlice>>();

const EMPTY_SLICE: SubjectBankSlice = { q: [], k: {}, r: [] };

function sliceKey(grade: string, subject: string): string {
  return `${grade}/${subject}`;
}

function sliceUrl(grade: string, subject: string): string {
  return `${BANK_BASE}${encodeURIComponent(grade)}/${encodeURIComponent(subject)}.js`;
}

/** 注入一个经典脚本并等待其执行完成（成功后移除标签，避免 DOM 堆积） */
function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => {
      el.remove();
      resolve();
    };
    el.onerror = () => {
      el.remove();
      reject(new Error(`题库分片加载失败：${src}`));
    };
    document.head.appendChild(el);
  });
}

function bankStore(): Record<string, SubjectBankSlice> {
  const w = window as unknown as { __XTS_BANK__?: Record<string, SubjectBankSlice> };
  if (!w.__XTS_BANK__) w.__XTS_BANK__ = {};
  return w.__XTS_BANK__;
}

export function gradeSortKey(g: string): number {
  const i = GRADE_ORDER.indexOf(g);
  return i < 0 ? 999 : i;
}

/** 内置题库中该学期的题数（来自清单，不触发加载） */
export function builtinCount(grade: string): number {
  return GRADE_BANK_META.find((x) => x.grade === grade)?.count ?? 0;
}

/** 是否存在该学期（内置清单或已有外部/已加载数据） */
export function hasGrade(grade: string): boolean {
  return builtinCount(grade) > 0 || !!QUESTION_BANK[grade]?.length;
}

/** 全部可用学期：内置清单 ∪ 外部导入/已加载学期，按学期顺序排序 */
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

/** 该学期当前可用题数（已加载的才计入） */
export function gradeQuestionCount(grade: string): number {
  return QUESTION_BANK[grade]?.length ?? 0;
}

export function isGradeLoaded(grade: string): boolean {
  return loaded.has(grade);
}

export function loadedGrades(): string[] {
  return [...loaded];
}

/** 该学期已加载的学科分片数 */
export function loadedSubjectCount(grade: string): number {
  return subjectsOf(grade).filter((s) => slices.has(sliceKey(grade, s))).length;
}

/** 加载指定「学期 + 学科」分片（幂等；失败降级为空分片并告警） */
export async function loadSubject(grade: string, subject: string): Promise<SubjectBankSlice> {
  const key = sliceKey(grade, subject);
  const hit = slices.get(key);
  if (hit) return hit;
  const pending = inflightSlices.get(key);
  if (pending) return pending;

  // 清单中没有该分片：视为无题学科，直接返回空分片
  if (!SUBJECT_BANK_META[key]) {
    slices.set(key, EMPTY_SLICE);
    return EMPTY_SLICE;
  }

  const task = (async () => {
    const store = bankStore();
    if (!store[key]) await injectScript(sliceUrl(grade, subject));
    const slice = bankStore()[key] ?? EMPTY_SLICE;
    slices.set(key, slice);
    inflightSlices.delete(key);
    return slice;
  })().catch((e) => {
    inflightSlices.delete(key);
    console.warn('[学堂杀] 题库分片加载失败：', key, e);
    slices.set(key, EMPTY_SLICE);
    return EMPTY_SLICE;
  });
  inflightSlices.set(key, task);
  return task;
}

export function isSubjectLoaded(grade: string, subject: string): boolean {
  return slices.has(sliceKey(grade, subject));
}

/** 已加载分片的知识点讲解（未加载则返回 undefined，由调用方先 loadSubject） */
export function getNote(grade: string, subject: string, kp: string): KnowledgeNote | undefined {
  return slices.get(sliceKey(grade, subject))?.k[kp];
}

/** 已加载分片的全部讲解 */
export function getNotes(grade: string, subject: string): Record<string, KnowledgeNote> {
  return slices.get(sliceKey(grade, subject))?.k ?? {};
}

/** 已加载分片的关系边 */
export function getRelations(grade: string, subject: string): KpRelation[] {
  return slices.get(sliceKey(grade, subject))?.r ?? [];
}

/** 动态加载指定学期的内置题目（幂等；内部并行加载该学期全部学科分片） */
export async function loadGrade(grade: string): Promise<Question[]> {
  if (loaded.has(grade)) return QUESTION_BANK[grade] ?? [];
  const pending = inflight.get(grade);
  if (pending) return pending;

  const subs = subjectsOf(grade);
  if (!subs.length) {
    // 内置清单中没有该学期：视为仅外部题库学期
    loaded.add(grade);
    if (!QUESTION_BANK[grade]) QUESTION_BANK[grade] = [];
    return QUESTION_BANK[grade];
  }

  const p = (async () => {
    const lists = await Promise.all(subs.map((s) => loadSubject(grade, s).then((x) => x.q)));
    const bank = QUESTION_BANK[grade] ?? (QUESTION_BANK[grade] = []);
    const seen = new Set(bank.map((q) => q.q));
    for (const list of lists) {
      for (const q of list) {
        if (!seen.has(q.q)) {
          seen.add(q.q);
          bank.push(q);
        }
      }
    }
    loaded.add(grade);
    inflight.delete(grade);
    return bank;
  })().catch((e) => {
    inflight.delete(grade);
    console.warn('[学堂杀] 学期题库加载失败：', grade, e);
    if (!QUESTION_BANK[grade]) QUESTION_BANK[grade] = [];
    return QUESTION_BANK[grade];
  });
  inflight.set(grade, p);
  return p;
}

/** 预取多个学期（后台并行，不阻塞） */
export function prefetchGrades(grades: string[]): void {
  for (const g of grades) {
    if (!loaded.has(g) && subjectsOf(g).length) void loadGrade(g);
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

export { GRADE_BANK_META, SUBJECT_BANK_META, subjectsOf };
