/* ==================== 扩展卡牌目录（纯数据 · 新增卡牌的唯一真源） ====================
 * 定位：在基础牌堆（core，现有 125 张）之上补齐原版三国杀缺失的卡牌。
 *
 * 设计约定：
 *   1. 装备牌的 `sub` **必须是槽位名**（weapon / armor / horse+ / horse- / treasure），
 *      装备写入哪个槽由 sub 决定（见 game/turn.ts 与 game/ai.ts 的装备分支）；
 *      具体是哪一件装备由 `extra.skill` 区分。锦囊 / 基本牌的 `sub` 沿用原版英文 key。
 *      由此 `Card` 结构不变 → `state_sync` 序列化结构不变，旧版客户端可正常解包。
 *   2. `name` **直接使用《三国杀》原版卡名**（不做学堂化改名），规则书、出牌选项与战斗日志同源。
 *   3. 规则内核严格沿用原版；存在分歧或需要额外交互的少数卡牌已在 desc 中标注「简化实现」，
 *      详见 docs/卡牌扩展包清单.md。
 *   4. 本模块为纯数据，**无顶层副作用**（保持 ui ↔ game ↔ net 的模块循环安全）。
 *
 * 结算方式 resolve：
 *   - 'judge'  ：延时锦囊，置入目标判定区，由 judgePhase 结算
 *   - 'switch' ：锦囊，由 game/actions.ts 的 useTrick 新增 case 结算
 *   - 'equip'  ：装备，通过 Card.skill 钩子结算（武器在 useSha、防具在 damage）
 *   - 'passive'：装备但无主动技能（具名坐骑，复用 ±1 马的距离计算）
 */
import type { Card, CardType } from '../core/types';
import type { CardPackId } from './cardPacks';

export interface CardDef {
  /** 卡牌内部 key（沿用原版英文，联机结构兼容的关键） */
  sub: string;
  /** 卡名，与《三国杀》原版一致 */
  name: string;
  type: CardType;
  /** 归属扩展包 */
  pack: CardPackId;
  /** 牌堆投放张数 */
  count: number;
  /** 额外字段：range / skill / dist / judgeType / damageType */
  extra?: Partial<Card>;
  /** 结算方式 */
  resolve: 'judge' | 'switch' | 'equip' | 'passive';
  /** 出牌提示与规则书文案 */
  desc: string;
}

/**
 * 全量扩展卡牌目录。新增卡牌 = 加一条记录（牌堆自动投放），
 * 再按 resolve 类型在对应结算点补充分支即可。
 */
export const CARD_CATALOG: Record<string, CardDef> = {
  /* ---------------- 军争篇 ---------------- */
  bingliang: {
    sub: 'bingliang',
    name: '兵粮寸断',
    type: 'trick',
    pack: 'junzheng',
    count: 2,
    extra: { judgeType: 'bingliang' },
    resolve: 'judge',
    desc: '延时锦囊：置于一名其他角色的判定区，其判定若不为♣梅花，则跳过其摸牌阶段',
  },
  qilin: {
    sub: 'weapon',
    name: '麒麟弓',
    type: 'equip',
    pack: 'junzheng',
    count: 1,
    extra: { range: 5, skill: 'qilin' },
    resolve: 'equip',
    desc: '攻击范围 5；你使用【杀】造成伤害后，可弃置目标装备区里的一张坐骑牌',
  },
  zhuque: {
    sub: 'weapon',
    name: '朱雀羽扇',
    type: 'equip',
    pack: 'junzheng',
    count: 1,
    extra: { range: 4, skill: 'zhuque' },
    resolve: 'equip',
    desc: '攻击范围 4；你可将一张普通【杀】当【火杀】使用',
  },

  /* ---------------- 神话再临（风火林山） ---------------- */
  yinyue: {
    sub: 'weapon',
    name: '银月枪',
    type: 'equip',
    pack: 'shenhua',
    count: 1,
    extra: { range: 3, skill: 'yinyue' },
    resolve: 'equip',
    desc: '攻击范围 3；你使用【杀】造成伤害后，可令目标不能使用或打出与该【杀】同花色的手牌，直到其下个回合开始',
  },
  qixing: {
    sub: 'weapon',
    name: '七星刀',
    type: 'equip',
    pack: 'shenhua',
    count: 1,
    extra: { range: 2, skill: 'qixing' },
    resolve: 'equip',
    desc: '攻击范围 2；你使用【杀】造成伤害后，可令目标弃置一张手牌',
  },
  taiping: {
    sub: 'armor',
    name: '太平要术',
    type: 'equip',
    pack: 'shenhua',
    count: 1,
    extra: { skill: 'taiping' },
    resolve: 'equip',
    desc: '防具·锁定技：你不能成为【乐不思蜀】【兵粮寸断】等延时锦囊的目标',
  },
  mingguang: {
    sub: 'armor',
    name: '明光铠',
    type: 'equip',
    pack: 'shenhua',
    count: 1,
    extra: { skill: 'mingguang' },
    resolve: 'equip',
    desc: '防具：你每次受到的伤害 -1（最低 1 点）；【青釭剑】可无视',
  },

  /* ---------------- SP · 一将成名 ---------------- */
  wuliu: {
    sub: 'weapon',
    name: '吴六剑',
    type: 'equip',
    pack: 'sp',
    count: 1,
    extra: { range: 2, skill: 'wuliu' },
    resolve: 'equip',
    desc: '攻击范围 2；你使用【杀】造成伤害后，可弃置一张手牌，对其追加 1 点伤害',
  },
  muyu: {
    sub: 'treasure',
    name: '木牛流马',
    type: 'equip',
    pack: 'sp',
    count: 1,
    extra: { skill: 'muyu' },
    resolve: 'equip',
    desc: '宝物：摸牌阶段额外摸 1 张牌（简化实现：省略原版「存粮 / 取粮」的额外交互）',
  },
  // 具名坐骑：原版标准包 / SP 复刻马，规则内核与 ±1 马一致
  chitu: {
    sub: 'horse-',
    name: '赤兔',
    type: 'equip',
    pack: 'sp',
    count: 1,
    extra: { dist: 1 },
    resolve: 'passive',
    desc: '-1 马：你计算与其他角色的距离 -1',
  },
  zixin: {
    sub: 'horse-',
    name: '紫骍',
    type: 'equip',
    pack: 'sp',
    count: 1,
    extra: { dist: 1 },
    resolve: 'passive',
    desc: '-1 马：你计算与其他角色的距离 -1',
  },
  zhaohuang: {
    sub: 'horse-',
    name: '爪黄飞电',
    type: 'equip',
    pack: 'sp',
    count: 1,
    extra: { dist: 1 },
    resolve: 'passive',
    desc: '-1 马：你计算与其他角色的距离 -1',
  },
  dilu: {
    sub: 'horse+',
    name: '的卢',
    type: 'equip',
    pack: 'sp',
    count: 1,
    extra: { dist: 1 },
    resolve: 'passive',
    desc: '+1 马：其他角色计算与你的距离 +1',
  },
  dayuan: {
    sub: 'horse+',
    name: '大宛',
    type: 'equip',
    pack: 'sp',
    count: 1,
    extra: { dist: 1 },
    resolve: 'passive',
    desc: '+1 马：其他角色计算与你的距离 +1',
  },
  jueying: {
    sub: 'horse+',
    name: '绝影',
    type: 'equip',
    pack: 'sp',
    count: 1,
    extra: { dist: 1 },
    resolve: 'passive',
    desc: '+1 马：其他角色计算与你的距离 +1',
  },

  /* ---------------- 应变篇 ---------------- */
  zhiji: {
    sub: 'zhiji',
    name: '知己知彼',
    type: 'trick',
    pack: 'yingbian',
    count: 2,
    resolve: 'switch',
    desc: '观看一名其他角色的手牌，然后你摸 1 张牌',
  },
  shuishui: {
    sub: 'shuishui',
    name: '水淹七军',
    type: 'trick',
    pack: 'yingbian',
    count: 2,
    resolve: 'switch',
    desc: '令一名装备区有牌的其他角色弃置一张装备牌，否则其受到你造成的 1 点伤害',
  },
  caomu: {
    sub: 'caomu',
    name: '草木皆兵',
    type: 'trick',
    pack: 'yingbian',
    count: 2,
    resolve: 'switch',
    desc: '令一名其他角色弃置两张手牌（简化实现：原版为「限制其使用/打出某花色手牌」）',
  },
  yuanjiao: {
    sub: 'yuanjiao',
    name: '远交近攻',
    type: 'trick',
    pack: 'yingbian',
    count: 1,
    resolve: 'switch',
    desc: '令一名其他角色摸 1 张牌，然后你摸 2 张牌',
  },
  yiyi: {
    sub: 'yiyi',
    name: '以逸待劳',
    type: 'trick',
    pack: 'yingbian',
    count: 1,
    resolve: 'switch',
    desc: '令一名其他角色摸 2 张牌，然后你摸 1 张牌',
  },
  huoshao: {
    sub: 'huoshao',
    name: '火烧连营',
    type: 'trick',
    pack: 'yingbian',
    count: 1,
    extra: { damageType: 'fire' },
    resolve: 'switch',
    desc: '对一名其他角色造成 1 点火属性伤害；若其处于连环状态，额外造成 1 点火属性伤害',
  },

  /* ---------------- 国战篇（仅卡牌，不含模式规则） ---------------- */
  wuxieguo: {
    sub: 'wuxieguo',
    name: '无懈可击·国',
    type: 'trick',
    pack: 'guozhan',
    count: 2,
    resolve: 'switch',
    desc: '响应牌：抵消一张锦囊对所有角色的效果（不可被再次无懈）',
  },
  diaohu: {
    sub: 'diaohu',
    name: '调虎离山',
    type: 'trick',
    pack: 'guozhan',
    count: 2,
    resolve: 'switch',
    desc: '弃置一名其他角色装备区里的一张牌',
  },
  lianjun: {
    sub: 'lianjun',
    name: '联军盛宴',
    type: 'trick',
    pack: 'guozhan',
    count: 1,
    resolve: 'switch',
    desc: '所有其他存活角色各摸 1 张牌',
  },
  chiling: {
    sub: 'chiling',
    name: '敕令',
    type: 'trick',
    pack: 'guozhan',
    count: 1,
    resolve: 'switch',
    desc: '令所有其他存活角色各弃置一张手牌',
  },
};

/** 需指定一名其他角色为目标的扩展锦囊（出牌阶段目标选择 / 兼爱转移共用） */
export const ONE_TARGET_TRICKS: string[] = Object.values(CARD_CATALOG)
  .filter((d) => d.type === 'trick' && d.resolve === 'switch' && d.sub !== 'wuxieguo' && d.sub !== 'lianjun' && d.sub !== 'chiling')
  .map((d) => d.sub);

/** 群体锦囊（无需指定目标，对所有其他角色生效） */
export const ALL_TARGET_TRICKS: string[] = ['lianjun', 'chiling'];

/** 响应牌：只能被动打出，不出现在出牌阶段的可选列表 */
export const RESPONSE_ONLY_TRICKS: string[] = ['wuxieguo'];

/** 可被【无懈可击】响应的扩展锦囊（延时类不在此列，与既有 lebu / shandian 口径一致） */
export const COUNTERABLE_EXTRA_TRICKS: string[] = Object.values(CARD_CATALOG)
  .filter((d) => d.type === 'trick' && d.resolve === 'switch' && d.sub !== 'wuxieguo')
  .map((d) => d.sub);

/** 延时锦囊（置入判定区）的 sub 集合 */
export const DELAY_TRICK_SUBS: string[] = Object.values(CARD_CATALOG)
  .filter((d) => d.resolve === 'judge')
  .map((d) => d.sub);

/** 按 sub 取目录项（同名 sub 的具名坐骑只返回首条，仅用于文案兜底） */
export function cardDefOf(sub: string): CardDef | undefined {
  return CARD_CATALOG[sub];
}

/** 按 sub + 卡名取目录项（具名坐骑的 sub 重复，需按名字区分） */
export function cardDefOfCard(c: Card): CardDef | undefined {
  for (const def of Object.values(CARD_CATALOG)) {
    if (def.sub === c.sub && def.name === c.name) return def;
  }
  return undefined;
}

/** 该卡是否为扩展卡（用于规则书分组与「未知卡兜底」判断） */
export function isExtraCard(c: Card): boolean {
  return cardDefOfCard(c) !== undefined;
}
