/* ==================== 出牌 ==================== */
import type { Card, Player } from '../core/types';
import { G } from './state';
import { FX, aoeFx, drawFx, floatTextFx, trickCast } from '../core/fx';
import { Sound } from '../core/sound';
import { FACTIONS } from '../data/factions';
import { C } from '../data/cards';
import { addLog, addPlayLog } from './log';
import { hasSkill, discardCard, drawCards, inRange } from './rules';
import { render } from '../ui/render';
import { showPlayCard } from '../ui/playzone';
import { showPlayHint, TRICK_DESC } from '../ui/hint';
import { aiQuiz, aiSpeak } from './ai';
import { aiQuizRate, aiShouldCounter } from './aibrain';
import { dealDamage } from './damage';
import { waitChoice } from './choice';
import { askQuizForPlayer } from './quiz';
import { NET, scheduleSync } from '../net/network';

export async function useSha(
  attackerIdx: number,
  targetIdx: number,
  opts: { fromQinglong?: boolean; suit?: string } = {},
): Promise<void> {
  const a = G.players[attackerIdx],
    t = G.players[targetIdx];
  const hasLiannu = a.equip.weapon?.skill === 'liannu';
  if (!hasLiannu && !opts.fromQinglong && (a.flags.shaUsed || 0) >= 1) {
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
  // 仁王盾：黑色【杀】无效
  const suit = opts.suit ?? '♠';
  const black = suit === '♠' || suit === '♣';
  if (t.equip.armor?.skill === 'renwang' && black) {
    addLog(`${t.name} 的【仁王盾】挡下了黑色【杀】`, 'hl');
    render();
    return;
  }
  const dodged = await requestShan(targetIdx, attackerIdx);
  if (dodged) {
    // 青龙偃月刀：杀被闪后可对同目标再出一张杀
    if (a.equip.weapon?.skill === 'qinglong' && t.alive) {
      const again = a.isAI
        ? a.hand.some((c) => c.sub === 'sha') && inRange(attackerIdx, targetIdx)
        : (await waitChoice(
            attackerIdx,
            [
              { label: '🐉 青龙偃月刀：再出一张杀', value: 'yes' },
              { label: '不发动', value: 'no' },
            ],
            'list',
          )) === 'yes';
      if (again) {
        await useSha(attackerIdx, targetIdx, { fromQinglong: true, suit });
        return;
      }
    }
    return;
  }
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
  addLog(`📘 玩法·【${card.name}】：${TRICK_DESC[card.sub] || '（暂无说明）'}`, 'explain');
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

  // 无懈可击：即时锦囊结算前插入响应链（延时类乐/闪电在判定区，不在范围）
  const COUNTERABLE = ['wuzhong', 'guohe', 'shunshou', 'juedou', 'nanman', 'wanjian', 'taoyuan'];
  if (COUNTERABLE.includes(card.sub)) {
    const countered = await counterChain(attackerIdx, card.sub, targetIdx);
    if (countered) {
      addLog(`【无懈可击】生效，${card.name} 被抵消`, 'hl');
      render();
      return;
    }
  }

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

/** 无懈可击响应链：返回该锦囊是否最终被抵消（支持无懈可叠，每人每条链一次） */
async function counterChain(srcIdx: number, sub: string, primary: number | null): Promise<boolean> {
  let countered = false;
  let lastCounterer = -1;
  const responders = G.players.map((_, i) => i).filter((i) => i !== srcIdx && G.players[i].alive);
  const responded = new Set<number>();
  const queue: number[] = [...responders];
  while (queue.length) {
    const pid = queue.shift()!;
    if (responded.has(pid)) continue;
    const p = G.players[pid];
    if (!p.hand.some((c) => c.sub === 'wuxie')) continue;
    let want = false;
    if (p.isAI) {
      want = aiShouldCounter(pid, srcIdx, countered, sub, primary, lastCounterer);
    } else {
      const ch = await waitChoice(
        pid,
        [
          { label: `🚫 无懈可击（抵消【${trickLabel(sub)}】）`, value: 'use' },
          { label: '不响应', value: 'skip' },
        ],
        'list',
      );
      want = ch === 'use';
    }
    if (want) {
      const w = p.hand.find((c) => c.sub === 'wuxie')!;
      discardCard(p, w);
      addLog(`${p.name} 打出【无懈可击】`, 'hl');
      responded.add(pid);
      countered = !countered;
      lastCounterer = pid;
      for (const r of responders) if (!responded.has(r)) queue.push(r);
    }
  }
  return countered;
}

function trickLabel(sub: string): string {
  const m: Record<string, string> = {
    wuzhong: '无中生有', guohe: '过河拆桥', shunshou: '顺手牵羊', juedou: '决斗',
    nanman: '南蛮入侵', wanjian: '万箭齐发', taoyuan: '桃园结义',
  };
  return m[sub] || '锦囊';
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
    if (t.knowledge >= 1 && aiQuiz(aiQuizRate(t))) {
      t.knowledge--;
      addLog(`${t.name} 消耗学识当闪`);
      await FX.shield(targetIdx);
      return true;
    }
    return false;
  }
  const opts: { label: string; value: string }[] = [];
  const shans = t.hand.filter((c) => c.sub === 'shan');
  shans.forEach((c) => opts.push({ label: `【闪】${c.suit}${c.num}`, value: 'card_' + c.id }));
  // 答题免伤/学识当闪 仅在手中无【闪】时可选：有闪必须出闪，保证闪牌价值（提高可玩性）
  const noShan = shans.length === 0;
  if (noShan && t.equip.armor?.skill === 'bagua') {
    const jc = G.deck.pop() || C('判定', 'basic', 'none', '♠', 1);
    addLog(`【八卦阵】判定：${jc.suit}${jc.num}`, 'hl');
    G.discard.push(jc);
    if (jc.suit === '♥' || jc.suit === '♦') {
      addLog('【八卦阵】判定为红色，视为闪', 'hl');
      await FX.shield(targetIdx);
      return true;
    }
    addLog('【八卦阵】判定失败');
  }
  if (noShan && t.knowledge >= 1) opts.push({ label: '1学识当闪', value: 'know' });
  if ((t.shield || 0) >= 1) opts.push({ label: '1护盾当闪', value: 'shield' });
  if (noShan) opts.push({ label: '答题免伤', value: 'quiz' });
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
