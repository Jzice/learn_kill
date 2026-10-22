/* ==================== 出牌 ==================== */
import type { Card, DamageType, Player } from '../core/types';
import { G } from './state';
import { FX, aoeFx, drawFx, floatTextFx, trickCast } from '../core/fx';
import { Sound } from '../core/sound';
import { FACTIONS } from '../data/factions';
import { C, SHA_SUBS } from '../data/cards';
import { addLog, addPlayLog } from './log';
import { discardCard, drawCards, genderOf, inRange, sameFaction } from './rules';
import {
  canBeTarget,
  canConvertAs,
  cardImmuneTo,
  consumeRedirect,
  enemyEquipVoidOf,
  equipImmune,
  fire,
  markConvertUse,
  shaLimitOf,
  shanNeeded,
  tryNumGuard,
  tryPreventShaDamage,
  tryReflect,
} from './skillEngine';
import { render } from '../ui/render';
import { showPlayCard } from '../ui/playzone';
import { showPlayHint, TRICK_DESC } from '../ui/hint';
import { aiQuiz, aiSpeak } from './ai';
import { aiQuizRate, aiShouldCounter } from './aibrain';
import { dealDamage, onLoseArmor } from './damage';
import { triggerDamageMod } from './skillfx';
import { runSkillEffects } from './skillfx';
import { expansionItemById } from '../data/expansion';
import { waitChoice } from './choice';
import { askQuizForPlayer } from './quiz';
import { NET, scheduleSync, syncStateToClients } from '../net/network';

/** 结算一次【杀】的伤害值（精忠 / 古锭刀 / 酒·额外伤害），并消耗额外伤害 */
function shaDamage(a: Player, t: Player): number {
  let dmg = 1;
  // 古锭刀：目标没有手牌时伤害 +1
  if (a.equip.weapon?.skill === 'guding' && t.hand.length === 0) dmg += 1;
  // 扩展包触发技：出杀/伤害加成原语（物理「力大无穷」damageMod: +1 等）
  dmg += triggerDamageMod(a);
  // 局前武器加成：出杀/伤害 +n（由配装注入，整局有效）
  if (a.flags.bonusDmg) dmg += a.flags.bonusDmg;
  if (a.flags.extraDamage) {
    dmg += a.flags.extraDamage;
    a.flags.extraDamage = 0;
  }
  return dmg;
}

/** 弃置指定玩家手牌末尾 n 张（AI/自动弃牌用） */
function dumpHand(p: Player, n: number): void {
  for (let k = 0; k < n && p.hand.length > 0; k++) {
    const c = p.hand.pop()!;
    G.discard.push(c);
  }
}

/** 转移候选人的 AI 评分：优先非同阵营 + 手牌多（把祸水引向"敌人"） */
function redirectScore(from: Player, to: Player): number {
  return (sameFaction(from, to) ? 0 : 2) + Math.min(to.hand.length, 5) * 0.2;
}

/** 墨子【兼爱】：成为锦囊目标时，可将其转移给另一名角色（每回合限一次） */
async function tryTrickRedirect(attackerIdx: number, targetIdx: number): Promise<number> {
  const t = G.players[targetIdx];
  if (!t || !t.alive) return targetIdx;
  const cands = G.players.map((_, i) => i).filter(
    (i) => i !== attackerIdx && i !== targetIdx && G.players[i].alive && canBeTarget(i, 'trick'),
  );
  if (!cands.length) return targetIdx;
  const d = consumeRedirect(t, 'trickRedirect');
  if (!d) return targetIdx;
  addLog(`【${d.name}】${t.name} 将此锦囊转移给另一名角色`, 'hl');
  let to = cands[0];
  if (t.isAI) {
    to = cands.reduce((best, i) => (redirectScore(t, G.players[i]) > redirectScore(t, G.players[best]) ? i : best), cands[0]);
  } else {
    const ch = await waitChoice(
      targetIdx,
      cands.map((i) => ({ label: `转移给 ${G.players[i].name}`, value: i })),
      'target',
    );
    const v = Number(ch);
    if (Number.isFinite(v) && cands.includes(v)) to = v;
  }
  render();
  return to;
}

/** 卢瑟福【散射实验】：成为【杀】目标时，可将其转移给另一名角色（每回合限一次） */
async function tryShaRedirect(attackerIdx: number, targetIdx: number): Promise<number> {
  const t = G.players[targetIdx];
  if (!t || !t.alive) return targetIdx;
  const cands = G.players.map((_, i) => i).filter(
    (i) => i !== attackerIdx && i !== targetIdx && G.players[i].alive && canBeTarget(i, 'sha'),
  );
  if (!cands.length) return targetIdx;
  const d = consumeRedirect(t, 'shaRedirect');
  if (!d) return targetIdx;
  addLog(`【${d.name}】${t.name} 将此【杀】转移给另一名角色`, 'hl');
  let to = cands[0];
  if (t.isAI) {
    to = cands.reduce((best, i) => (redirectScore(t, G.players[i]) > redirectScore(t, G.players[best]) ? i : best), cands[0]);
  } else {
    const ch = await waitChoice(
      targetIdx,
      cands.map((i) => ({ label: `转移给 ${G.players[i].name}`, value: i })),
      'target',
    );
    const v = Number(ch);
    if (Number.isFinite(v) && cands.includes(v)) to = v;
  }
  render();
  return to;
}

export async function useSha(
  attackerIdx: number,
  targetIdx: number,
  opts: {
    fromQinglong?: boolean;
    fromFangtian?: boolean;
    fromJiedao?: boolean;
    suit?: string;
    /** 【杀】的点数（林则徐·海防 点数对抗判据） */
    num?: string | number;
    damageType?: DamageType;
  } = {},
): Promise<void> {
  const a = G.players[attackerIdx],
    t = G.players[targetIdx];
  // 空城等免疫：不能成为【杀】的目标
  if (!canBeTarget(targetIdx, 'sha')) {
    addLog(`${t.name} 不可被指定为【杀】的目标`, 'hl');
    return;
  }
  // 卢瑟福【散射实验】：成为【杀】目标时可转移给另一名角色，再以新目标重新结算
  const redirectTo = await tryShaRedirect(attackerIdx, targetIdx);
  if (redirectTo !== targetIdx) {
    return useSha(attackerIdx, redirectTo, opts);
  }
  // 墨子【非攻】：目标的武器 / 防具对其余角色无效（装备失效）
  const wVoid = enemyEquipVoidOf(t, 'weapon');
  const aVoid = enemyEquipVoidOf(t, 'armor');
  const hasLiannu = !wVoid && a.equip.weapon?.skill === 'liannu';
  // 每回合出杀上限：连弩无限；咆哮可额外出杀（伽利略·自由落体）
  const shaCap = hasLiannu ? Infinity : shaLimitOf(a);
  if (
    !hasLiannu &&
    !opts.fromQinglong &&
    !opts.fromFangtian &&
    !opts.fromJiedao &&
    (a.flags.shaUsed || 0) >= shaCap
  ) {
    addLog('本回合已使用过【杀】');
    return;
  }
  a.flags.shaUsed = (a.flags.shaUsed || 0) + 1;
  const dmgType: DamageType = opts.damageType || 'normal';
  const cname = dmgType === 'fire' ? '火杀' : dmgType === 'thunder' ? '雷杀' : '杀';
  const suit = opts.suit ?? '♠';
  addPlayLog(a.name, 'use', cname, t.name);
  aiSpeak(a, 'attack');
  FX.attackLunge(attackerIdx);
  Sound.play('sha');
  showPlayCard({ name: cname, suit, num: '?', type: 'basic' }, a.name, FACTIONS[a.faction].color);
  await FX.flyCard(attackerIdx, targetIdx, cname, 'basic');
  // 青釭剑：无视目标防具（仁王盾 / 八卦阵 / 藤甲 / 白银狮子均失效）；墨子【非攻】令防具失效
  const ignoreArmor = a.equip.weapon?.skill === 'qinggang' && !wVoid;
  const armor = ignoreArmor || aVoid ? undefined : t.equip.armor?.skill;
  const black = suit === '♠' || suit === '♣';
  if (armor === 'renwang' && black) {
    addLog(`${t.name} 的【仁王盾】挡下了黑色【杀】`, 'hl');
    render();
    return;
  }
  // 藤甲：普通【杀】无效（属性杀可生效且火焰伤害 +1）
  if (armor === 'tengjia' && dmgType === 'normal') {
    addLog(`${t.name} 的【藤甲】挡下了普通【杀】`, 'hl');
    render();
    return;
  }
  // 雌雄双股剑：对异性角色使用杀，对方选择「令你摸一张」或「自弃一张」
  if (a.equip.weapon?.skill === 'cixiong' && !wVoid && genderOf(a) !== genderOf(t)) {
    addLog(`【雌雄双股剑】：${t.name} 需抉择`, 'hl');
    let ch: string | number = 'draw';
    if (t.hand.length > 0) {
      ch = t.isAI
        ? // 对敌方：弃自己一张（不让攻击者摸牌）；对同阵营：让队友摸牌
          sameFaction(a, t)
          ? 'draw'
          : 'discard'
        : await waitChoice(targetIdx, [
            { label: `令 ${a.name} 摸一张牌`, value: 'draw' },
            { label: '弃置自己一张手牌', value: 'discard' },
          ], 'list');
    }
    if (ch === 'discard' && t.hand.length > 0) {
      dumpHand(t, 1);
      addLog(`${t.name} 弃置一张手牌`, 'dmg');
    } else {
      drawCards(a, 1);
      addLog(`${a.name} 摸一张牌`, 'hl');
    }
    render();
  }
  /** 命中结算：兼爱可防止伤害，散射实验可反伤 */
  const resolveHit = async (): Promise<void> => {
    if (await tryPreventShaDamage(attackerIdx, targetIdx)) return;
    await dealDamage(attackerIdx, targetIdx, shaDamage(a, t), dmgType, ignoreArmor);
    await tryReflect(attackerIdx, targetIdx);
  };
  // 林则徐【海防】：展示一张手牌，点数 ≥ 此【杀】点数则此杀无效
  if (await tryNumGuard(targetIdx, Number(opts.num ?? 0))) {
    render();
    return;
  }
  // 岳飞【精忠】（无双）：每回合第一张【杀】需连续使用两张【闪】才能抵消
  const needShan = shanNeeded(attackerIdx);
  if (needShan > 1) addLog(`【精忠】${t.name} 需连续使用 ${needShan} 张【闪】才能抵消`, 'hl');
  const dodged = await requestShan(targetIdx, attackerIdx, { ignoreArmor, need: needShan });
  if (dodged) {
    // 贯石斧：弃两张牌，令此杀强制命中
    if (a.equip.weapon?.skill === 'guanshi' && !wVoid && a.hand.length >= 2) {
      const force = a.isAI
        ? true
        : (await waitChoice(attackerIdx, [
            { label: '🪓 贯石斧：弃两张牌强制命中', value: 'yes' },
            { label: '不发动', value: 'no' },
          ], 'list')) === 'yes';
      if (force) {
        dumpHand(a, 2);
        addLog(`${a.name} 贯石斧：弃两张牌，此杀不可闪避`, 'hl');
        render();
        await resolveHit();
        return;
      }
    }
    // 青龙偃月刀：杀被闪后可对同目标再出一张杀
    // 规则：需消耗一张手牌中的【杀】；该杀不计入出杀次数上限；若被再次闪避可继续发动（链式）
    if (a.equip.weapon?.skill === 'qinglong' && !wVoid && t.alive) {
      const shaInHand = inRange(attackerIdx, targetIdx)
        ? a.hand.find((c) => SHA_SUBS.includes(c.sub))
        : undefined;
      const again = !!shaInHand && (a.isAI
        ? true
        : (await waitChoice(
            attackerIdx,
            [
              { label: '🐉 青龙偃月刀：再出一张杀', value: 'yes' },
              { label: '不发动', value: 'no' },
            ],
            'list',
          )) === 'yes');
      if (again && shaInHand) {
        discardCard(a, shaInHand);
        await useSha(attackerIdx, targetIdx, {
          fromQinglong: true,
          suit: shaInHand.suit,
          damageType: shaInHand.damageType,
        });
        return;
      }
    }
    return;
  }
  // 寒冰剑：防止伤害，改为弃置目标两张牌
  if (a.equip.weapon?.skill === 'hanbing' && a.hand.length >= 2) {
    const useSkill = a.isAI
      ? t.hand.length >= 2
      : (await waitChoice(attackerIdx, [
          { label: '❄️ 寒冰剑：弃两张牌，改为令其弃两张牌', value: 'yes' },
          { label: '正常造成伤害', value: 'no' },
        ], 'list')) === 'yes';
    if (useSkill) {
      dumpHand(a, 2);
      dumpHand(t, 2);
      addLog(`【寒冰剑】${t.name} 弃置两张手牌，免除伤害`, 'hl');
      render();
      return;
    }
  }
  await resolveHit();
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
  // 每回合限一次：多张酒不得叠加，避免一刀秒杀（原版规则）
  if (p.flags.jiuUsed) {
    addLog('本回合已使用过【酒】');
    return;
  }
  p.flags.jiuUsed = true;
  p.flags.extraDamage = (p.flags.extraDamage || 0) + 1;
  addPlayLog(p.name, 'use', '酒', '');
  showPlayCard({ name: '酒', suit: '♠', num: '?', type: 'basic' }, p.name, FACTIONS[p.faction].color);
  Sound.play('jiu');
  FX.skillWave(idx);
}

export async function useTrick(
  attackerIdx: number,
  card: Card,
  targetIdxIn: number | null,
  secondTarget: number | null = null,
): Promise<void> {
  const a = G.players[attackerIdx];
  let targetIdx = targetIdxIn;
  const tn = targetIdx != null ? G.players[targetIdx].name : '';
  addPlayLog(a.name, 'use', card.name, tn);
  addLog(`📘 玩法·【${card.name}】：${TRICK_DESC[card.sub] || '（暂无说明）'}`, 'explain');
  showPlayHint('锦囊', card.name, TRICK_DESC[card.sub] || '');
  showPlayCard(card, a.name, FACTIONS[a.faction].color);
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
  const COUNTERABLE = [
    'wuzhong', 'guohe', 'shunshou', 'juedou', 'nanman', 'wanjian', 'taoyuan',
    'jiedao', 'wugu', 'tiesuo', 'huogong',
  ];
  if (COUNTERABLE.includes(card.sub)) {
    const res = await counterChain(attackerIdx, card.sub, targetIdx);
    if (res.countered) {
      addLog(`【无懈可击】生效，${card.name} 被抵消`, 'hl');
      // 茅盾【批判】：锦囊被无懈后可弃一张牌令其弃一张牌
      await fire('onTrickCountered', {
        idx: attackerIdx,
        srcIdx: res.by,
        card,
        targetIdx: targetIdx ?? undefined,
      });
      render();
      return;
    }
  }

  // 墨子【兼爱】：单体锦囊结算前，目标可将其转移给另一名角色
  const SINGLE_TARGET_TRICKS = ['guohe', 'shunshou', 'juedou', 'lebu', 'huogong', 'tiesuo'];
  if (targetIdx != null && SINGLE_TARGET_TRICKS.includes(card.sub)) {
    targetIdx = await tryTrickRedirect(attackerIdx, targetIdx);
  }

  switch (card.sub) {
    case 'wuzhong': {
      drawCards(a, 2);
      drawFx(attackerIdx, 2);
      addLog(`${a.name} 摸2张牌`);
      break;
    }
    case 'guohe': {
      if (targetIdx != null && canBeTarget(targetIdx, 'trick', '过河拆桥', card.suit)) {
        await discardTargetCard(targetIdx, attackerIdx, '弃置');
      }
      break;
    }
    case 'shunshou': {
      if (targetIdx != null && canBeTarget(targetIdx, 'trick', '顺手牵羊', card.suit)) {
        await discardTargetCard(targetIdx, attackerIdx, '获得');
      }
      break;
    }
    case 'juedou': {
      if (targetIdx == null || !canBeTarget(targetIdx, 'juedou', '决斗', card.suit)) break;
      let def: Player = G.players[targetIdx],
        ai = attackerIdx,
        di = targetIdx;
      while (true) {
        const sha = def.hand.find((c) => SHA_SUBS.includes(c.sub));
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
        if (!canBeTarget(i, 'trick', '南蛮入侵', card.suit)) continue;
        targets.push(i);
      }
      await aoeFx(attackerIdx, targets, '#e74c3c');
      for (const i of targets) {
        const t = G.players[i];
        if (!t.alive) continue;
        // 藤甲：南蛮入侵无效
        if (t.equip.armor?.skill === 'tengjia') {
          addLog(`${t.name} 的【藤甲】令【南蛮入侵】无效`, 'hl');
          continue;
        }
        const sha = t.hand.find((c) => SHA_SUBS.includes(c.sub));
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
        if (!canBeTarget(i, 'trick', '万箭齐发', card.suit)) continue;
        targets.push(i);
      }
      await aoeFx(attackerIdx, targets, '#f39c12');
      for (const i of targets) {
        const t = G.players[i];
        if (!t.alive) continue;
        // 藤甲：万箭齐发无效
        if (t.equip.armor?.skill === 'tengjia') {
          addLog(`${t.name} 的【藤甲】令【万箭齐发】无效`, 'hl');
          continue;
        }
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
      if (targetIdx != null && canBeTarget(targetIdx, 'trick', '乐不思蜀', card.suit)) {
        G.players[targetIdx].judge.push({ ...card, judgeType: 'lebu' });
        addLog(`【乐不思蜀】置于 ${G.players[targetIdx].name} 判定区`);
      }
      break;
    }
    case 'shandian': {
      // 法拉第【避雷针】：不能成为【闪电】的目标
      if (cardImmuneTo(a, '闪电')) {
        addLog(`${a.name} 免疫【闪电】，无法置于判定区`, 'hl');
        break;
      }
      a.judge.push({ ...card, judgeType: 'shandian' });
      addLog(`【闪电】置于 ${a.name} 判定区`);
      break;
    }
    case 'jiedao': {
      if (targetIdx != null && secondTarget != null) {
        const holder = G.players[targetIdx];
        const victim = G.players[secondTarget];
        let attack = false;
        const shaCard = holder.hand.find((c) => SHA_SUBS.includes(c.sub));
        if (holder.isAI) attack = !!shaCard && inRange(targetIdx, secondTarget);
        else if (shaCard && inRange(targetIdx, secondTarget)) {
          attack =
            (await waitChoice(targetIdx, [
              { label: `对 ${victim.name} 使用【杀】`, value: 'attack' },
              { label: `交出武器【${holder.equip.weapon?.name || '武器'}】`, value: 'give' },
            ], 'list')) === 'attack';
        }
        if (attack && shaCard) {
          discardCard(holder, shaCard);
          addLog(`${holder.name} 对 ${victim.name} 使用【杀】`);
          await useSha(targetIdx, secondTarget, {
            fromJiedao: true,
            suit: shaCard.suit,
            damageType: shaCard.damageType,
          });
        } else {
          const w = holder.equip.weapon;
          if (w) {
            holder.equip.weapon = null;
            a.hand.push(w);
            addLog(`${a.name} 获得 ${holder.name} 的【${w.name}】`, 'hl');
          }
        }
      }
      break;
    }
    case 'wugu': {
      const aliveCount = G.players.filter((q) => q.alive).length;
      const shown: Card[] = [];
      for (let k = 0; k < aliveCount; k++) {
        const c = G.deck.pop();
        if (c) shown.push(c);
      }
      addLog(`【五谷丰登】亮出 ${shown.length} 张牌`, 'hl');
      const order: number[] = [];
      const start = G.players.indexOf(a);
      for (let k = 0; k < G.players.length; k++) {
        const i = (start + k) % G.players.length;
        if (G.players[i].alive) order.push(i);
      }
      for (const i of order) {
        if (!shown.length) break;
        const pl = G.players[i];
        if (!canBeTarget(i, 'trick')) continue;
        let pickId = shown[0].id;
        if (!pl.isAI) {
          const ch = await waitChoice(
            i,
            shown.map((c) => ({ label: `【${c.name}】${c.suit}${c.num}`, value: c.id })),
            'list',
          );
          pickId = Number(ch);
        } else {
          // AI 按价值挑牌：桃 > 杀 > 闪 > 装备 > 无懈 > 其他
          const rank = (c: Card): number =>
            c.sub === 'tao'
              ? 5
              : SHA_SUBS.includes(c.sub)
                ? 4
                : c.sub === 'shan'
                  ? 3
                  : c.type === 'equip'
                    ? 2
                    : c.sub === 'wuxie'
                      ? 1
                      : 0;
          pickId = shown.reduce((best, c) => (rank(c) > rank(best) ? c : best), shown[0]).id;
        }
        let at = shown.findIndex((c) => c.id === pickId);
        if (at < 0) at = 0;
        const got = shown.splice(at, 1)[0];
        pl.hand.push(got);
        addLog(`${pl.name} 获得【${got.name}】`);
      }
      shown.forEach((c) => G.discard.push(c));
      break;
    }
    case 'tiesuo': {
      const ids = [targetIdx, secondTarget].filter((x): x is number => x != null && x >= 0);
      for (const ti of ids) {
        const t = G.players[ti];
        if (!t || !t.alive) continue;
        t.chained = !t.chained;
        addLog(
          t.chained
            ? `【铁索连环】${t.name} 横置（进入连环）`
            : `【铁索连环】${t.name} 重置（解除连环）`,
          'hl',
        );
      }
      break;
    }
    case 'huogong': {
      if (targetIdx != null) {
        const t = G.players[targetIdx];
        const shown = t.hand.length ? t.hand[Math.floor(Math.random() * t.hand.length)] : null;
        addLog(
          shown
            ? `【火攻】${t.name} 展示【${shown.name}】${shown.suit}${shown.num}`
            : `【火攻】${t.name} 无手牌可展示，火攻失败`,
          'hl',
        );
        if (shown) {
          const same = a.hand.filter((c) => c.suit === shown.suit);
          let burn = false;
          if (a.isAI) {
            burn = same.length > 0;
            if (burn && same[0]) discardCard(a, same[0]);
          } else if (same.length) {
            const ch = await waitChoice(
              attackerIdx,
              same
                .map((c) => ({ label: `弃【${c.name}】${c.suit}${c.num}`, value: 'c_' + c.id }))
                .concat([{ label: '不弃牌（火攻失败）', value: 'no' }]),
              'list',
            );
            if (String(ch).startsWith('c_')) {
              const id = Number(String(ch).slice(2));
              const c = a.hand.find((x) => x.id === id);
              if (c) {
                discardCard(a, c);
                burn = true;
              }
            }
          }
          if (burn) await dealDamage(attackerIdx, targetIdx, 1, 'fire');
          else addLog('火攻未生效', 'dmg');
        }
      }
      break;
    }
  }
  // 使用锦囊后：诗成（顺序连锁）/ 随笔 / 讽刺小说 / 诗辩 / 区位 …
  if (a.alive) {
    await fire('onUseTrick', {
      idx: attackerIdx,
      card,
      targetIdx: targetIdx ?? undefined,
      trickSeq: a.flags.trickCount || 1,
    });
  }
  render();
}

/** 无懈可击响应链：返回该锦囊是否最终被抵消（支持无懈可叠，每人每条链一次） */
async function counterChain(
  srcIdx: number,
  sub: string,
  primary: number | null,
): Promise<{ countered: boolean; by: number }> {
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
  return { countered, by: lastCounterer };
}

function trickLabel(sub: string): string {
  const m: Record<string, string> = {
    wuzhong: '无中生有', guohe: '过河拆桥', shunshou: '顺手牵羊', juedou: '决斗',
    nanman: '南蛮入侵', wanjian: '万箭齐发', taoyuan: '桃园结义',
    jiedao: '借刀杀人', wugu: '五谷丰登', tiesuo: '铁索连环', huogong: '火攻',
  };
  return m[sub] || '锦囊';
}

export async function discardTargetCard(targetIdx: number, srcIdx: number, mode: string): Promise<void> {
  const t = G.players[targetIdx];
  // 焚书（锦囊免疫）：不能被【过河拆桥】/【顺手牵羊】指定
  if (!canBeTarget(targetIdx, 'trick')) return;
  const opts: { label: string; value: string }[] = [];
  if (t.hand.length > 0) opts.push({ label: `手牌（${t.hand.length}张）`, value: 'hand' });
  // 凯库勒【结构式】：装备不能被过河拆桥 / 顺手牵羊指定
  if (!equipImmune(t)) {
    if (t.equip.weapon) opts.push({ label: `武器：${t.equip.weapon.name}`, value: 'weapon' });
    if (t.equip.armor) opts.push({ label: `防具：${t.equip.armor.name}`, value: 'armor' });
    if (t.equip.horsePlus) opts.push({ label: '+1马', value: 'horsePlus' });
    if (t.equip.horseMinus) opts.push({ label: '-1马', value: 'horseMinus' });
  }
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
    // 狄更斯【雾都孤儿】：回合外失去最后一张手牌时摸一张
    if (t.hand.length === 0 && G.current !== targetIdx) await fire('onLoseHand', { idx: targetIdx });
  } else {
    const c = t.equip[ch as keyof typeof t.equip];
    if (c) {
      if (ch === 'armor') onLoseArmor(t, c);
      t.equip[ch as keyof typeof t.equip] = null;
      if (mode === '获得') src.hand.push(c);
      else G.discard.push(c);
      addLog(`${src.name} ${mode}了 ${t.name} 的【${c.name}】`);
      await fire('onLoseEquip', { idx: targetIdx, card: c });
    }
  }
  render();
  if (NET.isHost) scheduleSync();
}

/* ==================== 消耗类道具 ==================== */
/**
 * 使用局内携带的消耗类道具（不进牌堆，不可被顺手牵羊等卡牌影响，局末清空）。
 * 消耗来自玩家「局内携带」计数（player.items），不影响个人档案库存与配装。
 */
export async function useItem(idx: number, itemId: string): Promise<void> {
  const p = G.players[idx];
  if (!p || !p.alive || !p.items || !(p.items[itemId] > 0)) return;
  const def = expansionItemById(itemId);
  if (!def) return;
  p.items[itemId] -= 1;
  if (p.items[itemId] <= 0) delete p.items[itemId];
  addLog(`🎒 ${p.name} 使用了【${def.name}】`, 'reward');
  floatTextFx(idx, def.name, '#ffd479');
  await runSkillEffects(idx, p, def.effects);
  render();
  if (NET.isHost) syncStateToClients();
}

/* ==================== 出闪 ==================== */
/**
 * 请求出【闪】：need > 1 时（无双）需连续出多张，任意一张出不起即命中。
 * 未成功闪避（need 未凑齐）返回 false。
 */
export async function requestShan(
  targetIdx: number,
  srcIdx: number,
  o: { ignoreArmor?: boolean; need?: number } = {},
): Promise<boolean> {
  const need = o.need || 1;
  for (let k = 0; k < need; k++) {
    const ok = await requestOneShan(targetIdx, srcIdx, o, need);
    if (!ok) return false;
  }
  return true;
}

async function requestOneShan(
  targetIdx: number,
  srcIdx: number,
  o: { ignoreArmor?: boolean; need?: number },
  need: number,
): Promise<boolean> {
  const t = G.players[targetIdx];
  const onDodged = async (): Promise<boolean> => true;
  const outside = G.current !== targetIdx;
  if (t.isAI) {
    // 转化技：老舍【骆驼祥子】装备当闪 / 孙子【虚实】杀当闪
    const shan =
      t.hand.find((c) => c.sub === 'shan') || t.hand.find((c) => canConvertAs(t, c, 'shan', outside));
    if (shan) {
      if (shan.sub !== 'shan') markConvertUse(t, shan, 'shan', outside);
      discardCard(t, shan);
      addLog(`${t.name} 打出【${shan.name}】`);
      await FX.shield(targetIdx);
      await fire('onUseShan', { idx: targetIdx, srcIdx, card: shan });
      return onDodged();
    }
    // 八卦阵：手中无闪时判定，红色视为打出闪（AI 此前完全不判，装备形同虚设）
    if (!o.ignoreArmor && t.equip.armor?.skill === 'bagua') {
      const jc = G.deck.pop() || C('判定', 'basic', 'none', '♠', 1);
      addLog(`【八卦阵】判定：${jc.suit}${jc.num}`, 'hl');
      G.discard.push(jc);
      if (jc.suit === '♥' || jc.suit === '♦') {
        addLog('【八卦阵】判定为红色，视为闪', 'hl');
        await FX.shield(targetIdx);
        return onDodged();
      }
      addLog('【八卦阵】判定失败');
    }
    if (t.knowledge >= 1 && aiQuiz(aiQuizRate(t))) {
      t.knowledge--;
      addLog(`${t.name} 消耗学识当闪`);
      await FX.shield(targetIdx);
      return onDodged();
    }
    // 护盾当闪：残血时值得用（护盾是稀缺资源，满血时留给更需要的时候）
    if ((t.shield || 0) >= 1 && t.hp <= 2) {
      t.shield--;
      addLog(`${t.name} 消耗1护盾当闪`);
      await FX.shield(targetIdx);
      return onDodged();
    }
    return false;
  }
  const opts: { label: string; value: string }[] = [];
  const shans = t.hand.filter((c) => c.sub === 'shan' || canConvertAs(t, c, 'shan', outside));
  shans.forEach((c) =>
    opts.push({
      label: c.sub === 'shan' ? `【闪】${c.suit}${c.num}` : `【${c.name}】${c.suit}${c.num} 当【闪】`,
      value: 'card_' + c.id,
    }),
  );
  // 答题免伤/学识当闪 仅在手中无【闪】时可选：有闪必须出闪，保证闪牌价值（提高可玩性）
  const noShan = shans.length === 0;
  if (noShan && !o.ignoreArmor && t.equip.armor?.skill === 'bagua') {
    const jc = G.deck.pop() || C('判定', 'basic', 'none', '♠', 1);
    addLog(`【八卦阵】判定：${jc.suit}${jc.num}`, 'hl');
    G.discard.push(jc);
    if (jc.suit === '♥' || jc.suit === '♦') {
      addLog('【八卦阵】判定为红色，视为闪', 'hl');
      await FX.shield(targetIdx);
      return onDodged();
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
    return onDodged();
  }
  if (ch === 'shield') {
    t.shield--;
    addLog(`${t.name} 消耗护盾当闪`);
    await FX.shield(targetIdx);
    return onDodged();
  }
  if (ch === 'quiz') {
    const ok = await askQuizForPlayer(t, false);
    if (ok) {
      addLog(`${t.name} 答对视为闪`, 'hl');
      await FX.shield(targetIdx);
      return onDodged();
    }
    addLog(`${t.name} 答错`, 'dmg');
    return false;
  }
  if (String(ch).startsWith('card_')) {
    const id = Number(String(ch).slice(5));
    const c = t.hand.find((x) => x.id === id);
    if (c) {
      if (c.sub !== 'shan') markConvertUse(t, c, 'shan', outside);
      discardCard(t, c);
      addLog(`${t.name} 打出【${c.name}】`);
      await FX.shield(targetIdx);
      await fire('onUseShan', { idx: targetIdx, srcIdx, card: c });
      return onDodged();
    }
  }
  return false;
}
