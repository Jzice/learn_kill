/* ==================== 技能定义表（声明式） ====================
 * 46 名基础角色共 93 个技能全部在此登记：时机 + 费用 + 限制 + 效果原语。
 * 由 src/game/skillEngine.ts 统一分派，规则书 / 选人卡 / 亮将卡均读本表。
 *
 * 设计原则（详见 docs/游戏机制.md）：
 * - 一人一面：每名角色的技能在至少三个机制维度上与其他角色区分
 * - 点数类技能命中率统一落在 40%~60%（质数 46.2% / 奇偶 46.2%~53.8% / ≥8 为 46.2% / ≤6 为 46.2%）
 * - 未命中分支必有 ≥0.6 PP 保底；群体与无限类收益封顶
 * - 「+1 学识」仅保留居里夫人【镭元素】一处学识经济技
 */
import type { Skill, SkillDef, SkillE, SkillTiming, SkillType } from '../core/types';

/** 展示类型 → 出牌阶段是否作为「主动技按钮」出现 */
export function skillTypeOf(d: SkillDef): SkillType {
  return d.kind === 'active' || d.kind === 'limit' || d.kind === 'lord' ? 'active' : 'trigger';
}

const PRIME = [2, 3, 5, 7, 11, 13];
/** 点数是否为质数（祖冲之·密率 / 缀术） */
export function isPrimeNum(n: number | string): boolean {
  return PRIME.includes(Number(n));
}

/* ------------------------------------------------------------------ */
/* 语文 📖                                                             */
/* ------------------------------------------------------------------ */

/** 鲁迅·呐喊：甘宁【奇袭】式转化技 */
const LUXUN_NAH: SkillDef = {
  id: 'luxun_nah',
  name: '呐喊',
  kind: 'convert',
  timing: 'passive',
  desc: '你可将一张黑色手牌当【过河拆桥】使用（杂文如匕首投枪）。',
  effects: [{ kind: 'convert', from: { color: 'black' }, to: 'guohe' }],
};

/** 鲁迅·横眉：展示手牌的花色分支反制 */
const LUXUN_HENGMEI: SkillDef = {
  id: 'luxun_hengmei',
  name: '横眉',
  kind: 'trigger',
  timing: 'onDamaged',
  desc: '受到伤害后，你可展示一张手牌：黑色则令伤害来源弃置一张牌，红色则你摸一张牌。',
  effects: [
    {
      kind: 'showHand',
      black: [{ kind: 'targetDiscard', n: 1 }],
      red: [{ kind: 'selfDraw', n: 1 }],
    },
  ],
};

/** 李白·将进酒：红色手牌当酒 */
const LIBAI_JIANGJINJIU: SkillDef = {
  id: 'libai_jiangjinjiu',
  name: '将进酒',
  kind: 'convert',
  timing: 'passive',
  desc: '你可将一张红色手牌当【酒】使用，每回合限一次（举杯邀明月）。',
  effects: [{ kind: 'convert', from: { color: 'red' }, to: 'jiu', limit: 'perTurn' }],
};

/** 李白·诗成：出牌顺序连锁（本回合第二张及之后的锦囊） */
const LIBAI_SHICHENG: SkillDef = {
  id: 'libai_shicheng',
  name: '诗成',
  kind: 'trigger',
  timing: 'onUseTrick',
  desc: '出牌阶段你使用的本回合第二张及之后的锦囊牌结算后，你摸一张牌；若为红色改为摸两张。',
  effects: [{ kind: 'trickDraw', n: 1, minSeq: 2, redExtra: 1 }],
};

/** 杜甫·三吏三别：窥牌 + 交换 */
const DUFU_SANLI: SkillDef = {
  id: 'dufu_sanli',
  name: '三吏三别',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可观看一名角色的手牌，然后与其各交换一张手牌。',
  effects: [{ kind: 'peekHand', then: 'exchange' }],
};

/** 杜甫·沉郁：觉醒技（残血觉醒） */
const DUFU_CHENYU: SkillDef = {
  id: 'dufu_chenyu',
  name: '沉郁',
  kind: 'awaken',
  timing: 'awaken',
  limit: 'perGame',
  cond: { k: 'hpAtMost', n: 1 },
  desc: '觉醒技：准备阶段若你的体力为 1，你减 1 点体力上限并永久获得【诗史】。',
  effects: [{ kind: 'awaken', replaceWith: 'dufu_shishi', minusMaxHp: 1 }],
};

/** 杜甫觉醒后·诗史 */
const DUFU_SHISHI: SkillDef = {
  id: 'dufu_shishi',
  name: '诗史',
  kind: 'passive',
  timing: 'passive',
  desc: '你的手牌上限 +2；你受到伤害后摸两张牌。',
  effects: [
    { kind: 'handLimit', n: 2 },
    { kind: 'selfDraw', n: 2, at: 'onDamaged' },
  ],
};

/** 朱自清·背影：给牌反哺 */
const ZHUZIQING_BEIYING: SkillDef = {
  id: 'zhuziqing_beiying',
  name: '背影',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可将一张手牌交给一名角色；若为【闪】，你摸两张牌。',
  effects: [{ kind: 'giveHandIfShan', selfDraw: 2 }],
};

/** 朱自清·荷塘月色：回合末「最后一张牌」条件 */
const ZHUZIQING_HETANG: SkillDef = {
  id: 'zhuziqing_hetang',
  name: '荷塘月色',
  kind: 'trigger',
  timing: 'onTurnEnd',
  desc: '回合结束，若你本回合使用的最后一张牌为锦囊牌，你摸一张牌；若你本回合未使用过任何牌，你回复 1 点体力。',
  effects: [
    { kind: 'selfDraw', n: 1, cond: { k: 'lastCardIsTrick' } },
    { kind: 'selfHeal', n: 1, cond: { k: 'playedNothingThisTurn' } },
  ],
};

/** 老舍·茶馆：群体窥牌 + 控顶 */
const LAOSHE_CHAGUAN: SkillDef = {
  id: 'laoshe_chaguan',
  name: '茶馆',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可令所有其他角色各展示一张手牌，然后你获得其中的一张（茶馆听百态）。',
  effects: [{ kind: 'revealAllPickOne' }],
};

/** 老舍·骆驼祥子：装备牌当闪 */
const LAOSHE_XIANGZI: SkillDef = {
  id: 'laoshe_xiangzi',
  name: '骆驼祥子',
  kind: 'convert',
  timing: 'passive',
  desc: '你可将一张装备牌当【闪】使用或打出（车夫的脊梁）。',
  effects: [{ kind: 'convert', from: { type: 'equip' }, to: 'shan' }],
};

/** 茅盾·子夜：黑色手牌当杀 */
const MAODUN_ZIYE: SkillDef = {
  id: 'maodun_ziye',
  name: '子夜',
  kind: 'convert',
  timing: 'passive',
  desc: '你可将一张黑色手牌当【杀】使用，每回合限一次。',
  effects: [{ kind: 'convert', from: { color: 'black' }, to: 'sha', limit: 'perTurn' }],
};

/** 茅盾·批判：锦囊被无懈后的反制 */
const MAODUN_PIPAN: SkillDef = {
  id: 'maodun_pipan',
  name: '批判',
  kind: 'trigger',
  timing: 'onTrickCountered',
  desc: '你的锦囊牌被【无懈可击】抵消后，你可弃置一张手牌，令该【无懈可击】的使用者弃置一张牌。',
  effects: [
    { kind: 'costCard', n: 1 },
    { kind: 'targetDiscard', n: 1 },
  ],
};

/* ------------------------------------------------------------------ */
/* 数学 🔢                                                             */
/* ------------------------------------------------------------------ */

/** 祖冲之·密率：质数判定（46.2%），命中 2 伤、未命中保底摸 1 */
const ZCZ_MILV: SkillDef = {
  id: 'zcz_milv',
  name: '密率',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可令一名角色判定：若点数为质数（2/3/5/7/11/13），其受到 2 点伤害；否则你摸一张牌。',
  effects: [
    {
      kind: 'judgeIf',
      test: 'prime',
      hit: [{ kind: 'targetDamage', n: 2 }],
      miss: [{ kind: 'selfDraw', n: 1 }],
    },
  ],
};

/** 祖冲之·缀术：手牌上限 +2，弃质数牌改为置顶 */
const ZCZ_ZHUISHU: SkillDef = {
  id: 'zcz_zhuishu',
  name: '缀术',
  kind: 'passive',
  timing: 'passive',
  desc: '你的手牌上限 +2；弃牌阶段你可弃置的每张点数为质数的牌改为置于牌堆顶。',
  effects: [
    { kind: 'handLimit', n: 2 },
    { kind: 'discardToTop', pick: 'prime', at: 'onDiscard' },
  ],
};

/** 华罗庚·统筹：答题对决 */
const HLG_TONGCHOU: SkillDef = {
  id: 'hlg_tongchou',
  name: '统筹',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可与一名角色进行答题对决：你答对且其答错，你摸两张牌；你答错，你弃置一张牌。',
  effects: [
    {
      kind: 'quizDuel',
      win: [{ kind: 'selfDraw', n: 2 }],
      lose: [{ kind: 'costCard', n: 1 }],
    },
  ],
};

/** 华罗庚·优选法：额外摸 1 后弃 1，弃置牌为奇数则不弃 */
const HLG_YOUXUAN: SkillDef = {
  id: 'hlg_youxuan',
  name: '优选法',
  kind: 'trigger',
  timing: 'onDraw',
  desc: '摸牌阶段你可额外摸一张牌，然后弃置一张牌；若弃置的牌点数为奇数，则改为不弃。',
  effects: [{ kind: 'extraDrawDiscardOdd', n: 1 }],
};

/** 高斯·算术研究：答题对决 */
const GAOSI_SUANSHU: SkillDef = {
  id: 'gaosi_suanshu',
  name: '算术研究',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可与一名角色进行答题对决：你答对且其答错，你观看牌堆顶三张并获得其中两张；反之其摸两张牌。',
  effects: [
    {
      kind: 'quizDuel',
      win: [{ kind: 'deckPeek', n: 3, then: 'pickTwo' }],
      lose: [{ kind: 'targetDraw', n: 2 }],
    },
  ],
};

/** 高斯·数论直觉：手牌中有对子则上限额外 +1 */
const GAOSI_SHULUN: SkillDef = {
  id: 'gaosi_shulun',
  name: '数论直觉',
  kind: 'passive',
  timing: 'passive',
  desc: '你的手牌上限 +1；若你的手牌中有两张点数相同的牌，上限额外 +1。',
  effects: [
    { kind: 'handLimit', n: 1 },
    { kind: 'handLimit', n: 1, cond: { k: 'hasNumPair' } },
  ],
};

/** 笛卡尔·坐标系：双判定同色奖励（v2.1：以知识考核替代弃牌） */
const DIKAER_ZUOBIAO: SkillDef = {
  id: 'dikaer_zuobiao',
  name: '坐标系',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可答一道数学题，答对则令一名角色判定，然后可令另一名角色判定；若两次判定颜色相同，你摸两张牌。',
  effects: [{ kind: 'doubleJudge', sameColor: [{ kind: 'selfDraw', n: 2 }] }],
};

/** 笛卡尔·我思故我在：改判（司马懿【鬼才】式） */
const DIKAER_WOSI: SkillDef = {
  id: 'dikaer_wosi',
  name: '我思故我在',
  kind: 'trigger',
  timing: 'beforeJudge',
  desc: '一名角色的判定牌生效前，你可打出一张手牌替换之。',
  effects: [{ kind: 'replaceJudge' }],
};

/** 柯西·极限：判定阈值（v2.1：以判定替代弃牌，阈值 46.2%，未命中摸 2 张保底） */
const KEXI_JIXIAN: SkillDef = {
  id: 'kexi_jixian',
  name: '极限',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可令一名角色判定：若点数 ≥8，其受到 2 点伤害；否则你摸两张牌。',
  effects: [{ kind: 'judgeIf', test: 'ge', n: 8, hit: [{ kind: 'targetDamage', n: 2 }], miss: [{ kind: 'selfDraw', n: 2 }] }],
};

/** 柯西·序列：弃置两张点数之差 ≤2 则摸 1 */
const KEXI_XULIE: SkillDef = {
  id: 'kexi_xulie',
  name: '序列',
  kind: 'passive',
  timing: 'passive',
  desc: '你的手牌上限 +2；弃牌阶段若你弃置的牌中有两张点数之差 ≤2，你摸一张牌。',
  effects: [{ kind: 'handLimit', n: 2 }],
};

/* ------------------------------------------------------------------ */
/* 英语 🔤                                                             */
/* ------------------------------------------------------------------ */

/** 莎士比亚·十四行诗：成对代价 + 令其选择 */
const SHASHIBIYA_SHS: SkillDef = {
  id: 'shashibiya_shs',
  name: '十四行诗',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可弃置两张花色相同的手牌（押韵），令一名角色选择：交给你一张手牌 / 失去 1 点体力，然后你摸一张牌。',
  effects: [
    { kind: 'costCard', n: 2, require: 'sameSuit' },
    {
      kind: 'targetChoose',
      options: [
        [{ kind: 'gainHand', n: 1 }],
        [{ kind: 'targetLoseHp', n: 1 }],
      ],
    },
    { kind: 'selfDraw', n: 1 },
  ],
};

/** 莎士比亚·哈姆雷特：反转抉择（把选择权交给敌人） */
const SHASHIBIYA_HMLT: SkillDef = {
  id: 'shashibiya_hmlt',
  name: '哈姆雷特',
  kind: 'trigger',
  timing: 'onDamaged',
  desc: '受到伤害后，你可令伤害来源选择：令你摸两张牌 / 令其弃置两张牌（生存还是毁灭）。',
  effects: [
    {
      kind: 'targetChoose',
      options: [
        [{ kind: 'selfDraw', n: 2 }],
        [{ kind: 'targetDiscard', n: 2 }],
      ],
    },
  ],
};

/** 培根·论读书：观星取牌 */
const PEIGEN_LUNDUOSHU: SkillDef = {
  id: 'peigen_lundushu',
  name: '论读书',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可观看牌堆顶四张牌，获得其中的一张，其余以任意顺序置于牌堆顶。',
  effects: [{ kind: 'deckPeek', n: 4, then: 'pickOne' }],
};

/** 培根·随笔：黑色锦囊摸牌 */
const PEIGEN_SUIBI: SkillDef = {
  id: 'peigen_suibi',
  name: '随笔',
  kind: 'trigger',
  timing: 'onUseTrick',
  desc: '你使用黑色锦囊牌后，摸一张牌。',
  effects: [{ kind: 'trickDraw', n: 1, blackOnly: true }],
};

/** 马克·吐温·百万英镑：拼点 */
const MATUWEN_BWYB: SkillDef = {
  id: 'matuwen_bwyb',
  name: '百万英镑',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可与一名角色拼点：若你赢，你获得其拼点的牌并令其弃置一张牌；若你输，你交给其两张手牌。',
  effects: [
    {
      kind: 'pointDuel',
      win: [
        { kind: 'takeDuelCard' },
        { kind: 'targetDiscard', n: 1 },
      ],
      lose: [{ kind: 'giveHand', n: 2 }],
    },
  ],
};

/** 马克·吐温·讽刺小说：嘲讽手牌最多者 */
const MATUWEN_FC: SkillDef = {
  id: 'matuwen_fc',
  name: '讽刺小说',
  kind: 'trigger',
  timing: 'onUseTrick',
  desc: '你使用锦囊牌后摸一张牌；若该锦囊的目标中含手牌最多的角色，改为摸两张牌。',
  effects: [{ kind: 'trickDraw', n: 1, richestExtra: 1 }],
};

/** 狄更斯·双城记：反间猜花色 */
const DIGENGSI_SCJ: SkillDef = {
  id: 'digengsi_scj',
  name: '双城记',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可令一名角色选择一种花色，然后展示你的一张手牌：若花色不符，其受到 1 点伤害；若相符，你将此牌交给其。',
  effects: [
    {
      kind: 'guessSuit',
      miss: [{ kind: 'targetDamage', n: 1 }],
      hit: [{ kind: 'giveDuelCard' }],
    },
  ],
};

/** 狄更斯·雾都孤儿：连营式空手补偿 */
const DIGENGSI_WDGE: SkillDef = {
  id: 'digengsi_wdge',
  name: '雾都孤儿',
  kind: 'passive',
  timing: 'passive',
  desc: '你的手牌上限 +1；你于回合外失去最后一张手牌时，摸一张牌。',
  effects: [
    { kind: 'handLimit', n: 1 },
    { kind: 'selfDraw', n: 1, at: 'onLoseHand' },
  ],
};

/** 雪莱·西风颂：传播（v2.1：以知识考核替代弃牌） */
const XUELAI_XFS: SkillDef = {
  id: 'xuelai_xfs',
  name: '西风颂',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可答一道英语题，答对则令至多两名其他角色各摸一张牌，然后你回复 1 点体力。',
  effects: [
    { kind: 'multiDraw', max: 2, n: 1 },
    { kind: 'selfHeal', n: 1 },
  ],
};

/** 雪莱·诗辩 */
const XUELAI_SHIBIAN: SkillDef = {
  id: 'xuelai_shibian',
  name: '诗辩',
  kind: 'trigger',
  timing: 'onUseTrick',
  desc: '你使用锦囊牌后摸一张牌；若为红色锦囊，改为摸两张牌。',
  effects: [{ kind: 'trickDraw', n: 1, redExtra: 1 }],
};

/* ------------------------------------------------------------------ */
/* 物理 ⚛️                                                             */
/* ------------------------------------------------------------------ */

/** 牛顿·三大定律：自损爆发 */
const NIUDUN_SDDL: SkillDef = {
  id: 'niudun_sddl',
  name: '三大定律',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可弃置一张手牌对一名角色造成 2 点伤害，然后你失去 1 点体力（作用力与反作用力）。',
  effects: [
    { kind: 'costCard', n: 1 },
    { kind: 'targetDamage', n: 2 },
    { kind: 'selfLoseHp', n: 1 },
  ],
};

/** 牛顿·万有引力：双向距离 */
const NIUDUN_WYYL: SkillDef = {
  id: 'niudun_wyyl',
  name: '万有引力',
  kind: 'passive',
  timing: 'passive',
  desc: '你计算与其他角色的距离 −1；其他角色计算与你的距离 +1。',
  effects: [
    { kind: 'distMod', delta: -1 },
    { kind: 'distPlusToMe', n: 1 },
  ],
};

/** 爱因斯坦·相对论：限定技换血 */
const AINSTEIN_XDL: SkillDef = {
  id: 'ainstein_xdl',
  name: '相对论',
  kind: 'limit',
  timing: 'active',
  limit: 'perGame',
  desc: '限定技：出牌阶段，你可与一名角色交换体力值（整局限一次）。',
  effects: [{ kind: 'swapHp' }],
};

/** 爱因斯坦·质能方程：红牌当火杀 */
const AINSTEIN_ZNFC: SkillDef = {
  id: 'ainstein_znfc',
  name: '质能方程',
  kind: 'convert',
  timing: 'passive',
  desc: '你可将一张红色手牌当【火杀】使用（E=mc²，质能转换）。',
  effects: [{ kind: 'convert', from: { color: 'red' }, to: 'sha', damageType: 'fire' }],
};

/** 法拉第·避雷针：免疫【闪电】+ 受雷伤摸牌（v2.1：法拉第笼，替代原弃牌雷伤技） */
const FALADI_DCYG: SkillDef = {
  id: 'faladi_dcyg',
  name: '避雷针',
  kind: 'passive',
  timing: 'passive',
  desc: '锁定技：你不能成为【闪电】的目标；当你受到雷属性伤害时，你摸一张牌。',
  effects: [
    { kind: 'cardImmune', names: ['闪电'] },
    { kind: 'selfDraw', n: 1, at: 'onDamaged', cond: { k: 'lastDamageThunder' } },
  ],
};

/** 法拉第·场论：闪的点数奇偶分支 */
const FALADI_CHANGLUN: SkillDef = {
  id: 'faladi_changlun',
  name: '场论',
  kind: 'trigger',
  timing: 'onUseShan',
  desc: '你使用或打出【闪】后摸一张牌；若该【闪】点数为偶数，改为摸两张牌。',
  effects: [
    { kind: 'selfDraw', n: 1 },
    { kind: 'selfDraw', n: 1, cond: { k: 'lastCardEven' } },
  ],
};

/** 伽利略·自由落体：咆哮变体（每回合最多额外 2 张） */
const JIALILUE_ZYLT: SkillDef = {
  id: 'jialilue_zylt',
  name: '自由落体',
  kind: 'passive',
  timing: 'passive',
  desc: '你使用【杀】无次数限制，每回合最多额外使用 2 张；你每回合使用的第二张及之后的【杀】，需先弃置一张手牌。',
  effects: [{ kind: 'shaUnlimited', maxExtra: 2, extraCostHand: 1 }],
};

/** 伽利略·望远镜：射程 + 常驻预知 */
const JIALILUE_WYJ: SkillDef = {
  id: 'jialilue_wyj',
  name: '望远镜',
  kind: 'passive',
  timing: 'passive',
  desc: '你的攻击范围 +1；牌堆顶的一张牌对你可见。',
  effects: [
    { kind: 'rangePlus', n: 1 },
    { kind: 'peekTopDeck', n: 1 },
  ],
};

/** 普朗克·量子：洛神式连续判定（v2.1：以知识考核替代弃牌） */
const PULANGKE_LIANGZI: SkillDef = {
  id: 'pulangke_liangzi',
  name: '量子',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可答一道物理题，答对则连续判定直到出现偶数点数的牌，你获得全部判定牌；若你因此获得至少三张牌，对一名角色造成 1 点伤害。',
  effects: [
    {
      kind: 'chainJudge',
      stopWhen: 'even',
      takeAll: true,
      bonusAt: 3,
      bonus: [{ kind: 'targetDamage', n: 1 }],
    },
  ],
};

/** 普朗克·普朗克常数 */
const PULANGKE_CS: SkillDef = {
  id: 'pulangke_cs',
  name: '普朗克常数',
  kind: 'passive',
  timing: 'passive',
  desc: '你的手牌上限 +1；你使用或打出【闪】后，若你已受伤，你回复 1 点体力（每回合限一次）。',
  effects: [
    { kind: 'handLimit', n: 1 },
    { kind: 'selfHeal', n: 1, cond: { k: 'isHurt' }, at: 'onUseShan' },
  ],
};

/* ------------------------------------------------------------------ */
/* 化学 ⚗️                                                             */
/* ------------------------------------------------------------------ */

/** 门捷列夫·周期律：排序式观星 */
const MJLF_ZQL: SkillDef = {
  id: 'mjlf_zql',
  name: '周期律',
  kind: 'active',
  timing: 'onTurnStart',
  desc: '准备阶段，你可观看牌堆顶五张牌，将它们按点数从小到大排序后放回牌堆顶（周期表排列）。',
  effects: [{ kind: 'starSort', n: 5, dir: 'asc' }],
};

/** 门捷列夫·元素：三花色收集连锁 */
const MJLF_YUANSU: SkillDef = {
  id: 'mjlf_yuansu',
  name: '元素',
  kind: 'passive',
  timing: 'passive',
  desc: '你的手牌上限 +1；出牌阶段若你使用过三种不同花色的牌，你摸两张牌。',
  effects: [
    { kind: 'handLimit', n: 1 },
    { kind: 'suitCollect', n: 3, reward: [{ kind: 'selfDraw', n: 2 }] },
  ],
};

/** 拉瓦锡·质量守恒：等量转化（v2.1：以知识考核替代弃牌） */
const LWY_ZLSH: SkillDef = {
  id: 'lwx_zlsh',
  name: '质量守恒',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可答一道化学题，答对则令一名角色回复 1 点体力，然后你摸一张牌（物质不灭，相互转化）。',
  effects: [{ kind: 'targetHeal', n: 1 }, { kind: 'selfDraw', n: 1 }],
};

/** 拉瓦锡·燃烧学说 */
const LWY_RSHXS: SkillDef = {
  id: 'lwx_rshxs',
  name: '燃烧学说',
  kind: 'passive',
  timing: 'passive',
  desc: '你的手牌上限 +1；每回合首次当你使用的红色牌进入弃牌堆时，你回复 1 点体力。',
  effects: [
    { kind: 'handLimit', n: 1 },
    { kind: 'selfHeal', n: 1, cond: { k: 'lastCardRed' }, at: 'onUseTrick' },
  ],
};

/** 居里夫人·放射性：标记持续伤害（v2.1：以知识考核替代弃牌） */
const JULI_FSX: SkillDef = {
  id: 'juli_fsx',
  name: '放射性',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可答一道化学题，答对则令一名角色获得 2 枚「辐射」标记；其回合开始时移除 1 枚并受到 1 点伤害。',
  effects: [{ kind: 'addMark', mark: 'radiation', n: 2 }],
};

/** 居里夫人·镭元素：全表唯一学识经济技 */
const JULI_LYS: SkillDef = {
  id: 'juli_lys',
  name: '镭元素',
  kind: 'passive',
  timing: 'passive',
  desc: '你的手牌上限 +1；每当你获得学识时，额外 +1 学识。',
  effects: [
    { kind: 'handLimit', n: 1 },
    { kind: 'knowledgeGain', n: 1 },
  ],
};

/** 凯库勒·苯环：循环交换（v2.1：以知识考核替代弃牌） */
const KKL_BH: SkillDef = {
  id: 'kkl_bh',
  name: '苯环',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可答一道化学题，答对则令一名角色摸两张牌，然后其选择：交给你两张手牌 / 受到你造成的 1 点伤害。',
  effects: [
    { kind: 'targetDraw', n: 2 },
    {
      kind: 'targetChoose',
      options: [
        [{ kind: 'gainHand', n: 2 }],
        [{ kind: 'targetDamage', n: 1 }],
      ],
    },
  ],
};

/** 凯库勒·结构式：装备区关联上限 + 装备免疫 */
const KKL_JGS: SkillDef = {
  id: 'kkl_jgs',
  name: '结构式',
  kind: 'passive',
  timing: 'passive',
  desc: '你的手牌上限 +1，装备区每有一张牌额外 +1；你的装备不能被【过河拆桥】与【顺手牵羊】指定。',
  effects: [
    { kind: 'handLimit', n: 1 },
    { kind: 'immune', scope: 'equip' },
  ],
};

/** 卢瑟福·核模型：无视防具 */
const LSF_HMX: SkillDef = {
  id: 'lsf_hmx',
  name: '核模型',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可无视一名角色的防具对其造成 1 点伤害；若其没有防具，改为令其弃置一张牌。',
  effects: [
    {
      kind: 'armorPierceDamage',
      n: 1,
      noArmor: [{ kind: 'targetDiscard', n: 1 }],
    },
  ],
};

/** 卢瑟福·散射实验：α 粒子被原子核散射偏转 → 转移【杀】的目标（每回合限一次） */
const LSF_SSSY: SkillDef = {
  id: 'lsf_sssy',
  name: '散射实验',
  kind: 'trigger',
  timing: 'onTargetSha',
  limit: 'perTurn',
  desc: '当你成为【杀】的目标时，你可将此【杀】转移给另一名角色（每回合限一次）。',
  effects: [
    { kind: 'handLimit', n: 1 },
    { kind: 'shaRedirect' },
  ],
};

/* ------------------------------------------------------------------ */
/* 生物 🧬                                                             */
/* ------------------------------------------------------------------ */

/** 达尔文·进化论：筛选择优（点数之和 ≤7 才回血） */
const DEW_JHL: SkillDef = {
  id: 'dew_jhl',
  name: '进化论',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可摸三张牌，然后弃置其中点数最小的两张；若这两张点数之和 ≤7，你回复 1 点体力（自然选择）。',
  effects: [
    {
      kind: 'drawDiscardMin',
      draw: 3,
      discard: 2,
      bonusTest: { sumAtMost: 7 },
      bonus: [{ kind: 'selfHeal', n: 1 }],
    },
  ],
};

/** 达尔文·适者生存 */
const DEW_SZSC: SkillDef = {
  id: 'dew_szsc',
  name: '适者生存',
  kind: 'trigger',
  timing: 'onDamaged',
  desc: '受到伤害后，你摸一张牌；若你的体力值 ≤2，改为摸两张牌。',
  effects: [
    { kind: 'selfDraw', n: 1 },
    { kind: 'selfDraw', n: 1, cond: { k: 'hpAtMost', n: 2 } },
  ],
};

/** 巴斯德·巴氏灭菌：花色代价（v2.1：以知识考核替代弃牌） */
const BSD_MJ: SkillDef = {
  id: 'bsd_mj',
  name: '巴氏灭菌',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可答一道生物题，答对则令一名角色弃置一张牌，然后你摸一张牌（高温灭菌，清除微生物）。',
  effects: [{ kind: 'targetDiscard', n: 1 }, { kind: 'selfDraw', n: 1 }],
};

/** 巴斯德·免疫：属性减伤 + 花色免疫（v2.1：疫苗只对特定「菌株」生效） */
const BSD_MY: SkillDef = {
  id: 'bsd_my',
  name: '免疫',
  kind: 'passive',
  timing: 'passive',
  desc: '你受到的火属性与雷属性伤害 −1（最低 1 点）；♦方片的牌对你无效。',
  effects: [
    { kind: 'reduceDamage', types: ['fire', 'thunder'], n: 1 },
    { kind: 'suitImmune', suits: ['♦'] },
  ],
};

/** 孟德尔·分离定律：点数成对代价 */
const MDE_FLL: SkillDef = {
  id: 'mde_fll',
  name: '分离定律',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可弃置两张点数相同的手牌（等位基因），摸三张牌，然后将其中一张交给一名其他角色。',
  effects: [
    { kind: 'costCard', n: 2, require: 'sameNum' },
    { kind: 'selfDraw', n: 3 },
    { kind: 'giveHand', n: 1 },
  ],
};

/** 孟德尔·显性性状 */
const MDE_XXXZ: SkillDef = {
  id: 'mde_xxxz',
  name: '显性性状',
  kind: 'trigger',
  timing: 'onDamaged',
  desc: '受到伤害后，你摸一张牌；若伤害来源与你同学科，你可展示一张手牌，若为红色则回复 1 点体力。',
  effects: [
    { kind: 'selfDraw', n: 1 },
    { kind: 'showHand', red: [{ kind: 'selfHeal', n: 1 }] },
  ],
};

/** 屠呦呦·青蒿素：点数 ≤6 当桃 */
const TYY_QHS: SkillDef = {
  id: 'tyy_qhs',
  name: '青蒿素',
  kind: 'convert',
  timing: 'passive',
  desc: '你可将一张点数 ≤6 的手牌当【桃】使用，每回合限一次（低温提取小分子）。',
  effects: [{ kind: 'convert', from: { maxNum: 6 }, to: 'tao', limit: 'perTurn' }],
};

/** 屠呦呦·低温提取：弃置点数最小牌改为置顶 */
const TYY_DWTQ: SkillDef = {
  id: 'tyy_dwtq',
  name: '低温提取',
  kind: 'passive',
  timing: 'passive',
  desc: '你的手牌上限 +1；弃牌阶段你可弃置的牌中点数最小的一张改为置于牌堆顶。',
  effects: [
    { kind: 'handLimit', n: 1 },
    { kind: 'discardToTop', pick: 'min', at: 'onDiscard' },
  ],
};

/** 李时珍·本草纲目：华佗【急救】式回合外转化 */
const LSZ_BCGM: SkillDef = {
  id: 'lsz_bcgm',
  name: '本草纲目',
  kind: 'convert',
  timing: 'passive',
  desc: '你的回合外，你可将一张红色手牌当【桃】使用（百草皆可入药）。',
  effects: [{ kind: 'convert', from: { color: 'red' }, to: 'tao', outsideTurn: true }],
};

/** 李时珍·行医：限定技自救 */
const LSZ_XY: SkillDef = {
  id: 'lsz_xy',
  name: '行医',
  kind: 'limit',
  timing: 'onDying',
  limit: 'perGame',
  desc: '限定技：当你进入濒死状态时，你可弃置所有手牌，将体力回复至 1 并摸一张牌（整局限一次）。',
  effects: [{ kind: 'revive', hp: 1 }],
};

/* ------------------------------------------------------------------ */
/* 历史 🏛️                                                             */
/* ------------------------------------------------------------------ */

/** 秦始皇·统一：花色命令（限至多两名）（v2.1：以知识考核替代弃牌） */
const QSH_TY: SkillDef = {
  id: 'qsh_ty',
  name: '统一',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可答一道历史题，答对则令至多两名其他角色各选择：弃置一张♦方片的手牌 / 失去 1 点体力（车同轨，书同文）。',
  effects: [
    {
      kind: 'targetChoose',
      maxTargets: 2,
      options: [
        [{ kind: 'discardSuitMatch', n: 1, suit: '♦' }],
        [{ kind: 'targetLoseHp', n: 1 }],
      ],
    },
  ],
};

/** 秦始皇·焚书：锦囊免疫 */
const QSH_FS: SkillDef = {
  id: 'qsh_fs',
  name: '焚书',
  kind: 'passive',
  timing: 'passive',
  desc: '你不能成为锦囊牌的目标；你的手牌上限 +1。',
  effects: [
    { kind: 'immune', scope: 'trick' },
    { kind: 'handLimit', n: 1 },
  ],
};

/** 岳飞·精忠：无双 */
const YF_JZ: SkillDef = {
  id: 'yf_jz',
  name: '精忠',
  kind: 'passive',
  timing: 'passive',
  desc: '你每回合使用的第一张【杀】，目标需连续使用两张【闪】才能抵消（岳家军势不可挡）。',
  effects: [{ kind: 'shaNeedShan', n: 2, perTurnFirst: true }],
};

/** 岳飞·莫须有：身份联动 */
const YF_MXY: SkillDef = {
  id: 'yf_mxy',
  name: '莫须有',
  kind: 'trigger',
  timing: 'onDamaged',
  desc: '受到伤害后，你摸一张牌；若伤害来源为主公，改为回复 1 点体力。',
  effects: [
    { kind: 'selfDraw', n: 1 },
    { kind: 'selfHeal', n: 1, cond: { k: 'srcIsLord' } },
  ],
};

/** 郑和·下西洋：贸易分配 */
const ZH_XXY: SkillDef = {
  id: 'zh_xxy',
  name: '下西洋',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可摸两张牌，然后将至多两张手牌交给其他角色；若你至少交给两名不同的角色，你回复 1 点体力。',
  effects: [
    { kind: 'selfDraw', n: 2 },
    { kind: 'giveHand', n: 2, healIfSpread: 2 },
  ],
};

/** 郑和·航海图：距离 -1 + 顺手牵羊无距离限制 + 马政（v2.1：舟楫之利） */
const ZH_HHT: SkillDef = {
  id: 'zh_hht',
  name: '航海图',
  kind: 'passive',
  timing: 'passive',
  desc: '你计算与其他角色的距离 −1；你使用【顺手牵羊】无距离限制；装备区每有一张马，你计算距离额外 −1。',
  effects: [
    { kind: 'distMod', delta: -1 },
    { kind: 'shunshouNoDist' },
    { kind: 'horseDist', n: 1 },
  ],
};

/** 林则徐·虎门销烟：群体销毁（收益封顶）（v2.1：以知识考核替代弃牌） */
const LZX_HMXY: SkillDef = {
  id: 'lzx_hmxy',
  name: '虎门销烟',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可答一道历史题，答对则令所有其他角色各弃置一张手牌，然后你摸一张牌。',
  effects: [
    { kind: 'allDiscard', n: 1 },
    { kind: 'selfDraw', n: 1 },
  ],
};

/** 林则徐·海防：点数对抗免伤 */
const LZX_HF: SkillDef = {
  id: 'lzx_hf',
  name: '海防',
  kind: 'trigger',
  timing: 'onTargetSha',
  limit: 'perTurn',
  desc: '当你成为【杀】的目标时，你可展示一张手牌，若其点数 ≥ 该【杀】的点数，此【杀】对你无效（每回合限一次）。',
  effects: [{ kind: 'numGuard', op: 'ge', against: 'shaNum', limit: 'perTurn' }],
};

/** 司马迁·史笔：控顶 */
const SMQ_SB: SkillDef = {
  id: 'smq_sb',
  name: '史笔',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可将一张手牌置于牌堆顶，然后摸一张牌；若该牌为黑色，你额外摸一张牌（秉笔直书）。',
  effects: [
    { kind: 'toDeckTop', from: 'hand' },
    { kind: 'selfDraw', n: 1 },
    { kind: 'selfDraw', n: 1, cond: { k: 'lastCardBlack' } },
  ],
};

/** 司马迁·忍辱负重：觉醒技 */
const SMQ_RRFZ: SkillDef = {
  id: 'smq_rrfz',
  name: '忍辱负重',
  kind: 'awaken',
  timing: 'awaken',
  limit: 'perGame',
  cond: { k: 'dmgTakenAtLeast', n: 3 },
  desc: '觉醒技：准备阶段若你本局已受到过至少 3 次伤害，你减 1 点体力上限并永久获得【成一家之言】。',
  effects: [{ kind: 'awaken', replaceWith: 'smq_cyjzyzy', minusMaxHp: 1 }],
};

/** 司马迁觉醒后·成一家之言 */
const SMQ_CYJZYZY: SkillDef = {
  id: 'smq_cyjzyzy',
  name: '成一家之言',
  kind: 'passive',
  timing: 'passive',
  desc: '你的手牌上限 +2；你受到伤害后摸两张牌。',
  effects: [
    { kind: 'handLimit', n: 2 },
    { kind: 'selfDraw', n: 2, at: 'onDamaged' },
  ],
};

/** 诸葛亮·观星（三国杀原版） */
const ZGL_GX: SkillDef = {
  id: 'zgl_gx',
  name: '观星',
  kind: 'active',
  timing: 'onTurnStart',
  desc: '准备阶段，你可观看牌堆顶的 X 张牌（X 为存活角色数且至多为 5），将其中任意数量以任意顺序置于牌堆顶，其余以任意顺序置于牌堆底。',
  effects: [{ kind: 'star', n: 'alive' }],
};

/** 诸葛亮·空城（三国杀原版） */
const ZGL_KC: SkillDef = {
  id: 'zgl_kc',
  name: '空城',
  kind: 'passive',
  timing: 'passive',
  desc: '锁定技：若你没有手牌，你不能成为【杀】或【决斗】的目标。',
  effects: [{ kind: 'noHandImmune' }],
};

/** 诸葛亮·出师表（新增第三技能）：军令状博弈 */
const ZGL_CSB: SkillDef = {
  id: 'zgl_csb',
  name: '出师表',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可弃置一张手牌，令一名角色选择：交给你一张手牌 / 立下军令状——本回合结束时若其未使用过【杀】，其失去 1 点体力。',
  effects: [
    { kind: 'costCard', n: 1 },
    {
      kind: 'targetChoose',
      maxTargets: 1,
      options: [
        [{ kind: 'gainHand', n: 1 }],
        [{ kind: 'pledge', onTurnEnd: [{ kind: 'targetLoseHp', n: 1 }] }],
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* 地理 🌍                                                             */
/* ------------------------------------------------------------------ */

/** 徐霞客·游记：牌堆底 */
const XXK_YJ: SkillDef = {
  id: 'xxk_yj',
  name: '游记',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可观看牌堆底的两张牌，获得其中的一张，另一张置于牌堆顶。',
  effects: [{ kind: 'deckBottom', n: 2, then: 'peek' }],
};

/** 徐霞客·探险：距离 -1 + 无视 +1 马 + 距离陷阱（v2.1：游记所至，远敌难近） */
const XXK_TX: SkillDef = {
  id: 'xxk_tx',
  name: '探险',
  kind: 'passive',
  timing: 'passive',
  desc: '锁定技：你计算与其他角色的距离 −1，且计算距离时无视其他角色的 +1 马；与你距离大于 1 的角色不能对你使用【杀】。',
  effects: [
    { kind: 'distMod', delta: -1 },
    { kind: 'ignoreHorsePlus' },
    { kind: 'distTrap', min: 1 },
  ],
};

/** 张衡·地动仪：改判 */
const ZH_DDY: SkillDef = {
  id: 'zh_ddy',
  name: '地动仪',
  kind: 'trigger',
  timing: 'beforeJudge',
  desc: '一名角色的判定牌生效前，你可打出一张手牌替换之（候风地动仪预警）。',
  effects: [{ kind: 'replaceJudge' }],
};

/** 张衡·浑天说 */
const ZH_HTS: SkillDef = {
  id: 'zh_hts',
  name: '浑天说',
  kind: 'passive',
  timing: 'passive',
  desc: '你的手牌上限 +1；摸牌阶段前你可观看牌堆顶两张牌，将其中一张置于牌堆底（观天象调序）。',
  effects: [
    { kind: 'handLimit', n: 1 },
    { kind: 'deckPeek', n: 2, then: 'toBottomOne', at: 'onDraw' },
  ],
};

/** 郦道元·水经注：花色筛选（v2.1：以知识考核替代弃牌） */
const LDY_SJZ: SkillDef = {
  id: 'ldy_sjz',
  name: '水经注',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可答一道地理题，答对则展示牌堆顶三张牌，获得其中的一张，其余置入弃牌堆；若你获得的牌为红色，你额外摸一张牌。',
  effects: [
    { kind: 'deckPeek', n: 3, then: 'pickOne' },
    { kind: 'selfDraw', n: 1, cond: { k: 'lastCardRed' } },
  ],
};

/** 郦道元·舆地 */
const LDY_YD: SkillDef = {
  id: 'ldy_yd',
  name: '舆地',
  kind: 'passive',
  timing: 'passive',
  desc: '你计算与其他角色的距离 −1；你的手牌上限 +1。',
  effects: [
    { kind: 'distMod', delta: -1 },
    { kind: 'handLimit', n: 1 },
  ],
};

/** 李四光·地质勘探：掘底（限量版） */
const LSG_DZKT: SkillDef = {
  id: 'lsg_dzkt',
  name: '地质勘探',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可展示牌堆底五张牌，获得其中的装备牌，其余置入弃牌堆。',
  effects: [{ kind: 'deckBottom', n: 5, then: 'digEquip' }],
};

/** 李四光·构造体系：枭姬双向 + 地质锤（v2.1：装备牌可当【杀】使用） */
const LSG_GZTX: SkillDef = {
  id: 'lsg_gztx',
  name: '构造体系',
  kind: 'passive',
  timing: 'passive',
  desc: '你的手牌上限 +1；你装备一张装备牌时摸一张牌；你失去装备区的牌时摸一张牌；你可将一张装备牌当【杀】使用（每回合限一次）。',
  effects: [
    { kind: 'handLimit', n: 1 },
    { kind: 'selfDraw', n: 1, at: 'onEquip' },
    { kind: 'selfDraw', n: 1, at: 'onLoseEquip' },
    { kind: 'convert', from: { type: 'equip' }, to: 'sha', limit: 'perTurn' },
  ],
};

/* ------------------------------------------------------------------ */
/* 政治 ⚖️                                                             */
/* ------------------------------------------------------------------ */

/** 孔子·论语：反转抉择 */
const KZ_LY: SkillDef = {
  id: 'kz_ly',
  name: '论语',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可将两张手牌交给一名角色，然后其选择：令你摸两张牌 / 令你回复 1 点体力（因材施教）。',
  effects: [
    { kind: 'giveHand', n: 2 },
    {
      kind: 'targetChoose',
      options: [
        [{ kind: 'selfDraw', n: 2 }],
        [{ kind: 'selfHeal', n: 1 }],
      ],
      // 注：选项中的「你」均指技能发动者（孔子本人）
    },
  ],
};

/** 孔子·有教无类：限定技 */
const KZ_YJWL: SkillDef = {
  id: 'kz_yjwl',
  name: '有教无类',
  kind: 'limit',
  timing: 'active',
  limit: 'perGame',
  desc: '限定技：出牌阶段，你可令所有角色各摸一张牌，然后所有已受伤的角色各回复 1 点体力（整局限一次）。',
  effects: [
    { kind: 'allDraw', n: 1 },
    { kind: 'allHeal', n: 1 },
  ],
};

/** 韩非子·法不阿贵 */
const HFZ_FBAG: SkillDef = {
  id: 'hfz_fbag',
  name: '法不阿贵',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可令一名角色选择：交给你一张手牌 / 弃置两张手牌。',
  effects: [
    {
      kind: 'targetChoose',
      options: [
        [{ kind: 'gainHand', n: 1 }],
        [{ kind: 'targetDiscard', n: 2 }],
      ],
    },
  ],
};

/** 韩非子·术势 */
const HFZ_SS: SkillDef = {
  id: 'hfz_ss',
  name: '术势',
  kind: 'trigger',
  timing: 'onDamaged',
  desc: '受到伤害后，你摸一张牌；若伤害来源的手牌数大于你，改为令其弃置两张牌。',
  effects: [
    { kind: 'selfDraw', n: 1 },
    { kind: 'targetDiscard', n: 2, at: 'onDamaged' },
  ],
};

/** 孟子·仁政：身份联动 */
const MZ_RZ: SkillDef = {
  id: 'mz_rz',
  name: '仁政',
  kind: 'active',
  timing: 'active',
  desc: '出牌阶段，你可令一名角色回复 1 点体力，然后你摸一张牌；若其为主公，你额外回复 1 点体力。',
  effects: [
    { kind: 'targetHeal', n: 1 },
    { kind: 'selfDraw', n: 1 },
    { kind: 'selfHeal', n: 1, cond: { k: 'targetIsLord' } },
  ],
};

/** 孟子·王道：据守翻面 */
const MZ_WD: SkillDef = {
  id: 'mz_wd',
  name: '王道',
  kind: 'passive',
  timing: 'passive',
  desc: '你的手牌上限 +1；回合结束阶段，若你本回合未造成过伤害，你可翻面并摸三张牌（以德服人，休养生息）。',
  effects: [
    { kind: 'handLimit', n: 1 },
    { kind: 'turnFace', draw: 3, at: 'onTurnEnd' },
  ],
};

/** 墨子·非攻：免疫群体 AOE + 敌人装备失效（v2.1：反对不义之战，收缴兵器） */
const MZ_FG: SkillDef = {
  id: 'mozi_fg',
  name: '非攻',
  kind: 'passive',
  timing: 'passive',
  desc: '锁定技：你不能成为【万箭齐发】与【南蛮入侵】的目标；其他角色的武器与防具对你无效。',
  effects: [
    { kind: 'cardImmune', names: ['万箭齐发', '南蛮入侵'] },
    { kind: 'enemyEquipVoid', slots: ['weapon', 'armor'] },
  ],
};

/** 墨子·兼爱：成为锦囊目标时可转移给另一名角色（v2.1：替人承受） */
const MZ_JA: SkillDef = {
  id: 'mozi_ja',
  name: '兼爱',
  kind: 'trigger',
  timing: 'passive',
  limit: 'perTurn',
  desc: '当你成为锦囊牌的目标时，你可将此牌转移给另一名角色（每回合限一次）。',
  effects: [{ kind: 'trickRedirect' }],
};

/** 孙子·兵法：突袭 */
const SZ_BF: SkillDef = {
  id: 'sz_bf',
  name: '兵法',
  kind: 'trigger',
  timing: 'onDraw',
  desc: '摸牌阶段，你可改为获得至多两名其他角色的各一张手牌，并观看其手牌（知己知彼）。',
  effects: [{ kind: 'replaceDraw', effects: [{ kind: 'stealFrom', max: 2 }] }],
};

/** 孙子·虚实：杀闪互换（各限一次） */
const SZ_XS: SkillDef = {
  id: 'sz_xs',
  name: '虚实',
  kind: 'convert',
  timing: 'passive',
  desc: '每回合限一次，你可将一张【闪】当【杀】使用；每回合限一次，你可将一张【杀】当【闪】使用或打出（虚实相生）。',
  effects: [
    { kind: 'convert', from: { sub: 'shan' }, to: 'sha', limit: 'perTurn' },
    { kind: 'convert', from: { sub: 'sha' }, to: 'shan', limit: 'perTurn' },
  ],
};

/* ------------------------------------------------------------------ */
/* 主公技（沿用旧 id，保证 factions.ts 与联机兼容）                     */
/* ------------------------------------------------------------------ */

const LORD_SHISHU: SkillDef = {
  id: 'shishu', name: '诗书', kind: 'lord', timing: 'active',
  desc: '主公技：你摸一张牌。', effects: [{ kind: 'selfDraw', n: 1 }],
};
const LORD_TUIYAN: SkillDef = {
  id: 'tuiyan', name: '推演', kind: 'lord', timing: 'active',
  desc: '主公技：令一名角色判定，黑色其受到 1 点伤害，红色其摸一张牌。',
  effects: [{ kind: 'judgeIf', test: 'black', hit: [{ kind: 'targetDamage', n: 1 }], miss: [{ kind: 'targetDraw', n: 1 }] }],
};
const LORD_YISHU: SkillDef = {
  id: 'yishu', name: '译述', kind: 'lord', timing: 'active',
  desc: '主公技：你获得一名角色的一张手牌。', effects: [{ kind: 'gainHand', n: 1 }],
};
const LORD_YINLI: SkillDef = {
  id: 'yinli', name: '引力', kind: 'lord', timing: 'active',
  desc: '主公技：对一名角色造成 1 点伤害。', effects: [{ kind: 'targetDamage', n: 1 }],
};
const LORD_CUIHUA: SkillDef = {
  id: 'cuihua', name: '催化', kind: 'lord', timing: 'active',
  desc: '主公技：令一名角色回复 1 点体力（已满则改为摸一张牌）。', effects: [{ kind: 'targetHeal', n: 1 }],
};
const LORD_JINHUALUN: SkillDef = {
  id: 'jinhualun', name: '进化', kind: 'lord', timing: 'active',
  desc: '主公技：你摸两张牌，然后弃置一张牌。',
  effects: [{ kind: 'selfDraw', n: 2 }, { kind: 'costCard', n: 1 }],
};
const LORD_MINGJIAN: SkillDef = {
  id: 'mingjian', name: '明鉴', kind: 'lord', timing: 'active',
  desc: '主公技：令一名角色弃置一张牌。', effects: [{ kind: 'targetDiscard', n: 1 }],
};
const LORD_TANSUO: SkillDef = {
  id: 'tansuo', name: '探索', kind: 'lord', timing: 'active',
  desc: '主公技：所有角色各摸一张牌。', effects: [{ kind: 'allDraw', n: 1 }],
};
const LORD_XUNJIE: SkillDef = {
  id: 'xunjie', name: '训诫', kind: 'lord', timing: 'active',
  desc: '主公技：令一名角色选择：交给你一张手牌 / 弃置一张手牌。',
  effects: [{ kind: 'targetChoose', options: [[{ kind: 'gainHand', n: 1 }], [{ kind: 'targetDiscard', n: 1 }]] }],
};

/* ------------------------------------------------------------------ */
/* 学科主题技（沿用旧 id，保证 packets.ts 与联机兼容）                  */
/* ------------------------------------------------------------------ */

const SUB_BEISONG: SkillDef = {
  id: 'beisong', name: '背诵', kind: 'active', timing: 'active',
  desc: '弃一张手牌，摸两张牌（背诵默写，积累素材）。',
  effects: [{ kind: 'costCard', n: 1 }, { kind: 'selfDraw', n: 2 }],
};
const SUB_WENYAN: SkillDef = {
  id: 'wenyan', name: '文言', kind: 'active', timing: 'active',
  desc: '弃两张手牌，摸三张牌（文言积累，厚积薄发）。',
  effects: [{ kind: 'costCard', n: 2 }, { kind: 'selfDraw', n: 3 }],
};
const SUB_YOUSHU: SkillDef = {
  id: 'youshu', name: '有理数', kind: 'active', timing: 'active',
  desc: '弃一张手牌，令一名角色判定：红色其摸一张牌，黑色其弃一张牌。',
  effects: [
    { kind: 'costCard', n: 1 },
    { kind: 'judgeIf', test: 'red', hit: [{ kind: 'targetDraw', n: 1 }], miss: [{ kind: 'targetDiscard', n: 1 }] },
  ],
};
const SUB_DAOSHU: SkillDef = {
  id: 'daoshu', name: '导数', kind: 'active', timing: 'active',
  desc: '弃一张手牌，令一名角色弃置两张手牌（求导取极值）。',
  effects: [{ kind: 'costCard', n: 1 }, { kind: 'targetDiscard', n: 2 }],
};
const SUB_TINGXIE: SkillDef = {
  id: 'tingxie', name: '听写', kind: 'active', timing: 'active',
  desc: '弃一张手牌，获得一名角色的一张手牌（听写抽查）。',
  effects: [{ kind: 'costCard', n: 1 }, { kind: 'gainHand', n: 1 }],
};
const SUB_ZHEXUE: SkillDef = {
  id: 'zhexue', name: '哲学', kind: 'active', timing: 'active',
  desc: '弃一张手牌，获得一名角色的一张手牌（思辨论证）。',
  effects: [{ kind: 'costCard', n: 1 }, { kind: 'gainHand', n: 1 }],
};
const SUB_YUFA: SkillDef = {
  id: 'yufa', name: '语法', kind: 'active', timing: 'active',
  desc: '展示牌堆顶三张，获得其中的一张，其余置入弃牌堆（语法填空）。',
  effects: [{ kind: 'deckPeek', n: 3, then: 'pickOne' }],
};
const SUB_DIANCI: SkillDef = {
  id: 'dianci', name: '电磁', kind: 'active', timing: 'active',
  desc: '弃一张手牌，对一名角色造成 1 点伤害（电磁感应）。',
  effects: [{ kind: 'costCard', n: 1 }, { kind: 'targetDamage', n: 1 }],
};
const SUB_YOUJIHUAXUE: SkillDef = {
  id: 'youjihuaxue', name: '有机', kind: 'active', timing: 'active',
  desc: '弃两张手牌，回复 1 点体力并摸一张牌（有机合成）。',
  effects: [{ kind: 'costCard', n: 2 }, { kind: 'selfHeal', n: 1 }, { kind: 'selfDraw', n: 1 }],
};
const SUB_CHAODAI: SkillDef = {
  id: 'chaodai', name: '朝代', kind: 'active', timing: 'active',
  desc: '弃一张手牌，令所有其他角色各弃置一张手牌（改朝换代）。',
  effects: [{ kind: 'costCard', n: 1 }, { kind: 'allDiscard', n: 1 }],
};
const SUB_SHILIAO: SkillDef = {
  id: 'shiliao', name: '史料', kind: 'active', timing: 'active',
  desc: '弃一张手牌，所有存活角色各摸一张牌（史料共享）。',
  effects: [{ kind: 'costCard', n: 1 }, { kind: 'allDraw', n: 1 }],
};
const SUB_FAZHI: SkillDef = {
  id: 'fazhi', name: '法治', kind: 'active', timing: 'active',
  desc: '弃一张手牌，令一名角色回复 1 点体力（法治保障）。',
  effects: [{ kind: 'costCard', n: 1 }, { kind: 'targetHeal', n: 1 }],
};
const SUB_FULI: SkillDef = {
  id: 'fuli', name: '浮力', kind: 'passive', timing: 'passive',
  desc: '你计算与其他角色的距离 −1（浮力托举）。', effects: [{ kind: 'distMod', delta: -1 }],
};
const SUB_JINGWEI: SkillDef = {
  id: 'jingwei', name: '经纬', kind: 'passive', timing: 'passive',
  desc: '你计算与其他角色的距离 −1（经纬定位）。', effects: [{ kind: 'distMod', delta: -1 }],
};
const SUB_FANGCHENGSHI: SkillDef = {
  id: 'fangchengshi', name: '方程式', kind: 'passive', timing: 'passive',
  desc: '你的手牌上限 +1（配平储备）。', effects: [{ kind: 'handLimit', n: 1 }],
};
const SUB_YICHUAN: SkillDef = {
  id: 'yichuan', name: '遗传', kind: 'passive', timing: 'passive',
  desc: '你的手牌上限 +2（遗传信息承载）。', effects: [{ kind: 'handLimit', n: 2 }],
};
const SUB_GUANGHE: SkillDef = {
  id: 'guanghe', name: '光合', kind: 'trigger', timing: 'onDraw',
  desc: '摸牌阶段你额外摸一张牌（光合作用产能）。', effects: [{ kind: 'extraDraw', n: 1 }],
};
const SUB_QUWEI: SkillDef = {
  id: 'quwei', name: '区位', kind: 'trigger', timing: 'onUseTrick',
  desc: '你使用锦囊牌后摸一张牌（区位分析）。', effects: [{ kind: 'trickDraw', n: 1 }],
};

/* ------------------------------------------------------------------ */
/* 登记表                                                              */
/* ------------------------------------------------------------------ */

export const SKILL_DEFS: Record<string, SkillDef> = Object.fromEntries(
  [
    // 语文
    LUXUN_NAH,
    LUXUN_HENGMEI,
    LIBAI_JIANGJINJIU,
    LIBAI_SHICHENG,
    DUFU_SANLI,
    DUFU_CHENYU,
    DUFU_SHISHI,
    ZHUZIQING_BEIYING,
    ZHUZIQING_HETANG,
    LAOSHE_CHAGUAN,
    LAOSHE_XIANGZI,
    MAODUN_ZIYE,
    MAODUN_PIPAN,
    // 数学
    ZCZ_MILV,
    ZCZ_ZHUISHU,
    HLG_TONGCHOU,
    HLG_YOUXUAN,
    GAOSI_SUANSHU,
    GAOSI_SHULUN,
    DIKAER_ZUOBIAO,
    DIKAER_WOSI,
    KEXI_JIXIAN,
    KEXI_XULIE,
    // 英语
    SHASHIBIYA_SHS,
    SHASHIBIYA_HMLT,
    PEIGEN_LUNDUOSHU,
    PEIGEN_SUIBI,
    MATUWEN_BWYB,
    MATUWEN_FC,
    DIGENGSI_SCJ,
    DIGENGSI_WDGE,
    XUELAI_XFS,
    XUELAI_SHIBIAN,
    // 物理
    NIUDUN_SDDL,
    NIUDUN_WYYL,
    AINSTEIN_XDL,
    AINSTEIN_ZNFC,
    FALADI_DCYG,
    FALADI_CHANGLUN,
    JIALILUE_ZYLT,
    JIALILUE_WYJ,
    PULANGKE_LIANGZI,
    PULANGKE_CS,
    // 化学
    MJLF_ZQL,
    MJLF_YUANSU,
    LWY_ZLSH,
    LWY_RSHXS,
    JULI_FSX,
    JULI_LYS,
    KKL_BH,
    KKL_JGS,
    LSF_HMX,
    LSF_SSSY,
    // 生物
    DEW_JHL,
    DEW_SZSC,
    BSD_MJ,
    BSD_MY,
    MDE_FLL,
    MDE_XXXZ,
    TYY_QHS,
    TYY_DWTQ,
    LSZ_BCGM,
    LSZ_XY,
    // 历史
    QSH_TY,
    QSH_FS,
    YF_JZ,
    YF_MXY,
    ZH_XXY,
    ZH_HHT,
    LZX_HMXY,
    LZX_HF,
    SMQ_SB,
    SMQ_RRFZ,
    SMQ_CYJZYZY,
    ZGL_GX,
    ZGL_KC,
    ZGL_CSB,
    // 地理
    XXK_YJ,
    XXK_TX,
    ZH_DDY,
    ZH_HTS,
    LDY_SJZ,
    LDY_YD,
    LSG_DZKT,
    LSG_GZTX,
    // 政治
    KZ_LY,
    KZ_YJWL,
    HFZ_FBAG,
    HFZ_SS,
    MZ_RZ,
    MZ_WD,
    MZ_FG,
    MZ_JA,
    SZ_BF,
    SZ_XS,
    // 主公技
    LORD_SHISHU,
    LORD_TUIYAN,
    LORD_YISHU,
    LORD_YINLI,
    LORD_CUIHUA,
    LORD_JINHUALUN,
    LORD_MINGJIAN,
    LORD_TANSUO,
    LORD_XUNJIE,
    // 学科主题技
    SUB_BEISONG,
    SUB_WENYAN,
    SUB_YOUSHU,
    SUB_DAOSHU,
    SUB_TINGXIE,
    SUB_ZHEXUE,
    SUB_YUFA,
    SUB_DIANCI,
    SUB_YOUJIHUAXUE,
    SUB_CHAODAI,
    SUB_SHILIAO,
    SUB_FAZHI,
    SUB_FULI,
    SUB_JINGWEI,
    SUB_FANGCHENGSHI,
    SUB_YICHUAN,
    SUB_GUANGHE,
    SUB_QUWEI,
  ].map((d) => [d.id, d]),
);

/** 按 id 取定义 */
export function defOf(id: string): SkillDef | undefined {
  return SKILL_DEFS[id];
}

/**
 * 由登记表派生角色挂载的 Skill（单一数据源）。
 * 未登记的技能（扩展包自定义 id）回退为主动技，保证扩展包数据零改动可用。
 */
export function skillOf(id: string): Skill {
  const d = defOf(id);
  if (!d) return { id, name: id, type: 'active', desc: '' };
  return { id: d.id, name: d.name, type: skillTypeOf(d), desc: d.desc };
}

/** 技能在指定时机是否生效（含「效果自带 at 时机」的情况） */
export function matchesTiming(d: SkillDef, t: SkillTiming): boolean {
  if (d.timing === t) return true;
  return (d.effects as SkillE[]).some((e) => e.at === t);
}
