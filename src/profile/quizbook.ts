/* ==================== 个人学习档案：出题范围 + 错题本（掌握度） ====================
 * · 出题范围：本年级本学期 / 本学期及以前年级 / 初中阶段 / 高中阶段
 * · 答题记录：以题干为唯一标识记录答错与连对次数，达到 MASTER_STREAK 次视为掌握
 * · 错题加权：错题权重最高，同知识点（学科+知识点）次之，已掌握题不再出现
 */
import type { Question, QuizRec, QuizScope } from '../core/types';
import { escapeHtml } from '../core/dom';
import { GRADE_ORDER, gradeSortKey } from '../data/grades';
import { loadGrade, QUESTION_BANK } from '../data/bankLoader';
import { PROFILE, saveProfile } from './profile';

/** 连对达到该次数即掌握，后续不再抽到 */
export const MASTER_STREAK = 3;

/** 可选出题范围（id / 名称 / 说明） */
export const SCOPES: { id: QuizScope; label: string; desc: string }[] = [
  { id: 'grade', label: '📖 本年级本学期', desc: '仅当前所选年级学期的题目' },
  { id: 'past', label: '⏪ 本学期及以前', desc: '当前学期及之前所有年级的题目（循序渐进）' },
  { id: 'junior', label: '📗 初中阶段', desc: '初一上 ~ 初三下 全部题目' },
  { id: 'senior', label: '📘 高中阶段', desc: '高一上 ~ 高三下 全部题目' },
];

const SCOPE_MAP: Record<QuizScope, { label: string; desc: string }> = Object.fromEntries(
  SCOPES.map((s) => [s.id, { label: s.label, desc: s.desc }]),
) as Record<QuizScope, { label: string; desc: string }>;

/* ==================== 出题范围 ==================== */

function normScope(s: unknown): QuizScope {
  return s === 'past' || s === 'junior' || s === 'senior' ? s : 'grade';
}

export function quizScope(): QuizScope {
  return normScope(PROFILE.quizScope);
}

export function setQuizScope(s: QuizScope): void {
  PROFILE.quizScope = normScope(s);
  saveProfile();
}

export function scopeLabel(s?: QuizScope): string {
  return SCOPE_MAP[normScope(s ?? quizScope())].label.replace(/^\S+\s/, '');
}

export function scopeDesc(s?: QuizScope): string {
  return SCOPE_MAP[normScope(s ?? quizScope())].desc;
}

/** 该范围覆盖的年级学期列表（GRADE_ORDER 中「年级+学期」，按学段升序） */
export function scopeGrades(scope: QuizScope, grade: string): string[] {
  const cur = gradeSortKey(grade);
  const pool = GRADE_ORDER.filter((g) => {
    // 外部导入的自定义年级不在内置顺序内，但只要能排序就并入本学期及以前
    if (GRADE_ORDER.includes(g)) return true;
    return scope === 'past' && gradeSortKey(g) <= cur;
  });
  switch (normScope(scope)) {
    case 'past':
      return pool.filter((g) => gradeSortKey(g) <= cur);
    case 'junior':
      return pool.filter((g) => g.startsWith('初'));
    case 'senior':
      return pool.filter((g) => g.startsWith('高'));
    default:
      return [grade];
  }
}

/** 是否属于指定学段 */
export function inPhase(g: string, phase: 'junior' | 'senior'): boolean {
  return phase === 'junior' ? g.startsWith('初') : g.startsWith('高');
}

/* ==================== 答题记录 / 掌握度 ==================== */

/** 题目标识：题干文本唯一（题库去重同样以题干为准），取哈希作 key 节省存储 */
export function qid(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return 'q' + h.toString(36);
}

function recs(): Record<string, QuizRec> {
  if (!PROFILE.quizRec || typeof PROFILE.quizRec !== 'object') PROFILE.quizRec = {};
  return PROFILE.quizRec;
}

export function recOf(q: Question): QuizRec | undefined {
  return recs()[qid(q.q)];
}

/** 该题是否已掌握（连对达 MASTER_STREAK 次） */
export function isMastered(q: Question): boolean {
  const r = recOf(q);
  return !!r && r.c >= MASTER_STREAK;
}

/** 记录一次作答；返回该题最新记录 */
export function recordAnswer(q: Question, correct: boolean, grade = ''): QuizRec {
  const map = recs();
  const key = qid(q.q);
  const old = map[key];
  const rec: QuizRec = {
    w: (old?.w || 0) + (correct ? 0 : 1),
    c: correct ? (old?.c || 0) + 1 : 0,
    ts: Date.now(),
    s: q.s || old?.s || '综合',
    kp: q.kp || old?.kp || '综合',
    g: grade || q.g || old?.g || '',
    text: old?.text || q.q,
  };
  map[key] = rec;
  // 学段学习量：答对时按所属学期累加（装备 tier2/3 解锁条件的度量，见 unlockCondition.ts）
  if (correct && grade) {
    if (!PROFILE.gradeStats || typeof PROFILE.gradeStats !== 'object') PROFILE.gradeStats = {};
    PROFILE.gradeStats[grade] = (PROFILE.gradeStats[grade] || 0) + 1;
  }
  saveProfile();
  return rec;
}

/** 错题本条目（答过错且尚未掌握），按「错次多 → 最近」排序 */
export function wrongList(): { key: string; rec: QuizRec }[] {
  return Object.entries(recs())
    .filter(([, r]) => r.w > 0 && r.c < MASTER_STREAK)
    .map(([key, rec]) => ({ key, rec }))
    .sort((a, b) => b.rec.w - a.rec.w || b.rec.ts - a.rec.ts);
}

export function wrongCount(): number {
  return wrongList().length;
}

export function masteredCount(): number {
  return Object.values(recs()).filter((r) => r.c >= MASTER_STREAK).length;
}

export function recordedCount(): number {
  return Object.keys(recs()).length;
}

/** 按 key 直接取记录（首页学习面板展开解析用） */
export function recByKey(key: string): QuizRec | undefined {
  return recs()[key];
}

/** 已攻克错题：曾经答错但已连对达标（与「待复习」分开的单独列表） */
export function masteredWrongList(): { key: string; rec: QuizRec }[] {
  return Object.entries(recs())
    .filter(([, r]) => r.w > 0 && r.c >= MASTER_STREAK)
    .map(([key, rec]) => ({ key, rec }))
    .sort((a, b) => b.rec.ts - a.rec.ts);
}

/** 知识点维度的掌握情况（按「学科 + 知识点」聚合） */
export interface KpStat {
  s: string;
  kp: string;
  /** 该知识点下有作答记录的题数 */
  total: number;
  /** 其中已掌握的题数 */
  mastered: number;
  /** 其中仍是错题（错 ≥1 次且未掌握）的题数 */
  wrong: number;
  /** 掌握百分比 */
  pct: number;
}

export function kpStats(): KpStat[] {
  const m = new Map<string, KpStat>();
  for (const r of Object.values(recs())) {
    const k = `${r.s || '综合'}|${r.kp || '综合'}`;
    let st = m.get(k);
    if (!st) {
      st = { s: r.s || '综合', kp: r.kp || '综合', total: 0, mastered: 0, wrong: 0, pct: 0 };
      m.set(k, st);
    }
    st.total++;
    if (r.c >= MASTER_STREAK) st.mastered++;
    if (r.w > 0 && r.c < MASTER_STREAK) st.wrong++;
  }
  const arr = [...m.values()];
  for (const st of arr) st.pct = st.total ? Math.round((st.mastered / st.total) * 100) : 0;
  // 「还差一点」的排前面（未掌握题多者优先），其次按已掌握题数，最后按学科名
  return arr.sort(
    (a, b) =>
      b.total - b.mastered - (a.total - a.mastered) ||
      b.wrong - a.wrong ||
      b.mastered - a.mastered ||
      a.s.localeCompare(b.s, 'zh'),
  );
}

/** 按题干在题库中查找原题（用于首页展开解析）；题库未加载时返回 undefined */
export function findQuestionByText(text: string, grade: string): Question | undefined {
  if (!grade) return undefined;
  return (QUESTION_BANK[grade] || []).find((q) => q.q === text);
}

/* ==================== 首页复习组题（纯查询，不写档案） ==================== */

/** 把待复习错题按「学科|知识点」分组，供复习随机挑组出题 */
export function wrongByKp(): { s: string; kp: string; recs: { key: string; rec: QuizRec }[] }[] {
  const groups = new Map<string, { s: string; kp: string; recs: { key: string; rec: QuizRec }[] }>();
  for (const { key, rec } of wrongList()) {
    const s = rec.s || '综合';
    const kp = rec.kp || '综合';
    const k = `${s}|${kp}`;
    let g = groups.get(k);
    if (!g) {
      g = { s, kp, recs: [] };
      groups.set(k, g);
    }
    g.recs.push({ key, rec });
  }
  return [...groups.values()];
}

/**
 * 组装某知识点的复习题组（异步、按需懒加载题库）：
 * 1) 该组错题还原为完整题（保证「随机出现错题」）；2) 题库内同知识点题；
 * 3) 同知识点不足 3 道时补充同科目题作为「相关」。
 * 去重（按题干）→ 打乱顺序 → 截到 limit。纯查询，绝不调用 recordAnswer。
 */
export async function buildReviewSet(s: string, kp: string, opts?: { limit?: number }): Promise<Question[]> {
  const limit = opts?.limit ?? 6;
  const group = wrongByKp().find((g) => g.s === s && g.kp === kp);
  const recs = group?.recs ?? [];
  // 先确保该知识点涉及的年级题库已加载（保持懒加载不变式：点击时才加载）
  const grades = [...new Set(recs.map((r) => r.rec.g).filter(Boolean))] as string[];
  await Promise.all(grades.map((g) => loadGrade(g)));

  const seen = new Set<string>();
  const out: Question[] = [];
  const push = (q: Question | undefined): void => {
    if (q && q.o && q.o.length && !seen.has(q.q)) {
      seen.add(q.q);
      out.push(q);
    }
  };

  // 1) 该组错题（优先，保证覆盖用户真正错的题）
  for (const r of recs) push(findQuestionByText(r.rec.text, r.rec.g));
  // 2) 同知识点题
  for (const g of Object.keys(QUESTION_BANK)) {
    for (const q of QUESTION_BANK[g] || []) if (q.kp === kp) push(q);
  }
  // 3) 同知识点不足 3 道时，补充同科目题作为「相关」
  if (out.length < 3) {
    for (const g of Object.keys(QUESTION_BANK)) {
      for (const q of QUESTION_BANK[g] || []) if (q.s === s && q.kp !== kp) push(q);
    }
  }
  // 打乱顺序（错题打散在同知识点/同科目题之间）
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, limit);
}

/** 标记复习一次：推进掌握进度（连对 +1），达到 MASTER_STREAK 即从待复习移入已攻克 */
export function markReviewed(key: string): QuizRec | undefined {
  const map = recs();
  const r = map[key];
  if (!r) return undefined;
  r.c = (r.c || 0) + 1;
  r.ts = Date.now();
  saveProfile();
  return r;
}

/** 清空错题本与掌握度（保留选项设置） */
export function clearQuizBook(): void {
  PROFILE.quizRec = {};
  saveProfile();
}

/* ==================== 抽题权重 ==================== */

/** 有错题（含未掌握）的「学科|知识点」集合 —— 同类型题目加权依据 */
export function wrongKpSet(): Set<string> {
  const s = new Set<string>();
  for (const { rec } of wrongList()) s.add(`${rec.s}|${rec.kp}`);
  return s;
}

/**
 * 单题权重：错题 10 分 > 同知识点 3 分 > 新题 1 分；已掌握题返回 0（不再出现）
 */
export function weightOf(q: Question, kps?: Set<string>): number {
  const r = recOf(q);
  if (r && r.c >= MASTER_STREAK) return 0;
  if (r && r.w > 0) return 10;
  const set = kps ?? wrongKpSet();
  return set.has(`${q.s}|${q.kp}`) ? 3 : 1;
}

/** 按权重随机抽题；权重全为 0（全部掌握）时退化为等概率 */
export function weightedPick(pool: Question[], kps?: Set<string>): Question | null {
  if (!pool.length) return null;
  const kpSet = kps ?? wrongKpSet();
  const ws = pool.map((q) => weightOf(q, kpSet));
  const total = ws.reduce((a, b) => a + b, 0);
  if (total <= 0) return pool[Math.floor(Math.random() * pool.length)];
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= ws[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/** 错题优先抽取概率：错题越多概率越高（15% ~ 60%） */
export function wrongBoostRate(poolSize: number): number {
  if (poolSize <= 0) return 0;
  return Math.min(0.6, Math.max(0.15, wrongCount() / poolSize));
}

/* ==================== 错题本 UI（渲染进「我的档案」弹窗） ==================== */

/** 在档案弹窗内渲染错题本区块（无错题时展示掌握度统计） */
export function renderWrongBook(): void {
  const box = document.getElementById('wrongBookBox');
  if (!box) return;
  const list = wrongList();
  const mastered = masteredCount();
  const head =
    `<h4>📕 错题本（${list.length} 题待攻克 · 已掌握 ${mastered} 题）</h4>` +
    `<div style="font-size:10.5px;color:var(--muted);margin-bottom:8px">答错自动入本；同一知识点累计答对 ${MASTER_STREAK} 次即掌握，后续不再出现。</div>`;
  if (!list.length) {
    box.innerHTML =
      head +
      `<div class="wb-empty">${mastered > 0 ? `🎉 暂无错题，已掌握 ${mastered} 道题` : '🎉 暂无错题，继续保持！'}</div>`;
    return;
  }
  const rows = list
    .slice(0, 30)
    .map(
      ({ rec }) => `<div class="wb-item">
        <div class="wb-top">${escapeHtml(rec.g || '综合')} · ${escapeHtml(rec.s)} · ${escapeHtml(rec.kp)}
          <span class="wb-tag">错 ${rec.w} 次</span></div>
        <div class="wb-q">${escapeHtml(rec.text)}</div>
        <div class="wb-bar">${'●'.repeat(rec.c)}${'○'.repeat(Math.max(0, MASTER_STREAK - rec.c))}<span>掌握 ${rec.c}/${MASTER_STREAK}</span></div>
      </div>`,
    )
    .join('');
  box.innerHTML =
    head +
    `<div class="wb-list">${rows}</div>` +
    (list.length > 30 ? `<div style="font-size:10.5px;color:var(--muted);text-align:center">仅显示最近 30 条，共 ${list.length} 条</div>` : '') +
    `<button class="btn btn-sm wb-clear" onclick="clearWrongBook()">🗑 清空错题本与掌握度</button>`;
}

/** 档案弹窗内一键清空（含二次确认） */
export function clearWrongBook(): void {
  if (!confirm('确定清空错题本与掌握度记录吗？此操作不可撤销。')) return;
  clearQuizBook();
  renderWrongBook();
}