/* ==================== 规则原语（距离/手牌/技能判定） ==================== */
import type { Card, Player } from '../core/types';
import { G } from './state';
import { shuffle } from '../data/cards';
import { Sound } from '../core/sound';

export function hasSkill(p: Player, id: string): boolean {
  return !!p.skills && p.skills.some((s) => s.id === id);
}

export function seatDist(a: number, b: number): number {
  const n = G.players.length;
  return Math.min(Math.abs(a - b), n - Math.abs(a - b));
}

export function distBetween(fi: number, ti: number): number {
  let d = seatDist(fi, ti);
  const from = G.players[fi],
    to = G.players[ti];
  if (to.equip.horsePlus) d += 1;
  if (from.equip.horseMinus) d -= 1;
  if (hasSkill(from, 'wanyou') || hasSkill(from, 'tanxian')) d -= 1;
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
  if (n > 0) Sound.play('draw');
}

export function discardCard(p: Player, card: Card, toDiscard = true): void {
  const i = p.hand.findIndex((c) => c.id === card.id);
  if (i >= 0) {
    p.hand.splice(i, 1);
    if (toDiscard) G.discard.push(card);
  }
}

export function handLimit(p: Player): number {
  let l = Math.max(p.hp, 0);
  if (hasSkill(p, 'zhuishu')) l += 2;
  if (hasSkill(p, 'yuansu')) l += 1;
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
