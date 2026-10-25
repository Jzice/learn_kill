/* ==================== 规则原语（距离/手牌/技能判定） ==================== */
import type { Card, EquipSlot, Gender, Player } from '../core/types';
import { G } from './state';
import { shuffle } from '../data/cards';
import { CHAR_GENDER } from '../data/characters';
import { Sound } from '../core/sound';
import { discardFx, drawFx } from '../core/fx';
import { triggerDistMod, triggerHandLimit } from './skillfx';
import { distModOf, distPlusToMeOf, enemyEquipVoidOf, handLimitBonus, horseDistOf, ignoreHorsePlus } from './skillEngine';

export function hasSkill(p: Player, id: string): boolean {
  return !!p.skills && p.skills.some((s) => s.id === id);
}

/** 角色性别：真人取个性化设置（隐藏则回退角色表），AI 取角色表；用于【雌雄双股剑】异性判定 */
export function genderOf(p: Player): Gender {
  const g = p.identity?.gender;
  if (g && g !== 'hidden') return g;
  return CHAR_GENDER[p.charId] || 'male';
}

export function seatDist(a: number, b: number): number {
  // 官方规则：一名角色死亡则不再参与距离的计算，即其左右两边的角色就"挨近"了
  // 因此把存活角色按座次压缩成环，在其相对位置上取顺时针 / 逆时针的最短路径
  const alive: number[] = [];
  for (let i = 0; i < G.players.length; i++) if (G.players[i].alive) alive.push(i);
  const n = alive.length;
  const ai = alive.indexOf(a);
  const bi = alive.indexOf(b);
  if (ai < 0 || bi < 0) return Infinity; // 调用方已过滤阵亡者，理论不可达
  return Math.min(Math.abs(ai - bi), n - Math.abs(ai - bi));
}

export function distBetween(fi: number, ti: number): number {
  let d = seatDist(fi, ti);
  const from = G.players[fi],
    to = G.players[ti];
  // 徐霞客【探险】无视他人 +1 马；墨子【非攻】令他人 +1 马对你无效
  if (to.equip.horsePlus && !ignoreHorsePlus(from) && !enemyEquipVoidOf(to, 'horsePlus')) d += 1;
  // 墨子【非攻】令他人 -1 马对你无效
  if (from.equip.horseMinus && !enemyEquipVoidOf(to, 'horseMinus')) d -= 1;
  // 郑和【航海图】马政：装备区每有一张马，距离额外 -1
  d -= horseDistOf(from);
  // 声明式技能：距离修正原语（万有引力 / 探险 / 航海图 / 舆地 / 浮力 / 经纬）
  d += distModOf(from);
  // 牛顿【万有引力】：其他角色计算与你的距离 +1
  d += distPlusToMeOf(to);
  // 扩展包触发技：距离修正原语（保持加法式共存）
  d += triggerDistMod(from);
  return Math.max(1, d);
}

export function attackRange(p: Player): number {
  return p.equip.weapon ? p.equip.weapon.range || 1 : 1;
}

export function inRange(fi: number, ti: number): boolean {
  return distBetween(fi, ti) <= attackRange(G.players[fi]);
}

/**
 * 【银月枪】花色封锁：该角色不能使用或打出其封锁花色的手牌。
 * 封锁在其**自己**的下个回合开始时清除（见 runTurn 的回合初重置）。
 */
export function blockedSuitOf(p: Player): string | null {
  return p.flags.blockSuit || null;
}

/** 该角色当前能否使用 / 打出这张牌（花色封锁判定；弃置不受影响） */
export function canUseCard(p: Player, c: Card): boolean {
  const b = blockedSuitOf(p);
  return !b || c.suit !== b;
}

/** 手牌中「可使用」且满足谓词的牌（统一过滤花色封锁，供出杀 / 出闪 / 响应 AOE 复用） */
export function usableHand(p: Player, pred: (c: Card) => boolean): Card[] {
  return p.hand.filter((c) => pred(c) && canUseCard(p, c));
}

/** 宝物槽技能（【木牛流马】等）是否生效 */
export function treasureSkillOf(p: Player): string | undefined {
  return p.equip.treasure?.skill;
}

/** 装备区里所有坐骑牌所在的槽位（【麒麟弓】弃置目标坐骑用） */
export function horseSlotsOf(p: Player): ('horsePlus' | 'horseMinus')[] {
  const out: ('horsePlus' | 'horseMinus')[] = [];
  if (p.equip.horsePlus) out.push('horsePlus');
  if (p.equip.horseMinus) out.push('horseMinus');
  return out;
}

/** 装备区里所有非空槽位（【调虎离山】/【水淹七军】弃置装备用） */
export function filledEquipSlots(p: Player): EquipSlot[] {
  const out: EquipSlot[] = [];
  if (p.equip.weapon) out.push('weapon');
  if (p.equip.armor) out.push('armor');
  if (p.equip.horsePlus) out.push('horsePlus');
  if (p.equip.horseMinus) out.push('horseMinus');
  if (p.equip.treasure) out.push('treasure');
  return out;
}

export function drawCards(p: Player, n: number): void {
  for (let i = 0; i < n; i++) {
    if (G.deck.length === 0) {
      if (G.discard.length === 0) break;
      G.deck = G.discard;
      G.discard = [];
      shuffle(G.deck);
    }
    const c = G.deck.pop();
    if (c) p.hand.push(c);
  }
  if (n > 0) {
    Sound.play('draw');
    const idx = G.players.indexOf(p);
    if (idx === G.myPlayerIdx || G.players.length === 0) drawFx(idx < 0 ? 0 : idx, n);
  }
}

export function discardCard(p: Player, card: Card, toDiscard = true): void {
  const i = p.hand.findIndex((c) => c.id === card.id);
  if (i >= 0) {
    p.hand.splice(i, 1);
    if (toDiscard) {
      G.discard.push(card);
      const idx = G.players.indexOf(p);
      if (idx === G.myPlayerIdx) discardFx(idx);
      Sound.play('discard');
    }
  }
}

export function handLimit(p: Player): number {
  let l = Math.max(p.hp, 0);
  // 声明式技能：手牌上限原语（缀术 +2 / 数论直觉 +1（有对子再 +1）/ 元素 +1 …）
  l += handLimitBonus(p);
  // 扩展包触发技：手牌上限原语（数学/化学「厚积薄发」handLimit: +1 等）
  l += triggerHandLimit(p);
  return l;
}

export function sameFaction(a: Player, b: Player): boolean {
  return a.faction === b.faction;
}

/** 座位显示顺序：本人永远第一 */
export function displayOrder(): number[] {
  const n = G.players.length,
    me = G.myPlayerIdx,
    arr: number[] = [];
  for (let k = 0; k < n; k++) arr.push((me + k) % n);
  return arr;
}
