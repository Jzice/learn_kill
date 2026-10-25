/* ==================== 卡牌 ==================== */
import type { Card, CardType } from '../core/types';
import { allTrickDefs } from './knowledgeTricks';
import { CARD_CATALOG } from './cardCatalog';
import type { CardPackId } from './cardPacks';

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

/** 【杀】的三种子类（普通杀 / 火杀 / 雷杀），出牌与手牌点击判定共用 */
export const SHA_SUBS: string[] = ['sha', 'huo', 'lei'];

/**
 * 构建牌堆。
 *
 * **零回归底线**：不传 `opts`（或 packs 仅含 'core'）时，产物与改造前的 125 张
 * 基础牌堆**逐项一致**（同名同数、同样的花色点数生成规则），由 scripts/smoke-cards.mjs 断言。
 *
 * 扩展卡为**追加式**入池：在基础牌之后 push，不改写基础配比，
 * 因此不启用扩展包时牌堆构成完全不变。
 */
export function buildDeck(opts?: { packs?: CardPackId[] }): Card[] {
  const d: Card[] = [];
  // 基本牌：杀共 30（普通杀 20 + 火杀 5 + 雷杀 5，与原版总数一致），闪 15 / 桃 8 / 酒 5
  for (let i = 0; i < 20; i++)
    d.push(C('杀', 'basic', 'sha', SUITS[i % 4], (i % 13) + 1, { damageType: 'normal' }));
  for (let i = 0; i < 5; i++)
    d.push(C('火杀', 'basic', 'huo', i % 2 ? '♦' : '♥', (i % 13) + 1, { damageType: 'fire' }));
  for (let i = 0; i < 5; i++)
    d.push(C('雷杀', 'basic', 'lei', i % 2 ? '♣' : '♠', (i % 13) + 1, { damageType: 'thunder' }));
  for (let i = 0; i < 15; i++) d.push(C('闪', 'basic', 'shan', SUITS[i % 4], (i % 13) + 1));
  for (let i = 0; i < 8; i++) d.push(C('桃', 'basic', 'tao', SUITS[i % 4], (i % 13) + 1));
  for (let i = 0; i < 5; i++) d.push(C('酒', 'basic', 'jiu', SUITS[i % 4], (i % 13) + 1));
  const tr: [string, string, Partial<Card>, number][] = [
    ['无中生有', 'wuzhong', {}, 4],
    ['过河拆桥', 'guohe', {}, 6],
    ['顺手牵羊', 'shunshou', {}, 5],
    ['决斗', 'juedou', {}, 3],
    ['南蛮入侵', 'nanman', {}, 3],
    ['万箭齐发', 'wanjian', {}, 1],
    ['桃园结义', 'taoyuan', {}, 1],
    ['无懈可击', 'wuxie', {}, 4],
    ['乐不思蜀', 'lebu', {}, 3],
    ['闪电', 'shandian', { damageType: 'thunder' }, 2],
    ['借刀杀人', 'jiedao', {}, 2],
    ['五谷丰登', 'wugu', {}, 2],
    ['铁索连环', 'tiesuo', {}, 6],
    ['火攻', 'huogong', { damageType: 'fire' }, 3],
  ];
  tr.forEach(([n, s, e, c]) => {
    for (let i = 0; i < c; i++) d.push(C(n, 'trick', s, SUITS[i % 4], (i % 13) + 1, e));
  });
  // 扩展卡：按 cardCatalog 追加（仅投放已启用卡包的卡牌；具名坐骑等 sub 重复项按记录各自投放）
  const packs = opts?.packs;
  if (packs && packs.length) {
    for (const def of Object.values(CARD_CATALOG)) {
      if (!packs.includes(def.pack)) continue;
      for (let i = 0; i < def.count; i++)
        d.push(C(def.name, def.type, def.sub, SUITS[i % 4], (i % 13) + 1, def.extra ? { ...def.extra } : {}));
    }
  }
  // 知识点锦囊：按定义表批量注入（type='trick'，sub=定义表 key），张数受 KtDef.deck 控制，
  // 不改变基本牌 30/15/8/5 比例；随牌堆洗牌后与其他牌混合。
  for (const [sub, def] of Object.entries(allTrickDefs())) {
    for (let i = 0; i < (def.deck ?? 1); i++)
      d.push(C(def.name, 'trick', sub, SUITS[i % 4], (i % 13) + 1));
  }
  const eq: [string, string, Partial<Card>, number][] = [
    ['诸葛连弩', 'weapon', { range: 1, skill: 'liannu' }, 2],
    ['青龙偃月刀', 'weapon', { range: 3, skill: 'qinglong' }, 1],
    ['丈八蛇矛', 'weapon', { range: 3, skill: 'zhangba' }, 1],
    ['青釭剑', 'weapon', { range: 2, skill: 'qinggang' }, 1],
    ['雌雄双股剑', 'weapon', { range: 2, skill: 'cixiong' }, 1],
    ['贯石斧', 'weapon', { range: 3, skill: 'guanshi' }, 1],
    ['方天画戟', 'weapon', { range: 4, skill: 'fangtian' }, 1],
    ['寒冰剑', 'weapon', { range: 2, skill: 'hanbing' }, 1],
    ['古锭刀', 'weapon', { range: 2, skill: 'guding' }, 1],
    ['八卦阵', 'armor', { skill: 'bagua' }, 2],
    ['仁王盾', 'armor', { skill: 'renwang' }, 1],
    ['藤甲', 'armor', { skill: 'tengjia' }, 2],
    ['白银狮子', 'armor', { skill: 'baiyin' }, 1],
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
