/* ==================== 声明式技能引擎 ====================
 * 46 名基础角色 93 个技能 + 9 个主公技 + 18 个学科主题技全部由 SkillDef 声明，
 * 由本文件统一分派：时机过滤 → 条件校验 → 次数限制 → 费用支付 → 原语执行。
 *
 * 设计约束（与项目不变式一致）：
 * - 本模块禁止顶层副作用，所有跨模块调用都发生在函数体内
 * - 所有玩家选择一律复用 choice.ts 的 waitChoice（联机 Promise 桥），不新开通道
 * - 扩展包角色（纯 SkillEffect 原语制）继续走 skillfx.ts，与引擎加法式共存
 */
import type {
  Card,
  ChoiceOption,
  DamageType,
  Player,
  SkillCond,
  SkillDef,
  SkillE,
  SkillEffect,
  SkillTiming,
} from '../core/types';
import { G } from './state';
import { FX, drawFx } from '../core/fx';
import { addLog, addPlayLog } from './log';
import { drawCards, discardCard } from './rules';
import { dealDamage, dyingPhase } from './damage';
import { waitChoice } from './choice';
import { askQuizForPlayer } from './quiz';
import { render } from '../ui/render';
import { showPlayHint } from '../ui/hint';
import { NET, scheduleSync } from '../net/network';
import { C, shuffle } from '../data/cards';
import { defOf, isPrimeNum } from '../data/skilldefs';

/* ---------------- 上下文 ---------------- */

export interface SkillCtx {
  /** 技能持有者座位号 */
  idx: number;
  /** 伤害来源 / 触发者（-1 表示无来源） */
  srcIdx?: number;
  /** 当前目标（已确定时） */
  targetIdx?: number;
  /** 本次事件相关的牌（刚使用 / 弃置 / 判定的牌） */
  card?: Card | null;
  /** 判定牌（beforeJudge 可改写） */
  judgeCard?: Card | null;
  /** 判定归属者 */
  judgeOwner?: number;
  /** 【杀】的点数（海防点数对抗） */
  shaNum?: number;
  /** 本回合已使用的锦囊张数（诗成顺序连锁） */
  trickSeq?: number;
  /** 参照花色 / 点数（秦始皇统一「与你弃牌同花色」、郦道元水经注） */
  refSuit?: string;
  refNum?: number;
  /** 拼点 / 反间展示的牌 */
  duelCard?: Card | null;
  /** 当前执行的技能定义（觉醒技替换自身等场景需要） */
  def?: SkillDef;
  /** 是否为翻转抉择：由「目标」替发动者做选择（targetChoose 中 selfDraw 归发动者） */
  chooser?: number;
}

/* ---------------- 基础工具 ---------------- */

export function numOf(c: Card | null | undefined): number {
  const n = Number(c?.num);
  return Number.isFinite(n) ? n : 0;
}
function isRed(c: Card | null | undefined): boolean {
  return !!c && (c.suit === '♥' || c.suit === '♦');
}
function isBlack(c: Card | null | undefined): boolean {
  return !!c && (c.suit === '♠' || c.suit === '♣');
}
function cardLabel(c: Card): string {
  return `【${c.name}】${c.suit}${c.num}`;
}
function aliveCount(): number {
  return G.players.filter((p) => p.alive).length;
}
function aliveIdxs(except?: number): number[] {
  return G.players.map((p, i) => ({ p, i })).filter((x) => x.p.alive && x.i !== except).map((x) => x.i);
}
function aliveWithHand(except?: number): number[] {
  return G.players.map((p, i) => ({ p, i })).filter((x) => x.p.alive && x.i !== except && x.p.hand.length > 0).map((x) => x.i);
}

/** 从牌堆顶取 n 张（自动重洗弃牌堆） */
function takeTop(n: number): Card[] {
  const out: Card[] = [];
  for (let i = 0; i < n; i++) {
    if (!G.deck.length) {
      if (!G.discard.length) break;
      G.deck = G.discard;
      G.discard = [];
      shuffle(G.deck);
    }
    const c = G.deck.pop();
    if (c) out.push(c);
  }
  return out;
}
/** 从牌堆底取 n 张 */
function takeBottom(n: number): Card[] {
  return G.deck.splice(0, Math.min(n, G.deck.length));
}
/** 放回牌堆顶：cards[0] 在最上面（最先被摸到） */
function putTop(cards: Card[]): void {
  for (let i = cards.length - 1; i >= 0; i--) G.deck.push(cards[i]);
}
/** 放回牌堆底 */
function putBottom(cards: Card[]): void {
  for (const c of cards) G.deck.unshift(c);
}
function toDiscard(cards: Card[]): void {
  for (const c of cards) G.discard.push(c);
}

function healPlayer(p: Player, n: number): void {
  const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + n);
  if (p.hp > before) FX.healGlow(G.players.indexOf(p));
}

function loseHp(p: Player, n: number): void {
  p.hp -= n;
  floatDown(p, n);
}
function floatDown(p: Player, n: number): void {
  addLog(`${p.name} 失去 ${n} 点体力`, 'dmg');
}

/** 随机取 n 张手牌到弃牌堆 */
function dumpHand(p: Player, n: number): void {
  for (let k = 0; k < n && p.hand.length > 0; k++) {
    const c = p.hand[Math.floor(Math.random() * p.hand.length)];
    discardCard(p, c);
  }
}
/** 把 from 的一张手牌交给 to */
function stealOne(from: Player, to: Player): void {
  if (!from.hand.length) return;
  const c = from.hand[Math.floor(Math.random() * from.hand.length)];
  discardCard(from, c, false);
  to.hand.push(c);
}

/* ---------------- 技能查询 ---------------- */

export function defsOf(p: Player): SkillDef[] {
  const out: SkillDef[] = [];
  for (const s of p.skills || []) {
    const d = defOf(s.id);
    if (d) out.push(d);
  }
  return out;
}

/** 该玩家在指定时机生效的技能定义 */
export function skillsOf(p: Player, t: SkillTiming): SkillDef[] {
  return defsOf(p).filter((d) => effectsAt(d, t).length > 0);
}

/** 技能在指定时机生效的效果列表（含「效果自带 at 时机」） */
export function effectsAt(d: SkillDef, t: SkillTiming): SkillE[] {
  const out: SkillE[] = [];
  for (const e of d.effects as SkillE[]) {
    if (e.at ? e.at === t : d.timing === t) out.push(e);
  }
  return out;
}

/** 发动费用是否可支付（技能 cost 与效果里的 costCard 一并统计） */
export function canPay(p: Player, d: SkillDef): boolean {
  let need = d.cost?.hand || 0;
  for (const e of d.effects) {
    if (e.kind === 'costCard') {
      need += e.n;
      if (e.require === 'sameNum' && !hasPair(p, 'num')) return false;
      if (e.require === 'sameSuit' && !hasPair(p, 'suit')) return false;
    }
  }
  return p.hand.length >= need;
}

function hasPair(p: Player, kind: 'num' | 'suit'): boolean {
  const seen = new Set<string>();
  for (const c of p.hand) {
    const k = kind === 'num' ? String(numOf(c)) : c.suit;
    if (seen.has(k)) return true;
    seen.add(k);
  }
  return false;
}

/** 使用次数是否还有剩余 */
export function limitLeft(p: Player, d: SkillDef): boolean {
  if (d.limit === 'perTurn') return (p.skillUse?.[d.id] || 0) < 1;
  if (d.limit === 'perGame') return !((p.skillGame?.[d.id] || 0) > 0);
  return true;
}

/** 记一次使用 */
function markUse(p: Player, d: SkillDef): void {
  if (d.limit === 'perTurn') {
    p.skillUse = p.skillUse || {};
    p.skillUse[d.id] = (p.skillUse[d.id] || 0) + 1;
  } else if (d.limit === 'perGame') {
    p.skillGame = p.skillGame || {};
    p.skillGame[d.id] = 1;
  }
}

export function payCost(p: Player, d: SkillDef): void {
  const n = d.cost?.hand || 0;
  for (let i = 0; i < n && p.hand.length > 0; i++) discardCard(p, p.hand[p.hand.length - 1]);
}

/* ---------------- 条件判定 ---------------- */

function condOk(p: Player, c: SkillCond | undefined, ctx: SkillCtx): boolean {
  if (!c) return true;
  const src = ctx.srcIdx != null && ctx.srcIdx >= 0 ? G.players[ctx.srcIdx] : null;
  const tgt = ctx.targetIdx != null && ctx.targetIdx >= 0 ? G.players[ctx.targetIdx] : null;
  switch (c.k) {
    case 'hpAtMost': return p.hp <= c.n;
    case 'hpLowest': {
      const alives = G.players.filter((q) => q.alive);
      return alives.length > 0 && p.hp <= Math.min(...alives.map((q) => q.hp));
    }
    case 'isHurt': return p.hp < p.maxHp;
    case 'dmgTakenAtLeast': return (p.marks?._dmg || 0) >= c.n;
    case 'srcIsLord': return !!src && src.role === 'lord';
    case 'srcHandMoreThanMe': return !!src && src.hand.length > p.hand.length;
    case 'srcHandGeMe': return !!src && src.hand.length >= p.hand.length;
    case 'srcSameSubject': return !!src && src.subject === p.subject;
    case 'srcDiffSubject': return !!src && src.subject !== p.subject;
    case 'playedThisTurnAtLeast': return (p.flags.playedCount || 0) >= c.n;
    case 'playedNothingThisTurn': return (p.flags.playedCount || 0) === 0;
    case 'noShaThisTurn': return (p.flags.shaUsed || 0) === 0;
    case 'noDamageDealtThisTurn': return !p.flags.dealtDamage;
    case 'noTrickThisTurn': return !p.flags.usedTrick;
    case 'lastCardIsTrick': return p.flags.lastCardType === 'trick';
    case 'hasNumPair': return hasPair(p, 'num');
    case 'handAtMost': return p.hand.length <= c.n;
    case 'outsideTurn': return G.current !== G.players.indexOf(p);
    case 'roleIn': return c.roles.includes(p.role);
    case 'targetHasNoEquip': return !!tgt && !tgt.equip.armor && !tgt.equip.weapon && !tgt.equip.horsePlus && !tgt.equip.horseMinus;
    case 'targetChained': return !!tgt && !!tgt.chained;
    case 'targetIsLord': return !!tgt && tgt.role === 'lord';
    case 'lastCardBlack': return isBlack(ctx.card);
    case 'lastCardRed': return isRed(ctx.card);
    case 'lastCardEven': return !!ctx.card && numOf(ctx.card) % 2 === 0;
    case 'lastCardOdd': return !!ctx.card && numOf(ctx.card) % 2 === 1;
    case 'lastCardPrime': return !!ctx.card && isPrimeNum(ctx.card.num);
    case 'lastCardNumGe': return !!ctx.card && numOf(ctx.card) >= c.n;
    case 'lastCardNumLe': return !!ctx.card && numOf(ctx.card) <= c.n;
    default: return true;
  }
}

/** 触发技是否需要玩家确认：主动型 / 限定技 / 带弃牌代价的一律询问 */
function needsAsk(d: SkillDef): boolean {
  if (d.kind === 'active' || d.kind === 'limit' || d.kind === 'lord') return true;
  return d.effects.some((e) => e.kind === 'costCard');
}

async function askUse(idx: number, d: SkillDef): Promise<boolean> {
  const p = G.players[idx];
  if (!p || !p.alive) return false;
  if (p.isAI) {
    // AI 启发式：回血类在满血时不发动，其余一律发动
    const onlyHeal = d.effects.every((e) => e.kind === 'selfHeal' || e.kind === 'targetHeal');
    if (onlyHeal && p.hp >= p.maxHp) return false;
    return true;
  }
  const ch = await waitChoice(
    idx,
    [
      { label: `发动【${d.name}】`, value: 'yes', skill: true },
      { label: '不发动', value: 'no' },
    ],
    'list',
  );
  return ch === 'yes';
}

/* ---------------- 触发派发 ---------------- */

/** 需要全场扫描的时机（改判等） */
const GLOBAL_TIMINGS: SkillTiming[] = ['beforeJudge'];

export async function fire(timing: SkillTiming, ctx: SkillCtx): Promise<void> {
  if (G.gameOver) return;
  // 伤害累计：供「忍辱负重」等觉醒技判定
  if (timing === 'onDamaged') {
    const t = G.players[ctx.idx];
    if (t) {
      t.marks = t.marks || {};
      t.marks._dmg = (t.marks._dmg || 0) + 1;
    }
  }
  const scope = GLOBAL_TIMINGS.includes(timing) ? G.players.map((_, i) => i) : [ctx.idx];
  for (const i of scope) {
    const p = G.players[i];
    if (!p || !p.alive) continue;
    for (const d of defsOf(p)) {
      const effs = effectsAt(d, timing);
      if (!effs.length) continue;
      if (!limitLeft(p, d)) continue;
      if (!condOk(p, d.cond, { ...ctx, idx: i })) continue;
      if (!canPay(p, d)) continue;
      if (needsAsk(d) && !(await askUse(i, d))) continue;
      markUse(p, d);
      addLog(`【${d.name}】${p.name} 发动`, 'hl');
      await runEffects(i, p, effs, { ...ctx, idx: i, def: d });
      if (G.gameOver) return;
    }
  }
}

/* ---------------- 主动技入口 ---------------- */

export async function invokeActive(idx: number, skillId: string): Promise<void> {
  const p = G.players[idx];
  const d = defOf(skillId);
  if (!p || !d) return;
  if (p.flags.skillUsed) {
    addLog('本回合已使用过主动技能');
    return;
  }
  if (!limitLeft(p, d)) {
    addLog(`【${d.name}】本局已使用过`, 'dmg');
    render();
    return;
  }
  if (!canPay(p, d)) {
    addLog(`${p.name} 手牌不足，【${d.name}】未发动`, 'dmg');
    render();
    return;
  }
  p.flags.skillUsed = true;
  addPlayLog(p.name, 'skill', d.name, '');
  const isLord = d.kind === 'lord';
  addLog(`${isLord ? '【主公技·' : '【'}${d.name}】${p.name} 发起挑战…`, 'hl');
  render();
  const ok = await askQuizForPlayer(p, true);
  if (!ok) {
    addLog(`${p.name} 知识不足，【${d.name}】失败`, 'dmg');
    render();
    if (NET.isHost) scheduleSync();
    return;
  }
  addLog(`📘 玩法·【${d.name}】：${d.desc}`, 'explain');
  showPlayHint('技能', d.name, d.desc);
  FX.skillWave(idx);
  payCost(p, d);
  markUse(p, d);
  await runEffects(idx, p, d.effects as SkillE[], { idx, def: d });
  render();
  if (NET.isHost) scheduleSync();
}

/* ---------------- 效果执行 ---------------- */

export async function runEffects(idx: number, p: Player, effects: SkillEffect[], ctx: SkillCtx): Promise<void> {
  const owner = ctx.idx;
  for (const raw of effects) {
    const e = raw as SkillEffect;
    if (!condOk(p, (e as SkillE & { cond?: SkillCond }).cond, ctx)) continue;
    if (!p.alive) break;
    switch (e.kind) {
      /* ---- 基础资源 ---- */
      case 'selfDraw':
        if (e.n > 0) drawCards(p, e.n);
        break;
      case 'shield':
        p.shield += e.n;
        FX.healGlow(idx);
        break;
      case 'selfHeal':
        healPlayer(p, e.n);
        break;
      case 'selfLoseHp':
        loseHp(p, e.n);
        render();
        if (p.hp <= 0 && p.alive) await dyingPhase(idx, -1);
        break;
      case 'allHeal':
        for (const q of G.players) if (q.alive && q.hp < q.maxHp) healPlayer(q, e.n);
        break;
      case 'gainKnowledge':
        p.knowledge += e.n;
        break;
      case 'spendKnowledge':
        p.knowledge = Math.max(0, p.knowledge - e.n);
        break;
      case 'targetHeal': {
        const ti = await resolveTarget(idx, ctx, false);
        if (ti < 0) break;
        const t = G.players[ti];
        if (t.hp < t.maxHp) {
          healPlayer(t, e.n);
          addLog(`${t.name} 回复 ${e.n} 点体力`, 'heal');
        } else {
          drawCards(t, e.n);
          addLog(`${t.name} 体力已满，改为摸 ${e.n} 张牌`);
        }
        break;
      }
      case 'targetDraw': {
        const ti = await resolveTarget(idx, ctx, false);
        if (ti < 0) break;
        drawCards(G.players[ti], e.n);
        break;
      }
      case 'targetDamage': {
        const ti = await resolveTarget(idx, ctx, false);
        if (ti < 0) break;
        await dealDamage(owner, ti, e.n, e.damageType || 'normal');
        break;
      }
      case 'targetLoseHp': {
        const ti = await resolveTarget(idx, ctx, false);
        if (ti < 0) break;
        await dealDamage(-1, ti, e.n);
        break;
      }
      case 'targetDiscard': {
        const ti = await resolveTarget(idx, ctx, false);
        if (ti < 0) break;
        dumpHand(G.players[ti], e.n);
        break;
      }
      case 'allDiscard':
        for (const i of aliveIdxs(idx)) dumpHand(G.players[i], e.n);
        break;
      case 'allDraw':
        for (const q of G.players) if (q.alive) drawCards(q, e.n);
        break;
      case 'gainHand': {
        const ti = await resolveTarget(idx, ctx, true);
        if (ti < 0) break;
        for (let k = 0; k < e.n; k++) stealOne(G.players[ti], p);
        break;
      }
      case 'costCard': {
        const picked = await pickCostCards(idx, e.n, e.require);
        ctx.refSuit = picked.length ? picked[picked.length - 1].suit : ctx.refSuit;
        ctx.refNum = picked.length ? numOf(picked[picked.length - 1]) : ctx.refNum;
        for (const c of picked) discardCard(p, c);
        break;
      }

      /* ---- 牌堆操控 ---- */
      case 'star': {
        const n = e.n === 'alive' ? Math.min(5, aliveCount()) : e.n;
        const cards = takeTop(n);
        if (!cards.length) break;
        addLog(`【${'观星'}】${p.name} 观看牌堆顶 ${cards.length} 张`, 'hl');
        if (p.isAI) {
          const sorted = [...cards].sort((a, b) => cardValue(b) - cardValue(a));
          putTop(sorted);
        } else {
          const { top, bottom } = await arrangeCards(idx, cards);
          putTop(top);
          putBottom(bottom);
        }
        break;
      }
      case 'starSort': {
        const cards = takeTop(e.n);
        if (!cards.length) break;
        const sorted = [...cards].sort((a, b) => (e.dir === 'asc' ? 1 : -1) * (numOf(a) - numOf(b)));
        putTop(sorted);
        addLog(`${p.name} 将牌堆顶 ${sorted.length} 张按点数${e.dir === 'asc' ? '从小到大' : '从大到小'}排列`, 'hl');
        break;
      }
      case 'deckPeek': {
        const cards = takeTop(e.n);
        if (!cards.length) break;
        addLog(`${p.name} 展示牌堆顶 ${cards.length} 张：${cards.map((c) => c.name).join('、')}`, 'hl');
        if (e.then === 'toBottomOne') {
          let pick = 0;
          if (!p.isAI) {
            const ch = await waitChoice(idx, cards.map((c, i) => ({ label: `置于牌堆底：${cardLabel(c)}`, value: i })), 'list');
            pick = Number(ch);
            if (Number.isNaN(pick) || pick < 0) pick = 0;
          }
          const chosen = cards.splice(pick, 1)[0];
          putTop(cards);
          putBottom([chosen]);
        } else {
          const want = e.then === 'pickTwo' ? 2 : 1;
          const got: Card[] = [];
          for (let k = 0; k < want && cards.length; k++) {
            let at = 0;
            if (p.isAI) {
              at = e.match === 'sameSuit' && ctx.refSuit ? Math.max(0, cards.findIndex((c) => c.suit === ctx.refSuit)) : 0;
              at = Math.max(0, cards.reduce((best, c, i) => (cardValue(c) > cardValue(cards[best]) ? i : best), 0));
            } else {
              const ch = await waitChoice(idx, cards.map((c, i) => ({ label: `获得 ${cardLabel(c)}`, value: i })), 'list');
              at = Number(ch);
              if (Number.isNaN(at) || at < 0) at = 0;
            }
            got.push(cards.splice(Math.min(at, cards.length - 1), 1)[0]);
          }
          for (const c of got) p.hand.push(c);
          toDiscard(cards);
          if (e.match === 'sameSuit' && ctx.refSuit && got.some((c) => c.suit === ctx.refSuit)) {
            drawCards(p, 1);
            addLog(`${p.name} 获得同花色牌，额外摸一张`, 'hl');
          }
        }
        break;
      }
      case 'deckBottom': {
        const cards = takeBottom(e.n).reverse(); // 牌堆底 → 靠近底部的先取，reverse 后 [0] 为最靠上
        if (!cards.length) break;
        if (e.then === 'digEquip') {
          const kept = cards.filter((c) => c.type === 'equip');
          toDiscard(cards.filter((c) => c.type !== 'equip'));
          for (const c of kept) p.hand.push(c);
          addLog(`${p.name} 从牌堆底获得 ${kept.length} 张装备牌`, 'hl');
        } else {
          addLog(`${p.name} 观看牌堆底：${cards.map((c) => cardLabel(c)).join('、')}`, 'hl');
          let at = 0;
          if (!p.isAI) {
            const ch = await waitChoice(idx, cards.map((c, i) => ({ label: `获得 ${cardLabel(c)}`, value: i })), 'list');
            at = Number(ch);
            if (Number.isNaN(at) || at < 0) at = 0;
          }
          const got = cards.splice(Math.min(at, cards.length - 1), 1)[0];
          p.hand.push(got);
          putTop(cards);
        }
        break;
      }
      case 'toDeckTop': {
        const c = await pickHandCard(idx, '置于牌堆顶');
        if (!c) break;
        discardCard(p, c, false);
        G.deck.push(c);
        ctx.card = c;
        addLog(`${p.name} 将【${c.name}】置于牌堆顶`, 'hl');
        break;
      }
      case 'peekTopDeck':
      case 'discardToTop':
        // 前者仅 UI 展示；后者在弃牌阶段由 redirectToDeckTop 处理
        break;

      /* ---- 点数 / 花色 ---- */
      case 'judgeIf': {
        const ti = await resolveTarget(idx, ctx, false);
        if (ti < 0) break;
        const jc = takeTop(1)[0] || C('判定', 'basic', 'none', '♠', 1);
        addLog(`判定：${jc.suit}${jc.num}`, 'hl');
        await FX.judge(ti, jc);
        const n = numOf(jc);
        let hit = false;
        switch (e.test) {
          case 'prime': hit = isPrimeNum(jc.num); break;
          case 'odd': hit = n % 2 === 1; break;
          case 'even': hit = n % 2 === 0; break;
          case 'ge': hit = n >= (e.n ?? 0); break;
          case 'le': hit = n <= (e.n ?? 13); break;
          case 'black': hit = isBlack(jc); break;
          case 'red': hit = isRed(jc); break;
          case 'sameNum': hit = !!ctx.card && n === numOf(ctx.card); break;
        }
        G.discard.push(jc);
        await runEffects(idx, p, hit ? e.hit : e.miss, { ...ctx, targetIdx: ti });
        break;
      }
      case 'chainJudge': {
        const got: Card[] = [];
        for (let guard = 0; guard < 12; guard++) {
          const jc = takeTop(1)[0];
          if (!jc) break;
          got.push(jc);
          addLog(`连续判定：${jc.suit}${jc.num}`, 'hl');
          await FX.judge(idx, jc);
          const even = numOf(jc) % 2 === 0;
          if (even) break;
        }
        for (const c of got) p.hand.push(c);
        addLog(`${p.name} 获得 ${got.length} 张判定牌`, 'hl');
        drawFx(idx, got.length);
        if (e.bonusAt && got.length >= e.bonusAt && e.bonus) {
          await runEffects(idx, p, e.bonus, ctx);
        }
        break;
      }
      case 'doubleJudge': {
        const first = await runJudgeFor(idx, ctx);
        const second = await runJudgeFor(idx, ctx);
        if (first && second && isRed(first) === isRed(second)) {
          addLog('两次判定颜色相同', 'hl');
          await runEffects(idx, p, e.sameColor, ctx);
        }
        break;
      }
      case 'costThenDamage': {
        const picked = await pickCostCards(idx, e.cost, undefined, 'high');
        for (const c of picked) discardCard(p, c);
        const ti = await resolveTarget(idx, ctx, false);
        if (ti < 0) break;
        let dmg = e.dmg;
        const last = picked[picked.length - 1];
        if (last && e.bonusTest) {
          const n = numOf(last);
          const pass = e.bonusTest.op === 'ge' ? n >= e.bonusTest.n : n <= e.bonusTest.n;
          if (pass) dmg += e.bonus || 0;
        }
        await dealDamage(owner, ti, dmg);
        break;
      }
      case 'drawDiscardMin': {
        drawCards(p, e.draw);
        const sorted = [...p.hand].sort((a, b) => numOf(a) - numOf(b));
        const drop = sorted.slice(0, Math.min(e.discard, p.hand.length));
        let sum = 0;
        for (const c of drop) {
          sum += numOf(c);
          discardCard(p, c);
        }
        if (e.bonusTest && drop.length === e.discard && sum <= e.bonusTest.sumAtMost && e.bonus) {
          await runEffects(idx, p, e.bonus, ctx);
        }
        break;
      }
      case 'extraDrawDiscardOdd': {
        drawCards(p, e.n);
        if (!p.hand.length) break;
        const c = await pickHandCard(idx, '弃置（奇数点数则不弃）');
        if (!c) break;
        if (numOf(c) % 2 === 1) {
          addLog(`${p.name} 弃置的牌点数为奇数，改为不弃`, 'hl');
        } else discardCard(p, c);
        break;
      }
      case 'armorPierceDamage': {
        const ti = await resolveTarget(idx, ctx, false);
        if (ti < 0) break;
        const t = G.players[ti];
        if (t.equip.armor) {
          await dealDamage(owner, ti, e.n, 'normal', true);
        } else if (e.noArmor) {
          await runEffects(idx, p, e.noArmor, { ...ctx, targetIdx: ti });
        } else {
          await dealDamage(owner, ti, e.n);
        }
        break;
      }

      /* ---- 交互与博弈 ---- */
      case 'pointDuel': {
        const ti = await resolveTarget(idx, ctx, true);
        if (ti < 0) break;
        const t = G.players[ti];
        const mc = await pickHandCard(idx, '拼点：选择一张手牌');
        if (!mc) break;
        const tc = t.hand.length ? t.hand[Math.floor(Math.random() * t.hand.length)] : null;
        addLog(`【拼点】${p.name} ${cardLabel(mc)} vs ${t.name} ${tc ? cardLabel(tc) : '（无牌）'}`, 'hl');
        discardCard(p, mc, false);
        G.discard.push(mc);
        if (tc) {
          discardCard(t, tc, false);
          G.discard.push(tc);
        }
        ctx.duelCard = tc;
        ctx.card = tc;
        const win = !tc || numOf(mc) > numOf(tc);
        addLog(win ? `${p.name} 拼点获胜` : `${p.name} 拼点失败`, win ? 'hl' : 'dmg');
        await runEffects(idx, p, win ? e.win : e.lose, { ...ctx, targetIdx: ti });
        break;
      }
      case 'quizDuel': {
        const ti = await resolveTarget(idx, ctx, false);
        if (ti < 0) break;
        const t = G.players[ti];
        const myOk = await askQuizForPlayer(p, false);
        const hisOk = await askQuizForPlayer(t, false);
        const win = myOk && !hisOk;
        addLog(win ? `${p.name} 答题对决获胜` : `${p.name} 答题对决未获胜`, win ? 'hl' : 'dmg');
        await runEffects(idx, p, win ? e.win : e.lose, { ...ctx, targetIdx: ti });
        break;
      }
      case 'guessSuit': {
        const ti = await resolveTarget(idx, ctx, false);
        if (ti < 0) break;
        const t = G.players[ti];
        let guess = '♠';
        if (!t.isAI) {
          const ch = await waitChoice(ti, [
            { label: '♠ 黑桃', value: '♠' },
            { label: '♥ 红桃', value: '♥' },
            { label: '♣ 梅花', value: '♣' },
            { label: '♦ 方片', value: '♦' },
          ], 'list');
          guess = String(ch);
        } else {
          guess = ['♠', '♥', '♣', '♦'][Math.floor(Math.random() * 4)];
        }
        const shown = await pickHandCard(idx, '反间：展示一张手牌');
        if (!shown) break;
        addLog(`【反间】${t.name} 猜 ${guess}，${p.name} 展示 ${cardLabel(shown)}`, 'hl');
        ctx.duelCard = shown;
        const hit = shown.suit === guess;
        await runEffects(idx, p, hit ? e.hit : e.miss, { ...ctx, targetIdx: ti });
        break;
      }
      case 'takeDuelCard': {
        const c = ctx.duelCard;
        if (c) p.hand.push(c);
        ctx.duelCard = null;
        break;
      }
      case 'giveDuelCard': {
        const c = ctx.duelCard;
        const ti = ctx.targetIdx;
        if (c && ti != null && ti >= 0) {
          discardCard(p, c, false);
          G.players[ti].hand.push(c);
          addLog(`${p.name} 将【${c.name}】交给 ${G.players[ti].name}`, 'hl');
        }
        ctx.duelCard = null;
        break;
      }
      case 'peekHand': {
        const ti = await resolveTarget(idx, ctx, true);
        if (ti < 0) break;
        const t = G.players[ti];
        if (e.then === 'exchange') {
          const a = await pickHandCard(idx, '交换：选择你的一张手牌');
          if (a) {
            const b = t.hand.length ? t.hand[Math.floor(Math.random() * t.hand.length)] : null;
            discardCard(p, a, false);
            t.hand.push(a);
            if (b) {
              discardCard(t, b, false);
              p.hand.push(b);
            }
            addLog(`${p.name} 与 ${t.name} 各交换一张手牌`, 'hl');
          }
        } else if (e.then === 'steal') {
          stealOne(t, p);
        } else if (e.then === 'toDeckTop') {
          const c = t.hand.length ? t.hand[Math.floor(Math.random() * t.hand.length)] : null;
          if (c) {
            discardCard(t, c, false);
            G.deck.push(c);
          }
        }
        break;
      }
      case 'exchangeHand': {
        const ti = await resolveTarget(idx, ctx, true);
        if (ti < 0) break;
        for (let k = 0; k < e.n; k++) {
          const a = await pickHandCard(idx, '交换：选择你的一张手牌');
          if (!a) break;
          const t = G.players[ti];
          const b = t.hand.length ? t.hand[Math.floor(Math.random() * t.hand.length)] : null;
          discardCard(p, a, false);
          t.hand.push(a);
          if (b) {
            discardCard(t, b, false);
            p.hand.push(b);
          }
        }
        break;
      }
      case 'stealFrom': {
        const cands = aliveWithHand(idx);
        if (!cands.length) break;
        const picked: number[] = [];
        if (p.isAI) picked.push(...cands.slice(0, e.max));
        else {
          const rest = [...cands];
          while (picked.length < e.max && rest.length) {
            const ch = await waitChoice(
              idx,
              rest.map((i) => ({ label: `夺取 ${G.players[i].name} 一张手牌`, value: i })).concat(
                picked.length ? [{ label: '结束选择', value: -1 }] : [{ label: '取消', value: -1 }],
              ),
              'target',
            );
            const v = Number(ch);
            if (v < 0) break;
            picked.push(v);
            rest.splice(rest.indexOf(v), 1);
          }
        }
        for (const i of picked) stealOne(G.players[i], p);
        break;
      }
      case 'replaceDraw': {
        // 突袭：在摸牌阶段替代常规摸牌（由 turn.ts 判断是否替代）
        await runEffects(idx, p, e.effects, ctx);
        break;
      }
      case 'multiDraw': {
        const cands = aliveIdxs(idx);
        const picked: number[] = [];
        if (p.isAI) picked.push(...cands.slice(0, e.max));
        else {
          const rest = [...cands];
          while (picked.length < e.max && rest.length) {
            const ch = await waitChoice(
              idx,
              rest.map((i) => ({ label: `令 ${G.players[i].name} 摸 ${e.n} 张牌`, value: i })).concat(
                picked.length ? [{ label: '结束选择', value: -1 }] : [{ label: '取消', value: -1 }],
              ),
              'target',
            );
            const v = Number(ch);
            if (v < 0) break;
            picked.push(v);
            rest.splice(rest.indexOf(v), 1);
          }
        }
        for (const i of picked) drawCards(G.players[i], e.n);
        break;
      }
      case 'giveHand': {
        const targets: number[] = [];
        for (let k = 0; k < e.n; k++) {
          const ti = await resolveTarget(idx, ctx, true, targets);
          if (ti < 0) break;
          const c = await pickHandCard(idx, `交给 ${G.players[ti].name} 一张手牌`);
          if (!c) break;
          discardCard(p, c, false);
          G.players[ti].hand.push(c);
          if (!targets.includes(ti)) targets.push(ti);
        }
        if (e.healIfSpread && targets.length >= e.healIfSpread) {
          healPlayer(p, 1);
          addLog(`${p.name} 广施恩惠，回复 1 点体力`, 'heal');
        }
        break;
      }
      case 'giveHandIfShan': {
        const ti = await resolveTarget(idx, ctx, true);
        if (ti < 0) break;
        const c = await pickHandCard(idx, '交给一名角色一张手牌');
        if (!c) break;
        discardCard(p, c, false);
        G.players[ti].hand.push(c);
        if (c.sub === 'shan') {
          drawCards(p, e.selfDraw);
          addLog(`${p.name} 交出【闪】，摸 ${e.selfDraw} 张牌`, 'hl');
        }
        break;
      }
      case 'revealAllPickOne': {
        const shown: { i: number; c: Card }[] = [];
        for (const i of aliveIdxs(idx)) {
          const t = G.players[i];
          if (!t.hand.length) continue;
          shown.push({ i, c: t.hand[Math.floor(Math.random() * t.hand.length)] });
        }
        if (!shown.length) break;
        addLog(`所有其他角色各展示一张手牌：${shown.map((s) => cardLabel(s.c)).join('、')}`, 'hl');
        let at = 0;
        if (!p.isAI) {
          const ch = await waitChoice(idx, shown.map((s, k) => ({ label: `获得 ${cardLabel(s.c)}`, value: k })), 'list');
          at = Number(ch);
          if (Number.isNaN(at) || at < 0) at = 0;
        }
        const pick = shown[Math.min(at, shown.length - 1)];
        discardCard(G.players[pick.i], pick.c, false);
        p.hand.push(pick.c);
        addLog(`${p.name} 获得 ${cardLabel(pick.c)}`, 'hl');
        break;
      }
      case 'showHand': {
        const c = await pickHandCard(idx, '展示一张手牌');
        if (!c) break;
        addLog(`${p.name} 展示 ${cardLabel(c)}`, 'hl');
        ctx.card = c;
        if (isBlack(c) && e.black) await runEffects(idx, p, e.black, ctx);
        else if (isRed(c) && e.red) await runEffects(idx, p, e.red, ctx);
        break;
      }
      case 'discardToHeal': {
        const n = Math.min(e.max, p.hand.length);
        const picked = await pickCostCards(idx, n, undefined, 'low');
        for (const c of picked) discardCard(p, c);
        if (!picked.length) break;
        const ti = await resolveTarget(idx, ctx, false);
        if (ti < 0) break;
        const t = G.players[ti];
        if (t.hp < t.maxHp) {
          healPlayer(t, picked.length);
          addLog(`${t.name} 回复 ${picked.length} 点体力`, 'heal');
        } else {
          healPlayer(p, picked.length);
          addLog(`${t.name} 体力已满，${p.name} 改为回复 ${picked.length} 点体力`, 'heal');
        }
        break;
      }
      case 'discardSuitMatch': {
        const ti = ctx.targetIdx;
        if (ti == null || ti < 0) break;
        const t = G.players[ti];
        const same = t.hand.filter((c) => c.suit === ctx.refSuit);
        if (same.length && !t.isAI) {
          const ch = await waitChoice(
            ti,
            same.map((c) => ({ label: `弃置 ${cardLabel(c)}`, value: c.id })).concat([{ label: '改为失去 1 点体力', value: -1 }]),
            'list',
          );
          const id = Number(ch);
          const c = same.find((x) => x.id === id);
          if (c) {
            discardCard(t, c);
            break;
          }
        } else if (same.length) {
          discardCard(t, same[0]);
          break;
        }
        await dealDamage(-1, ti, 1);
        break;
      }
      case 'targetChoose': {
        const max = e.maxTargets || 1;
        const cands = aliveIdxs(idx);
        const picked: number[] = [];
        if (p.isAI) picked.push(...cands.slice(0, max));
        else {
          const rest = [...cands];
          while (picked.length < max && rest.length) {
            const ch = await waitChoice(
              idx,
              rest.map((i) => ({ label: `指定 ${G.players[i].name}`, value: i })).concat(
                picked.length ? [{ label: '结束选择', value: -1 }] : [{ label: '取消', value: -1 }],
              ),
              'target',
            );
            const v = Number(ch);
            if (v < 0) break;
            picked.push(v);
            rest.splice(rest.indexOf(v), 1);
          }
        }
        for (const ti of picked) {
          const t = G.players[ti];
          let at = 0;
          if (t.isAI) {
            at = aiChooseOption(t, e.options, p);
          } else {
            const opts: ChoiceOption[] = e.options.map((_, k) => ({ label: optionLabel(e.options[k]), value: k }));
            const ch = await waitChoice(ti, opts, 'list');
            at = Number(ch);
            if (Number.isNaN(at) || at < 0 || at >= e.options.length) at = 0;
          }
          await runEffects(idx, p, e.options[Math.min(at, e.options.length - 1)], { ...ctx, targetIdx: ti, chooser: ti });
        }
        break;
      }
      case 'swapHp': {
        const ti = await resolveTarget(idx, ctx, false);
        if (ti < 0) break;
        const t = G.players[ti];
        const a = p.hp;
        p.hp = Math.min(p.maxHp, t.hp);
        t.hp = Math.min(t.maxHp, a);
        addLog(`${p.name} 与 ${t.name} 交换体力值（${a} ⇄ ${t.hp}）`, 'hl');
        break;
      }
      case 'turnFace': {
        p.turned = !p.turned;
        drawCards(p, e.draw);
        addLog(`${p.name} 翻面并摸 ${e.draw} 张牌`, 'hl');
        break;
      }

      /* ---- 状态与标记 ---- */
      case 'addMark': {
        const ti = await resolveTarget(idx, ctx, false);
        if (ti < 0) break;
        const t = G.players[ti];
        t.marks = t.marks || {};
        t.marks[e.mark] = (t.marks[e.mark] || 0) + e.n;
        addLog(`${t.name} 获得 ${e.n} 枚「${e.mark === 'radiation' ? '辐射' : e.mark}」标记`, 'hl');
        break;
      }
      case 'tickMark': {
        const holder = G.players[ctx.idx];
        const n = holder?.marks?.[e.mark] || 0;
        if (n > 0) {
          holder.marks![e.mark] = n - 1;
          addLog(`${holder.name} 移除 1 枚「${e.mark === 'radiation' ? '辐射' : e.mark}」，受到 ${e.damage} 点伤害`, 'dmg');
          await dealDamage(owner >= 0 ? owner : -1, ctx.idx, e.damage);
        }
        break;
      }
      case 'pledge': {
        const ti = ctx.targetIdx;
        if (ti == null || ti < 0) break;
        G.players[ti].flags.pledge = true;
        addLog(`${G.players[ti].name} 立下军令状：本回合结束时若未使用过【杀】，失去 1 点体力`, 'hl');
        break;
      }
      case 'revive': {
        const hand = [...p.hand];
        for (const c of hand) discardCard(p, c);
        p.hp = e.hp;
        drawCards(p, 1);
        addLog(`${p.name} 弃置所有手牌，体力回复至 ${e.hp}`, 'heal');
        FX.healGlow(idx);
        break;
      }
      case 'awaken': {
        p.maxHp = Math.max(1, p.maxHp - e.minusMaxHp);
        if (p.hp > p.maxHp) p.hp = p.maxHp;
        const nd = defOf(e.replaceWith);
        const srcId = ctx.def?.id;
        if (nd && srcId) {
          const i = p.skills.findIndex((s) => s.id === srcId);
          if (i >= 0) p.skills.splice(i, 1, { id: nd.id, name: nd.name, type: 'trigger', desc: nd.desc });
          addLog(`✨ ${p.name} 觉醒，体力上限 -${e.minusMaxHp}，永久获得【${nd.name}】`, 'hl');
        }
        break;
      }
      case 'immune':
      case 'noHandImmune':
      case 'cardImmune':
      case 'suitImmune':
      case 'distTrap':
      case 'trickRedirect':
      case 'shaRedirect':
      case 'reduceDamage':
      case 'replaceJudge':
      case 'shaNeedShan':
      case 'shaUnlimited':
      case 'numGuard':
      case 'reflect':
      case 'preventShaDamage':
      case 'suitCollect':
      case 'rangePlus':
      case 'distPlusToMe':
      case 'ignoreHorsePlus':
      case 'shunshouNoDist':
      case 'knowledgeGain':
      case 'nextShaBonus':
      case 'nextShaUnblockable':
      case 'convert':
      case 'extraDraw':
      case 'handLimit':
      case 'distMod':
      case 'damageMod':
        // 由聚合查询 / 专用钩子处理，不作为「执行期原语」
        break;
      case 'trickDraw': {
        const c = ctx.card;
        if (!c) break;
        if (e.blackOnly && !isBlack(c)) break;
        if (e.minSeq && (ctx.trickSeq || 0) < e.minSeq) break;
        let n = e.n;
        if (e.redExtra && isRed(c)) n += e.redExtra;
        if (e.richestExtra && ctx.targetIdx != null && ctx.targetIdx >= 0 && isRichest(ctx.targetIdx)) n += e.richestExtra;
        if (n > 0) drawCards(p, n);
        break;
      }
    }
    render();
  }
  if (NET.isHost) scheduleSync();
}

/* ---------------- 目标与手牌选择 ---------------- */

/** 解析目标：优先用 ctx.targetIdx，否则让发动者选择（AI 随机 / 真人 waitChoice） */
async function resolveTarget(idx: number, ctx: SkillCtx, needHand: boolean, exclude?: number[]): Promise<number> {
  if (ctx.targetIdx != null && ctx.targetIdx >= 0 && G.players[ctx.targetIdx]?.alive) return ctx.targetIdx;
  const p = G.players[idx];
  const cands = (needHand ? aliveWithHand(idx) : aliveIdxs(idx)).filter((i) => !exclude?.includes(i));
  if (!cands.length) return -1;
  if (p.isAI) return cands[Math.floor(Math.random() * cands.length)];
  const opts: ChoiceOption[] = cands.map((i) => ({ label: G.players[i].name, value: i }));
  opts.push({ label: '取消', value: -1 });
  const ch = await waitChoice(idx, opts, 'target');
  const v = Number(ch);
  return Number.isFinite(v) && v >= 0 ? v : -1;
}

/** 从手牌中选一张（AI 自动，真人 waitChoice） */
async function pickHandCard(idx: number, tip: string): Promise<Card | null> {
  const p = G.players[idx];
  if (!p.hand.length) return null;
  if (p.isAI) return p.hand[Math.floor(Math.random() * p.hand.length)];
  const opts: ChoiceOption[] = p.hand.map((c) => ({ label: cardLabel(c), value: c.id }));
  opts.push({ label: '取消', value: -1 });
  const ch = await waitChoice(idx, opts, 'list');
  const id = Number(ch);
  if (!Number.isFinite(id) || id < 0) return null;
  return p.hand.find((c) => c.id === id) || null;
}

/** 选 n 张费用牌（支持同点数 / 同花色要求，AI 可按点数偏好挑） */
async function pickCostCards(
  idx: number,
  n: number,
  require?: 'sameNum' | 'sameSuit',
  prefer: 'high' | 'low' = 'low',
): Promise<Card[]> {
  const p = G.players[idx];
  if (n <= 0 || p.hand.length < n) return [];
  if (p.isAI) {
    const pool = [...p.hand];
    if (require) {
      const groups = new Map<string, Card[]>();
      for (const c of pool) {
        const k = require === 'sameNum' ? String(numOf(c)) : c.suit;
        const arr = groups.get(k) || [];
        arr.push(c);
        groups.set(k, arr);
      }
      const fit = [...groups.values()].find((a) => a.length >= n);
      return fit ? fit.slice(0, n) : pool.slice(0, n);
    }
    const sorted = [...pool].sort((a, b) => (prefer === 'high' ? numOf(b) - numOf(a) : numOf(a) - numOf(b)));
    return sorted.slice(0, n);
  }
  const picked: Card[] = [];
  for (let k = 0; k < n; k++) {
    const rest = p.hand.filter((c) => !picked.some((x) => x.id === c.id));
    if (!rest.length) break;
    let opts: ChoiceOption[] = rest.map((c) => ({ label: cardLabel(c), value: c.id }));
    if (require && picked.length) {
      const ref = picked[0];
      opts = rest
        .filter((c) => (require === 'sameNum' ? numOf(c) === numOf(ref) : c.suit === ref.suit))
        .map((c) => ({ label: cardLabel(c), value: c.id }));
      if (!opts.length) opts = rest.map((c) => ({ label: cardLabel(c), value: c.id }));
    }
    opts.push({ label: '取消', value: -1 });
    const ch = await waitChoice(idx, opts, 'list');
    const id = Number(ch);
    if (!Number.isFinite(id) || id < 0) break;
    const c = rest.find((x) => x.id === id);
    if (!c) break;
    picked.push(c);
  }
  return picked;
}

/** 观星：依次挑选置顶的牌，其余置底 */
async function arrangeCards(idx: number, cards: Card[]): Promise<{ top: Card[]; bottom: Card[] }> {
  const top: Card[] = [];
  const rest = [...cards];
  while (rest.length) {
    const opts: ChoiceOption[] = rest.map((c, i) => ({ label: `置顶：${cardLabel(c)}`, value: i }));
    opts.push({ label: top.length ? `结束（其余 ${rest.length} 张置底）` : `全部置于牌堆底`, value: -1 });
    const ch = await waitChoice(idx, opts, 'list');
    const v = Number(ch);
    if (!Number.isFinite(v) || v < 0) break;
    const at = Math.min(v, rest.length - 1);
    top.push(rest.splice(at, 1)[0]);
  }
  return { top, bottom: rest };
}

/** 是否为场上手牌最多的存活角色（马克·吐温·讽刺小说判据） */
function isRichest(idx: number): boolean {
  const alive = G.players.filter((q) => q.alive);
  if (!alive.length) return false;
  const max = Math.max(...alive.map((q) => q.hand.length));
  return G.players[idx]?.hand.length === max;
}

/** 牌的朴素价值（AI 挑牌用） */
function cardValue(c: Card): number {
  if (c.sub === 'tao') return 6;
  if (c.sub === 'jiu') return 5;
  if (c.sub === 'shan') return 4;
  if (c.sub === 'sha' || c.sub === 'huo' || c.sub === 'lei') return 4;
  if (c.type === 'equip') return 3;
  if (c.sub === 'wuxie') return 3;
  return 2;
}

/** 判定一次并返回判定牌（双判定用） */
async function runJudgeFor(idx: number, ctx: SkillCtx): Promise<Card | null> {
  const ti = await resolveTarget(idx, ctx, false);
  if (ti < 0) return null;
  const jc = takeTop(1)[0] || C('判定', 'basic', 'none', '♠', 1);
  addLog(`判定：${jc.suit}${jc.num}`, 'hl');
  await FX.judge(ti, jc);
  G.discard.push(jc);
  return jc;
}

/** AI 在「令其选择」中挑选对自己代价最小的一项 */
function aiChooseOption(t: Player, options: SkillEffect[][], owner: Player): number {
  let best = 0;
  let bestCost = Infinity;
  options.forEach((opts, k) => {
    let cost = 0;
    for (const e of opts) {
      switch (e.kind) {
        case 'targetLoseHp': cost += 1.5 * e.n; break;
        case 'targetDamage': cost += 1.5 * e.n; break;
        case 'targetDiscard': cost += 1.0 * e.n * (t.hand.length ? 1 : 0.3); break;
        case 'discardSuitMatch': cost += 0.9 * e.n; break;
        case 'gainHand': cost += 0.6 * e.n; break;
        case 'selfDraw': cost += 0.35 * e.n * (owner === t ? -1 : 1); break;
        case 'selfHeal': cost += owner === t ? -1.2 * e.n : 1.0 * e.n; break;
        case 'targetHeal': cost += -1.0 * e.n; break;
        case 'pledge': cost += t.flags.shaUsed ? 0.2 : 1.1; break;
        default: break;
      }
    }
    if (cost < bestCost) {
      bestCost = cost;
      best = k;
    }
  });
  return best;
}

function optionLabel(effs: SkillEffect[]): string {
  const parts: string[] = [];
  for (const e of effs) {
    switch (e.kind) {
      case 'gainHand': parts.push(`交给对方 ${e.n} 张手牌`); break;
      case 'targetDiscard': parts.push(`弃置 ${e.n} 张手牌`); break;
      case 'targetLoseHp': parts.push(`失去 ${e.n} 点体力`); break;
      case 'targetDamage': parts.push(`受到 ${e.n} 点伤害`); break;
      case 'targetHeal': parts.push(`回复 ${e.n} 点体力`); break;
      case 'selfDraw': parts.push(`令对方摸 ${e.n} 张牌`); break;
      case 'selfHeal': parts.push(`令对方回复 ${e.n} 点体力`); break;
      case 'pledge': parts.push('立下军令状（本回合未出杀则失去1点体力）'); break;
      case 'discardSuitMatch': parts.push('弃置一张同花色手牌'); break;
      default: parts.push('执行效果');
    }
  }
  return parts.join(' + ') || '执行效果';
}

/* ==================== 聚合查询（供规则钩子调用） ==================== */

/** 手牌上限加成 */
export function handLimitBonus(p: Player): number {
  let sum = 0;
  for (const d of defsOf(p)) {
    for (const e of d.effects) {
      if (e.kind !== 'handLimit') continue;
      if (!condOk(p, e.cond, { idx: G.players.indexOf(p) })) continue;
      sum += e.n;
    }
  }
  return sum;
}
/** 距离修正（负 = 更近） */
export function distModOf(p: Player): number {
  let sum = 0;
  for (const d of defsOf(p)) for (const e of d.effects) if (e.kind === 'distMod') sum += e.delta;
  return sum;
}
/** 摸牌阶段额外摸牌 */
export function extraDrawOf(p: Player): number {
  let sum = 0;
  for (const d of defsOf(p)) for (const e of d.effects) if (e.kind === 'extraDraw') sum += e.n;
  return sum;
}
/** 出杀伤害加成 */
export function damageModOf(p: Player): number {
  let sum = 0;
  for (const d of defsOf(p)) for (const e of d.effects) if (e.kind === 'damageMod') sum += e.delta;
  return sum;
}
/** 攻击范围加成 */
export function rangeBonusOf(p: Player): number {
  let sum = 0;
  for (const d of defsOf(p)) for (const e of d.effects) if (e.kind === 'rangePlus') sum += e.n;
  return sum;
}
/** 其他角色计算与其的距离加成 */
export function distPlusToMeOf(p: Player): number {
  let sum = 0;
  for (const d of defsOf(p)) for (const e of d.effects) if (e.kind === 'distPlusToMe') sum += e.n;
  return sum;
}
/** 是否无视他人 +1 马 */
export function ignoreHorsePlus(p: Player): boolean {
  return defsOf(p).some((d) => d.effects.some((e) => e.kind === 'ignoreHorsePlus'));
}
/** 顺手牵羊是否无距离限制 */
export function shunshouNoDist(p: Player): boolean {
  return defsOf(p).some((d) => d.effects.some((e) => e.kind === 'shunshouNoDist'));
}
/** 预知牌堆顶张数（UI） */
export function peekTopDeckOf(p: Player): number {
  let n = 0;
  for (const d of defsOf(p)) for (const e of d.effects) if (e.kind === 'peekTopDeck') n = Math.max(n, e.n);
  return n;
}
/** 属性伤害减伤 */
export function reduceDamageOf(p: Player, type: DamageType): number {
  let n = 0;
  for (const d of defsOf(p))
    for (const e of d.effects) if (e.kind === 'reduceDamage' && e.types.includes(type)) n += e.n;
  return n;
}
/** 学识经济加成（居里夫人·镭元素） */
export function knowledgeBonusOf(p: Player): number {
  let n = 0;
  for (const d of defsOf(p)) for (const e of d.effects) if (e.kind === 'knowledgeGain') n += e.n;
  return n;
}
/** 免疫：不能成为某类牌的目标 */
export function canBeTarget(
  tgtIdx: number,
  scope: 'trick' | 'sha' | 'juedou' | 'equip',
  cardName?: string,
  cardSuit?: string,
): boolean {
  const p = G.players[tgtIdx];
  if (!p) return true;
  for (const d of defsOf(p)) {
    for (const e of d.effects) {
      if (e.kind === 'immune') {
        if (e.scope === 'trick' && scope === 'trick') return false;
        if (e.scope === 'equip' && scope === 'equip') return false;
        if (e.scope === 'shaAndJuedou' && (scope === 'sha' || scope === 'juedou')) return false;
      }
      if (e.kind === 'noHandImmune' && p.hand.length === 0 && (scope === 'sha' || scope === 'juedou')) return false;
      // 指定牌名免疫（东风 / 避雷 / 非攻）
      if (e.kind === 'cardImmune' && cardName && e.names.includes(cardName)) return false;
      // 指定花色免疫
      if (e.kind === 'suitImmune' && cardSuit && e.suits.includes(cardSuit as '♠')) return false;
    }
  }
  return true;
}
/** 是否对某张具体牌名免疫（UI 提示 / AOE 目标过滤） */
export function cardImmuneTo(p: Player, cardName: string): boolean {
  return defsOf(p).some((d) => d.effects.some((e) => e.kind === 'cardImmune' && e.names.includes(cardName)));
}
/** 是否对某个花色免疫 */
export function suitImmuneTo(p: Player, suit: string): boolean {
  return defsOf(p).some((d) => d.effects.some((e) => e.kind === 'suitImmune' && (e.suits as string[]).includes(suit)));
}
/** 距离陷阱：返回最小安全距离（0 = 无陷阱） */
export function distTrapOf(p: Player): number {
  let n = 0;
  for (const d of defsOf(p)) for (const e of d.effects) if (e.kind === 'distTrap') n = Math.max(n, e.min);
  return n;
}
/** 可否转移锦囊目标（墨子·兼爱） */
export function trickRedirectOf(p: Player): boolean {
  return defsOf(p).some((d) => d.effects.some((e) => e.kind === 'trickRedirect'));
}
/** 可否转移【杀】的目标（卢瑟福·散射） */
export function shaRedirectOf(p: Player): boolean {
  return defsOf(p).some((d) => d.effects.some((e) => e.kind === 'shaRedirect'));
}
/** 无双：抵消一张【杀】所需的【闪】数量 */
export function shanNeeded(attackerIdx: number): number {
  const a = G.players[attackerIdx];
  if (!a) return 1;
  for (const d of defsOf(a))
    for (const e of d.effects)
      if (e.kind === 'shaNeedShan' && (!e.perTurnFirst || (a.flags.shaUsed || 0) === 0)) return e.n;
  return 1;
}
/** 咆哮：本回合出【杀】上限返回 -1 表示武器无限；否则返回张数上限 */
export function shaLimitOf(p: Player): number {
  let limit = 1;
  for (const d of defsOf(p)) for (const e of d.effects) if (e.kind === 'shaUnlimited') limit += e.maxExtra;
  return limit;
}
/** 咆哮：本次额外出杀需弃置的手牌数 */
export function shaExtraCost(p: Player): number {
  if ((p.flags.shaUsed || 0) < 1) return 0;
  for (const d of defsOf(p)) for (const e of d.effects) if (e.kind === 'shaUnlimited') return e.extraCostHand;
  return 0;
}
/** 被【杀】命中后的反伤数值（卢瑟福·散射实验） */
export function reflectOf(p: Player): number {
  for (const d of defsOf(p))
    for (const e of d.effects) if (e.kind === 'reflect' && e.when === 'hurtBySha') return e.n;
  return 0;
}

/* ==================== 转化技 ==================== */

/** 该手牌当前可否当目标牌使用 */
export function canConvertAs(p: Player, card: Card, to: string, outsideTurn: boolean): boolean {
  for (const d of defsOf(p)) {
    for (const e of d.effects) {
      if (e.kind !== 'convert' || e.to !== to) continue;
      if (e.outsideTurn && !outsideTurn) continue;
      if (!outsideTurn && e.outsideTurn) continue;
      if (e.limit === 'perTurn' && (p.skillUse?.[d.id] || 0) >= 1) continue;
      const f = e.from;
      if (f.color === 'red' && !isRed(card)) continue;
      if (f.color === 'black' && !isBlack(card)) continue;
      if (f.suit && card.suit !== f.suit) continue;
      if (f.type && card.type !== f.type) continue;
      if (f.sub && card.sub !== f.sub) continue;
      if (f.maxNum != null && numOf(card) > f.maxNum) continue;
      if (f.minNum != null && numOf(card) < f.minNum) continue;
      return true;
    }
  }
  return false;
}
/** 记一次转化技使用（每回合限一次的转化技） */
export function markConvertUse(p: Player, card: Card, to: string, outsideTurn: boolean): void {
  for (const d of defsOf(p)) {
    for (const e of d.effects) {
      if (e.kind !== 'convert' || e.to !== to) continue;
      if (e.outsideTurn && !outsideTurn) continue;
      if (!outsideTurn && e.outsideTurn) continue;
      const f = e.from;
      if (f.color === 'red' && !isRed(card)) continue;
      if (f.color === 'black' && !isBlack(card)) continue;
      if (f.suit && card.suit !== f.suit) continue;
      if (f.type && card.type !== f.type) continue;
      if (f.sub && card.sub !== f.sub) continue;
      if (f.maxNum != null && numOf(card) > f.maxNum) continue;
      if (f.minNum != null && numOf(card) < f.minNum) continue;
      if (e.limit === 'perTurn') {
        p.skillUse = p.skillUse || {};
        p.skillUse[d.id] = (p.skillUse[d.id] || 0) + 1;
        addLog(`【${d.name}】${p.name} 将 ${cardLabel(card)} 当作【${toName(to)}】使用`, 'hl');
      }
      return;
    }
  }
}
function toName(to: string): string {
  return to === 'sha' ? '杀' : to === 'shan' ? '闪' : to === 'tao' ? '桃' : to === 'jiu' ? '酒' : '过河拆桥';
}
/** 转化后的伤害属性（火杀等） */
export function convertDamageType(p: Player, card: Card, to: string, outsideTurn: boolean): DamageType | undefined {
  for (const d of defsOf(p))
    for (const e of d.effects) {
      if (e.kind !== 'convert' || e.to !== to) continue;
      if (e.outsideTurn !== undefined && e.outsideTurn !== outsideTurn) continue;
      const f = e.from;
      if (f.color === 'red' && !isRed(card)) continue;
      if (f.color === 'black' && !isBlack(card)) continue;
      if (f.sub && card.sub !== f.sub) continue;
      if (f.maxNum != null && numOf(card) > f.maxNum) continue;
      if (f.minNum != null && numOf(card) < f.minNum) continue;
      return e.damageType;
    }
  return undefined;
}

/* ==================== 专属钩子 ==================== */

/** 海防式点数对抗：成为【杀】目标时展示手牌，点数 ≥ 杀点数则该杀无效 */
export async function tryNumGuard(targetIdx: number, shaNum: number): Promise<boolean> {
  const p = G.players[targetIdx];
  if (!p || !p.alive || !p.hand.length) return false;
  for (const d of defsOf(p)) {
    for (const e of d.effects) {
      if (e.kind !== 'numGuard') continue;
      if (!limitLeft(p, d)) continue;
      let use = true;
      if (!p.isAI) {
        const ch = await waitChoice(
          targetIdx,
          [
            { label: `【${d.name}】展示一张手牌，点数 ≥ ${shaNum} 则此杀无效`, value: 'yes', skill: true },
            { label: '不发动', value: 'no' },
          ],
          'list',
        );
        use = ch === 'yes';
      }
      if (!use) continue;
      const shown = await pickHandCard(targetIdx, '展示一张手牌');
      if (!shown) continue;
      markUse(p, d);
      addLog(`【${d.name}】${p.name} 展示 ${cardLabel(shown)}（杀点数 ${shaNum}）`, 'hl');
      const ok = e.op === 'ge' ? numOf(shown) >= shaNum : numOf(shown) <= shaNum;
      if (ok) {
        addLog('点数对抗成功，此【杀】无效', 'hl');
        return true;
      }
      addLog('点数对抗失败', 'dmg');
    }
  }
  return false;
}

/** 改判：判定牌生效前用手牌替换（笛卡尔 / 张衡） */
export async function tryReplaceJudge(judgeOwner: number, judgeCard: Card): Promise<Card> {
  for (const i of G.players.map((_, k) => k)) {
    const p = G.players[i];
    if (!p || !p.alive || !p.hand.length) continue;
    for (const d of defsOf(p)) {
      const has = d.effects.some((e) => e.kind === 'replaceJudge');
      if (!has) continue;
      if (!limitLeft(p, d)) continue;
      let use = true;
      if (!p.isAI) {
        const ch = await waitChoice(
          i,
          [
            { label: `【${d.name}】打出一张手牌替换判定牌`, value: 'yes', skill: true },
            { label: '不发动', value: 'no' },
          ],
          'list',
        );
        use = ch === 'yes';
      }
      if (!use) continue;
      const c = await pickHandCard(i, '替换判定牌');
      if (!c) continue;
      markUse(p, d);
      discardCard(p, c, false);
      G.discard.push(judgeCard);
      addLog(`【${d.name}】${p.name} 用 ${cardLabel(c)} 替换判定牌`, 'hl');
      return c;
    }
  }
  return judgeCard;
}

/** 兼爱：用【杀】造成伤害时可防止伤害改为令目标摸牌 */
export async function tryPreventShaDamage(srcIdx: number, tgtIdx: number): Promise<boolean> {
  const p = G.players[srcIdx];
  if (!p || !p.alive) return false;
  for (const d of defsOf(p)) {
    for (const e of d.effects) {
      if (e.kind !== 'preventShaDamage') continue;
      if (!limitLeft(p, d)) continue;
      if (d.cond && !condOk(p, d.cond, { idx: srcIdx, targetIdx: tgtIdx })) continue;
      let use = true;
      if (!p.isAI) {
        const ch = await waitChoice(
          srcIdx,
          [
            { label: `【${d.name}】防止此伤害，令目标摸一张牌`, value: 'yes', skill: true },
            { label: '正常造成伤害', value: 'no' },
          ],
          'list',
        );
        use = ch === 'yes';
      }
      if (!use) continue;
      markUse(p, d);
      addLog(`【${d.name}】${p.name} 防止了此伤害`, 'hl');
      await runEffects(srcIdx, p, e.then, { idx: srcIdx, targetIdx: tgtIdx });
      return true;
    }
  }
  return false;
}

/** 花色收集连锁：本回合用过 n 种花色则触发（门捷列夫·元素） */
export async function checkSuitCollect(idx: number): Promise<void> {
  const p = G.players[idx];
  if (!p || !p.alive) return;
  const suits = new Set(p.turnSuits || []);
  for (const d of defsOf(p)) {
    for (const e of d.effects) {
      if (e.kind !== 'suitCollect') continue;
      if (suits.size < e.n) continue;
      if (!limitLeft(p, d)) continue;
      markUse(p, d);
      addLog(`【${d.name}】${p.name} 本回合已使用 ${suits.size} 种花色`, 'hl');
      await runEffects(idx, p, e.reward, { idx });
    }
  }
}

/** 军令状结算：回合结束未使用过【杀】则失去 1 点体力 */
export async function resolvePledge(idx: number): Promise<void> {
  const p = G.players[idx];
  if (!p || !p.alive || !p.flags.pledge) return;
  p.flags.pledge = false;
  if ((p.flags.shaUsed || 0) > 0) {
    addLog(`${p.name} 本回合使用过【杀】，军令状解除`, 'hl');
    return;
  }
  addLog(`【军令状】${p.name} 本回合未使用过【杀】，失去 1 点体力`, 'dmg');
  await dealDamage(-1, idx, 1);
}

/** 辐射标记结算：回合开始移除 1 枚并受伤（标记由施加者持有 tickMark 原语） */
export async function resolveMarks(idx: number): Promise<void> {
  const p = G.players[idx];
  if (!p || !p.alive || !p.marks) return;
  for (let j = 0; j < G.players.length; j++) {
    const src = G.players[j];
    if (!src || !src.alive) continue;
    for (const d of defsOf(src)) {
      for (const e of d.effects) {
        if (e.kind !== 'tickMark') continue;
        if ((p.marks[e.mark] || 0) <= 0) continue;
        await runEffects(j, src, [e], { idx, def: d });
      }
    }
  }
}

/** 弃牌阶段：满足条件的弃牌改为置于牌堆顶（缀术 / 低温提取） */
export function redirectToDeckTop(p: Player, c: Card): boolean {
  for (const d of defsOf(p)) {
    for (const e of d.effects) {
      if (e.kind !== 'discardToTop') continue;
      if (!limitLeft(p, d)) continue;
      const ok =
        e.pick === 'prime'
          ? isPrimeNum(c.num)
          : p.hand.every((x) => numOf(x) >= numOf(c));
      if (!ok) continue;
      markUse(p, d);
      const i = p.hand.findIndex((x) => x.id === c.id);
      if (i >= 0) p.hand.splice(i, 1);
      G.deck.push(c);
      addLog(`【${d.name}】${p.name} 将【${c.name}】置于牌堆顶`, 'hl');
      return true;
    }
  }
  return false;
}

/** 回合初重置：每回合技能计数 / 花色收集 / 出牌统计 */
export function resetTurnState(p: Player): void {
  p.skillUse = {};
  p.turnSuits = [];
  p.flags.playedCount = 0;
  p.flags.dealtDamage = false;
  p.flags.usedTrick = false;
  p.flags.trickCount = 0;
  p.flags.lastCardType = null;
}

/** 记录一次出牌（顺序连锁 / 花色收集 / 军令状判据） */
export async function noteCardPlayed(idx: number, card: Card): Promise<void> {
  const p = G.players[idx];
  if (!p) return;
  p.flags.playedCount = (p.flags.playedCount || 0) + 1;
  p.flags.lastCardType = card.type;
  if (card.type === 'trick') {
    p.flags.usedTrick = true;
    p.flags.trickCount = (p.flags.trickCount || 0) + 1;
  }
  p.turnSuits = p.turnSuits || [];
  if (!p.turnSuits.includes(card.suit)) p.turnSuits.push(card.suit);
  await checkSuitCollect(idx);
}

/** 濒死自救（李时珍·行医）：返回是否已自救成功 */
export async function tryRevive(idx: number): Promise<boolean> {
  const p = G.players[idx];
  if (!p || !p.alive) return false;
  for (const d of defsOf(p)) {
    for (const e of d.effects) {
      if (e.kind !== 'revive' || d.timing !== 'onDying') continue;
      if (!limitLeft(p, d)) continue;
      let use = true;
      if (!p.isAI) {
        const ch = await waitChoice(
          idx,
          [
            { label: `【${d.name}】弃置所有手牌，体力回复至 ${e.hp} 并摸一张牌`, value: 'yes', skill: true },
            { label: '不发动', value: 'no' },
          ],
          'list',
        );
        use = ch === 'yes';
      }
      if (!use) continue;
      markUse(p, d);
      addLog(`【${d.name}】${p.name} 弃置所有手牌，体力回复至 ${e.hp}`, 'heal');
      await runEffects(idx, p, [e], { idx, def: d });
      return true;
    }
  }
  return false;
}

/** 突袭（孙子·兵法）：摸牌阶段改为夺取他人手牌，返回是否已替代常规摸牌 */
export async function tryReplaceDraw(idx: number): Promise<boolean> {
  const p = G.players[idx];
  if (!p || !p.alive) return false;
  for (const d of defsOf(p)) {
    for (const e of d.effects) {
      if (e.kind !== 'replaceDraw') continue;
      if (!limitLeft(p, d)) continue;
      const cands = aliveWithHand(idx);
      if (!cands.length) continue;
      let use = true;
      if (!p.isAI) {
        const ch = await waitChoice(
          idx,
          [
            { label: `【${d.name}】改为获得至多两名其他角色的各一张手牌`, value: 'yes', skill: true },
            { label: '常规摸牌', value: 'no' },
          ],
          'list',
        );
        use = ch === 'yes';
      }
      if (!use) continue;
      markUse(p, d);
      addLog(`【${d.name}】${p.name} 放弃摸牌，改为夺取他人手牌`, 'hl');
      await runEffects(idx, p, e.effects, { idx, def: d });
      return true;
    }
  }
  return false;
}

/** 反伤（卢瑟福·散射实验）：被【杀】命中后反击 */
export async function tryReflect(srcIdx: number, tgtIdx: number): Promise<void> {
  const t = G.players[tgtIdx];
  const a = G.players[srcIdx];
  if (!t || !a || !t.alive || !a.alive) return;
  const n = reflectOf(t);
  if (n <= 0) return;
  for (const d of defsOf(t)) {
    for (const e of d.effects) {
      if (e.kind !== 'reflect' || e.when !== 'hurtBySha') continue;
      if (!limitLeft(t, d)) continue;
      let use = true;
      if (!t.isAI) {
        const ch = await waitChoice(
          tgtIdx,
          [
            { label: `【${d.name}】对 ${a.name} 造成 ${e.n} 点伤害`, value: 'yes', skill: true },
            { label: '不发动', value: 'no' },
          ],
          'list',
        );
        use = ch === 'yes';
      }
      if (!use) continue;
      markUse(t, d);
      addLog(`【${d.name}】${t.name} 反弹 ${e.n} 点伤害`, 'hl');
      await dealDamage(tgtIdx, srcIdx, e.n);
      return;
    }
  }
}

/** 是否有【装备】类免疫（凯库勒·结构式） */
export function equipImmune(p: Player): boolean {
  return defsOf(p).some((d) => d.effects.some((e) => e.kind === 'immune' && e.scope === 'equip'));
}


