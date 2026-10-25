/* ==================== 知识点锦囊 ====================
 * 由初高中九科关键词 / 成语 / 短语与校园生活场景提炼而成的锦囊牌。
 * 纯数据驱动：每张锦囊 = 一条 KtDef 记录；分派与结算见 game/actions.ts 的 useKnowledgeTrick。
 *   - 策略型（strategy）：直接套用 effects 原语，由 game/skillEngine.ts 的 runEffects 执行；
 *   - 答题型（quiz）：先经 game/quiz.ts 的 askQuizForPlayer 答题，
 *     答对套用 effects（学习奖励已在 displayQuiz 内自动发放），答错执行 onWrong 或哑火。
 * 新增玩法 = 往 KNOWLEDGE_TRICKS 加一条数据 + 在 cards.ts 自动入牌堆，无需改动引擎。
 * 本模块为纯数据，无顶层副作用（保持 ui ↔ game ↔ net 的模块循环安全）。
 */
import type { FactionId, SkillEffect } from '../core/types';

/** 玩法类型：strategy=纯策略迁移（不强制答题）；quiz=答题触发 */
export type KtKind = 'strategy' | 'quiz';
/** 目标模式：none=无需目标；one=需指定一名其他角色 */
export type KtTarget = 'none' | 'one';
/** 学科归属：九科阵营 id；'campus' 表示校园生活（不对应具体学科，取中性配色） */
export type KtSubject = FactionId | 'campus';

export interface KtDef {
  /** 卡牌显示名（成语 / 短语 / 定律） */
  name: string;
  /** 学科归属（规则书展示配色 / 答题 bias） */
  subject: KtSubject;
  /** 玩法类型 */
  kind: KtKind;
  /** 目标模式 */
  target: KtTarget;
  /** 规则书 / 出牌提示文案 */
  desc: string;
  /** 牌堆投放张数（默认 1） */
  deck?: number;
  /** 生效效果：策略型为出牌即生效；答题型为「答对」时生效（runEffects 可执行的原语） */
  effects?: SkillEffect[];
  /** 答题型：优先抽题学科（省略则按玩家阵营 / 角色学科 bias） */
  quizSubject?: string;
  /** 答题型：答错时的反噬效果（省略则哑火） */
  onWrong?: SkillEffect[];
}

export const KNOWLEDGE_TRICKS: Record<string, KtDef> = {
  // ---- 语文 ----
  hualong: {
    name: '画龙点睛',
    subject: 'chinese',
    kind: 'strategy',
    target: 'none',
    deck: 2,
    desc: '观看牌堆顶 3 张，取 1 张收入手中（抓住关键一笔）',
    effects: [{ kind: 'deckPeek', n: 3, then: 'pickOne' }],
  },
  yiming: {
    name: '一鸣惊人',
    subject: 'chinese',
    kind: 'quiz',
    target: 'none',
    deck: 1,
    desc: '答对一道语文题则脱颖而出：摸 2 张牌并 +1 学识；答错则哑火',
    quizSubject: '语文',
    effects: [
      { kind: 'selfDraw', n: 2 },
      { kind: 'gainKnowledge', n: 1 },
    ],
  },
  // ---- 数学 ----
  dengdai: {
    name: '等量代换',
    subject: 'math',
    kind: 'strategy',
    target: 'one',
    deck: 2,
    desc: '与目标各交换一张手牌（等价代换，各取所需）',
    effects: [{ kind: 'exchangeHand', n: 1 }],
  },
  // ---- 英语 ----
  hitbooks: {
    name: 'Hit the books',
    subject: 'english',
    kind: 'quiz',
    target: 'none',
    deck: 1,
    desc: '答对一道英语题则啃书有获：摸 2 张牌；答错则哑火',
    quizSubject: '英语',
    effects: [{ kind: 'selfDraw', n: 2 }],
  },
  // ---- 物理 ----
  nengliang: {
    name: '能量守恒',
    subject: 'physics',
    kind: 'strategy',
    target: 'none',
    deck: 2,
    desc: '弃 1 张牌作为能量，转化为摸 2 张牌（形态转换，总量守恒）',
    effects: [
      { kind: 'costCard', n: 1 },
      { kind: 'selfDraw', n: 2 },
    ],
  },
  // ---- 化学 ----
  zhihuan: {
    name: '置换反应',
    subject: 'chemistry',
    kind: 'strategy',
    target: 'one',
    deck: 2,
    desc: '查看目标手牌并夺取其中一张（活泼元素置换）',
    effects: [{ kind: 'peekHand', then: 'steal' }],
  },
  // ---- 生物 ----
  guanghe: {
    name: '光合作用',
    subject: 'biology',
    kind: 'strategy',
    target: 'none',
    deck: 2,
    desc: '吸收 1 张牌（CO₂）释放能量：摸 1 张牌并 +1 学识',
    effects: [
      { kind: 'costCard', n: 1 },
      { kind: 'selfDraw', n: 1 },
      { kind: 'gainKnowledge', n: 1 },
    ],
  },
  // ---- 历史 ----
  wanbi: {
    name: '完璧归赵',
    subject: 'history',
    kind: 'strategy',
    target: 'one',
    deck: 2,
    desc: '将一张手牌交给目标（礼尚往来，化敌为友）',
    effects: [{ kind: 'giveHand', n: 1 }],
  },
  // ---- 地理 ----
  yangliu: {
    name: '洋流',
    subject: 'geography',
    kind: 'strategy',
    target: 'one',
    deck: 1,
    desc: '寒暖流裹挟，冲走目标一张手牌',
    effects: [{ kind: 'targetDiscard', n: 1 }],
  },
  // ---- 政治 ----
  liangbian: {
    name: '量变到质变',
    subject: 'politics',
    kind: 'quiz',
    target: 'one',
    deck: 1,
    desc: '答对一道政治题则引发质的飞跃：对目标造成 2 点伤害；答错则哑火',
    quizSubject: '政治',
    effects: [{ kind: 'targetDamage', n: 2 }],
  },
  // ---- 校园生活 ----
  jiaozuoye: {
    name: '交作业',
    subject: 'campus',
    kind: 'quiz',
    target: 'none',
    deck: 1,
    desc: '按时交作业（答对任意一题）受表扬：摸 2 张牌 +1 学识；未交（答错）则被批评，失去 1 点体力',
    effects: [
      { kind: 'selfDraw', n: 2 },
      { kind: 'gainKnowledge', n: 1 },
    ],
    onWrong: [{ kind: 'selfLoseHp', n: 1 }],
  },
};

/** 运行时注册的锦囊定义（自定义扩展包注入；不参与基础牌堆常量） */
const RUNTIME_TRICKS: Record<string, KtDef> = {};
/** 注册一条运行时锦囊（覆盖同名内置锦囊） */
export function registerTrick(sub: string, def: KtDef): void {
  RUNTIME_TRICKS[sub] = def;
}
/** 注销一条运行时锦囊 */
export function unregisterTrick(sub: string): void {
  delete RUNTIME_TRICKS[sub];
}
/** 列出当前所有运行时注册的锦囊 sub（用于整体重建时清理） */
export function runtimeTrickSubs(): string[] {
  return Object.keys(RUNTIME_TRICKS);
}
/** 合并内置与运行时锦囊（用于牌堆注入 / 规则书 / 结算查找） */
export function allTrickDefs(): Record<string, KtDef> {
  return { ...KNOWLEDGE_TRICKS, ...RUNTIME_TRICKS };
}
/** 按 sub 取锦囊定义（含运行时注册，结算与描述统一走这里） */
export function trickDefOf(sub: string): KtDef | undefined {
  return allTrickDefs()[sub];
}

/** 是否为知识点锦囊（按卡牌 sub 判定） */
export function isKnowledgeTrick(sub: string): boolean {
  return !!allTrickDefs()[sub];
}
