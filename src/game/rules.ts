/* ==================== 规则原语（距离/手牌/技能判定） ==================== */
import type { Card, Gender, Player } from '../core/types';
import { G } from './state';
import { shuffle } from '../data/cards';
import { CHAR_GENDER } from '../data/characters';
import { Sound } from '../core/sound';
import { discardFx, drawFx } from '../core/fx';

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
  if (to.equip.horsePlus) d += 1;
  if (from.equip.horseMinus) d -= 1;
  // 「浮力」(生物?) 物理·初中 / 「经纬」地理·初中：计算距离-1（扩展包触发技）
  if (hasSkill(from, 'wanyou') || hasSkill(from, 'tanxian') || hasSkill(from, 'fuli') || hasSkill(from, 'jingwei')) d -= 1;
  return Math.max(1, d);
}

export function attackRange(p: Player): number {
  return p.equip.weapon ? p.equip.weapon.range || 1 : 1;
}

export function inRange(fi: number, ti: number): boolean {
  return distBetween(fi, ti) <= attackRange(G.players[fi]);
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
  if (hasSkill(p, 'zhuishu')) l += 2;
  if (hasSkill(p, 'yichuan')) l += 2; // 生物·高中「遗传」
  if (hasSkill(p, 'yuansu')) l += 1;
  if (hasSkill(p, 'fangchengshi')) l += 1; // 化学·初中「方程式」
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
