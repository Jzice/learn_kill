/* ==================== 商店解锁条件判定（单一判定源，纯函数） ====================
 * 设计依据：docs/学分商店学习激励方案.md §4 / §5
 *
 * 角色（108 名）：学分 + 学科掌握（「已掌握知识点」与「累计答对」二选一，按学段分档）
 *   初一上~初二下：知识点 ≥2 或 答对 ≥30
 *   初三上~初三下：知识点 ≥5 或 答对 ≥60
 *   高一上~高二下：知识点 ≥8 或 答对 ≥100
 *   高三上~高三下：知识点 ≥12 或 答对 ≥150
 * 装备（18 件）：学分 + 学段学习量里程碑
 *   tier1：仅学分（新手礼包引导）
 *   tier2：+ 初中学段答对 ≥60
 *   tier3：+ 高中答对 ≥120 且 ≥3 个学科精通
 *   tier4：+ 学霸认证（全库已掌握知识点 ≥60 且 学习类成就 ≥8 项）
 *
 * UI（ui/shop.ts 卡片）与购买（credits.ts 扣费前）共用本模块判定，杜绝双份规则。
 * 输入仅 PROFILE + kpStats() 派生值，不加载题库分片（懒加载不变量）。
 */
import type { Character } from '../core/types';
import type { EquipDef } from '../data/expansion';
import { EQUIP_PRICE } from '../data/expansion';
import { GRADE_ORDER } from '../data/grades';
import { PROFILE } from './profile';
import { kpStats } from './quizbook';
import { charPrice, credits } from './credits';

export interface UnlockCond {
  key: string;
  label: string;
  cur: number;
  need: number;
  ok: boolean;
  /** credit / must：必须全部满足；either：组内任一满足即可 */
  group: 'credit' | 'must' | 'either';
  /** 未达标时的引导跳转目标 */
  jump?: 'bank';
}

/** 学习类成就 id（tier4「学霸认证」计数口径；v1.8.2 起逐步补齐） */
export const LEARNING_ACH_IDS: string[] = [
  'quiz_10', 'quiz_50', 'all_subjects',
  'quiz_100', 'quiz_300', 'kp_20', 'kp_60', 'streak_10',
  'daily_7', 'subject_master', 'all_master_9', 'perfect_game', 'pass_30',
];

/** 学科精通：该学科已掌握知识点 ≥ 10 */
export const SUBJECT_MASTER_KP = 10;

/** 角色学段分档（按 GRADE_ORDER 学期下标区间） */
const CHAR_BANDS: { maxIdx: number; kp: number; quiz: number }[] = [
  { maxIdx: 3, kp: 2, quiz: 30 }, // 初一上~初二下
  { maxIdx: 5, kp: 5, quiz: 60 }, // 初三上~初三下
  { maxIdx: 9, kp: 8, quiz: 100 }, // 高一上~高二下
  { maxIdx: 11, kp: 12, quiz: 150 }, // 高三上~高三下
];

function charBand(grade: string): { kp: number; quiz: number } {
  const i = GRADE_ORDER.indexOf(grade);
  // 外部导入的自定义年级不在内置顺序内：按最严档处理
  if (i < 0) return { kp: CHAR_BANDS[CHAR_BANDS.length - 1].kp, quiz: CHAR_BANDS[CHAR_BANDS.length - 1].quiz };
  const band = CHAR_BANDS.find((b) => i <= b.maxIdx) ?? CHAR_BANDS[CHAR_BANDS.length - 1];
  return { kp: band.kp, quiz: band.quiz };
}

/** 掌握度快照：一次遍历 quizRec，供一次渲染内的多张卡片复用 */
export interface MasterySnapshot {
  /** 学科 → 已掌握知识点数 */
  bySubject: Record<string, number>;
  /** 全库已掌握知识点数 */
  total: number;
  /** 达到「学科精通」的学科数 */
  masters: number;
  /** 已获得的学习类成就数 */
  learningAch: number;
}

export function masterySnapshot(): MasterySnapshot {
  const bySubject: Record<string, number> = {};
  for (const st of kpStats()) {
    if (st.mastered > 0) bySubject[st.s] = (bySubject[st.s] || 0) + 1;
  }
  const total = Object.values(bySubject).reduce((a, b) => a + b, 0);
  const masters = Object.values(bySubject).filter((n) => n >= SUBJECT_MASTER_KP).length;
  const ach = PROFILE.achievements || {};
  const learningAch = LEARNING_ACH_IDS.filter((id) => ach[id]).length;
  return { bySubject, total, masters, learningAch };
}

/** 某学段累计答对题数（gradeStats：初中=初一上~初三下，高中=高一上~高三下） */
function phaseCorrect(phase: 'junior' | 'senior'): number {
  const gs = PROFILE.gradeStats || {};
  return Object.entries(gs)
    .filter(([g]) => (phase === 'junior' ? g.startsWith('初') : g.startsWith('高')))
    .reduce((a, [, n]) => a + n, 0);
}

/** 角色解锁条件：学分（必须）+ 学科掌握二选一 */
export function charConditions(c: Character, snap: MasterySnapshot): UnlockCond[] {
  const b = charBand(c.grade);
  const kp = snap.bySubject[c.subject] || 0;
  const quiz = (PROFILE.subjects || {})[c.subject] || 0;
  const price = charPrice(c.id);
  return [
    { key: 'credit', label: '学分', cur: credits(), need: price, ok: credits() >= price, group: 'credit' },
    { key: 'kp', label: `${c.subject}·已掌握知识点`, cur: kp, need: b.kp, ok: kp >= b.kp, group: 'either', jump: 'bank' },
    { key: 'quiz', label: `${c.subject}·累计答对`, cur: quiz, need: b.quiz, ok: quiz >= b.quiz, group: 'either', jump: 'bank' },
  ];
}

/** 装备解锁条件：学分（必须）+ 按 tier 递增的学段学习量里程碑 */
export function equipConditions(e: EquipDef, snap: MasterySnapshot): UnlockCond[] {
  const price = EQUIP_PRICE[e.tier] ?? 0;
  const conds: UnlockCond[] = [
    { key: 'credit', label: '学分', cur: credits(), need: price, ok: credits() >= price, group: 'credit' },
  ];
  if (e.tier >= 2) {
    const cur = phaseCorrect('junior');
    conds.push({ key: 'juniorQuiz', label: '初中学段答对', cur, need: 60, ok: cur >= 60, group: 'must', jump: 'bank' });
  }
  if (e.tier >= 3) {
    const cur = phaseCorrect('senior');
    conds.push({ key: 'seniorQuiz', label: '高中学段答对', cur, need: 120, ok: cur >= 120, group: 'must', jump: 'bank' });
    conds.push({ key: 'subjectMaster', label: '学科精通（≥10 知识点的学科数）', cur: snap.masters, need: 3, ok: snap.masters >= 3, group: 'must', jump: 'bank' });
  }
  if (e.tier >= 4) {
    conds.push({ key: 'totalKp', label: '全库已掌握知识点', cur: snap.total, need: 60, ok: snap.total >= 60, group: 'must', jump: 'bank' });
    conds.push({ key: 'learningAch', label: '学习类成就', cur: snap.learningAch, need: 8, ok: snap.learningAch >= 8, group: 'must', jump: 'bank' });
  }
  return conds;
}

/** 全部条件是否满足（either 组内任一满足即可） */
export function condsOk(conds: UnlockCond[]): boolean {
  const must = conds.filter((c) => c.group !== 'either');
  const either = conds.filter((c) => c.group === 'either');
  return must.every((c) => c.ok) && (either.length === 0 || either.some((c) => c.ok));
}

/** 首个未达标条件（用于按钮提示；either 组整体未达标时返回进度最高的一条） */
export function firstBlocked(conds: UnlockCond[]): UnlockCond | null {
  for (const c of conds) {
    if (c.group !== 'either' && !c.ok) return c;
  }
  const either = conds.filter((c) => c.group === 'either');
  if (either.length && either.every((c) => !c.ok)) {
    return either.reduce((a, b) => (b.cur / Math.max(1, b.need) > a.cur / Math.max(1, a.need) ? b : a));
  }
  return null;
}
