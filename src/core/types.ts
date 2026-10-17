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
  s: string;
  kp: string;
  q: string;
  o: string[];
  a: number;
}

export type QuestionBank = Record<string, Question[]>;

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
}

export interface Player {
  id: number;
  name: string;
  avatar: string;
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
}

export interface PublicProfile {
  name: string;
  score: number;
  games: number;
  wins: number;
  achievements: Record<string, number>;
  subjects: Record<string, number>;
  correctQuiz: number;
  bestStreak: number;
}

export interface RoomMember {
  peerId: string;
  name: string;
  isHost: boolean;
  profile: PublicProfile | null;
}

export interface QuizStats {
  total: number;
  correct: number;
}
