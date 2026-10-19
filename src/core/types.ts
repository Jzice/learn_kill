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
