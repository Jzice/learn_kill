/* ==================== 主动技能 ==================== */
import type { ChoiceOption } from '../core/types';
import { G } from './state';
import { FX, floatTextFx } from '../core/fx';
import { FACTIONS } from '../data/factions';
import { C } from '../data/cards';
import { addLog, addPlayLog } from './log';
import { hasSkill, drawCards, discardCard } from './rules';
import { render } from '../ui/render';
import { showPlayCard } from '../ui/playzone';
import { showPlayHint } from '../ui/hint';
import { aiSpeak } from './ai';
import { dealDamage } from './damage';
import { waitChoice } from './choice';
import { askQuizForPlayer } from './quiz';
import { NET, syncStateToClients } from '../net/network';
import { isExpansionActive, runSkillEffects } from './skillfx';

export async function useActiveSkill(idx: number, skillId: string): Promise<void> {
  const p = G.players[idx];
  if (p.flags.skillUsed) {
    addLog('本回合已使用过主动技能');
    return;
  }
  p.flags.skillUsed = true;
  const sk = p.skills.find((s) => s.id === skillId);
  if (!sk) return;
  // 扩展包技能（带原语组合）：答题通过后由原语分派器统一执行，不再走 legacy switch
  if (isExpansionActive(sk)) {
    addLog(`【${sk.name}】${p.name} 发起挑战…`, 'hl');
    render();
    const ok = await askQuizForPlayer(p, true);
    if (!ok) {
      addLog(`${p.name} 知识不足，【${sk.name}】失败`, 'dmg');
      floatTextFx(idx, '技能失败', '#8a8070');
      render();
      if (NET.isHost) syncStateToClients();
      return;
    }
    addPlayLog(p.name, 'skill', sk.name, '');
    addLog(`📘 玩法·【${sk.name}】：${sk.desc || '（暂无说明）'}`, 'explain');
    showPlayHint('技能', sk.name, sk.desc || '');
    aiSpeak(p, 'skill');
    FX.skillWave(idx);
    showPlayCard({ name: sk.name, suit: '✦', num: '', type: 'trick' }, p.name, FACTIONS[p.faction].color);
    await runSkillEffects(idx, p, sk.effects!);
    return;
  }
  const isLord = Object.values(FACTIONS).some((f) => f.lordSkill.id === skillId);
  addLog(isLord ? `【主公技·${sk.name}】${p.name} 发起挑战…` : `【${sk.name}】${p.name} 发起挑战…`, 'hl');
  render();
  const ok = await askQuizForPlayer(p, true);
  if (!ok) {
    addLog(`${p.name} 知识不足，【${sk.name}】失败`, 'dmg');
    floatTextFx(idx, '技能失败', '#8a8070');
    render();
    if (NET.isHost) syncStateToClients();
    return;
  }
  addPlayLog(p.name, 'skill', sk.name, '');
  addLog(`📘 玩法·【${sk.name}】：${sk.desc || '（暂无说明）'}`, 'explain');
  showPlayHint('技能', sk.name, sk.desc || '');
  aiSpeak(p, 'skill');
  FX.skillWave(idx);
  showPlayCard({ name: sk.name, suit: '✦', num: '', type: 'trick' }, p.name, FACTIONS[p.faction].color);

  // 通用“选择一名其他角色”helper（AI 随机选，真人走 waitChoice）
  const pickOther = async (): Promise<number> => {
    const ts = G.players.map((q, i) => ({ q, i })).filter((x) => x.q.alive && x.i !== idx);
    if (!ts.length) return -1;
    let ti: number;
    if (p.isAI) ti = ts[Math.floor(Math.random() * ts.length)].i;
    else {
      const o: ChoiceOption[] = ts.map((x) => ({ label: x.q.name, value: x.i }));
      o.push({ label: '取消', value: -1 });
      ti = (await waitChoice(idx, o, 'target')) as number;
      if (ti < 0) return -1;
    }
    return ti;
  };
  // 通用“选择一名有手牌的其他角色”helper
  const pickOtherWithHand = async (): Promise<number> => {
    const ts = G.players.map((q, i) => ({ q, i })).filter((x) => x.q.alive && x.i !== idx && x.q.hand.length > 0);
    if (!ts.length) return -1;
    let ti: number;
    if (p.isAI) ti = ts[0].i;
    else {
      const o: ChoiceOption[] = ts.map((x) => ({ label: x.q.name, value: x.i }));
      o.push({ label: '取消', value: -1 });
      ti = (await waitChoice(idx, o, 'target')) as number;
      if (ti < 0) return -1;
    }
    return ti;
  };
  const stealHand = (from: (typeof G.players)[number], to: (typeof G.players)[number]): void => {
    const c = from.hand[Math.floor(Math.random() * from.hand.length)];
    discardCard(from, c, false);
    to.hand.push(c);
  };
  /**
   * 主动技机会退还：玩家取消选择、场上无合法目标或费用不足时，
   * 不消耗本回合主动技机会（答题失败仍然消耗，作为「知识不足」的惩罚）。
   */
  const noCost = (): void => {
    p.flags.skillUsed = false;
  };

  switch (skillId) {
    case 'shishu': {
      drawCards(p, 1);
      break;
    }
    case 'yishu': {
      const ti = await pickOtherWithHand();
      if (ti < 0) { noCost(); break; }
      stealHand(G.players[ti], p);
      break;
    }
    case 'yinli': {
      const ti = await pickOther();
      if (ti < 0) { noCost(); break; }
      await dealDamage(idx, ti, 1);
      break;
    }
    case 'cuihua': {
      const ts = G.players.map((q, i) => ({ q, i })).filter((x) => x.q.alive);
      if (!ts.length) { noCost(); break; }
      let ti: number;
      if (p.isAI) ti = ts[0].i;
      else {
        const o: ChoiceOption[] = ts.map((x) => ({ label: x.q.name, value: x.i }));
        o.push({ label: '取消', value: -1 });
        ti = (await waitChoice(idx, o, 'target')) as number;
        if (ti < 0) { noCost(); break; }
      }
      const t = G.players[ti];
      if (t.hp < t.maxHp) {
        t.hp++;
        FX.healGlow(ti);
      } else drawCards(t, 1);
      break;
    }
    case 'mingjian': {
      const ti = await pickOtherWithHand();
      if (ti < 0) { noCost(); break; }
      const t = G.players[ti];
      discardCard(t, t.hand[Math.floor(Math.random() * t.hand.length)]);
      break;
    }
    case 'tansuo': {
      for (const q of G.players) if (q.alive) drawCards(q, 1);
      break;
    }
    case 'nah': {
      if (!p.hand.length) { noCost(); break; }
      discardCard(p, p.hand[0]);
      const ti = await pickOther();
      if (ti < 0) { noCost(); break; }
      const t = G.players[ti];
      if (t.hand.length > 0) discardCard(t, t.hand[Math.floor(Math.random() * t.hand.length)]);
      else await dealDamage(-1, ti, 1);
      break;
    }
    case 'jiangjinjiu': {
      drawCards(p, 2);
      p.flags.noSha = true;
      break;
    }
    case 'milv':
    case 'tuiyan': {
      if (!p.hand.length) { noCost(); break; }
      discardCard(p, p.hand[0]);
      const ti = await pickOther();
      if (ti < 0) { noCost(); break; }
      const t = G.players[ti];
      const jc = G.deck.pop() || C('判定', 'basic', 'none', '♠', 1);
      await FX.judge(ti, jc);
      if (jc.suit === '♠' || jc.suit === '♣') await dealDamage(idx, ti, 1);
      else if (skillId === 'tuiyan') drawCards(t, 1);
      G.discard.push(jc);
      break;
    }
    case 'tongchou': {
      if (!p.hand.length) { noCost(); break; }
      const c = p.hand[0];
      discardCard(p, c, false);
      const ti = await pickOther();
      if (ti < 0) { noCost(); break; }
      const t = G.players[ti];
      t.hand.push(c);
      drawCards(p, 1);
      break;
    }
    case 'zhineng': {
      if (!p.hand.length) { noCost(); break; }
      discardCard(p, p.hand[0]);
      const ti = await pickOther();
      if (ti < 0) { noCost(); break; }
      await dealDamage(-1, ti, 1);
      break;
    }
    case 'jinhualun': {
      drawCards(p, 2);
      if (p.hand.length > 0) discardCard(p, p.hand[0]);
      break;
    }
    case 'tongyi': {
      for (let i = 0; i < G.players.length; i++) {
        if (i === idx || !G.players[i].alive) continue;
        const t = G.players[i];
        if (t.hand.length > 0) discardCard(t, t.hand[Math.floor(Math.random() * t.hand.length)]);
      }
      break;
    }
    case 'youji': {
      const ti = await pickOther();
      if (ti < 0) { noCost(); break; }
      const t = G.players[ti];
      if (t.hand.length > 0) discardCard(t, t.hand[Math.floor(Math.random() * t.hand.length)]);
      else drawCards(p, 1);
      break;
    }
    case 'lunyu': {
      const ts = G.players.map((q, i) => ({ q, i })).filter((x) => x.q.alive);
      if (!ts.length) { noCost(); break; }
      let ti: number;
      if (p.isAI) ti = ts[0].i;
      else {
        const o: ChoiceOption[] = ts.map((x) => ({ label: x.q.name, value: x.i }));
        o.push({ label: '取消', value: -1 });
        ti = (await waitChoice(idx, o, 'target')) as number;
        if (ti < 0) { noCost(); break; }
      }
      const t = G.players[ti];
      if (t.hp < t.maxHp) {
        t.hp++;
        FX.healGlow(ti);
      }
      drawCards(t, 1);
      break;
    }
    case 'shisihang': {
      const ti = await pickOther();
      if (ti < 0) { noCost(); break; }
      const t = G.players[ti];
      if (t.hand.length > 0) stealHand(t, p);
      else await dealDamage(-1, ti, 1);
      break;
    }
    case 'xunjie': {
      const ti = await pickOtherWithHand();
      if (ti < 0) { noCost(); break; }
      const t = G.players[ti];
      if (t.isAI) {
        stealHand(t, p); // AI 直接交出
      } else {
        const ch = await waitChoice(
          ti,
          [
            { label: `交给 ${p.name} 一张手牌`, value: 'give' },
            { label: '弃置自己一张手牌', value: 'discard' },
          ],
          'list',
        );
        if (ch === 'give') stealHand(t, p);
        else if (t.hand.length > 0) discardCard(t, t.hand[Math.floor(Math.random() * t.hand.length)]);
      }
      break;
    }
    /* ---- 初中 / 高中扩展包：按学科定制的主题主动技 ---- */
    case 'beisong': {
      // 语文·初中：弃1摸2
      if (!p.hand.length) { noCost(); break; }
      discardCard(p, p.hand[0]);
      drawCards(p, 2);
      break;
    }
    case 'wenyan': {
      // 语文·高中：弃2摸3
      if (p.hand.length < 2) { noCost(); break; }
      discardCard(p, p.hand[0]);
      discardCard(p, p.hand[0]);
      drawCards(p, 3);
      break;
    }
    case 'youshu': {
      // 数学·初中：弃1，令目标判定，红色摸1、黑色弃1
      if (!p.hand.length) { noCost(); break; }
      discardCard(p, p.hand[0]);
      const ti = await pickOther();
      if (ti < 0) { noCost(); break; }
      const t = G.players[ti];
      const jc = G.deck.pop() || C('判定', 'basic', 'none', '♠', 1);
      await FX.judge(ti, jc);
      if (jc.suit === '♥' || jc.suit === '♦') drawCards(t, 1);
      else if (t.hand.length > 0) discardCard(t, t.hand[Math.floor(Math.random() * t.hand.length)]);
      G.discard.push(jc);
      break;
    }
    case 'daoshu': {
      // 数学·高中：弃1，令目标弃2
      if (!p.hand.length) { noCost(); break; }
      discardCard(p, p.hand[0]);
      const ti = await pickOther();
      if (ti < 0) { noCost(); break; }
      const t = G.players[ti];
      for (let i = 0; i < 2 && t.hand.length > 0; i++) {
        discardCard(t, t.hand[Math.floor(Math.random() * t.hand.length)]);
      }
      break;
    }
    case 'tingxie':
    case 'zhexue': {
      // 英语·初中「听写」/ 政治·高中「哲学」：弃1，取得一名角色一张手牌
      if (!p.hand.length) { noCost(); break; }
      discardCard(p, p.hand[0]);
      const ti = await pickOtherWithHand();
      if (ti < 0) { noCost(); break; }
      stealHand(G.players[ti], p);
      break;
    }
    case 'yufa': {
      // 英语·高中：展示牌堆顶3张，获得其中1张，其余弃掉
      const top = [];
      for (let i = 0; i < 3 && G.deck.length > 0; i++) top.push(G.deck.pop()!);
      if (!top.length) { noCost(); break; }
      let pick = 0;
      if (!p.isAI) {
        const o: ChoiceOption[] = top.map((c, i) => ({ label: `${c.name} ${c.suit}${c.num}`, value: i }));
        o.push({ label: '取消', value: -1 });
        pick = (await waitChoice(idx, o, 'list')) as number;
        if (pick < 0) {
          G.discard.push(...top);
          noCost();
          break;
        }
      }
      top.forEach((c, i) => {
        if (i === pick) p.hand.push(c);
        else G.discard.push(c);
      });
      break;
    }
    case 'dianci': {
      // 物理·高中：弃1，对一名角色造成1点伤害
      if (!p.hand.length) { noCost(); break; }
      discardCard(p, p.hand[0]);
      const ti = await pickOther();
      if (ti < 0) { noCost(); break; }
      await dealDamage(-1, ti, 1);
      break;
    }
    case 'youjihuaxue': {
      // 化学·高中：弃2，回复1点体力并摸1张
      if (p.hand.length < 2) { noCost(); break; }
      discardCard(p, p.hand[0]);
      discardCard(p, p.hand[0]);
      if (p.hp < p.maxHp) {
        p.hp++;
        FX.healGlow(idx);
      }
      drawCards(p, 1);
      break;
    }
    case 'chaodai': {
      // 历史·初中：弃1，令所有其他角色各弃1
      if (!p.hand.length) { noCost(); break; }
      discardCard(p, p.hand[0]);
      for (let i = 0; i < G.players.length; i++) {
        if (i === idx || !G.players[i].alive) continue;
        const t = G.players[i];
        if (t.hand.length > 0) discardCard(t, t.hand[Math.floor(Math.random() * t.hand.length)]);
      }
      break;
    }
    case 'shiliao': {
      // 历史·高中：弃1，所有存活角色各摸1
      if (!p.hand.length) { noCost(); break; }
      discardCard(p, p.hand[0]);
      for (const q of G.players) if (q.alive) drawCards(q, 1);
      break;
    }
    case 'fazhi': {
      // 政治·初中：弃1，令一名角色回复1点体力（已满则改为摸1）
      if (!p.hand.length) { noCost(); break; }
      discardCard(p, p.hand[0]);
      const ti = await pickOther();
      if (ti < 0) { noCost(); break; }
      const t = G.players[ti];
      if (t.hp < t.maxHp) {
        t.hp++;
        FX.healGlow(ti);
      } else drawCards(t, 1);
      break;
    }
  }
  render();
  if (NET.isHost) syncStateToClients();
}
