/* ==================== 学分体系 ====================
 * 第三套数值（独立于「学识值/积分」）：
 *   - 只由学习行为产出（答题/复习/错题攻克）
 *   - 只用于解锁角色 / 购买装备 / 携带道具
 *   - 不参与对局胜负计算
 * 全部读写走 PROFILE（localStorage 持久化），仅在存档写入时序列化。
 */
import type { EquipSlot } from '../core/types';
import { GRADE_ORDER, gradeSortKey } from '../data/grades';
import { PROFILE, saveProfile } from './profile';
import {
  CHAR_PRICE,
  EQUIP_PRICE,
  EXPANSION_CHARS,
  EXPANSION_EQUIPS,
  EXPANSION_ITEMS,
  expansionCharById,
  expansionEquipById,
  expansionItemById,
} from '../data/expansion';
import { charConditions, condsOk, equipConditions, masterySnapshot } from './unlockCondition';

/** 学分数值曲线（便于调参） */
export const CREDIT_RULE: { perCorrectQuiz: number; perReview: number; perWrongFixed: number; dailyCap: number; missionDailyCap: number } = {
  perCorrectQuiz: 3,
  perReview: 2,
  perWrongFixed: 2,
  dailyCap: 300,
  /** 每日任务宝箱独立额度（防止刷任务绕开答题类日限） */
  missionDailyCap: 100,
};

/**
 * 按年级梯度计算答题学分：年级越高单题学分越高（初中 +0 / 高一高二 +1 / 高三 +2），
 * 激励向高年级推进；未知年级按基准计。
 */
export function quizCreditFor(grade: string): number {
  const i = GRADE_ORDER.indexOf(grade);
  const bonus = i < 0 ? 0 : Math.floor(i / 6);
  return CREDIT_RULE.perCorrectQuiz + bonus;
}

/** 局前携带上限（决策四：限额避免开局强度失控） */
export const LOADOUT_EQUIP_LIMIT = 2;
export const LOADOUT_ITEM_LIMIT = 3;

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 当前学分 */
export function credits(): number {
  return PROFILE.credits || 0;
}

/** 今日已获学分（跨日自动归零） */
export function earnedToday(): number {
  ensureCreditDay();
  return PROFILE.creditDaily.earned || 0;
}

/** 今日任务类已获学分（独立额度） */
export function missionEarnedToday(): number {
  ensureCreditDay();
  return PROFILE.creditDaily.missionEarned || 0;
}

/** 今日学分来源分项（quiz / review / wrongfix / drill / mission / pass） */
export function creditSources(): Record<string, number> {
  ensureCreditDay();
  return PROFILE.creditDaily.sources || {};
}

export function dailyCapReached(): boolean {
  return earnedToday() >= CREDIT_RULE.dailyCap;
}

export function missionCapReached(): boolean {
  return missionEarnedToday() >= CREDIT_RULE.missionDailyCap;
}

function ensureCreditDay(): void {
  if (PROFILE.creditDaily.date !== todayStr()) {
    PROFILE.creditDaily = { date: todayStr(), earned: 0, missionEarned: 0, sources: {} };
    saveProfile();
  }
}

/**
 * 增加学分（受每日上限约束）。返回实际入账数量（触顶后多余部分丢弃）。
 * reason = 'mission' | 'pass' 走任务类独立额度，其余（quiz/review/wrongfix/drill）走答题类额度。
 */
export function addCredits(n: number, reason = ''): number {
  if (n <= 0) return 0;
  ensureCreditDay();
  const isMission = reason === 'mission' || reason === 'pass';
  const cap = isMission ? CREDIT_RULE.missionDailyCap : CREDIT_RULE.dailyCap;
  const used = isMission ? PROFILE.creditDaily.missionEarned || 0 : PROFILE.creditDaily.earned || 0;
  const add = Math.min(n, Math.max(0, cap - used));
  if (add <= 0) return 0;
  if (isMission) PROFILE.creditDaily.missionEarned = used + add;
  else PROFILE.creditDaily.earned = used + add;
  PROFILE.credits = (PROFILE.credits || 0) + add;
  if (reason) {
    const src = PROFILE.creditDaily.sources || {};
    src[reason] = (src[reason] || 0) + add;
    PROFILE.creditDaily.sources = src;
  }
  saveProfile();
  return add;
}

/** 消耗学分，余额不足返回 false 且不扣减 */
export function spendCredits(n: number, _reason?: string): boolean {
  if (n <= 0) return true;
  if ((PROFILE.credits || 0) < n) return false;
  PROFILE.credits = (PROFILE.credits || 0) - n;
  saveProfile();
  return true;
}

/* ---------------- 角色解锁 ---------------- */
export function isCharUnlocked(id: string): boolean {
  return (PROFILE.unlockedChars || []).includes(id);
}
export function charPrice(id: string): number {
  return CHAR_PRICE[id] ?? 0;
}
export function unlockChar(id: string): boolean {
  const c = expansionCharById(id);
  if (!c) return false;
  if (isCharUnlocked(id)) return true;
  // 学习成果判定（与商店 UI 同一判定源，见 unlockCondition.ts）
  if (!condsOk(charConditions(c, masterySnapshot()))) return false;
  const price = charPrice(id);
  if (!spendCredits(price, `unlock:${id}`)) return false;
  PROFILE.unlockedChars = [...(PROFILE.unlockedChars || []), id];
  saveProfile();
  return true;
}

/* ---------------- 装备购买 ---------------- */
export function isEquipUnlocked(id: string): boolean {
  return (PROFILE.unlockedEquips || []).includes(id);
}
export function equipPrice(id: string): number {
  const e = expansionEquipById(id);
  return e ? EQUIP_PRICE[e.tier] ?? 0 : 0;
}
export function buyEquip(id: string, grade?: string): boolean {
  const e = expansionEquipById(id);
  if (!e) return false;
  if (isEquipUnlocked(id)) return true;
  // 年级门槛：达到装备要求年级方可购买（不传 grade 则跳过该校验，供内部调用）
  if (grade !== undefined && gradeSortKey(e.grade) > gradeSortKey(grade)) return false;
  // 学习成果判定（与商店 UI 同一判定源，见 unlockCondition.ts）
  if (!condsOk(equipConditions(e, masterySnapshot()))) return false;
  const price = EQUIP_PRICE[e.tier] ?? 0;
  if (!spendCredits(price, `buy:${id}`)) return false;
  PROFILE.unlockedEquips = [...(PROFILE.unlockedEquips || []), id];
  saveProfile();
  return true;
}

/** 直接解锁装备（不扣学分）：新手礼包 / 战令奖励等确定性发放通道 */
export function grantEquip(id: string): boolean {
  const e = expansionEquipById(id);
  if (!e) return false;
  if (isEquipUnlocked(id)) return true;
  PROFILE.unlockedEquips = [...(PROFILE.unlockedEquips || []), id];
  saveProfile();
  return true;
}

/* ---------------- 道具 ---------------- */
export function itemCount(id: string): number {
  return PROFILE.items?.[id] || 0;
}
/** 增加道具（受 maxCarry 上限约束），返回实际增加数 */
export function addItem(id: string, n = 1): number {
  const def = expansionItemById(id);
  if (!def) return 0;
  const cur = itemCount(id);
  const add = Math.max(0, Math.min(n, def.maxCarry - cur));
  if (add <= 0) return 0;
  PROFILE.items = { ...PROFILE.items, [id]: cur + add };
  saveProfile();
  return add;
}
export function removeItem(id: string, n = 1): boolean {
  const cur = itemCount(id);
  if (cur < n) return false;
  const left = cur - n;
  if (left <= 0) {
    const { [id]: _drop, ...rest } = PROFILE.items;
    PROFILE.items = rest;
  } else {
    PROFILE.items = { ...PROFILE.items, [id]: left };
  }
  saveProfile();
  return true;
}

/* ---------------- 局前配装 ---------------- */
/** 已装配的装备件数（4 槽位中非空者） */
export function loadoutEquipCount(): number {
  const l = PROFILE.loadout;
  return [l.weapon, l.armor, l.horsePlus, l.horseMinus].filter(Boolean).length;
}
/** 已装配的道具件数（各道具数量之和） */
export function loadoutItemCount(): number {
  const l = PROFILE.loadout.items || {};
  return Object.values(l).reduce((a, b) => a + b, 0);
}
/**
 * 局前配装支持的槽位。宝物槽（treasure）只存在于**对局内**的运行时 Equips，
 * 不参与局前配装，故此处排除，避免 Loadout 被新槽位污染。
 */
export type LoadoutSlot = Exclude<EquipSlot, 'treasure'>;

export function setLoadoutSlot(slot: LoadoutSlot, equipId: string | null): boolean {
  if (equipId && !isEquipUnlocked(equipId)) return false;
  if (equipId) {
    const e = expansionEquipById(equipId);
    if (!e || e.slot !== slot) return false;
    // 限额：若新增一件会使总数超 2，且当前槽位为空，则拒绝
    if (!PROFILE.loadout[slot] && loadoutEquipCount() >= LOADOUT_EQUIP_LIMIT) return false;
  }
  PROFILE.loadout = { ...PROFILE.loadout, [slot]: equipId };
  saveProfile();
  return true;
}
export function addLoadoutItem(id: string, n = 1): boolean {
  if (!isEquipUnlocked(id) && !PROFILE.items?.[id]) {
    /* 道具必须先拥有 */
  }
  if ((PROFILE.items?.[id] || 0) < n) return false;
  if (loadoutItemCount() + n > LOADOUT_ITEM_LIMIT) return false;
  PROFILE.loadout = { ...PROFILE.loadout, items: { ...PROFILE.loadout.items, [id]: (PROFILE.loadout.items?.[id] || 0) + n } };
  saveProfile();
  return true;
}
export function removeLoadoutItem(id: string, n = 1): boolean {
  const cur = PROFILE.loadout.items?.[id] || 0;
  if (cur < n) return false;
  const left = cur - n;
  const items = { ...PROFILE.loadout.items };
  if (left <= 0) delete items[id];
  else items[id] = left;
  PROFILE.loadout = { ...PROFILE.loadout, items };
  saveProfile();
  return true;
}
export function clearLoadout(): void {
  PROFILE.loadout = { weapon: null, armor: null, horsePlus: null, horseMinus: null, items: {} };
  saveProfile();
}

/* ---------------- 查询：已解锁扩展角色列表 ---------------- */
export function unlockedExpansionChars(): typeof EXPANSION_CHARS {
  return EXPANSION_CHARS.filter((c) => isCharUnlocked(c.id));
}
export function allExpansionEquips() {
  return EXPANSION_EQUIPS;
}
export function allExpansionItems() {
  return EXPANSION_ITEMS;
}
