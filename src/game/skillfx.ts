/* ==================== 技能原语分派器 ====================
 * 108 个扩展包技能均由有限原语组合声明（见 src/data/expansion.ts），
 * 由本文件统一分派执行，避免 108 个独立分支：
 *   - 主动技：useActiveSkill 在走到 legacy switch 之前先拦截「带 effects 的技能」调用 runSkillEffects
 *   - 触发技：trigger* 系列纯函数被各规则钩子（距离/手牌上限/摸牌/伤害）聚合查询；
 *             只统计「带 effects 的技能」，与 legacy hasSkill 检查互不干扰（加法式接入）
 */
import type { Player, Skill, SkillEffect } from '../core/types';
import { G } from './state';
import { FX } from '../core/fx';
import { addLog, addPlayLog } from './log';
import { hasSkill, drawCards, discardCard } from './rules';
import { render } from '../ui/render';
import { dealDamage } from './damage';
import { waitChoice } from './choice';
import { NET, syncStateToClients } from '../net/network';

/** 是否为主动技（带原语、需手动发动） */
export function isExpansionActive(sk: Skill): boolean {
  return !!sk.effects && sk.effects.length > 0 && sk.type === 'active';
}

/* ---------------- 主动技原语执行 ---------------- */
async function pickOther(idx: number, p: Player, needHand = false): Promise<number> {
  const ts = G.players
    .map((q, i) => ({ q, i }))
    .filter((x) => x.q.alive && x.i !== idx && (!needHand || x.q.hand.length > 0));
  if (!ts.length) return -1;
  if (p.isAI) return ts[Math.floor(Math.random() * ts.length)].i;
  const o = ts.map((x) => ({ label: x.q.name, value: x.i }));
  o.push({ label: '取消', value: -1 });
  const ti = (await waitChoice(idx, o, 'target')) as number;
  return ti < 0 ? -1 : ti;
}

function stealHand(from: Player, to: Player, n: number): void {
  for (let i = 0; i < n && from.hand.length > 0; i++) {
    const c = from.hand[Math.floor(Math.random() * from.hand.length)];
    discardCard(from, c, false);
    to.hand.push(c);
  }
}

export async function runSkillEffects(idx: number, p: Player, effects: SkillEffect[]): Promise<void> {
  // 费用：主动技先弃置 costCard 张手牌
  const cost = effects.find((e) => e.kind === 'costCard');
  if (cost && cost.kind === 'costCard') {
    if (p.hand.length < cost.n) {
      p.flags.skillUsed = false; // 费用不足：不消耗本回合主动技机会
      addLog(`${p.name} 手牌不足，技能未发动`, 'dmg');
      return;
    }
    for (let i = 0; i < cost.n; i++) discardCard(p, p.hand[0]);
  }

  for (const e of effects) {
    switch (e.kind) {
      case 'costCard':
        break;
      case 'selfDraw': {
        if (e.n > 0) drawCards(p, e.n);
        break;
      }
      case 'shield': {
        p.shield += e.n;
        FX.healGlow(idx);
        break;
      }
      case 'targetDiscard': {
        const ti = await pickOther(idx, p);
        if (ti < 0) break;
        const t = G.players[ti];
        for (let i = 0; i < e.n && t.hand.length > 0; i++) {
          discardCard(t, t.hand[Math.floor(Math.random() * t.hand.length)]);
        }
        break;
      }
      case 'targetLoseHp': {
        const ti = await pickOther(idx, p);
        if (ti < 0) break;
        await dealDamage(-1, ti, e.n);
        break;
      }
      case 'targetDamage': {
        const ti = await pickOther(idx, p);
        if (ti < 0) break;
        await dealDamage(idx, ti, e.n);
        break;
      }
      case 'targetHeal': {
        const ti = await pickOther(idx, p);
        if (ti < 0) break;
        const t = G.players[ti];
        if (t.hp < t.maxHp) {
          t.hp += e.n;
          FX.healGlow(ti);
        } else drawCards(t, e.n);
        break;
      }
      case 'targetDraw': {
        const ti = await pickOther(idx, p);
        if (ti < 0) break;
        drawCards(G.players[ti], e.n);
        break;
      }
      case 'gainHand': {
        const ti = await pickOther(idx, p, true);
        if (ti < 0) break;
        stealHand(G.players[ti], p, e.n);
        break;
      }
      case 'allDiscard': {
        for (let i = 0; i < G.players.length; i++) {
          if (i === idx || !G.players[i].alive) continue;
          const t = G.players[i];
          for (let k = 0; k < e.n && t.hand.length > 0; k++) {
            discardCard(t, t.hand[Math.floor(Math.random() * t.hand.length)]);
          }
        }
        break;
      }
      case 'allDraw': {
        for (const q of G.players) if (q.alive) drawCards(q, e.n);
        break;
      }
      // 触发类原语在 runSkillEffects 中不应出现（由钩子聚合），忽略
      case 'extraDraw':
      case 'handLimit':
      case 'distMod':
      case 'damageMod':
        break;
    }
  }
  render();
  if (NET.isHost) syncStateToClients();
}

/* ---------------- 触发技聚合（加法式接入现有钩子） ---------------- */
function sumEffects(p: Player, kind: SkillEffect['kind'], pick: (e: SkillEffect) => number): number {
  let sum = 0;
  for (const s of p.skills) {
    if (!s.effects) continue; // 仅统计扩展包技能，legacy 技能走 hasSkill
    for (const e of s.effects) if (e.kind === kind) sum += pick(e);
  }
  return sum;
}

/** 摸牌阶段额外摸牌数（触发） */
export function triggerExtraDraw(p: Player): number {
  return sumEffects(p, 'extraDraw', (e) => (e.kind === 'extraDraw' ? e.n : 0));
}
/** 手牌上限加成（触发） */
export function triggerHandLimit(p: Player): number {
  return sumEffects(p, 'handLimit', (e) => (e.kind === 'handLimit' ? e.n : 0));
}
/** 距离修正（触发，负=更近） */
export function triggerDistMod(p: Player): number {
  return sumEffects(p, 'distMod', (e) => (e.kind === 'distMod' ? e.delta : 0));
}
/** 出杀/伤害加成（触发） */
export function triggerDamageMod(p: Player): number {
  return sumEffects(p, 'damageMod', (e) => (e.kind === 'damageMod' ? e.delta : 0));
}

export { hasSkill };
