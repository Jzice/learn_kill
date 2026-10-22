/* ==================== AI 大脑：信念推断 + 博弈策略 ====================
 * 纯逻辑模块：仅依赖 state/rules/types（无动作依赖，避免 damage→ai→actions 循环导入）。
 * 模块级状态不放入 G，不随联机 state_sync 同步——AI 的「心思」不泄露给客户端。
 *
 * 设计（博弈论框架）：
 *  1. 信念推断：AI 不再上帝视角读真实身份，而是维护对每个玩家的角色信念分布（对数得分，
 *     softmax 归一化）。通过观察「谁攻击了谁 / 谁救了谁」更新信念；明置主公与阵亡公开身份
 *     直接锚定为确定值。另维护恩怨（谁攻击过我→记仇，谁救过我→感恩）参与评分（互惠性）。
 *  2. 身份动态策略：AI 知道自己的身份（合法信息），按身份采用不同混合策略——
 *     - 主公/忠臣：攻击「疑似反贼/内奸」，忠臣回避疑似主公目标，优先保护主公；
 *     - 反贼：主公（明置锚点）为首要目标，但游戏前期按隐蔽概率「佯攻忠臣」隐藏意图，
 *       随回合推进逐渐聚焦主公；
 *     - 内奸：按两阵营期望兵力「拉偏架」维持均衡（谁强打谁），残局才亮剑；
 *       「假意救主公」维持忠臣伪装（欺骗）。
 *  3. 欺骗性救援：反贼在反贼势大时以小概率假救主公；内奸按均衡需要概率性救人。
 *  4. 观望（低暴露）：无明显敌意目标时按概率按兵不动，避免无意义出手暴露阵营。
 */
import type { Player } from '../core/types';
import { G } from './state';
import { inRange } from './rules';
import { resetCounts } from './aicounts';

type RoleKey = 'lord' | 'loyal' | 'rebel' | 'spy';
/** 对某玩家身份的对数得分（log-odds 风格，可为负；softmax 归一化后为信念概率） */
type Scores = Record<RoleKey, number>;
const ROLE_KEYS: RoleKey[] = ['lord', 'loyal', 'rebel', 'spy'];
const CLAMP = 5;

/** beliefs[观察者][目标] = 身份信念得分（每个 AI 独立推断，互不共享） */
const beliefs = new Map<number, Map<number, Scores>>();
/** 恩怨：grudges[我][攻击过我的人] = 次数；favors[我][救过我的人] = 次数 */
const grudges = new Map<number, Map<number, number>>();
const favors = new Map<number, Map<number, number>>();
/** AI 出手回合计数（近似轮次：round ≈ aiTurns / 存活人数） */
let aiTurns = 0;

function blank(): Scores {
  return { lord: 0, loyal: 0, rebel: 0, spy: 0 };
}

function clampScores(s: Scores): Scores {
  for (const k of ROLE_KEYS) s[k] = Math.max(-CLAMP, Math.min(CLAMP, s[k]));
  return s;
}

/** 获取（或惰性初始化）观察者对目标的信念；明置/公开身份直接锚定 */
function ensure(o: number, t: number): Scores {
  let m = beliefs.get(o);
  if (!m) {
    m = new Map();
    beliefs.set(o, m);
  }
  let s = m.get(t);
  if (!s) {
    s = blank();
    const tp = G.players[t];
    if (tp?.roleRevealed) {
      s = blank();
      s[tp.role as RoleKey] = CLAMP;
    }
    m.set(t, s);
  }
  return s;
}

/** 观察者 o 对目标 t 的身份信念概率分布 */
export function beliefProbs(o: number, t: number): Scores {
  const tp = G.players[t];
  const out = blank();
  if (!tp) return out;
  if (tp.roleRevealed) {
    out[tp.role as RoleKey] = 1;
    return out;
  }
  const s = ensure(o, t);
  let max = -Infinity;
  for (const k of ROLE_KEYS) max = Math.max(max, s[k]);
  let sum = 0;
  for (const k of ROLE_KEYS) {
    out[k] = Math.exp(s[k] - max);
    sum += out[k];
  }
  for (const k of ROLE_KEYS) out[k] /= sum;
  return out;
}

function aliveAIs(): number[] {
  const arr: number[] = [];
  G.players.forEach((p, i) => {
    if (p.alive && p.isAI) arr.push(i);
  });
  return arr;
}

function aliveCount(): number {
  return G.players.filter((p) => p.alive).length;
}

function roundApprox(): number {
  return aiTurns / Math.max(1, aliveCount());
}

/** 近似轮次（对外暴露，供 aieval 的 softmax 温度 / 佯攻概率使用） */
export function roundOf(): number {
  return roundApprox();
}

function addGrudge(victim: number, attacker: number): void {
  let m = grudges.get(victim);
  if (!m) {
    m = new Map();
    grudges.set(victim, m);
  }
  m.set(attacker, (m.get(attacker) || 0) + 1);
}

function addFavor(saved: number, saver: number): void {
  let m = favors.get(saved);
  if (!m) {
    m = new Map();
    favors.set(saved, m);
  }
  m.set(saver, (m.get(saver) || 0) + 1);
}

export function grudgeOf(o: number, t: number): number {
  return grudges.get(o)?.get(t) || 0;
}
export function favorOf(o: number, t: number): number {
  return favors.get(o)?.get(t) || 0;
}

/** 观察者 o 视角下两阵营期望兵力（不含自己；主公明置计 1） */
function expectedCamps(o: number): { lordSide: number; rebelSide: number } {
  let lordSide = 0;
  let rebelSide = 0;
  G.players.forEach((p, j) => {
    if (j === o || !p.alive) return;
    const pr = beliefProbs(o, j);
    lordSide += pr.lord + pr.loyal;
    rebelSide += pr.rebel;
  });
  return { lordSide, rebelSide };
}

/** 事件：src 攻击了 tgt —— 所有存活 AI 观察并更新对 src 的信念；受害者记仇 */
export function noteAttack(src: number, tgt: number): void {
  if (src < 0 || src === tgt || !G.players[src] || !G.players[tgt]) return;
  addGrudge(tgt, src);
  const tgtP = G.players[tgt];
  const tgtIsLord = tgtP.roleRevealed && tgtP.role === 'lord';
  for (const o of aliveAIs()) {
    if (o === src) continue;
    const b = ensure(o, src);
    if (tgtIsLord) {
      // 敢打明置主公 → 极可能是反贼（内奸残局也可能，弱信号）
      b.rebel += 2.2;
      b.spy += 0.5;
      b.loyal -= 0.9;
      b.lord -= 1;
    } else {
      const tp = beliefProbs(o, tgt);
      if (tp.lord + tp.loyal >= 0.5) {
        // 打疑似主公方 → 疑似反贼
        b.rebel += 0.9;
        b.loyal -= 0.5;
      } else {
        // 打疑似反贼方 → 疑似忠臣（内奸拉偏架也有此行为，弱信号）
        b.loyal += 0.8;
        b.rebel -= 0.5;
        b.spy += 0.15;
      }
    }
    clampScores(b);
  }
}

/** 事件：saver 救了 saved —— 更新信念；被救者感恩 */
export function noteSave(saver: number, saved: number): void {
  if (saver < 0 || saver === saved || !G.players[saver] || !G.players[saved]) return;
  addFavor(saved, saver);
  const savedP = G.players[saved];
  const savedIsLord = savedP.roleRevealed && savedP.role === 'lord';
  for (const o of aliveAIs()) {
    if (o === saver) continue;
    const b = ensure(o, saver);
    if (savedIsLord) {
      b.loyal += 1.5;
      b.rebel -= 0.8;
    } else {
      const tp = beliefProbs(o, saved);
      if (tp.rebel + tp.spy >= 0.55) {
        b.rebel += 1.0;
        b.loyal -= 0.5;
      } else {
        b.loyal += 0.5;
      }
    }
    clampScores(b);
  }
}

/** AI 回合计数（近似轮次推进） */
export function noteAiTurn(): void {
  aiTurns++;
}

/** 新对局重置（setupPlayers 时调用） */
export function resetBrain(): void {
  beliefs.clear();
  grudges.clear();
  favors.clear();
  aiTurns = 0;
  resetCounts(); // 牌堆 / 未见牌计数缓存一并清空
}

/** 自对弈度量：本局已进行的 AI 回合数（近似局长） */
export function aiTurnsOf(): number {
  return aiTurns;
}

/**
 * 选择攻击目标（博弈式目标评分）。
 * 返回目标下标；无明显敌意目标时按概率观望返回 -1（低暴露策略）。
 */
export function pickAiTarget(idx: number): number {
  const p = G.players[idx];
  if (!p?.alive) return -1;
  const round = roundApprox();
  // 前期隐蔽意图的佯攻概率（随轮次衰减：0.4 → 0.05）
  const conceal = Math.max(0.05, 0.4 - round * 0.12);
  // 反贼佯攻：本次出手伪装成忠臣打「最不像反贼同伙」的目标（必出手，不观望）
  const feign = p.role === 'rebel' && round <= 2 && Math.random() < conceal;
  const cands: { i: number; score: number }[] = [];
  for (let i = 0; i < G.players.length; i++) {
    if (i === idx || !G.players[i].alive || !inRange(idx, i)) continue;
    const t = G.players[i];
    const g = grudgeOf(idx, i);
    const f = favorOf(idx, i);
    const P = beliefProbs(idx, i);
    let s: number;
    if (p.role === 'rebel') {
      s = feign
        ? P.loyal * 1.2 + P.spy * 0.4 - P.rebel * 0.9 + g * 0.8 - f * 0.6
        : P.lord * 1.5 + P.loyal * 0.9 - P.rebel * 1.4 + g * 0.8 - f * 0.6;
    } else if (p.role === 'spy') {
      const camps = expectedCamps(idx);
      if (aliveCount() <= 2) {
        // 残局单挑：必须出手争胜
        s = P.lord + P.loyal + P.rebel + g;
      } else if (camps.rebelSide > camps.lordSide + 0.4) {
        // 反贼势大 → 帮主公方「拉偏架」（同时维持忠臣伪装）
        s = P.rebel * 1.2 - P.loyal * 0.4 + g * 0.6 - f * 0.5;
      } else if (camps.lordSide > camps.rebelSide + 0.4) {
        // 主公方势大 → 暗助反贼侧维持均衡
        s = P.loyal * 0.9 + P.lord * 0.5 - P.rebel * 0.6 + g * 0.6 - f * 0.5;
      } else {
        // 均衡 → 打恩怨目标或最强疑似者
        s = Math.max(P.rebel, P.loyal) * 0.8 + g * 0.5 - f * 0.4;
      }
    } else {
      // 主公/忠臣：攻击疑似反贼/内奸；坚决回避疑似主公（忠臣不可误伤主公）
      s = P.rebel + P.spy + g * 0.8 - f * 0.6 - P.lord * 1.5;
    }
    // 偏好残血可击杀目标；但【白银狮子】每次受伤最多 1 点，残血反而难打穿，不再给残血加成
    s += t.equip.armor?.skill === 'baiyin' ? 0 : (4 - t.hp) * 0.12;
    cands.push({ i, score: s });
  }
  if (!cands.length) return -1;
  cands.sort((a, b) => b.score - a.score);
  const best = cands[0];
  // 佯攻必出手（隐藏意图）；否则博弈式观望：无明显敌意目标时 75% 概率按兵不动
  if (!feign && best.score < 0.25 && Math.random() > 0.25) return -1;
  return best.i;
}

/**
 * AI 施救意愿（0=不救，(0,1]=意愿强度）。
 * 基于信念与身份策略，含欺骗性救援（反贼/内奸假意救主公维持伪装）。
 */
export function aiShouldSave(hIdx: number, dIdx: number): number {
  const h = G.players[hIdx];
  const d = G.players[dIdx];
  if (!h?.alive || !d) return 0;
  if (hIdx === dIdx) return 1; // 自救（外层已处理桃）
  const P = beliefProbs(hIdx, dIdx);
  const camps = expectedCamps(hIdx);
  if (d.roleRevealed) {
    if (d.role === 'lord') {
      if (h.role === 'rebel') {
        // 欺骗：反贼势大时小概率「假意救主」骗取信任（期望兵力按信念估计）
        return camps.rebelSide >= 1.2 && Math.random() < 0.12 ? 1 : 0;
      }
      if (h.role === 'spy') {
        // 欺骗：内奸维持忠臣伪装救主，但主公方稳操胜券时不再救
        return camps.rebelSide >= 1.5 && Math.random() < 0.35 ? 1 : 0;
      }
      return 1; // 忠臣必救主公
    }
    if (d.role === 'loyal') {
      if (h.role === 'rebel') return 0;
      if (h.role === 'spy') return Math.random() < 0.3 ? 1 : 0; // 内奸按伪装需要
      return 1;
    }
    if (d.role === 'rebel') {
      if (h.role === 'rebel') return Math.random() < 0.85 ? 1 : 0; // 偶尔囤桃不救（隐蔽+资源博弈）
      if (h.role === 'spy') return Math.random() < 0.3 ? 1 : 0;
      return 0;
    }
    return 0; // 内奸濒死：无人救（除非伪装需要，概率极低忽略）
  }
  // 身份未知：按信念与阵营均衡决策
  if (h.role === 'lord' || h.role === 'loyal') {
    return P.lord + P.loyal >= 0.55 ? 0.9 : 0.15;
  }
  if (h.role === 'rebel') {
    if (P.rebel >= 0.55) return 0.85;
    if (P.lord >= 0.9 && camps.rebelSide >= 2 && Math.random() < 0.12) return 1; // 假意救主
    return 0;
  }
  // 内奸：救「弱势方」维持均衡（拉偏架的救援版）
  const dOnLordSide = P.lord + P.loyal;
  if (dOnLordSide >= 0.5) return camps.lordSide <= camps.rebelSide ? 0.45 : 0.1;
  return camps.rebelSide <= camps.lordSide ? 0.45 : 0.1;
}

/** 答题闪避意愿：血量越低越拼命（动态决策） */
export function aiQuizRate(p: Player): number {
  if (!p) return 0.5;
  if (p.hp <= 1) return 0.85;
  if (p.hp <= 2) return 0.7;
  return 0.5;
}

/** 同阵营判定：用于无懈可击的「盟友/敌人」识别（身份公开时按主忠/反内，否则按学科阵营） */
function sameTeam(a: Player, b: Player): boolean {
  if (a.roleRevealed && b.roleRevealed) {
    const ta = a.role === 'lord' || a.role === 'loyal';
    const tb = b.role === 'lord' || b.role === 'loyal';
    return ta === tb;
  }
  return a.faction === b.faction;
}

/** 原始锦囊是否对 idx 有害（指向性锦囊看目标，AOE 对所有人有害） */
function trickHarms(sub: string, primary: number | null, idx: number): boolean {
  if (['guohe', 'shunshou', 'juedou', 'lebu', 'huogong', 'tiesuo'].includes(sub)) return primary === idx;
  if (sub === 'nanman' || sub === 'wanjian') return true;
  return false;
}

/**
 * AI 是否对当前生效的锦囊打出【无懈可击】。
 * - 尚未被无懈（countered=false）：抵消「对自己/盟友有害」的锦囊。
 * - 已被某人无懈（countered=true）：若刚刚无懈者是敌人且原始锦囊对我方有利（如桃园回血），则再无懈恢复之。
 */
export function aiShouldCounter(
  idx: number,
  srcIdx: number,
  countered: boolean,
  sub: string,
  primary: number | null,
  lastCounterer: number,
): boolean {
  const p = G.players[idx];
  if (!p?.alive || idx === srcIdx) return false;
  if (!p.hand.some((c) => c.sub === 'wuxie')) return false;
  if (!countered) return trickHarms(sub, primary, idx);
  if (lastCounterer < 0) return false;
  const lc = G.players[lastCounterer];
  if (!lc || !lc.alive) return false;
  if (sameTeam(p, lc)) return false; // 盟友已无懈，维持现状
  return sub === 'taoyuan'; // 敌人无懈了有利锦囊 → 我方恢复
}
