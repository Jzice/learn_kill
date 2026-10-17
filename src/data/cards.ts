/* ==================== 卡牌 ==================== */
import type { Card, CardType } from '../core/types';

export const SUITS: string[] = ['♠', '♥', '♣', '♦'];
let cid = 0;

export function C(
  name: string,
  type: CardType,
  sub: string,
  suit: string,
  num: string | number,
  extra: Partial<Card> = {},
): Card {
  return { id: ++cid, name, type, sub, suit, num, ...extra };
}

export function buildDeck(): Card[] {
  const d: Card[] = [];
  for (let i = 0; i < 30; i++) d.push(C('杀', 'basic', 'sha', SUITS[i % 4], (i % 13) + 1));
  for (let i = 0; i < 15; i++) d.push(C('闪', 'basic', 'shan', SUITS[i % 4], (i % 13) + 1));
  for (let i = 0; i < 8; i++) d.push(C('桃', 'basic', 'tao', SUITS[i % 4], (i % 13) + 1));
  for (let i = 0; i < 5; i++) d.push(C('酒', 'basic', 'jiu', SUITS[i % 4], (i % 13) + 1));
  const tr: [string, string, number][] = [
    ['无中生有', 'wuzhong', 4],
    ['过河拆桥', 'guohe', 6],
    ['顺手牵羊', 'shunshou', 5],
    ['决斗', 'juedou', 3],
    ['南蛮入侵', 'nanman', 3],
    ['万箭齐发', 'wanjian', 1],
    ['桃园结义', 'taoyuan', 1],
    ['无懈可击', 'wuxie', 4],
    ['乐不思蜀', 'lebu', 3],
    ['闪电', 'shandian', 2],
  ];
  tr.forEach(([n, s, c]) => {
    for (let i = 0; i < c; i++) d.push(C(n, 'trick', s, SUITS[i % 4], (i % 13) + 1));
  });
  const eq: [string, string, Partial<Card>, number][] = [
    ['诸葛连弩', 'weapon', { range: 1, skill: 'liannu' }, 1],
    ['青龙偃月刀', 'weapon', { range: 3, skill: 'qinglong' }, 1],
    ['丈八蛇矛', 'weapon', { range: 3, skill: 'zhangba' }, 1],
    ['八卦阵', 'armor', { skill: 'bagua' }, 2],
    ['仁王盾', 'armor', { skill: 'renwang' }, 1],
    ['+1马', 'horse+', { dist: 1 }, 3],
    ['-1马', 'horse-', { dist: 1 }, 3],
  ];
  eq.forEach(([n, s, e, c]) => {
    for (let i = 0; i < c; i++) d.push(C(n, 'equip', s, SUITS[i % 4], (i % 13) + 1, e));
  });
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

export function shuffle<T>(a: T[]): void {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}
