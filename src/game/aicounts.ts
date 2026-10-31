/* ==================== AI 牌堆 / 手牌推断（信息集建模） ====================
 * 博弈论意义：本游戏是「不完全信息博弈」，AI 的信息集 = 自己手牌 + 全部公开信息。
 * 牌堆构成是**固定且已知**的，因此可以用「总数 − 已公开」推出未见牌分布，
 * 进而估算「对手手里有没有闪」「决斗能不能赢」这类概率——这是所有 EV 计算的分母。
 *
 * 合法性：只使用 AI 视角可见的信息（自己手牌 / 全场装备 / 弃牌堆 / 判定区 / 他人手牌**数量**），
 * 绝不读取他人手牌内容。
 *
 * 模块级状态不入 G（与 beliefs / grudges 一致），不随 state_sync 下发。
 */
import type { Card } from '../core/types';
import { G } from './state';
import { CARD_CATALOG } from '../data/cardCatalog';
import type { CardPackId } from '../data/cardPacks';

/** 基础牌堆构成（与 data/cards.ts::buildDeck 无参调用一一对应，共 125 张） */
export const BASE_DECK_TOTAL: Record<string, number> = {
  // 基本牌 58
  sha: 20,
  huo: 5,
  lei: 5,
  shan: 15,
  tao: 8,
  jiu: 5,
  // 锦囊 45
  wuzhong: 4,
  guohe: 6,
  shunshou: 5,
  juedou: 3,
  nanman: 3,
  wanjian: 1,
  taoyuan: 1,
  wuxie: 4,
  lebu: 3,
  shandian: 2,
  jiedao: 2,
  wugu: 2,
  tiesuo: 6,
  huogong: 3,
  // 装备 22
  weapon: 10,
  armor: 6,
  'horse+': 3,
  'horse-': 3,
};

/**
 * 当前牌堆构成 = 基础 125 张 + 已启用扩展卡包的投放量。
 * 由 game/setup.ts 在 buildDeck 之后调用 applyDeckComposition() 刷新，
 * 否则 AI 的概率分母仍停留在「仅基础包」的口径（偏差可接受但不够准）。
 */
export const DECK_TOTAL: Record<string, number> = { ...BASE_DECK_TOTAL };
export let DECK_SIZE = Object.values(DECK_TOTAL).reduce((s, n) => s + n, 0);

/** 按启用的牌库扩展包重算牌堆构成（幂等，可重复调用） */
export function applyDeckComposition(packs: CardPackId[]): void {
  for (const k of Object.keys(DECK_TOTAL)) delete DECK_TOTAL[k];
  Object.assign(DECK_TOTAL, BASE_DECK_TOTAL);
  for (const def of Object.values(CARD_CATALOG)) {
    if (!packs.includes(def.pack)) continue;
    DECK_TOTAL[def.sub] = (DECK_TOTAL[def.sub] || 0) + def.count;
  }
  DECK_SIZE = Object.values(DECK_TOTAL).reduce((s, n) => s + n, 0);
  pubVer = -1; // 强制重算公开牌池缓存
}

/** 局前配装注入的装备不来自牌堆（id ≥ 90000、花色 '✦'），计数时排除 */
function fromDeck(c: Card | null | undefined): boolean {
  return !!c && c.suit !== '✦' && c.id < 90000;
}

let pubVer = -1;
let pubCounts: Record<string, number> = {};
let pubTotal = 0;

/** 公开局面版本号（与具体座位无关：弃牌堆 + 牌堆 + 判定区 + 全场装备） */
function publicVersion(): number {
  let v = G.discard.length + G.deck.length;
  for (let i = 0; i < G.players.length; i++) {
    const p = G.players[i];
    v += p.judge.length;
    if (fromDeck(p.equip.weapon)) v++;
    if (fromDeck(p.equip.armor)) v++;
    if (fromDeck(p.equip.horsePlus)) v++;
    if (fromDeck(p.equip.horseMinus)) v++;
  }
  return v;
}

/**
 * 公开牌池（与「我方是谁」无关）：牌堆构成 − 弃牌堆 − 判定区 − 全场装备。
 * 缓存按 publicVersion 命中；多个座位轮流决策时不再因 me 不同而抖动重算。
 */
function publicPool(): { counts: Record<string, number>; total: number } {
  const v = publicVersion();
  if (v === pubVer) return { counts: pubCounts, total: pubTotal };
  const counts: Record<string, number> = { ...DECK_TOTAL };
  let removed = 0;
  const drop = (c: Card | null | undefined): void => {
    if (!fromDeck(c)) return;
    if (counts[c!.sub] === undefined) return;
    if (counts[c!.sub] > 0) counts[c!.sub]--;
    removed++;
  };
  for (const c of G.discard) drop(c);
  for (const p of G.players) {
    for (const c of p.judge) drop(c);
    drop(p.equip.weapon);
    drop(p.equip.armor);
    drop(p.equip.horsePlus);
    drop(p.equip.horseMinus);
  }
  const total = Math.max(0, DECK_SIZE - removed);
  pubVer = v;
  pubCounts = counts;
  pubTotal = total;
  return { counts, total };
}

/**
 * 未见牌分布（AI 视角）：公开牌池 − 自己手牌。
 * 结果既包含「牌堆剩余」也包含「他人手牌」，正是估计他人手牌的正确抽样池。
 */
function unseen(me: number): { counts: Record<string, number>; total: number } {
  const { counts, total } = publicPool();
  const counts2: Record<string, number> = { ...counts };
  let removed = 0;
  const mine = G.players[me];
  if (mine) {
    for (const c of mine.hand) {
      if (fromDeck(c) && counts2[c.sub] !== undefined && counts2[c.sub] > 0) {
        counts2[c.sub]--;
        removed++;
      }
    }
  }
  return { counts: counts2, total: total - removed };
}

/** 未见池中某（些）子类的张数 */
export function unseenCountOf(me: number, subs: string | string[]): number {
  const list = Array.isArray(subs) ? subs : [subs];
  const { counts } = unseen(me);
  let n = 0;
  for (const s of list) n += counts[s] || 0;
  return n;
}

/** 未见池中随机一张牌属于该（些）子类的概率 */
export function pUnseen(me: number, subs: string | string[]): number {
  const { total } = unseen(me);
  if (total <= 0) return 0;
  return unseenCountOf(me, subs) / total;
}

/** 目标 t 的 n 张手牌中「至少一张属于该子类」的概率（独立近似，足够稳） */
export function pAtLeastOne(me: number, t: number, subs: string | string[]): number {
  const tp = G.players[t];
  if (!tp) return 0;
  const n = tp.hand.length;
  if (n <= 0) return 0;
  const q = pUnseen(me, subs);
  return 1 - Math.pow(1 - q, n);
}

/** 目标 t 手牌中该类牌的**期望张数**（用于决斗等需要数量而非存在性的场合） */
export function expectedCount(me: number, t: number, subs: string | string[]): number {
  const tp = G.players[t];
  if (!tp) return 0;
  return tp.hand.length * pUnseen(me, subs);
}

/** 我方手牌中可当【杀】使用的张数（含转化技由调用方自行叠加） */
export function countSub(pIdx: number, subs: string | string[]): number {
  const p = G.players[pIdx];
  if (!p) return 0;
  const list = Array.isArray(subs) ? subs : [subs];
  return p.hand.filter((c) => list.includes(c.sub)).length;
}

/** 二项分布 CDF：P(K ≤ k)，K ~ Bin(n, p) —— 决斗子博弈的闭式解需要 */
export function binomCdf(k: number, n: number, p: number): number {
  if (k < 0) return 0;
  if (k >= n) return 1;
  if (p <= 0) return 1;
  if (p >= 1) return 0;
  let s = 0;
  let c = 1; // C(n, 0)
  for (let i = 0; i <= k; i++) {
    s += c * Math.pow(p, i) * Math.pow(1 - p, n - i);
    c = (c * (n - i)) / (i + 1);
  }
  return Math.max(0, Math.min(1, s));
}

/** 新对局：清空缓存（由 resetBrain 一并调用） */
export function resetCounts(): void {
  pubVer = -1;
  pubCounts = {};
  pubTotal = 0;
}
