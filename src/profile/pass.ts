/* ==================== 学期通关战令（确定性奖励，v1.8.2） ====================
 * 设计依据：docs/学分商店学习激励方案.md §4.6
 * 周期 = 当前学期（SELECTED_GRADE；切换学期重置等级与经验）。
 * 经验来源：答对 +2 / 复习 +5 / 攻克错题 +8 / 完成每日任务 +10。
 * 升级曲线：升到 Lv.L 需 100 + 30×(L−1) 经验，满级 30 级共需 16,050 经验（≈一学期）。
 * 奖励全部固定查表（零随机）：学分走任务类额度（reason='pass'），道具走 addItem，
 * 装备为「自选 1 件」——经 grantPassEquip 直通解锁（不扣学分）。
 */
import { GRADE_ORDER } from '../data/grades';
import { expansionEquipById } from '../data/expansion';
import { addCredits, addItem, grantEquip } from './credits';
import { PROFILE, saveProfile } from './profile';

export const PASS_MAX_LEVEL = 30;

export interface PassState {
  semester: string;
  exp: number;
  claimed: number[];
}

/** 当前学期（大厅所选年级；未选时为空串表示通用战令） */
export function currentSemester(): string {
  const g = (window as unknown as { SELECTED_GRADE?: string }).SELECTED_GRADE;
  return g && GRADE_ORDER.includes(g) ? g : '';
}

/** 战令状态（跨学期自动重置） */
export function passState(): PassState {
  const sem = currentSemester();
  if (!PROFILE.pass || PROFILE.pass.semester !== sem) {
    PROFILE.pass = { semester: sem, exp: 0, claimed: [] };
    saveProfile();
  }
  return PROFILE.pass;
}

/** 经验 → 等级（满级 30） */
export function passLevelOf(exp: number): number {
  let lv = 0;
  let e = exp;
  while (lv < PASS_MAX_LEVEL && e >= 100 + 30 * lv) {
    e -= 100 + 30 * lv;
    lv++;
  }
  return lv;
}

/** 当前等级内的经验进度 */
export function passExpInLevel(exp: number): { cur: number; need: number } {
  let lv = 0;
  let e = exp;
  while (lv < PASS_MAX_LEVEL && e >= 100 + 30 * lv) {
    e -= 100 + 30 * lv;
    lv++;
  }
  if (lv >= PASS_MAX_LEVEL) return { cur: 1, need: 1 };
  return { cur: e, need: 100 + 30 * lv };
}

/** 增加战令经验（升级时抛 pass-updated 事件） */
export function addPassExp(n: number): void {
  if (n <= 0) return;
  const p = passState();
  const before = passLevelOf(p.exp);
  p.exp += n;
  const after = passLevelOf(p.exp);
  saveProfile();
  if (after > before && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pass-updated'));
  }
}

export interface PassRewardRow {
  level: number;
  kind: 'credit' | 'item' | 'equip';
  label: string;
  credits?: number;
  itemId?: string;
  n?: number;
  /** equip：可自选该档位任意 1 件 */
  tier?: 1 | 2 | 3;
}

/** 30 级固定奖励表 */
export const PASS_REWARDS: PassRewardRow[] = [
  { level: 1, kind: 'credit', label: '学分 20', credits: 20 },
  { level: 2, kind: 'item', label: '温故符 ×1', itemId: 'it_reset', n: 1 },
  { level: 3, kind: 'credit', label: '学分 25', credits: 25 },
  { level: 4, kind: 'item', label: '护身符 ×1', itemId: 'it_shield', n: 1 },
  { level: 5, kind: 'credit', label: '学分 30', credits: 30 },
  { level: 6, kind: 'item', label: '灵感符 ×1', itemId: 'it_draw', n: 1 },
  { level: 7, kind: 'credit', label: '学分 35', credits: 35 },
  { level: 8, kind: 'item', label: '锦囊符 ×1', itemId: 'it_peek', n: 1 },
  { level: 9, kind: 'credit', label: '学分 40', credits: 40 },
  { level: 10, kind: 'equip', label: 'tier1 装备自选 1 件 + 学分 50', tier: 1, credits: 50 },
  { level: 11, kind: 'credit', label: '学分 45', credits: 45 },
  { level: 12, kind: 'item', label: '温故符 ×1', itemId: 'it_reset', n: 1 },
  { level: 13, kind: 'credit', label: '学分 50', credits: 50 },
  { level: 14, kind: 'item', label: '护身符 ×1', itemId: 'it_shield', n: 1 },
  { level: 15, kind: 'credit', label: '学分 60', credits: 60 },
  { level: 16, kind: 'item', label: '拆弹符 ×1', itemId: 'it_peek2', n: 1 },
  { level: 17, kind: 'credit', label: '学分 65', credits: 65 },
  { level: 18, kind: 'item', label: '灵感符 ×1', itemId: 'it_draw', n: 1 },
  { level: 19, kind: 'credit', label: '学分 70', credits: 70 },
  { level: 20, kind: 'equip', label: 'tier2 装备自选 1 件 + 学分 80', tier: 2, credits: 80 },
  { level: 21, kind: 'credit', label: '学分 75', credits: 75 },
  { level: 22, kind: 'item', label: '锦囊符 ×1', itemId: 'it_peek', n: 1 },
  { level: 23, kind: 'credit', label: '学分 80', credits: 80 },
  { level: 24, kind: 'item', label: '铁壁符 ×1', itemId: 'it_wall', n: 1 },
  { level: 25, kind: 'credit', label: '学分 90', credits: 90 },
  { level: 26, kind: 'item', label: '温故符 ×2', itemId: 'it_reset', n: 2 },
  { level: 27, kind: 'credit', label: '学分 95', credits: 95 },
  { level: 28, kind: 'item', label: '拆弹符 ×1', itemId: 'it_peek2', n: 1 },
  { level: 29, kind: 'credit', label: '学分 100', credits: 100 },
  { level: 30, kind: 'equip', label: 'tier3 装备自选 1 件 + 学分 300', tier: 3, credits: 300 },
];

/**
 * 领取等级奖励。返回 true = 已发放；'choice' = 装备自选（需 UI 继续选择）；
 * false = 等级未到 / 已领 / 无此奖励。
 */
export function claimPassReward(level: number): boolean | 'choice' {
  const p = passState();
  if (p.claimed.includes(level)) return false;
  if (passLevelOf(p.exp) < level) return false;
  const r = PASS_REWARDS.find((x) => x.level === level);
  if (!r) return false;
  if (r.kind === 'equip') return 'choice';
  if (r.kind === 'credit') addCredits(r.credits || 0, 'pass');
  if (r.kind === 'item') addItem(r.itemId || '', r.n || 1);
  p.claimed = [...p.claimed, level];
  saveProfile();
  return true;
}

/** 战令装备自选：发放指定档位装备（直通解锁，不扣学分；含该等级的学分部分） */
export function grantPassEquip(level: number, equipId: string): boolean {
  const p = passState();
  if (p.claimed.includes(level) || passLevelOf(p.exp) < level) return false;
  const r = PASS_REWARDS.find((x) => x.level === level);
  if (!r || r.kind !== 'equip') return false;
  const e = expansionEquipById(equipId);
  if (!e || e.tier !== r.tier) return false;
  if (!grantEquip(equipId)) return false;
  if (r.credits) addCredits(r.credits, 'pass');
  p.claimed = [...p.claimed, level];
  saveProfile();
  return true;
}
