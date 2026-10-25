/* ==================== 牌库扩展包（Cards Pack） ====================
 * 与「角色扩展包」(src/data/packets.ts 的 PacketId) 相互独立：
 *   - PacketId  决定**角色池**（按年级 / 初中 / 高中 / 全部）
 *   - CardPackId 决定**牌堆构成**（在基础牌堆之上追加哪些扩展卡牌）
 * 两者命名与用途完全分离，避免 UI 与联机同步串线。
 *
 * core 为恒启用基础包（现有 125 张牌），不可关闭；
 * 其余包默认关闭，由房主开局勾选（联机随房间状态同步给加入方）。
 */
import type { CardDef } from './cardCatalog';

/** 牌库扩展包标识 */
export type CardPackId = 'core' | 'junzheng' | 'shenhua' | 'sp' | 'yingbian' | 'guozhan';

export interface CardPack {
  id: CardPackId;
  name: string;
  icon: string;
  desc: string;
  /** 原版出处（规则书展示用） */
  origin: string;
}

export const CARD_PACKS: CardPack[] = [
  {
    id: 'core',
    name: '基础牌堆',
    icon: '🂠',
    desc: '现有 125 张标准牌堆，恒启用且不可关闭',
    origin: '标准版 + 已并入的军争篇卡牌',
  },
  {
    id: 'junzheng',
    name: '军争篇',
    icon: '⚔️',
    desc: '延时锦囊与长射程武器：兵粮寸断 · 麒麟弓 · 朱雀羽扇',
    origin: '军争篇 / 神话再临补完',
  },
  {
    id: 'shenhua',
    name: '神话再临',
    icon: '🔥',
    desc: '风·火·林·山补充装备：银月枪 · 七星刀 · 太平要术 · 明光铠',
    origin: '神话再临（风火林山）',
  },
  {
    id: 'sp',
    name: 'SP · 一将成名',
    icon: '🎴',
    desc: '具名坐骑与特殊装备：吴六剑 · 木牛流马 · 六匹具名坐骑',
    origin: 'SP 卡 / 一将成名',
  },
  {
    id: 'yingbian',
    name: '应变篇',
    icon: '🌊',
    desc: '应变锦囊：知己知彼 · 水淹七军 · 草木皆兵 · 远交近攻 · 以逸待劳 · 火烧连营',
    origin: '应变篇',
  },
  {
    id: 'guozhan',
    name: '国战篇',
    icon: '🏳️',
    desc: '国战专属锦囊：无懈可击·国 · 调虎离山 · 联军盛宴 · 敕令',
    origin: '国战（仅引入卡牌，不含双将 / 野心家等模式规则）',
  },
];

/** 恒启用、不可关闭的基础包 */
export const CORE_CARD_PACK: CardPackId = 'core';

export const CARD_PACK_IDS: CardPackId[] = CARD_PACKS.map((p) => p.id);

export function isCardPackId(v: unknown): v is CardPackId {
  return typeof v === 'string' && (CARD_PACK_IDS as string[]).includes(v);
}

/**
 * 归一化外部传入的卡包列表（localStorage / 联机报文可能是任意字符串）：
 * 过滤非法值、去重、剔除 core（core 恒启用，由调用方自行并入）。
 */
export function normalizeCardPacks(list: unknown): CardPackId[] {
  if (!Array.isArray(list)) return [];
  const out: CardPackId[] = [];
  for (const v of list) {
    if (!isCardPackId(v) || v === CORE_CARD_PACK) continue;
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

/** 完整启用列表（含恒启用的 core），供 buildDeck 使用 */
export function withCore(list: CardPackId[]): CardPackId[] {
  const out = list.filter((id) => id !== CORE_CARD_PACK);
  return [CORE_CARD_PACK, ...out];
}

export function cardPackName(id: CardPackId): string {
  return CARD_PACKS.find((p) => p.id === id)?.name || '未知卡包';
}

/** 该卡包的卡牌种类数与投放总张数（规则书 / 选择面板展示用） */
export function packCardStats(id: CardPackId, catalog: Record<string, CardDef>): { types: number; cards: number } {
  let types = 0;
  let cards = 0;
  for (const def of Object.values(catalog)) {
    if (def.pack !== id) continue;
    types++;
    cards += def.count;
  }
  return { types, cards };
}

/** 是否至少启用了一个付费 / 扩展卡包（core 不算） */
export function hasExtraCardPack(list: CardPackId[]): boolean {
  return list.some((id) => id !== CORE_CARD_PACK);
}
