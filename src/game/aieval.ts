/* ==================== AI 期望收益（EV）评估层 ====================
 * 博弈论定位：把「手写线性打分」升级为「以信念为权重的期望效用」，并把牌堆 / 手牌的
 * 随机性显式建模为**机会节点**（chance node）展开一层：
 *
 *   EV(a) = Σ_k p_k · ΔU(s → s'_k)
 *
 * 其中 ΔU 由局面效用函数 U(s, i) 给出，p_k 由 aicounts 的未见牌分布给出。
 *
 * 依赖方向（严格单向，不产生新循环）：
 *   ai.ts / turn.ts / actions.ts → aieval → aibrain → state / rules
 * aieval 绝不反向导入 ai.ts（否则形成 ai ↔ aieval 循环）。
 */
import type { Card, Player, Role } from '../core/types';
import { G } from './state';
import { attackRange, inRange } from './rules';
import { ROLE_CONFIG } from '../data/characters';
import { beliefProbs, favorOf, grudgeOf, pickAiTarget as legacyPickAiTarget, roundOf } from './aibrain';
import { binomCdf, countSub, pAtLeastOne, pUnseen } from './aicounts';
import { AIPOLICY } from './aipolicy';
import { SHA_SUBS } from '../data/cards';

/* ---------------- 局面效用 U(s, i) ---------------- */

/** 某座位的「战力」：血量为主，手牌 / 装备 / 可发动技能为辅 */
export function powerOf(j: number): number {
  const p = G.players[j];
  if (!p || !p.alive) return 0;
  let eq = 0;
  if (p.equip.weapon) eq++;
  if (p.equip.armor) eq++;
  if (p.equip.horsePlus) eq++;
  if (p.equip.horseMinus) eq++;
  if (p.equip.treasure) eq++;
  const active = p.skills.some((s) => s.type === 'active' && !p.flags.skillUsed);
  return (
    p.hp +
    0.15 * p.maxHp +
    AIPOLICY.wHand * p.hand.length +
    AIPOLICY.wEquip * eq +
    (active ? AIPOLICY.wSkill : 0) +
    0.5 * (p.shield || 0)
  );
}

type RoleKey = 'lord' | 'loyal' | 'rebel' | 'spy';

/**
 * 剩余身份构成（扣除自己与已揭示者）——这是**所有人都知道的公共信息**。
 * 例如 5 人局为 主1/忠1/反2/内1：主公视角下任一未知角色的先验应是
 * 忠 0.25 / 反 0.5 / 内 0.25，而不是四项各 0.25。
 */
function rolePrior(o: number): Record<RoleKey, number> {
  const cfg = (ROLE_CONFIG[G.players.length] || ROLE_CONFIG[4]) as Role[];
  const c: Record<RoleKey, number> = { lord: 0, loyal: 0, rebel: 0, spy: 0 };
  for (const r of cfg) c[r] = (c[r] || 0) + 1;
  const me = G.players[o];
  if (me) c[me.role as RoleKey] = Math.max(0, c[me.role as RoleKey] - 1);
  for (let j = 0; j < G.players.length; j++) {
    if (j === o) continue;
    const p = G.players[j];
    if (p.roleRevealed) c[p.role as RoleKey] = Math.max(0, c[p.role as RoleKey] - 1);
  }
  return c;
}

/**
 * 信念 × 先验：把 aibrain 的均匀先验修正为「按剩余身份构成加权」的合法先验。
 * 已揭示身份直接返回确定分布，不再叠加先验。
 */
export function beliefWithPrior(o: number, t: number): Record<RoleKey, number> {
  const P = beliefProbs(o, t);
  if (G.players[t]?.roleRevealed) return P;
  const c = rolePrior(o);
  const tot = c.lord + c.loyal + c.rebel + c.spy;
  if (tot <= 0) return P;
  const w: Record<RoleKey, number> = {
    lord: P.lord * c.lord,
    loyal: P.loyal * c.loyal,
    rebel: P.rebel * c.rebel,
    spy: P.spy * c.spy,
  };
  const s = w.lord + w.loyal + w.rebel + w.spy;
  if (s <= 0) return { lord: c.lord / tot, loyal: c.loyal / tot, rebel: c.rebel / tot, spy: c.spy / tot };
  return { lord: w.lord / s, loyal: w.loyal / s, rebel: w.rebel / s, spy: w.spy / s };
}

/** j 对 i 而言是「敌人」的信念概率 */
export function enemyProb(i: number, j: number): number {
  const P = beliefWithPrior(i, j);
  switch (G.players[i]?.role) {
    case 'rebel':
      return P.lord + P.loyal;
    case 'spy':
      return 0; // 内奸由「阵营失衡」项统一处理，不设固定敌人
    default:
      return P.rebel + P.spy * 0.6;
  }
}

/** j 对 i 而言是「盟友」的信念概率 */
export function allyProb(i: number, j: number): number {
  const P = beliefWithPrior(i, j);
  switch (G.players[i]?.role) {
    case 'rebel':
      return P.rebel + P.spy * 0.3;
    case 'spy':
      return 0;
    default:
      return P.lord + P.loyal;
  }
}

/** 阵营亲疏系数 ∈ [−1, 1]：正=盟友，负=敌人 */
export function affinity(i: number, j: number): number {
  const a = allyProb(i, j) - enemyProb(i, j);
  return Math.max(-1, Math.min(1, a));
}

/** 双方阵营的期望战力（i 视角，不含 i 自己） */
export function campPowers(i: number): { lordSide: number; rebelSide: number } {
  let lordSide = 0;
  let rebelSide = 0;
  for (let j = 0; j < G.players.length; j++) {
    if (j === i || !G.players[j].alive) continue;
    const P = beliefWithPrior(i, j);
    const pw = powerOf(j);
    lordSide += (P.lord + P.loyal) * pw;
    rebelSide += P.rebel * pw;
  }
  return { lordSide, rebelSide };
}

/**
 * 内奸专用：把 j 的战力削去 1 点所带来的「阵营失衡改善量」（>0 表示更均衡）。
 * 这正是内奸的边际效用 —— 谁强削谁，残局自动退化为「削弱唯一的对手」。
 */
export function balanceGain(i: number, j: number): number {
  const { lordSide, rebelSide } = campPowers(i);
  const P = beliefWithPrior(i, j);
  const d = lordSide - rebelSide;
  const nd = d - (P.lord + P.loyal) + P.rebel;
  return Math.abs(d) - Math.abs(nd);
}

/** 局面效用 U(s, i) */
export function utilityFor(i: number): number {
  const me = G.players[i];
  if (!me) return 0;
  if (me.role === 'spy') {
    const { lordSide, rebelSide } = campPowers(i);
    return AIPOLICY.wSelf * powerOf(i) - AIPOLICY.spyBeta * Math.abs(lordSide - rebelSide);
  }
  let u = AIPOLICY.wSelf * powerOf(i);
  for (let j = 0; j < G.players.length; j++) {
    if (j === i || !G.players[j].alive) continue;
    u += affinity(i, j) * powerOf(j);
  }
  return u;
}

/** 对 t 造成 1 点伤害对 i 的效用增量（内奸走平衡项） */
export function damageGain(i: number, t: number, dmg = 1): number {
  const me = G.players[i];
  if (!me) return 0;
  if (me.role === 'spy') return balanceGain(i, t) * dmg * 2;
  return -affinity(i, t) * dmg;
}

/** 击杀额外收益（移除一个敌人的战略价值 > 1 点伤害） */
function killBonus(i: number, t: number, dmg: number): number {
  const tp = G.players[t];
  if (!tp || !tp.alive) return 0;
  const lethal = dmg >= tp.hp;
  if (!lethal) return 0;
  return enemyProb(i, t) * 1.2;
}

/* ---------------- 威胁度（多人博弈的集火依据） ---------------- */

/** j 每回合的期望输出能力 */
function outputOf(j: number): number {
  const p = G.players[j];
  if (!p || !p.alive) return 0;
  const range = attackRange(p);
  const liannu = p.equip.weapon?.skill === 'liannu' ? 1.0 : 0;
  // 扩展卡包武器：命中后的追加收益（弃坐骑 / 封花色 / 令弃牌 / 追加伤害 / 转火杀）
  const wskill = p.equip.weapon?.skill;
  const extraWeapon =
    wskill === 'qilin' ? 0.25 : wskill === 'yinyue' ? 0.3 : wskill === 'qixing' ? 0.25 : wskill === 'wuliu' ? 0.35 : wskill === 'zhuque' ? 0.15 : 0;
  const active = p.skills.some((s) => s.type === 'active' && !p.flags.skillUsed) ? 0.4 : 0;
  return 1 + (range - 1) * 0.25 + liannu + extraWeapon + Math.min(p.hand.length, 8) * 0.12 + active;
}

/** j 的威胁度：能打到多少人 × 输出能力 */
export function threatOf(j: number): number {
  let reach = 0;
  for (let k = 0; k < G.players.length; k++) {
    if (k === j || !G.players[k].alive) continue;
    if (inRange(j, k)) reach++;
  }
  return outputOf(j) * (0.5 + 0.25 * reach);
}

/* ---------------- 机会节点：各动作的 EV ---------------- */

/** 目标闪避一次【杀】的概率（含八卦阵判定、藤甲免疫等修正） */
export function dodgeProb(i: number, t: number, elemental: boolean): number {
  const tp = G.players[t];
  if (!tp) return 1;
  // 藤甲：普通杀无效（引擎层面直接免伤），视为必被「挡下」
  if (!elemental && tp.equip.armor?.skill === 'tengjia') return 1;
  let pNoDodge = 1 - pAtLeastOne(i, t, 'shan');
  if (tp.equip.armor?.skill === 'bagua') pNoDodge *= 1 - AIPOLICY.baguaRate;
  return Math.max(0, Math.min(1, 1 - pNoDodge));
}

/** 出【杀】的 EV */
export function evSha(i: number, t: number, dmg = 1, elemental = false): number {
  const tp = G.players[t];
  if (!tp || !tp.alive) return -99;
  const pHit = 1 - dodgeProb(i, t, elemental);
  // 【明光铠】减伤 1（最低 1 点）；【白银狮子】每次受伤最多 1 点
  let eff = dmg;
  const armor = tp.equip.armor?.skill;
  if (armor === 'mingguang') eff = Math.max(1, dmg - 1);
  else if (armor === 'baiyin') eff = Math.min(1, dmg);
  let gain = damageGain(i, t, eff) + killBonus(i, t, eff);
  // 连环传导：属性杀命中横置目标 → 传导给其余横置角色
  if (elemental && tp.chained) {
    for (let k = 0; k < G.players.length; k++) {
      if (k === i || k === t || !G.players[k].alive || !G.players[k].chained) continue;
      gain += damageGain(i, k, dmg) * 0.8;
    }
  }
  return pHit * gain - AIPOLICY.exposureW;
}

/** 决斗 EV：闭式子博弈解。目标先出杀、双方轮流，先出不起者受伤。
 *  K ~ Bin(n, q) 为对方手牌中的杀数；我方能出 A 张 → 我方胜 ⇔ K ≤ A。 */
export function evDuel(i: number, t: number): number {
  const me = G.players[i];
  const tp = G.players[t];
  if (!me || !tp || !tp.alive) return -99;
  const A = countSub(i, SHA_SUBS);
  const n = tp.hand.length;
  const q = pUnseen(i, SHA_SUBS);
  const pWin = binomCdf(A, n, q);
  const gain = damageGain(i, t, 1) + killBonus(i, t, 1);
  // 我方失手的代价：残血时近乎致命
  const loss = AIPOLICY.wSelf * (me.hp <= 1 ? 5 : 1);
  return pWin * gain - (1 - pWin) * loss;
}

/** 火攻 EV：目标展示一张手牌，我方需弃置同花色牌才能造成 1 点火焰伤害 */
export function evHuogong(i: number, t: number): number {
  const me = G.players[i];
  const tp = G.players[t];
  if (!me || !tp || !tp.alive || !tp.hand.length) return -99;
  const suits = ['♠', '♥', '♣', '♦'];
  const have: Record<string, boolean> = {};
  for (const c of me.hand) have[c.suit] = true;
  // 目标展示牌的花色按未见池的花色分布估计（忽略则退化为均分）
  let pSucc = 0;
  let tot = 0;
  const per: Record<string, number> = {};
  for (const s of suits) {
    const n = unseenSuitCount(i, s);
    per[s] = n;
    tot += n;
  }
  for (const s of suits) {
    const ps = tot > 0 ? per[s] / tot : 0.25;
    if (have[s]) pSucc += ps;
  }
  const tengjia = tp.equip.armor?.skill === 'tengjia';
  const dmg = tengjia ? 2 : 1;
  const gain = damageGain(i, t, dmg) + killBonus(i, t, dmg);
  return pSucc * gain - AIPOLICY.exposureW * 0.5;
}

/** 未见池中某花色的张数（花色在牌堆中近似均匀，按子类构成加权估算） */
function unseenSuitCount(me: number, suit: string): number {
  // 简化：牌堆各花色近似均分，直接按未见总数 / 4；未见池为空时给 1
  const total = expectedUnseenTotal(me);
  return Math.max(1, total / 4);
}

function expectedUnseenTotal(me: number): number {
  let known = 0;
  for (const p of G.players) known += p.judge.length;
  known += G.discard.length;
  const mine = G.players[me];
  if (mine) known += mine.hand.length;
  return Math.max(0, 125 - known);
}

/** AOE（南蛮入侵 / 万箭齐发）EV：逐座位累加期望伤害收益，天然处理「误伤队友」 */
export function evAoe(i: number, sub: 'nanman' | 'wanjian'): number {
  const need = sub === 'nanman' ? SHA_SUBS : 'shan';
  let ev = 0;
  for (let j = 0; j < G.players.length; j++) {
    if (j === i || !G.players[j].alive) continue;
    const pAvoid = pAtLeastOne(i, j, need);
    const gain = damageGain(i, j, 1) + killBonus(i, j, 1);
    ev += (1 - pAvoid) * gain;
  }
  return ev - AIPOLICY.exposureW * 0.5;
}

/** 铁索连环 EV：横置一 / 两名目标（对其本人无直接伤害，价值在后续属性伤害传导） */
export function evTiesuo(i: number, targets: number[]): number {
  let ev = 0;
  for (const t of targets) {
    const tp = G.players[t];
    if (!tp || !tp.alive) continue;
    ev += enemyProb(i, t) * 0.6 - allyProb(i, t) * 0.6;
  }
  // 场上已有横置的敌人时，连环的边际价值显著上升
  const chainedEnemy = G.players.some((q, k) => k !== i && q.alive && q.chained && enemyProb(i, k) > 0.3);
  if (chainedEnemy) ev += 0.5;
  return ev;
}

/** 留一张【闪】到手里的边际防守价值 */
export function shanMarginalValue(i: number): number {
  const me = G.players[i];
  if (!me || !me.alive) return 0;
  let pSafe = 1;
  for (let j = 0; j < G.players.length; j++) {
    if (j === i || !G.players[j].alive) continue;
    if (enemyProb(i, j) < 0.25) continue;
    const pAtk = inRange(j, i) ? Math.min(0.6, 0.25 + 0.08 * G.players[j].hand.length) : 0.04;
    pSafe *= 1 - pAtk * enemyProb(i, j);
  }
  return (1 - pSafe) * AIPOLICY.shanMarginal;
}

/**
 * 是否值得把一张「非闪」牌（转化技）当作【闪】打出。
 * 保留原「真闪必出」不变，只对**转化**做 EV 门控，避免白扔一张【杀】。
 */
export function shouldConvertToShan(i: number, dmg: number, card: Card): boolean {
  const me = G.players[i];
  if (!me) return true;
  if (dmg >= me.hp) return true; // 致命：必挡
  if (me.hp <= 2) return true; // 残血：必挡
  if (dmg >= 2) return true;
  // 低价值牌（装备 / 酒）转化不心疼；【杀】等到伤害更高时再用
  return card.type === 'equip' || card.sub === 'jiu';
}

/* ---------------- 目标选择：EV 版 ---------------- */

/** 对目标 j 的「出手价值」（用于选敌与排序） */
export function targetScore(i: number, j: number): number {
  const tp = G.players[j];
  if (!tp || !tp.alive) return -99;
  const me = G.players[i];
  if (!me) return -99;
  const g = grudgeOf(i, j);
  const f = favorOf(i, j);
  let s: number;
  if (me.role === 'spy') {
    s = balanceGain(i, j) * AIPOLICY.threatW * 2 + g * AIPOLICY.grudgeW - f * AIPOLICY.favorW;
  } else {
    const net = enemyProb(i, j) - AIPOLICY.allyPenalty * allyProb(i, j);
    const baiyin = tp.equip.armor?.skill === 'baiyin';
    const threatTerm = (AIPOLICY.threatW * threatOf(j) * 3) / (tp.hp + AIPOLICY.killDenom);
    const lowHp = baiyin ? 0 : AIPOLICY.lowHpW * (4 - tp.hp);
    s = net * (threatTerm + lowHp) + g * AIPOLICY.grudgeW - f * AIPOLICY.favorW;
  }
  return s;
}

/**
 * 博弈式目标选择（EV 版）。保留原「佯攻 / 观望」两项混合策略。
 * 返回目标下标；-1 = 观望不出手。
 */
export function pickAiTargetEv(idx: number): number {
  const p = G.players[idx];
  if (!p?.alive) return -1;
  const round = roundOf();
  const conceal = Math.max(0.05, 0.4 - round * 0.12);
  const feign = p.role === 'rebel' && round <= 2 && Math.random() < conceal;
  const cands: { i: number; score: number }[] = [];
  for (let i = 0; i < G.players.length; i++) {
    if (i === idx || !G.players[i].alive || !inRange(idx, i)) continue;
    let s = targetScore(idx, i);
    // 佯攻：反贼伪装成忠臣，打「最像主公方」的目标（取反后的亲疏）
    if (feign) {
      const P = beliefWithPrior(idx, i);
      s = P.loyal * 1.2 + P.lord * 0.9 - P.rebel * 0.9 + grudgeOf(idx, i) * 0.8 - favorOf(idx, i) * 0.6;
    }
    cands.push({ i, score: s });
  }
  if (!cands.length) return -1;
  cands.sort((a, b) => b.score - a.score);
  const best = cands[0];
  // 出手决策用「净敌意 net」而非被 threat 压低的 score：只要存在值得打的敌人就出手，
  // 用 score（含威胁度）只决定「先打谁」。否则 EV 会过度保守、整体进攻性低于基线。
  if (!feign) {
    const net = enemyProb(idx, best.i) - AIPOLICY.allyPenalty * allyProb(idx, best.i);
    if (net < 0.15 && Math.random() > 0.25) return -1;
  }
  return best.i;
}

/**
 * 统一的目标选择入口：按 AIPOLICY.useEv 在「EV 版」与「原启发式版」之间切换（A/B）。
 * 所有调用方（ai.ts / actions.ts）一律改用本函数。
 */
export function pickTarget(idx: number): number {
  return AIPOLICY.useEv ? pickAiTargetEv(idx) : legacyPickAiTarget(idx);
}

/* ---------------- 混合策略：softmax over EV ---------------- */

/** 按 EV 做 softmax 抽样：EV 差异越大越确定，差异小则随机化（防被读牌剥削） */
export function softmaxPick<T>(cands: T[], scoreOf: (c: T) => number, tau: number): T {
  if (!cands.length) return undefined as unknown as T;
  if (cands.length === 1) return cands[0];
  const t = Math.max(1e-3, tau);
  const m = Math.max(...cands.map(scoreOf));
  const w = cands.map((c) => Math.exp((scoreOf(c) - m) / t));
  const s = w.reduce((a, b) => a + b, 0);
  if (!(s > 0)) return cands[Math.floor(Math.random() * cands.length)];
  let r = Math.random() * s;
  for (let i = 0; i < cands.length; i++) {
    r -= w[i];
    if (r <= 0) return cands[i];
  }
  return cands[cands.length - 1];
}

/** 当前温度：随轮次衰减（前期探索 / 隐藏意图，后期收割） */
export function tauNow(): number {
  return AIPOLICY.tau0 * Math.pow(AIPOLICY.tauDecay, roundOf());
}

/* ---------------- 弃牌价值（弃牌阶段保序） ---------------- */

/** 单张手牌的保留价值（越大越不该弃） */
export function cardKeepValue(p: Player, c: Card): number {
  let base = AIPOLICY.keepTrick;
  if (c.sub === 'shan') base = AIPOLICY.keepShan;
  else if (c.sub === 'tao') base = AIPOLICY.keepTao * (p.hp < p.maxHp ? 1 : 0.45);
  else if (SHA_SUBS.includes(c.sub)) base = AIPOLICY.keepSha * (p.flags.noSha ? 0.3 : 1);
  else if (c.sub === 'jiu') base = 0.5;
  else if (c.type === 'equip') base = AIPOLICY.keepEquip;
  // 同类牌边际递减：第 2 张闪不如第 1 张值钱
  const same = p.hand.filter((x) => x.sub === c.sub).length;
  const decay = Math.pow(0.7, Math.max(0, same - 1));
  return base * decay;
}

/** 弃牌阶段：挑一张保留价值最低的牌弃掉（替代原 p.hand.pop() 的随机弃牌） */
export function pickDiscardCard(p: Player): Card | null {
  if (!p.hand.length) return null;
  let worst = p.hand[0];
  let wv = Infinity;
  for (const c of p.hand) {
    const v = cardKeepValue(p, c);
    if (v < wv) {
      wv = v;
      worst = c;
    }
  }
  return worst;
}
