/* ==================== 回合流程 ==================== */
import type { Card, ChoiceOption, DamageType } from '../core/types';
import { G } from './state';
import { FX } from '../core/fx';
import { FACTIONS } from '../data/factions';
import { C, SHA_SUBS } from '../data/cards';
import { addLog, addPlayLog } from './log';
import { hasSkill, drawCards, discardCard, distBetween, inRange, handLimit } from './rules';
import { Sound } from '../core/sound';
import { equipFx } from '../core/fx';
import { render } from '../ui/render';
import { showPlayCard } from '../ui/playzone';
import { EQUIP_DESC, showPlayHint } from '../ui/hint';
import { waitChoice } from './choice';
import { askQuizForPlayer } from './quiz';
import { aiPlayPhase, aiQuiz, aiSpeak } from './ai';
import { dealDamage, onLoseArmor } from './damage';
import { useActiveSkill } from './skills';
import { triggerExtraDraw } from './skillfx';
import { useSha, useTao, useJiu, useTrick } from './actions';
import { NET, scheduleSync } from '../net/network';

export async function runTurn(idx: number): Promise<void> {
  const p = G.players[idx];
  if (!p.alive) return;
  // 翻面：跳过整个回合并翻回正面（严格原版：与铁索连环的「横置」相互独立）
  if (p.turned) {
    p.turned = false;
    addLog(`🔄 ${p.name} 处于翻面状态，跳过本回合`, 'hl');
    render();
    return;
  }
  // 回合初重置一切「本回合」状态：
  // - shaUsed/skillUsed/noSha：原有
  // - skipPlay：乐不思蜀等延时锦囊只跳过「当前」回合的判定阶段，必须在此清零，
  //   否则一旦被跳过就永久失去出牌阶段（曾经的严重漏洞）
  // - extraDamage：【酒】的加成只在本回合有效，没打出杀也不得留到下一回合
  // - jiuUsed：【酒】每回合限饮一次，防止多张酒叠加一刀秒杀
  p.flags.shaUsed = 0;
  p.flags.skillUsed = false;
  p.flags.noSha = false;
  p.flags.skipPlay = false;
  p.flags.extraDamage = 0;
  p.flags.jiuUsed = false;
  G.current = idx;
  addLog(`—— ${p.name}（${FACTIONS[p.faction].name}）的回合 ——`, 'hl');
  Sound.play('turn');
  if (p.isAI) aiSpeak(p, 'idle');
  render();
  await judgePhase(p);
  let drawN = 2;
  // 「光合」生物·初中：摸牌阶段额外摸一张（「优选法」youxuan 原有逻辑不变：摸后需弃一张）
  if (hasSkill(p, 'youxuan') || hasSkill(p, 'guanghe')) drawN += 1;
  // 扩展包触发技：摸牌阶段额外摸牌原语（生物「光合产能」extraDraw: +1 等）
  drawN += triggerExtraDraw(p);
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
    // 本回合是否还能出【杀】：连弩无限；否则每回合限一次；noSha 时本回合禁止
    const canSha =
      !p.flags.noSha && (p.equip.weapon?.skill === 'liannu' || (p.flags.shaUsed || 0) < 1);
    const opts: ChoiceOption[] = [];
    for (const c of p.hand) {
      if (SHA_SUBS.includes(c.sub) && canSha) opts.push({ label: `【${c.name}】${c.suit}${c.num}`, value: 'sha_' + c.id });
      else if (c.sub === 'tao' && p.hp < p.maxHp) opts.push({ label: `【桃】`, value: 'tao_' + c.id });
      else if (c.sub === 'jiu' && !p.flags.jiuUsed) opts.push({ label: `【酒】`, value: 'jiu_' + c.id });
      else if (c.type === 'trick' && c.sub !== 'wuxie') opts.push({ label: `【${c.name}】`, value: 'trick_' + c.id });
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
    if (canSha && p.equip.weapon?.skill === 'zhangba' && p.hand.length >= 2) {
      opts.push({ label: '【丈八蛇矛】两张手牌当杀', value: 'zhangba' });
    }
    opts.push({ label: '结束出牌', value: 'end' });
    const ch = await waitChoice(idx, opts, 'play');
    if (ch === 'end' || !ch) break;
    if (!p.alive || G.gameOver) break;
    if (ch === 'zhangba') {
      const two = await pickTwoCards(idx);
      if (two.length === 2) {
        const tgt = await pickShaTarget(idx);
        if (tgt >= 0) {
          const suit = two.every((c) => c.suit === '♥' || c.suit === '♦') ? '♥' : '♠';
          discardCard(p, two[0]);
          discardCard(p, two[1]);
          addLog(`${p.name} 丈八蛇矛：两张手牌当杀`, 'hl');
          await useSha(idx, tgt, { suit });
        }
      }
      continue;
    }
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
      const cand: number[] = [];
      for (let i = 0; i < G.players.length; i++) {
        if (i === idx || !G.players[i].alive) continue;
        if (inRange(idx, i)) cand.push(i);
      }
      if (!cand.length) {
        addLog('攻击范围内无目标');
        continue;
      }
      // 方天画戟：此杀是最后一张手牌时，可指定至多 3 个目标
      const maxTargets = p.equip.weapon?.skill === 'fangtian' && p.hand.length === 1 ? 3 : 1;
      const picked = await pickShaTargets(idx, cand, maxTargets);
      if (!picked.length) continue;
      const dmgType: DamageType = card.damageType || 'normal';
      discardCard(p, card);
      for (let k = 0; k < picked.length; k++) {
        if (!G.players[picked[k]].alive) continue;
        await useSha(idx, picked[k], { suit: card.suit, damageType: dmgType, fromFangtian: k > 0 });
      }
    } else if (kind === 'tao') {
      discardCard(p, card);
      await useTao(idx);
    } else if (kind === 'jiu') {
      if (p.flags.jiuUsed) {
        addLog('本回合已使用过【酒】');
        continue;
      }
      discardCard(p, card);
      await useJiu(idx);
    } else if (kind === 'trick') {
      let tgt: number | null = null;
      let second: number | null = null;
      // 铁索连环：可重铸（弃此牌摸一张）
      if (card.sub === 'tiesuo') {
        const recast =
          (await waitChoice(idx, [
            { label: '指定一名角色（横置 / 重置）', value: 'use' },
            { label: '重铸：弃此牌并摸一张牌', value: 'recast' },
          ], 'list')) === 'recast';
        if (recast) {
          discardCard(p, card);
          drawCards(p, 1);
          addLog(`${p.name} 重铸【铁索连环】，摸一张牌`, 'hl');
          render();
          continue;
        }
      }
      if (['guohe', 'shunshou', 'juedou', 'lebu', 'huogong', 'tiesuo'].includes(card.sub)) {
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
      if (card.sub === 'jiedao') {
        const holders: ChoiceOption[] = [];
        for (let i = 0; i < G.players.length; i++) {
          if (i === idx || !G.players[i].alive) continue;
          const w = G.players[i].equip.weapon;
          if (!w || hasSkill(G.players[i], 'fenshu')) continue;
          holders.push({ label: `借刀：${G.players[i].name}（${w.name}）`, value: i });
        }
        if (!holders.length) {
          addLog('无人装备武器，无法借刀');
          continue;
        }
        holders.push({ label: '取消', value: -1 });
        const h = await waitChoice(idx, holders, 'target');
        if (Number(h) < 0) continue;
        const hi = h as number;
        const victims: ChoiceOption[] = [];
        for (let i = 0; i < G.players.length; i++) {
          if (i === hi || !G.players[i].alive) continue;
          if (inRange(hi, i)) victims.push({ label: `令其攻击 ${G.players[i].name}`, value: i });
        }
        if (!victims.length) {
          addLog('该角色攻击范围内无目标');
          continue;
        }
        victims.push({ label: '取消', value: -1 });
        const v = await waitChoice(idx, victims, 'target');
        if (Number(v) < 0) continue;
        tgt = hi;
        second = v as number;
      }
      discardCard(p, card);
      await useTrick(idx, card, tgt, second);
    } else if (kind === 'equip') {
      discardCard(p, card, false);
      showPlayCard(card, p.name, FACTIONS[p.faction].color);
      addPlayLog(p.name, 'use', card.name, '');
      if (card.sub === 'weapon') {
        if (p.equip.weapon) G.discard.push(p.equip.weapon);
        p.equip.weapon = card;
      } else if (card.sub === 'armor') {
        if (p.equip.armor) {
          onLoseArmor(p, p.equip.armor);
          G.discard.push(p.equip.armor);
        }
        p.equip.armor = card;
      } else if (card.sub === 'horse+') {
        if (p.equip.horsePlus) G.discard.push(p.equip.horsePlus);
        p.equip.horsePlus = card;
      } else if (card.sub === 'horse-') {
        if (p.equip.horseMinus) G.discard.push(p.equip.horseMinus);
        p.equip.horseMinus = card;
      }
      addLog(`${p.name} 装备【${card.name}】`);
      showPlayHint('装备', card.name, EQUIP_DESC[card.skill || ''] || '');
      Sound.play('equip');
      void equipFx(idx, card.name);
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

/** 依次选择【杀】的目标：max>1 时可多选（方天画戟最多 3 个），返回已选目标 */
async function pickShaTargets(idx: number, cand: number[], max: number): Promise<number[]> {
  const picked: number[] = [];
  const rest = [...cand];
  while (picked.length < max && rest.length) {
    const opts: ChoiceOption[] = rest.map((i) => ({ label: `攻击 ${G.players[i].name}`, value: i }));
    opts.push({ label: picked.length ? '结束选择' : '取消', value: -1 });
    const t = await waitChoice(idx, opts, 'target');
    const v = Number(t);
    if (v < 0) break;
    picked.push(v);
    rest.splice(rest.indexOf(v), 1);
  }
  return picked;
}

/** 选单个【杀】目标（丈八蛇矛用），返回 -1 表示取消 */
async function pickShaTarget(idx: number): Promise<number> {
  const cand: number[] = [];
  for (let i = 0; i < G.players.length; i++) {
    if (i === idx || !G.players[i].alive) continue;
    if (inRange(idx, i)) cand.push(i);
  }
  if (!cand.length) {
    addLog('攻击范围内无目标');
    return -1;
  }
  const r = await pickShaTargets(idx, cand, 1);
  return r.length ? r[0] : -1;
}

/** 依次选择两张手牌（丈八蛇矛用），任意一步取消则返回空 */
async function pickTwoCards(idx: number): Promise<Card[]> {
  const p = G.players[idx];
  const firstOpts = p.hand.map((c) => ({ label: `${c.name} ${c.suit}${c.num}`, value: c.id }));
  firstOpts.push({ label: '取消', value: -1 });
  const f = await waitChoice(idx, firstOpts, 'list');
  const fid = typeof f === 'number' ? f : Number(f);
  if (fid < 0) return [];
  const fc = p.hand.find((c) => c.id === fid);
  if (!fc) return [];
  const secondOpts = p.hand
    .filter((c) => c.id !== fid)
    .map((c) => ({ label: `${c.name} ${c.suit}${c.num}`, value: c.id }));
  secondOpts.push({ label: '取消', value: -1 });
  const s = await waitChoice(idx, secondOpts, 'list');
  const sid = typeof s === 'number' ? s : Number(s);
  if (sid < 0) return [];
  const sc = p.hand.find((c) => c.id === sid);
  if (!sc) return [];
  return [fc, sc];
}
