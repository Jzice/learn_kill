/* ==================== 全局领域类型 ==================== */

export type Suit = '♠' | '♥' | '♣' | '♦';
export type CardType = 'basic' | 'trick' | 'equip';
export type Role = 'lord' | 'loyal' | 'rebel' | 'spy';
export type FactionId =
  | 'chinese'
  | 'math'
  | 'english'
  | 'physics'
  | 'chemistry'
  | 'biology'
  | 'history'
  | 'geography'
  | 'politics';
export type SkillType = 'active' | 'trigger';
export type PendingType = 'list' | 'play' | 'discard' | 'rescue' | 'shan' | 'target';
export type LogAction =
  | 'log'
  | 'use'
  | 'damage'
  | 'heal'
  | 'skill'
  | 'reward'
  | 'faction'
  | 'kp'
  | 'sys';
export type ChatKind = 'ai' | 'self' | 'sys';
export type NetMode = 'single' | 'host' | 'join';
export type EquipSlot = 'weapon' | 'armor' | 'horsePlus' | 'horseMinus';
/** 玩家自选性别（仅用于个性化展示，不影响玩法） */
export type Gender = 'male' | 'female' | 'hidden';

/** 玩家个性化身份信息（昵称/头像/性别/心情），联机时同步给其他玩家 */
export interface PlayerIdentity {
  name: string;
  avatar: string;
  gender: Gender;
  mood: string;
  moodIcon: string;
}

export interface Skill {
  id: string;
  name: string;
  type: SkillType;
  desc: string;
  /** 扩展包技能的原语组合（仅扩展包技能有；基础技能走 skills.ts 的 switch 分发） */
  effects?: SkillEffect[];
}

/**
 * 技能效果原语：108 个扩展包技能均由有限原语组合声明，避免 108 个独立分支。
 * 由 src/game/skillfx.ts 统一分派执行（主动技在 useActiveSkill 拦截，触发技在规则钩子聚合）。
 */
export type SkillEffect =
  | { kind: 'selfDraw'; n: number }
  | { kind: 'targetDiscard'; n: number }
  | { kind: 'targetLoseHp'; n: number }
  | { kind: 'targetDamage'; n: number }
  | { kind: 'targetHeal'; n: number }
  | { kind: 'targetDraw'; n: number }
  | { kind: 'gainHand'; n: number }
  | { kind: 'allDiscard'; n: number }
  | { kind: 'allDraw'; n: number }
  | { kind: 'extraDraw'; n: number }
  | { kind: 'handLimit'; n: number }
  | { kind: 'distMod'; delta: number }
  | { kind: 'damageMod'; delta: number }
  | { kind: 'shield'; n: number }
  /** 主动技消耗手牌数（在结算其他原语前先弃置） */
  | { kind: 'costCard'; n: number };

/** 消耗类道具定义（局末清空，不进牌堆，不可被顺手牵羊等卡牌影响） */
export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  /** 携带上限 */
  maxCarry: number;
  effects: SkillEffect[];
}

/** 学分规则：产出与上限集中配置，便于调数值 */
export interface CreditRule {
  perCorrectQuiz: number;
  perReview: number;
  perWrongFixed: number;
  dailyCap: number;
}

/** 局前配装：携带的装备（按槽位）与道具（id → 数量） */
export interface Loadout {
  weapon: string | null;
  armor: string | null;
  horsePlus: string | null;
  horseMinus: string | null;
  items: Record<string, number>;
}

export interface Faction {
  name: string;
  color: string;
  icon: string;
  subject: string;
  desc: string;
  lordSkill: Skill;
}

export interface Character {
  id: string;
  name: string;
  title: string;
  faction: FactionId;
  subject: string;
  hp: number;
  avatar: string;
  grade: string;
  skills: Skill[];
}

export interface Question {
  /** 科目 */
  s: string;
  /** 所属单元（如"有理数""秦汉时期"） */
  u?: string;
  /** 知识点 */
  kp: string;
  /** 题干 */
  q: string;
  /** 选项（4 项） */
  o: string[];
  /** 正确选项下标 0-3 */
  a: number;
  /** 所属年级学期（抽题时按范围标记，题库原始数据可无此字段） */
  g?: string;
}

export type QuestionBank = Record<string, Question[]>;

/** 知识点讲解（与 Question.kp 对齐，按「学期 + 学科」随题库一起懒加载） */
export interface KnowledgeNote {
  /** 学科 */
  s: string;
  /** 单元 */
  u: string;
  /** 知识点（与 Question.kp 同名，用于互跳） */
  kp: string;
  /** 概要 */
  summary: string;
  /** 要点条目 */
  points: string[];
  /** 易错提示 */
  pitfall?: string;
  /** 学科扩展：英语 phrases/tenses/translations、数学 formulas/theorems、语文 classics 等 */
  ext?: Record<string, unknown>;
}

/** 知识点关系类型：前置 / 包含 / 应用 / 易混 */
export type KpRelationType = 'prereq' | 'contains' | 'apply' | 'contrast';

export interface KpRelation {
  /** 学科 */
  s: string;
  from: string;
  to: string;
  type: KpRelationType;
  note?: string;
}

/** 单个「学期 + 学科」分片：题目 + 讲解 + 关系 */
export interface SubjectBankSlice {
  q: Question[];
  /** 知识点名 → 讲解 */
  k: Record<string, KnowledgeNote>;
  r: KpRelation[];
}

/** 出题范围：本年级本学期 / 本学期及以前年级 / 初中阶段 / 高中阶段 */
export type QuizScope = 'grade' | 'past' | 'junior' | 'senior';

/** 单题答题记录（个人错题本 / 掌握度） */
export interface QuizRec {
  /** 累计答错次数 */
  w: number;
  /** 连续答对次数（答错清零），达到 MASTER_STREAK 视为掌握，不再抽到 */
  c: number;
  /** 最后作答时间戳 */
  ts: number;
  /** 学科 */
  s: string;
  /** 知识点 */
  kp: string;
  /** 年级学期 */
  g: string;
  /** 题干（错题本展示用） */
  text: string;
}

/** 伤害属性：普通 / 火 / 雷（属性伤害可被【藤甲】放大，并触发【铁索连环】传导） */
export type DamageType = 'normal' | 'fire' | 'thunder';

export interface Card {
  id: number;
  name: string;
  type: CardType;
  sub: string;
  suit: string;
  num: string | number;
  range?: number;
  skill?: string;
  dist?: number;
  judgeType?: 'lebu' | 'shandian';
  /** 该牌造成的伤害属性（火杀/雷杀/火攻/闪电），缺省按普通伤害处理 */
  damageType?: DamageType;
}

/** 出牌区展示用的轻量卡牌视图（允许 num 为 '?' 等占位） */
export interface PlayCardView {
  name: string;
  suit: string;
  num: string | number;
  type: CardType;
}

export interface Equips {
  weapon: Card | null;
  armor: Card | null;
  horsePlus: Card | null;
  horseMinus: Card | null;
}

export interface PlayerFlags {
  shaUsed: number;
  skillUsed: boolean;
  extraDamage: number;
  skipPlay: boolean;
  noSha: boolean;
  /** 本回合是否已使用过【酒】（每回合限一次，与额外伤害一起在回合初重置） */
  jiuUsed: boolean;
  /** 局前装备加成（由配装注入，整局有效）：护甲减伤次数 */
  dmgReduce?: number;
  /** 局前武器加成：出杀/伤害 +n（整局） */
  bonusDmg?: number;
}

export interface Player {
  id: number;
  name: string;
  /** 角色头像（AI 用；真人若设置了自定义头像则优先展示自定义） */
  avatar: string;
  /** 个性化身份（真人玩家有值，AI 为 null） */
  identity: PlayerIdentity | null;
  subject: string;
  charId: string;
  faction: FactionId;
  role: Role;
  roleRevealed: boolean;
  /** 击杀者名字（阵亡时记录，联机下随状态同步，供客人端播放阵亡动画显示「被谁所杀」） */
  killedBy?: string;
  hp: number;
  maxHp: number;
  hand: Card[];
  equip: Equips;
  judge: Card[];
  knowledge: number;
  shield: number;
  combo: number;
  maxCombo: number;
  subjectMastery: Record<string, number>;
  alive: boolean;
  isAI: boolean;
  skills: Skill[];
  peerId: string | null;
  flags: PlayerFlags;
  /** 铁索连环·横置：处于连环状态，受到属性伤害时传导给所有连环角色并各自重置 */
  chained?: boolean;
  /** 翻面：跳过一个回合（严格原版：与连环相互独立，不由铁索连环触发） */
  turned?: boolean;
  /** 局内携带的消耗类道具：道具 id → 数量（局末清空，不进牌堆） */
  items?: Record<string, number>;
}

export interface ChoiceOption {
  label: string;
  value: string | number;
  skill?: boolean;
  lord?: boolean;
}

export interface GameState {
  players: Player[];
  deck: Card[];
  discard: Card[];
  current: number;
  started: boolean;
  grade: string;
  myPlayerIdx: number;
  pendingOptions: ChoiceOption[] | null;
  pendingType: PendingType;
  pendingResolve: ((v: string | number) => void) | null;
  pendingPlayer: number | null;
  gameOver: boolean;
  winnerText: string;
  playerCount: number;
  settled: boolean;
  myKills: number;
  handClickable?: boolean;
  targetSelectable?: boolean;
  /** 回合限时：是否开启（开局选项，全局生效） */
  timerOn?: boolean;
  /** 回合限时秒数（10 / 20 / 30） */
  timerSec?: number;
  /** 当前决策的截止时间戳（ms，房主权威）；null / undefined = 无进行中的计时；随 state_sync 下发供客人端显示倒计时 */
  timerEnd?: number | null;
}

export interface LogEntry {
  action: LogAction;
  text?: string;
  cls?: string;
  fromName?: string;
  cardName?: string | number;
  toName?: string;
}

export interface ChatMessage {
  name: string;
  text: string;
  kind: ChatKind;
  /** 发送者头像（微信式气泡左侧/右侧人物块） */
  avatar?: string;
  /** 发送者心情图标 + 心情文案（即「一句话」） */
  moodIcon?: string;
  mood?: string;
}

export interface Level {
  n: string;
  min: number;
}

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  icon: string;
}

export interface Profile {
  name: string;
  score: number;
  games: number;
  wins: number;
  winStreak: number;
  bestStreak: number;
  totalQuiz: number;
  correctQuiz: number;
  maxCombo: number;
  achievements: Record<string, number>;
  subjects: Record<string, number>;
  /** 个性化：头像 / 性别 / 心情 / 心情图标 */
  avatar: string;
  gender: Gender;
  mood: string;
  moodIcon: string;
  /** 界面主题：光线模式（白天/夜晚/黄昏） */
  themeMode: 'day' | 'night' | 'dusk';
  /** 界面主题：内置配色风格 */
  themeStyle: 'gold' | 'teal' | 'red' | 'purple' | 'green' | 'blue';
  /** 出题范围（个人偏好，决定抽题覆盖的年级/阶段） */
  quizScope: QuizScope;
  /** 个人错题本：题干哈希 → 答题记录（掌握度） */
  quizRec: Record<string, QuizRec>;
  /** 学分：仅由学习行为产出、仅用于解锁/购买，不参与对局胜负 */
  credits: number;
  /** 学分每日获取累计（防刷）：{ date: 'YYYY-MM-DD', earned } */
  creditDaily: { date: string; earned: number };
  /** 已解锁的扩展包角色 id 列表 */
  unlockedChars: string[];
  /** 已解锁（购买）的装备 id 列表 */
  unlockedEquips: string[];
  /** 拥有的消耗类道具：道具 id → 数量 */
  items: Record<string, number>;
  /** 局前配装 */
  loadout: Loadout;
  /** 各学期累计答对题数（学段学习量：装备 tier2/3 解锁条件的度量） */
  gradeStats: Record<string, number>;
  /** 新手礼包（tier1 装备自选 1 件）是否已发放 */
  newbieGift: boolean;
}

export interface PublicProfile extends PlayerIdentity {
  score: number;
  games: number;
  wins: number;
  achievements: Record<string, number>;
  subjects: Record<string, number>;
  correctQuiz: number;
  bestStreak: number;
}

export interface PlayerPref {
  faction: FactionId;
  charId: string | null;
  /** 局前配装：携带的装备（按槽位）与道具（房主据此为远程玩家注入装备） */
  loadout?: Loadout;
  /** 该玩家已解锁的装备 id 列表（房主据此校验其配装合法性，非解锁件一律回退） */
  unlockedEquips?: string[];
  /** 加入方的出题范围（房主为该玩家抽题时按其偏好覆盖年级） */
  scope?: QuizScope;
}

export interface RoomMember {
  peerId: string;
  name: string;
  isHost: boolean;
  profile: PublicProfile | null;
  /** 加入方在设置界面自选的阵营 / 角色偏好（房主开局时优先采纳） */
  pref?: PlayerPref;
  /** 加入方的出题范围（房主抽题时按各自偏好出题） */
  scope?: QuizScope;
}

/** 座位表条目（数组下标即座位号，缺位表示该座位由 AI 补齐） */
export interface SeatSlot {
  peerId: string;
  name: string;
}

export interface QuizStats {
  total: number;
  correct: number;
}
