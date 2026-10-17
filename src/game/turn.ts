/* ==================== 回合流程 ==================== */
import type { ChoiceOption } from '../core/types';
import { G } from './state';
import { FX } from '../core/fx';
import { FACTIONS } from '../data/factions';
import { C } from '../data/cards';
import { addLog, addPlayLog } from './log';
import { hasSkill, drawCards, discardCard, distBetween, inRange, handLimit } from './rules';
import { render } from '../ui/render';
import { showPlayCard } from '../ui/playzone';
import { waitChoice } from './choice';
import { askQuizForPlayer } from './quiz';
import { aiPlayPhase, aiQuiz, aiSpeak } from './ai';
import { dealDamage } from './damage';
import { useActiveSkill } from './skills';
import { useSha, useTao, useJiu, useTrick } from './actions';
import { NET, scheduleSync } from '../net/network';

export async function runTurn(idx: number): Promise<void> {
  const p = G.players[idx];
  if (!p.alive) return;
  p.flags.shaUsed = 0;
  p.flags.skillUsed = false;
  p.flags.noSha = false;
  G.current = idx;
  addLog(`—— ${p.name}（${FACTIONS[p.faction].name}）的回合 ——`, 'hl');
  if (p.isAI) aiSpeak(p, 'idle');
  render();
  await judgePhase(p);
  let drawN = 2;
  if (hasSkill(p, 'youxuan')) drawN += 1;
  drawCards(p, drawN);
  addLog(`${p.name} 摸 ${drawN} 张牌`);
  if (hasSkill(p, 'youxuan') && p.hand.length > 0) {
    discardCard(p, p.hand[0]);
  }
  render();
  if (p.isAI) {
    if (aiQuiz(0.6)) {
      const ok = await askQuizForPlayer(p, false);
      if (ok) {
        drawCards(p, 1);
        addLog(`${p.name} 参悟成功`, 'hl');
      }
    }
  } else {
    const ch = await waitChoice(
      idx,
      [
        { label: '参悟答题（答对多摸1张+奖励）', value: 'quiz' },
        { label: '跳过', value: 'skip' },
      ],
      'list',
    );
    if (ch === 'quiz') {
      const ok = await askQuizForPlayer(p, false);
      if (ok) {
        drawCards(p, 1);
        addLog(`${p.name} 参悟成功`, 'hl');
      } else addLog(`${p.name} 参悟失败`, 'dmg');
    }
  }
  render();
  if (p.alive && !p.flags.skipPlay) await playPhase(idx);
  if (p.alive) await discardPhase(p);
  render();
}

export async function judgePhase(p: (typeof G.players)[number]): Promise<void> {
  if (!p.judge.length) return;
  for (let i = p.judge.length - 1; i >= 0; i--) {
    const j = p.judge[i];
    if (!j.judgeType) continue;
    p.judge.splice(i, 1);
    const card = G.deck.pop() || C('判定', 'basic', 'none', '♠', 1);
    addLog(`${p.name} 判定：${card.suit}${card.num}`, 'hl');
    await FX.judge(G.players.indexOf(p), card);
    if (j.judgeType === 'lebu') {
      if (card.suit !== '♥') {
        p.flags.skipPlay = true;
        addLog('【乐不思蜀】生效', 'dmg');
      } else addLog('乐不思蜀失效');
      G.discard.push(card);
    } else if (j.judgeType === 'shandian') {
      if (card.suit === '♠' && Number(card.num) >= 2 && Number(card.num) <= 9) {
        addLog('【闪电】命中！', 'dmg');
        G.discard.push(card);
        await dealDamage(-1, G.players.indexOf(p), 3, 'thunder');
      } else {
        addLog('闪电未命中');
        const next = (G.players.indexOf(p) + 1) % G.players.length;
        G.players[next].judge.push({ ...j });
        G.discard.push(card);
      }
    }
    if (!p.alive) break;
  }
  render();
}

export async function playPhase(idx: number): Promise<void> {
  const p = G.players[idx];
  if (p.isAI) {
    await aiPlayPhase(idx);
    return;
  }
  while (p.alive && !G.gameOver) {
    const opts: ChoiceOption[] = [];
    for (const c of p.hand) {
      if (c.sub === 'sha') opts.push({ label: `【杀】${c.suit}${c.num}`, value: 'sha_' + c.id });
      else if (c.sub === 'tao' && p.hp < p.maxHp) opts.push({ label: `【桃】`, value: 'tao_' + c.id });
      else if (c.sub === 'jiu') opts.push({ label: `【酒】`, value: 'jiu_' + c.id });
      else if (c.type === 'trick') opts.push({ label: `【${c.name}】`, value: 'trick_' + c.id });
      else if (c.type === 'equip') opts.push({ label: `【${c.name}】`, value: 'equip_' + c.id });
    }
    if (!p.flags.skillUsed) {
      p.skills.forEach((s) => {
        if (s.type === 'active') {
          const isLord = Object.values(FACTIONS).some((f) => f.lordSkill.id === s.id);
          opts.push({
            label: `▶${isLord ? '主公技·' : ''}${s.name}（需答题）`,
            value: 'skill_' + s.id,
            skill: true,
            lord: isLord,
          });
        }
      });
    }
    opts.push({ label: '结束出牌', value: 'end' });
    const ch = await waitChoice(idx, opts, 'play');
    if (ch === 'end' || !ch) break;
    if (!p.alive || G.gameOver) break;
    if (String(ch).startsWith('skill_')) {
      await useActiveSkill(idx, String(ch).slice(6));
      continue;
    }
    const [kind, idStr] = String(ch).split('_');
    const id = Number(idStr);
    const card = p.hand.find((c) => c.id === id);
    if (!card) continue;
    if (kind === 'sha') {
      if (p.flags.noSha) {
        addLog('本回合不能使用【杀】');
        continue;
      }
      const targets: ChoiceOption[] = [];
      for (let i = 0; i < G.players.length; i++) {
        if (i === idx || !G.players[i].alive) continue;
        if (inRange(idx, i)) targets.push({ label: `攻击 ${G.players[i].name}`, value: i });
      }
      if (!targets.length) {
        addLog('攻击范围内无目标');
        continue;
      }
      targets.push({ label: '取消', value: -1 });
      const t = await waitChoice(idx, targets, 'target');
      if (Number(t) < 0) continue;
      discardCard(p, card);
      await useSha(idx, t as number);
    } else if (kind === 'tao') {
      discardCard(p, card);
      await useTao(idx);
    } else if (kind === 'jiu') {
      discardCard(p, card);
      await useJiu(idx);
    } else if (kind === 'trick') {
      let tgt: number | null = null;
      if (['guohe', 'shunshou', 'juedou', 'lebu'].includes(card.sub)) {
        const targets: ChoiceOption[] = [];
        for (let i = 0; i < G.players.length; i++) {
          if (i === idx || !G.players[i].alive) continue;
          if (card.sub === 'shunshou' && distBetween(idx, i) > 1) continue;
          if (hasSkill(G.players[i], 'fenshu')) continue;
          targets.push({ label: G.players[i].name, value: i });
        }
        if (!targets.length) {
          addLog('无合法目标');
          continue;
        }
        targets.push({ label: '取消', value: -1 });
        const t = await waitChoice(idx, targets, 'target');
        if (Number(t) < 0) continue;
        tgt = t as number;
      }
      discardCard(p, card);
      await useTrick(idx, card, tgt);
    } else if (kind === 'equip') {
      discardCard(p, card, false);
      showPlayCard(card, p.name, FACTIONS[p.faction].color);
      addPlayLog(p.name, 'use', card.name, '');
      if (card.sub === 'weapon') {
        if (p.equip.weapon) G.discard.push(p.equip.weapon);
        p.equip.weapon = card;
      } else if (card.sub === 'armor') {
        if (p.equip.armor) G.discard.push(p.equip.armor);
        p.equip.armor = card;
      } else if (card.sub === 'horse+') {
        if (p.equip.horsePlus) G.discard.push(p.equip.horsePlus);
        p.equip.horsePlus = card;
      } else if (card.sub === 'horse-') {
        if (p.equip.horseMinus) G.discard.push(p.equip.horseMinus);
        p.equip.horseMinus = card;
      }
      addLog(`${p.name} 装备【${card.name}】`);
      render();
      if (NET.isHost) scheduleSync();
    }
    if (!p.alive || G.gameOver) break;
  }
}

export async function discardPhase(p: (typeof G.players)[number]): Promise<void> {
  const limit = handLimit(p);
  while (p.hand.length > limit && p.hand.length > 0) {
    if (p.isAI) {
      const c = p.hand.pop()!;
      G.discard.push(c);
    } else {
      const opts: ChoiceOption[] = p.hand.map((c) => ({ label: c.name, value: c.id }));
      if (!opts.length) break;
      const ch = await waitChoice(G.players.indexOf(p), opts, 'discard');
      const cid = typeof ch === 'number' ? ch : Number(ch);
      const c = p.hand.find((x) => x.id === cid);
      if (c) {
        discardCard(p, c);
        addLog(`${p.name} 弃置【${c.name}】`);
      } else break;
    }
  }
  render();
}
