/* ==================== 自定义扩展包运行时注册表 ====================
 * 让用户（老师 / 学生）在「不改动引擎、不需要重新构建」的前提下，导入自制扩展包：
 *   - 角色：每条技能注册为 SkillDef，由 src/game/skillEngine.ts 用全套 SkillE 原语执行
 *   - 锦囊：每条卡牌注册为 KtDef，由 cards.ts 自动入牌堆 + actions.ts 通用结算
 *   - 题目：走既有 QUESTION_BANK 合并通道
 * 数据为追加式；不装任何包时行为与改造前逐项一致（联机加入方亦不可见自定义内容）。
 *
 * 设计约束（对齐 AGENTS.md 不变量）：
 *   - 纯数据 + 无顶层副作用；启动时由 main.ts 调用 initPacks() 重建运行时注册表
 *   - 不导入 lobby / setup / 任何 UI 模块（避免模块循环）
 *   - 自定义内容「仅单机 / 房主」可用：联机加入方通过 setCustomAllowed(false) 关闭
 */
import type {
  Character,
  FactionId,
  QuestionBank,
  SkillDef,
  SkillE,
  SkillKind,
  SkillTiming,
} from '../core/types';
import { FACTIONS } from './factions';
import { gradeSortKey } from './grades';
import { stageOf, type PacketId } from './packets';
import { mergeBankData } from './questionBank';
import { registerSkillDef, unregisterSkillDef, skillOf, runtimeSkillIds } from './skilldefs';
import {
  registerTrick,
  unregisterTrick,
  runtimeTrickSubs,
  type KtDef,
  type KtKind,
  type KtSubject,
  type KtTarget,
} from './knowledgeTricks';

/* ---------------- 类型 ---------------- */

/** 扩展包内的一条技能（与 SkillDef 同构，作为数据声明） */
export interface PackSkillDef {
  id: string;
  name: string;
  kind: SkillKind;
  timing: SkillTiming;
  desc: string;
  cost?: SkillDef['cost'];
  limit?: SkillDef['limit'];
  cond?: SkillDef['cond'];
  effects: SkillE[];
}

/** 扩展包内的一个角色 */
export interface PackCharacter {
  id: string;
  name: string;
  title: string;
  faction: FactionId;
  subject: string;
  hp: number;
  avatar: string;
  grade: string;
  skills: PackSkillDef[];
}

/** 扩展包内的一张锦囊牌 */
export interface PackCard {
  key: string;
  name: string;
  subject: KtSubject;
  kind: KtKind;
  target: KtTarget;
  desc: string;
  deck?: number;
  effects?: SkillE[];
  quizSubject?: string;
  onWrong?: SkillE[];
}

/** 一个完整的扩展包（JSON 文件结构） */
export interface XtsPack {
  format: 'xts-pack';
  version: number;
  id: string;
  name: string;
  author?: string;
  desc?: string;
  characters?: PackCharacter[];
  cards?: PackCard[];
  questions?: QuestionBank;
}

/** 已安装包（含启用状态与安装时间） */
export interface InstalledPack extends XtsPack {
  enabled: boolean;
  addedAt: number;
}

/* ---------------- 校验白名单 ---------------- */

const KNOWN_EFFECT_KINDS = new Set<string>([
  'selfDraw', 'shield', 'selfHeal', 'selfLoseHp', 'allHeal', 'gainKnowledge', 'spendKnowledge',
  'targetHeal', 'targetDraw', 'targetDamage', 'targetLoseHp', 'targetDiscard', 'allDiscard',
  'allDraw', 'gainHand', 'costCard',
  'extraDraw', 'handLimit', 'distMod', 'damageMod',
  'star', 'starSort', 'deckPeek', 'deckBottom', 'toDeckTop', 'discardToTop', 'peekTopDeck',
  'convert', 'shaNeedShan', 'shaUnlimited', 'numGuard', 'reflect', 'armorPierceDamage',
  'preventShaDamage', 'pointDuel', 'judgeIf', 'chainJudge', 'suitCollect', 'guessSuit',
  'costThenDamage', 'doubleJudge', 'drawDiscardMin', 'extraDrawDiscardOdd',
  'peekHand', 'replaceDraw', 'targetChoose', 'quizDuel', 'swapHp', 'turnFace', 'giveHand',
  'giveHandIfShan', 'exchangeHand', 'multiDraw', 'stealFrom', 'revealAllPickOne', 'showHand',
  'discardToHeal', 'takeDuelCard', 'giveDuelCard', 'discardSuitMatch', 'trickDraw',
  'addMark', 'tickMark', 'pledge', 'immune', 'noHandImmune', 'cardImmune', 'suitImmune',
  'distTrap', 'trickRedirect', 'shaRedirect', 'enemyEquipVoid', 'horseDist', 'reduceDamage',
  'replaceJudge', 'awaken', 'revive', 'nextShaBonus', 'nextShaUnblockable', 'rangePlus',
  'distPlusToMe', 'ignoreHorsePlus', 'shunshouNoDist', 'knowledgeGain',
]);

const SKILL_KINDS: SkillKind[] = ['active', 'trigger', 'passive', 'limit', 'awaken', 'lord', 'convert'];
const SKILL_TIMINGS: SkillTiming[] = [
  'active', 'passive', 'onTurnStart', 'onDraw', 'onTurnEnd', 'beforeJudge', 'beforeDamage',
  'onDamaged', 'onTargetSha', 'onUseShan', 'onShaHit', 'onUseTrick',
];
const KT_KINDS: KtKind[] = ['strategy', 'quiz'];
const KT_TARGETS: KtTarget[] = ['none', 'one'];

const STORAGE_KEY = 'xuetangsha_packs_v1';

/* ---------------- 校验 ---------------- */

export interface ValidateResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** 粗略估算一名角色的「战力预算 PP」，用于平衡性告警（非精确，仅作作者提示） */
export function estimateCharPP(c: PackCharacter): number {
  let pp = c.hp >= 4 ? 1.0 : 0.6;
  for (const s of c.skills) {
    const w =
      s.kind === 'active' ? 1.2 :
      s.kind === 'trigger' ? 0.7 :
      s.kind === 'convert' ? 1.0 :
      s.kind === 'limit' ? 1.5 :
      s.kind === 'awaken' ? 0.5 :
      s.kind === 'lord' ? 1.0 : 0.6;
    pp += w;
    for (const e of s.effects as Array<{ kind: string; n?: number; delta?: number }>) {
      const k = e.kind;
      const mag = typeof e.n === 'number' ? e.n : typeof e.delta === 'number' ? e.delta : 1;
      if (['selfDraw', 'targetDraw', 'targetDamage', 'targetHeal', 'targetLoseHp', 'targetDiscard', 'allDraw', 'allDiscard', 'gainHand'].includes(k))
        pp += (typeof mag === 'number' ? mag : 1) * 0.2;
      else if (k === 'gainKnowledge' || k === 'knowledgeGain') pp += 0.5;
      else if (['immune', 'distMod', 'cardImmune', 'rangePlus', 'distPlusToMe', 'suitImmune'].includes(k)) pp += 0.4;
      else pp += 0.15;
    }
  }
  return Math.round(pp * 10) / 10;
}

export function validatePack(raw: unknown): ValidateResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isObj(raw)) {
    return { ok: false, errors: ['根节点必须是 JSON 对象'], warnings };
  }
  if (raw.format !== 'xts-pack') errors.push('缺少或错误的 format 字段（应为 "xts-pack"）');
  if (typeof raw.version !== 'number') errors.push('缺少 version 字段');
  if (typeof raw.id !== 'string' || !raw.id.trim()) errors.push('缺少 id（包唯一标识，建议 custom_ 前缀）');
  if (typeof raw.name !== 'string' || !raw.name.trim()) errors.push('缺少 name（展示名）');

  const chars = raw.characters;
  const cards = raw.cards;
  const qs = raw.questions;
  if (!Array.isArray(chars) && !Array.isArray(cards) && !isObj(qs)) {
    errors.push('至少需要一项：characters / cards / questions');
  }

  // 角色
  const usedCharIds = new Set<string>();
  if (Array.isArray(chars)) {
    chars.forEach((c, ci) => {
      const tag = `角色[${ci}]`;
      if (!isObj(c)) { errors.push(`${tag} 不是对象`); return; }
      if (typeof c.id !== 'string' || !c.id.trim()) errors.push(`${tag}.id 缺失`);
      else if (usedCharIds.has(c.id)) errors.push(`${tag}.id 重复：${c.id}`);
      else usedCharIds.add(c.id);
      if (typeof c.name !== 'string' || !c.name.trim()) errors.push(`${tag}.name 缺失`);
      if (typeof c.title !== 'string') errors.push(`${tag}.title 缺失`);
      if (typeof c.faction !== 'string' || !(c.faction in FACTIONS)) errors.push(`${tag}.faction 非法（应为九科 id：${Object.keys(FACTIONS).join('/')}）`);
      if (typeof c.subject !== 'string' || !c.subject.trim()) errors.push(`${tag}.subject 缺失`);
      if (typeof c.hp !== 'number' || c.hp < 2 || c.hp > 5) errors.push(`${tag}.hp 应在 2~5 之间`);
      if (typeof c.avatar !== 'string' || !c.avatar) errors.push(`${tag}.avatar 缺失（用单个 emoji）`);
      if (typeof c.grade !== 'string' || !c.grade.trim()) errors.push(`${tag}.grade 缺失`);
      if (!Array.isArray(c.skills) || c.skills.length === 0) errors.push(`${tag}.skills 至少 1 条`);
      const skillsArr: unknown[] = Array.isArray(c.skills) ? c.skills : [];
      skillsArr.forEach((s: unknown, si: number) => {
        const st = `${tag}.技能[${si}]`;
        if (!isObj(s)) { errors.push(`${st} 不是对象`); return; }
        if (typeof s.id !== 'string' || !s.id.trim()) errors.push(`${st}.id 缺失`);
        if (typeof s.name !== 'string' || !s.name.trim()) errors.push(`${st}.name 缺失`);
        if (typeof s.kind !== 'string' || !SKILL_KINDS.includes(s.kind as SkillKind)) errors.push(`${st}.kind 非法：${s.kind}`);
        if (typeof s.timing !== 'string' || !SKILL_TIMINGS.includes(s.timing as SkillTiming)) errors.push(`${st}.timing 非法：${s.timing}`);
        if (typeof s.desc !== 'string' || !s.desc.trim()) errors.push(`${st}.desc 缺失`);
        if (!Array.isArray(s.effects)) errors.push(`${st}.effects 必须是数组`);
        else {
          (s.effects as unknown[]).forEach((e: unknown, ei: number) => {
            if (!isObj(e) || typeof e.kind !== 'string') errors.push(`${st}.effects[${ei}] 缺少 kind`);
            else if (!KNOWN_EFFECT_KINDS.has(e.kind)) warnings.push(`${st}.effects[${ei}].kind 未知「${e.kind}」，引擎可能不识别`);
          });
        }
      });
      const pp = estimateCharPP(c as unknown as PackCharacter);
      if (pp > 5.0) warnings.push(`${tag}「${String(c.name)}」战力预算约 ${pp} PP，高于基线（建议 ≤5，避免失衡）`);
    });
  }

  // 锦囊
  const usedCardKeys = new Set<string>();
  if (Array.isArray(cards)) {
    cards.forEach((c, ci) => {
      const tag = `锦囊[${ci}]`;
      if (!isObj(c)) { errors.push(`${tag} 不是对象`); return; }
      if (typeof c.key !== 'string' || !c.key.trim()) errors.push(`${tag}.key 缺失`);
      else if (usedCardKeys.has(c.key)) errors.push(`${tag}.key 重复：${c.key}`);
      else usedCardKeys.add(c.key);
      if (typeof c.name !== 'string' || !c.name.trim()) errors.push(`${tag}.name 缺失`);
      if (typeof c.subject !== 'string') errors.push(`${tag}.subject 缺失`);
      if (typeof c.kind !== 'string' || !KT_KINDS.includes(c.kind as KtKind)) errors.push(`${tag}.kind 非法（strategy/quiz）`);
      if (typeof c.target !== 'string' || !KT_TARGETS.includes(c.target as KtTarget)) errors.push(`${tag}.target 非法（none/one）`);
      if (typeof c.desc !== 'string' || !c.desc.trim()) errors.push(`${tag}.desc 缺失`);
      if (c.deck !== undefined && (typeof c.deck !== 'number' || c.deck < 1 || c.deck > 4)) warnings.push(`${tag}.deck 建议 1~4（过多会稀释基础牌堆）`);
      (['effects', 'onWrong'] as const).forEach((f) => {
        if (c[f] !== undefined && !Array.isArray(c[f])) errors.push(`${tag}.${f} 必须是数组`);
      });
    });
  }

  // 题目
  if (qs !== undefined && !isObj(qs)) {
    errors.push('questions 必须是 { 年级: 题目[] }');
  } else if (isObj(qs)) {
    for (const [g, list] of Object.entries(qs)) {
      if (!Array.isArray(list)) { errors.push(`questions.${g} 不是数组`); continue; }
      (list as unknown[]).forEach((it, i) => {
        if (!isObj(it)) { errors.push(`questions.${g}[${i}] 不是对象`); return; }
        if (typeof it.q !== 'string' || !it.q.trim()) errors.push(`questions.${g}[${i}].q 缺失`);
        if (!Array.isArray(it.o) || (it.o as unknown[]).length < 2) errors.push(`questions.${g}[${i}].o 至少 2 项`);
        if (typeof it.a !== 'number' || (Array.isArray(it.o) && (it.a < 0 || it.a >= it.o.length))) errors.push(`questions.${g}[${i}].a 越界`);
      });
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/* ---------------- 持久化 ---------------- */

function readStore(): InstalledPack[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? (data as InstalledPack[]) : [];
  } catch {
    return [];
  }
}

function writeStore(list: InstalledPack[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* 配额超限等：忽略持久化，内存态仍可玩 */
  }
}

function enabledPacks(): InstalledPack[] {
  return readStore().filter((p) => p.enabled);
}

/* ---------------- 运行时注册（追加式，随启用状态重建） ---------------- */

let customAllowed = true;
/** 联机加入方调用此函数关闭自定义内容（仅单机 / 房主可用） */
export function setCustomAllowed(v: boolean): void {
  customAllowed = v;
}

function rebuildRuntime(): void {
  // 先整体清理旧的运行时注册，避免残留
  for (const id of runtimeSkillIds()) unregisterSkillDef(id);
  for (const sub of runtimeTrickSubs()) unregisterTrick(sub);

  for (const p of enabledPacks()) {
    for (const c of p.characters || []) {
      for (const s of c.skills) {
        registerSkillDef({
          id: s.id, name: s.name, kind: s.kind, timing: s.timing, desc: s.desc,
          cost: s.cost, limit: s.limit, cond: s.cond, effects: s.effects,
        });
      }
    }
    for (const card of p.cards || []) {
      const def: KtDef = {
        name: card.name, subject: card.subject, kind: card.kind, target: card.target,
        desc: card.desc, deck: card.deck ?? 1,
        effects: card.effects, quizSubject: card.quizSubject, onWrong: card.onWrong,
      };
      registerTrick(card.key, def);
    }
    if (p.questions) {
      try { mergeBankData(p.questions); } catch { /* 题目合并失败不影响其余内容 */ }
    }
  }
}

/* ---------------- 对外 API ---------------- */

/** 应用启动时调用：从 localStorage 重建运行时注册表 */
export function initPacks(): void {
  rebuildRuntime();
}

export function getInstalledPacks(): InstalledPack[] {
  return readStore();
}

export function installPack(raw: unknown): { ok: boolean; errors: string[]; warnings: string[]; pack?: InstalledPack } {
  const v = validatePack(raw);
  if (!v.ok) return { ok: false, errors: v.errors, warnings: v.warnings };
  const pack = { ...(raw as XtsPack), enabled: true, addedAt: Date.now() };
  const store = readStore().filter((p) => p.id !== pack.id); // 同名覆盖
  store.push(pack);
  writeStore(store);
  rebuildRuntime();
  return { ok: true, errors: [], warnings: v.warnings, pack };
}

export function setPackEnabled(id: string, on: boolean): void {
  const store = readStore().map((p) => (p.id === id ? { ...p, enabled: on } : p));
  writeStore(store);
  rebuildRuntime();
}

export function removePack(id: string): void {
  writeStore(readStore().filter((p) => p.id !== id));
  rebuildRuntime();
}

export function clearAllPacks(): void {
  writeStore([]);
  rebuildRuntime();
}

/** 从文本解析并安装（文件 / URL 加载共用） */
export function installPackFromText(text: string): { ok: boolean; errors: string[]; warnings: string[]; pack?: InstalledPack } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: ['JSON 解析失败：' + (e as Error).message], warnings: [] };
  }
  return installPack(data);
}

/* ---------------- 选角池接入 ---------------- */

function buildCharacter(c: PackCharacter): Character {
  const skills = c.skills.map((s) => skillOf(s.id));
  return {
    id: c.id, name: c.name, title: c.title, faction: c.faction, subject: c.subject,
    hp: c.hp, avatar: c.avatar, grade: c.grade, skills,
  };
}

/** 当前启用的自定义角色（按年级 / 扩展包筛选，与 mergedCharPool 规则一致） */
export function customCharsFor(grade: string, packet: PacketId): Character[] {
  if (!customAllowed) return [];
  const lim = gradeSortKey(grade);
  if (lim <= 0 && packet !== 'all') return [];
  const out: Character[] = [];
  for (const p of enabledPacks()) {
    for (const c of p.characters || []) {
      const cg = gradeSortKey(c.grade);
      if (cg <= 0) continue;
      if (packet === 'all') { /* 全量包：不计学段 */ }
      else if (packet === 'grade') { if (cg > lim) continue; }
      else if (stageOf(c.grade) !== packet) continue;
      out.push(buildCharacter(c));
    }
  }
  return out;
}

/** 编辑器用的空白模板 */
export function defaultPackTemplate(): XtsPack {
  return {
    format: 'xts-pack',
    version: 1,
    id: 'my_pack',
    name: '我的扩展包',
    author: '',
    desc: '',
    characters: [],
    cards: [],
    questions: {},
  };
}
