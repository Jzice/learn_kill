/* ==================== 出牌 ==================== */
import type { Card, Player } from '../core/types';
import { G } from './state';
import { FX, aoeFx, drawFx, floatTextFx, trickCast } from '../core/fx';
import { Sound } from '../core/sound';
import { FACTIONS } from '../data/factions';
import { addLog, addPlayLog } from './log';
import { hasSkill, discardCard, drawCards } from './rules';
import { render } from '../ui/render';
import { showPlayCard } from '../ui/playzone';
import { showPlayHint, TRICK_DESC } from '../ui/hint';
import { aiQuiz, aiSpeak } from './ai';
import { dealDamage } from './damage';
import { waitChoice } from './choice';
import { askQuizForPlayer } from './quiz';
import { NET, scheduleSync } from '../net/network';

export async function useSha(attackerIdx: number, targetIdx: number): Promise<void> {
  const a = G.players[attackerIdx],
    t = G.players[targetIdx];
  const hasLiannu = a.equip.weapon?.skill === 'liannu';
  if (!hasLiannu && (a.flags.shaUsed || 0) >= 1) {
    addLog('本回合已使用过【杀】');
    return;
  }
  a.flags.shaUsed = (a.flags.shaUsed || 0) + 1;
  addPlayLog(a.name, 'use', '杀', t.name);
  aiSpeak(a, 'attack');
  FX.attackLunge(attackerIdx);
  Sound.play('sha');
  showPlayCard({ name: '杀', suit: '♠', num: '?', type: 'basic' }, a.name, FACTIONS[a.faction].color);
  await FX.flyCard(attackerIdx, targetIdx, '杀', 'basic');
  const dodged = await requestShan(targetIdx, attackerIdx);
  if (dodged) return;
  let dmg = 1;
  if (hasSkill(a, 'jingzhong')) dmg += 1;
  if (a.flags.extraDamage) {
    dmg += a.flags.extraDamage;
    a.flags.extraDamage = 0;
  }
  await dealDamage(attackerIdx, targetIdx, dmg);
}

export async function useTao(idx: number): Promise<void> {
  const p = G.players[idx];
  if (p.hp >= p.maxHp) {
    addLog('体力已满');
    return;
  }
  p.hp++;
  addPlayLog(p.name, 'heal', '桃', p.name);
  showPlayCard({ name: '桃', suit: '♥', num: '?', type: 'basic' }, p.name, FACTIONS[p.faction].color);
  Sound.play('tao');
  FX.healGlow(idx);
  floatTextFx(idx, '+1', '#27ae60');
  render();
}

export async function useJiu(idx: number): Promise<void> {
  const p = G.players[idx];
  p.flags.extraDamage = (p.flags.extraDamage || 0) + 1;
  addPlayLog(p.name, 'use', '酒', '');
  showPlayCard({ name: '酒', suit: '♠', num: '?', type: 'basic' }, p.name, FACTIONS[p.faction].color);
  Sound.play('jiu');
  FX.skillWave(idx);
}

export async function useTrick(attackerIdx: number, card: Card, targetIdx: number | null): Promise<void> {
  const a = G.players[attackerIdx];
  const tn = targetIdx != null ? G.players[targetIdx].name : '';
  addPlayLog(a.name, 'use', card.name, tn);
  showPlayHint('锦囊', card.name, TRICK_DESC[card.sub] || '');
  showPlayCard(card, a.name, FACTIONS[a.faction].color);
  if (hasSkill(a, 'shicheng') || hasSkill(a, 'jiaohua')) {
    drawCards(a, 1);
  }
  render();
  // 锦囊释放特效与音效：按子类区分
  Sound.play(
    card.sub === 'nanman' || card.sub === 'wanjian'
      ? 'trick_aoe'
      : card.sub === 'taoyuan'
        ? 'trick_heal'
        : card.sub === 'lebu' || card.sub === 'shandian'
          ? 'trick_delay'
          : card.sub === 'guohe' || card.sub === 'shunshou'
            ? 'trick_steal'
            : card.sub === 'juedou'
              ? 'duel'
              : 'trick',
  );
  await trickCast(
    attackerIdx,
    card.name,
    card.sub,
    card.sub === 'nanman' || card.sub === 'wanjian'
      ? '#e74c3c'
      : card.sub === 'taoyuan'
        ? '#27ae60'
        : card.sub === 'lebu' || card.sub === 'shandian'
          ? '#f5c542'
          : '#b57fff',
  );

  switch (card.sub) {
    case 'wuzhong': {
      drawCards(a, 2);
      drawFx(attackerIdx, 2);
      addLog(`${a.name} 摸2张牌`);
      break;
    }
    case 'guohe': {
      if (targetIdx != null) await discardTargetCard(targetIdx, attackerIdx, '弃置');
      break;
    }
    case 'shunshou': {
      if (targetIdx != null) await discardTargetCard(targetIdx, attackerIdx, '获得');
      break;
    }
    case 'juedou': {
      if (targetIdx == null) break;
      let def: Player = G.players[targetIdx],
        ai = attackerIdx,
        di = targetIdx;
      while (true) {
        const sha = def.hand.find((c) => c.sub === 'sha');
        if (sha) {
          discardCard(def, sha);
          addLog(`${def.name} 打出【杀】`);
          FX.attackLunge(di);
          await FX.flyCard(di, ai, '杀', 'basic', 420);
          [ai, di] = [di, ai];
          def = G.players[di];
        } else {
          await dealDamage(ai, di, 1);
          break;
        }
      }
      break;
    }
    case 'nanman': {
      const targets: number[] = [];
      for (let i = 0; i < G.players.length; i++) {
        if (i === attackerIdx || !G.players[i].alive) continue;
        if (hasSkill(G.players[i], 'fenshu')) continue;
        targets.push(i);
      }
      await aoeFx(attackerIdx, targets, '#e74c3c');
      for (const i of targets) {
        const t = G.players[i];
        if (!t.alive) continue;
        const sha = t.hand.find((c) => c.sub === 'sha');
        if (sha) {
          discardCard(t, sha);
          addLog(`${t.name} 出杀抵挡`);
        } else await dealDamage(attackerIdx, i, 1);
      }
      break;
    }
    case 'wanjian': {
      const targets: number[] = [];
      for (let i = 0; i < G.players.length; i++) {
        if (i === attackerIdx || !G.players[i].alive) continue;
        if (hasSkill(G.players[i], 'fenshu')) continue;
        targets.push(i);
      }
      await aoeFx(attackerIdx, targets, '#f39c12');
      for (const i of targets) {
        const t = G.players[i];
        if (!t.alive) continue;
        const shan = t.hand.find((c) => c.sub === 'shan');
        if (shan) {
          discardCard(t, shan);
          addLog(`${t.name} 出闪抵挡`);
          await FX.shield(i);
        } else await dealDamage(attackerIdx, i, 1);
      }
      break;
    }
    case 'taoyuan': {
      for (const p of G.players) {
        if (p.alive && p.hp < p.maxHp) {
          p.hp++;
          addLog(`${p.name} 回复1点`, 'heal');
          FX.healGlow(G.players.indexOf(p));
        }
      }
      break;
    }
    case 'lebu': {
      if (targetIdx != null && !hasSkill(G.players[targetIdx], 'fenshu')) {
        G.players[targetIdx].judge.push({ ...card, judgeType: 'lebu' });
        addLog(`【乐不思蜀】置于 ${G.players[targetIdx].name} 判定区`);
      }
      break;
    }
    case 'shandian': {
      a.judge.push({ ...card, judgeType: 'shandian' });
      addLog(`【闪电】置于 ${a.name} 判定区`);
      break;
    }
  }
  render();
}

export async function discardTargetCard(targetIdx: number, srcIdx: number, mode: string): Promise<void> {
  const t = G.players[targetIdx];
  if (hasSkill(t, 'fenshu')) return;
  const opts: { label: string; value: string }[] = [];
  if (t.hand.length > 0) opts.push({ label: `手牌（${t.hand.length}张）`, value: 'hand' });
  if (t.equip.weapon) opts.push({ label: `武器：${t.equip.weapon.name}`, value: 'weapon' });
  if (t.equip.armor) opts.push({ label: `防具：${t.equip.armor.name}`, value: 'armor' });
  if (t.equip.horsePlus) opts.push({ label: '+1马', value: 'horsePlus' });
  if (t.equip.horseMinus) opts.push({ label: '-1马', value: 'horseMinus' });
  if (!opts.length) return;
  const src = G.players[srcIdx];
  let ch: string | number;
  if (src.isAI) ch = opts[Math.floor(Math.random() * opts.length)].value;
  else ch = await waitChoice(srcIdx, opts, 'list');
  if (ch === 'hand') {
    const c = t.hand[Math.floor(Math.random() * t.hand.length)];
    discardCard(t, c, mode !== '获得');
    addLog(`${src.name} ${mode}了 ${t.name} 一张手牌`);
    if (mode === '获得') src.hand.push(c);
  } else {
    const c = t.equip[ch as keyof typeof t.equip];
    if (c) {
      t.equip[ch as keyof typeof t.equip] = null;
      if (mode === '获得') src.hand.push(c);
      else G.discard.push(c);
      addLog(`${src.name} ${mode}了 ${t.name} 的【${c.name}】`);
    }
  }
  render();
  if (NET.isHost) scheduleSync();
}

/* ==================== 出闪 ==================== */
export async function requestShan(targetIdx: number, srcIdx: number): Promise<boolean> {
  const t = G.players[targetIdx];
  if (t.isAI) {
    const shan = t.hand.find((c) => c.sub === 'shan');
    if (shan) {
      discardCard(t, shan);
      addLog(`${t.name} 打出【闪】`);
      await FX.shield(targetIdx);
      return true;
    }
    if (t.knowledge >= 1 && aiQuiz()) {
      t.knowledge--;
      addLog(`${t.name} 消耗学识当闪`);
      await FX.shield(targetIdx);
      return true;
    }
    return false;
  }
  const opts: { label: string; value: string }[] = [];
  t.hand
    .filter((c) => c.sub === 'shan')
    .forEach((c) => opts.push({ label: `【闪】${c.suit}${c.num}`, value: 'card_' + c.id }));
  if (t.knowledge >= 1) opts.push({ label: '1学识当闪', value: 'know' });
  if ((t.shield || 0) >= 1) opts.push({ label: '1护盾当闪', value: 'shield' });
  opts.push({ label: '答题免伤', value: 'quiz' });
  opts.push({ label: '承受伤害', value: 'none' });
  const ch = await waitChoice(targetIdx, opts, 'shan');
  if (ch === 'none') return false;
  if (ch === 'know') {
    t.knowledge--;
    addLog(`${t.name} 消耗学识当闪`);
    await FX.shield(targetIdx);
    return true;
  }
  if (ch === 'shield') {
    t.shield--;
    addLog(`${t.name} 消耗护盾当闪`);
    await FX.shield(targetIdx);
    return true;
  }
  if (ch === 'quiz') {
    const ok = await askQuizForPlayer(t, false);
    if (ok) {
      addLog(`${t.name} 答对视为闪`, 'hl');
      await FX.shield(targetIdx);
      return true;
    }
    addLog(`${t.name} 答错`, 'dmg');
    return false;
  }
  if (String(ch).startsWith('card_')) {
    const id = Number(String(ch).slice(5));
    const c = t.hand.find((x) => x.id === id);
    if (c) {
      discardCard(t, c);
      addLog(`${t.name} 打出【闪】`);
      await FX.shield(targetIdx);
      return true;
    }
  }
  return false;
}
