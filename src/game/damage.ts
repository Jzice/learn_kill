/* ==================== 伤害 & 濒死 ==================== */
import type { Card, ChoiceOption, DamageType, Player } from '../core/types';
import { G } from './state';
import { FX, floatTextFx, resultBanner } from '../core/fx';
import { Sound } from '../core/sound';
import { localPlayerWin } from '../profile/profile';
import { ROLES } from '../data/characters';
import { addLog, addPlayLog } from './log';
import { discardCard } from './rules';
import { aiShouldSave, noteAttack, noteSave } from './aibrain';
import { llmChooseAction, llmShouldSave } from '../llm/agent';
import { llmReady } from '../llm/config';

/** 某 AI 是否愿意救援 idx：大模型接管座位走 llmShouldSave，否则用原启发式（意愿>0 视为救） */
async function saveWillingness(i: number, idx: number): Promise<boolean> {
  const q = G.players[i];
  if (q.aiMode === 'llm') return llmShouldSave(i, idx);
  return aiShouldSave(i, idx) > 0;
}
import { canConvertAs, fire, markConvertUse, reduceDamageOf, tryRevive } from './skillEngine';
import { render } from '../ui/render';
import { waitChoice } from './choice';
import { maybeSettle } from '../profile/profile';
import { NET, scheduleSync } from '../net/network';

export async function dealDamage(
  srcIdx: number,
  tgtIdx: number,
  amount: number,
  type: DamageType = 'normal',
  ignoreArmor = false,
): Promise<boolean> {
  const tgt = G.players[tgtIdx];
  if (!tgt || !tgt.alive) return false;
  // AI 信念事件：谁攻击了谁（所有存活 AI 观察，受害者记仇）
  if (srcIdx >= 0) noteAttack(srcIdx, tgtIdx);
  const dealt = await applyDamage(tgtIdx, amount, type, true, srcIdx, ignoreArmor);
  render();
  checkWin();
  return dealt;
}

/**
 * 实际扣血结算：防具修正 → 护盾/学识吸收 → 扣血 → 铁索连环传导。
 * allowChain=false 用于传导伤害本身，避免连环互相触发形成死循环。
 */
/**
 * @returns 是否实际造成了体力损失（被护盾 / 学识完全吸收时返回 false，
 *          供【投石问路】等「造成伤害后」类武器技能判定是否触发）
 */
async function applyDamage(
  tgtIdx: number,
  amount: number,
  type: DamageType,
  allowChain: boolean,
  srcIdx: number,
  ignoreArmor = false,
): Promise<boolean> {
  const tgt = G.players[tgtIdx];
  if (!tgt || !tgt.alive) return false;
  let dmg = amount;
  // 防具修正：白银狮子（每次受到的伤害最多 1 点）/ 藤甲（火焰伤害 +1）
  // 青釭剑（ignoreArmor）无视目标防具，上述修正整体失效
  // 巴斯德【免疫】：火 / 雷属性伤害 −1（最低 1 点）
  if (type !== 'normal' && dmg > 1) {
    const cut = reduceDamageOf(tgt, type);
    if (cut > 0) {
      dmg = Math.max(1, dmg - cut);
      addLog(`【免疫】${tgt.name} 受到的${type === 'fire' ? '火' : '雷'}属性伤害 -${cut}`, 'heal');
    }
  }
  const armor = tgt.equip.armor?.skill;
  if (!ignoreArmor) {
    if (armor === 'baiyin' && dmg > 1) {
      addLog(`【白银狮子】${tgt.name} 受到的伤害限制为 1 点`, 'heal');
      dmg = 1;
    }
    if (armor === 'tengjia' && type === 'fire') {
      dmg += 1;
      addLog(`【藤甲】${tgt.name} 受到火焰伤害 +1`, 'dmg');
    }
    // 【明光护甲】（明光铠）：每次受到的伤害 -1（最低 1 点）
    if (armor === 'mingguang' && dmg > 1) {
      dmg = Math.max(1, dmg - 1);
      addLog(`【明光护甲】${tgt.name} 受到的伤害 -1`, 'heal');
    }
  } else if (armor) {
    addLog(`【青釭剑】无视 ${tgt.name} 的防具（${armor}）`, 'hl');
  }
  // 局前护甲：减少受到的伤害（由配装注入，整局有效，每次伤害事件生效一次）
  if (tgt.flags.dmgReduce && dmg > 0) {
    const cut = Math.min(dmg, tgt.flags.dmgReduce);
    dmg -= cut;
    addLog(`【护甲】${tgt.name} 减伤 ${cut}`, 'heal');
  }
  while (dmg > 0 && (tgt.shield || 0) > 0) {
    tgt.shield--;
    dmg--;
    addLog(`${tgt.name} 消耗1护盾抵挡1点`, 'heal');
    floatTextFx(tgtIdx, '护盾', '#4af');
  }
  while (dmg > 0 && tgt.knowledge >= 2) {
    tgt.knowledge -= 2;
    dmg--;
    addLog(`${tgt.name} 消耗2学识抵挡1点`, 'heal');
  }
  let hpLost = false;
  if (dmg > 0) {
    await FX.slash(tgtIdx);
    floatTextFx(tgtIdx, '-' + dmg, '#ff3b30');
    Sound.play('hit');
    tgt.hp -= dmg;
    hpLost = true;
    addPlayLog('', 'damage', dmg, tgt.name, 'dmg');
    render();
    // 声明式触发技：受伤后（横眉 / 适者生存 / 显性性状 / 术势 / 莫须有 / 哈姆雷特 / 避雷针 …）
    if (tgt.alive) {
      await fire('onDamaged', {
        idx: tgtIdx,
        srcIdx,
        targetIdx: srcIdx >= 0 ? srcIdx : undefined,
        damageType: type,
      });
    }
    if (tgt.hp <= 0) await dyingPhase(tgtIdx, srcIdx);
  }
  render();
  // 铁索连环：属性伤害命中连环角色 → 传导给所有连环角色并各自重置
  if (allowChain && type !== 'normal' && tgt.chained) {
    await propagateChain(tgtIdx, amount, type);
  }
  return hpLost;
}

/** 连环传导：所有横置角色（含最初受击者）解除连环，其余各承受一次同属性同数值伤害 */
async function propagateChain(originIdx: number, amount: number, type: DamageType): Promise<void> {
  const chained = G.players.map((p, i) => ({ p, i })).filter((x) => x.p.chained);
  if (!chained.length) return;
  addLog(`【铁索连环】属性伤害传导（${chained.length} 名连环角色）`, 'hl');
  chained.forEach((x) => {
    x.p.chained = false;
  });
  for (const { p, i } of chained) {
    if (i === originIdx || !p.alive) continue;
    floatTextFx(i, '连环', '#f39c12');
    await applyDamage(i, amount, type, false, -1);
  }
  render();
}

/** 失去【白银狮子】时回复 1 点体力（装备被替换 / 拆除 / 顺手时调用） */
export function onLoseArmor(p: Player, card: Card | null): void {
  if (!card || card.skill !== 'baiyin' || !p.alive) return;
  if (p.hp >= p.maxHp) return;
  p.hp++;
  addLog(`【白银狮子】${p.name} 失去装备，回复 1 点体力`, 'heal');
  FX.healGlow(G.players.indexOf(p));
}

export async function dyingPhase(idx: number, srcIdx: number): Promise<void> {
  const p = G.players[idx];
  if (!p.alive) return;
  while (p.hp <= 0) {
    // 限定技自救（李时珍·行医）
    if (await tryRevive(idx)) continue;
    // 濒死自救：转化技（屠呦呦·青蒿素 / 李时珍·本草纲目）可把手牌当【桃】
    const outside = G.current !== idx;
    if (p.isAI) {
      // 大模型接管座位：由模型决定「用哪张桃自救」或「放弃自救」；调用失败才回退「有桃必自救」
      let tao: Card | undefined;
      let decided = false;
      if (p.aiMode === 'llm' && llmReady()) {
        const heals = p.hand.filter((c) => c.sub === 'tao' || canConvertAs(p, c, 'tao', outside));
        const opts: ChoiceOption[] = heals.map((c) => ({
          label: `使用【${c.name}】自救`,
          value: 'card_' + c.id,
        }));
        opts.push({ label: '放弃自救（保留手牌）', value: 'skip' });
        const v = await llmChooseAction(idx, opts, 'rescue');
        if (v !== null && v !== undefined) {
          decided = true;
          if (String(v).startsWith('card_')) {
            const cid = Number(String(v).slice(5));
            tao = p.hand.find((c) => c.id === cid);
          }
        }
      }
      if (!decided)
        tao =
          p.hand.find((c) => c.sub === 'tao') ||
          p.hand.find((c) => canConvertAs(p, c, 'tao', outside));
      if (tao) {
        if (tao.sub !== 'tao') markConvertUse(p, tao, 'tao', outside);
        discardCard(p, tao);
        p.hp++;
        addLog(`${p.name} 使用【${tao.name}】自救`, 'heal');
        FX.healGlow(idx);
        continue;
      }
      let saved = false;
      // AI 博弈救援：按信念/身份策略计算各 AI 施救意愿（含欺骗性救援），按意愿排序尝试
      // 大模型接管座位改用 llmShouldSave 决策（失败自动回退原启发式）
      const savers = G.players
        .map((q, i) => ({ q, i }))
        .filter(({ q }) => q.alive && q.isAI && q !== G.players[idx]);
      const will = (
        await Promise.all(
          savers.map(async ({ q, i }) => ({
            q,
            i,
            w: (await saveWillingness(i, idx)) ? 1 : 0,
          })),
        )
      )
        .filter((x) => x.w > 0)
        .sort((a, b) => b.w - a.w);
      for (const { q, i } of will) {
        const t2 = q.hand.find((c) => c.sub === 'tao');
        if (t2) {
          discardCard(q, t2);
          p.hp++;
          addLog(`${q.name} 使用【桃】救 ${p.name}`, 'heal');
          FX.healGlow(idx);
          noteSave(i, idx);
          saved = true;
          break;
        }
      }
      if (!saved) {
        p.alive = false;
        p.killedBy = killerName(srcIdx, idx);
        const kt = killerText(srcIdx, idx);
        revealDeadRole(p, kt);
        if (srcIdx === G.myPlayerIdx) G.myKills++;
        Sound.play('death');
        await FX.death(idx, ROLES[p.role].name, kt);
        break;
      }
    } else {
      const opts: { label: string; value: string }[] = [];
      p.hand
        .filter((c) => c.sub === 'tao' || c.sub === 'jiu' || canConvertAs(p, c, 'tao', outside))
        .forEach((c) =>
          opts.push({
            label: c.sub === 'tao' || c.sub === 'jiu' ? `【${c.name}】` : `【${c.name}】当【桃】`,
            value: 'card_' + c.id,
          }),
        );
      if (p.knowledge >= 1) opts.push({ label: '消耗1学识自救', value: 'know' });
      if ((p.shield || 0) >= 1) opts.push({ label: '消耗1护盾自救', value: 'shield' });
      opts.push({ label: '放弃', value: 'giveup' });
      const ch = await waitChoice(idx, opts, 'rescue');
      if (ch === 'giveup') {
        p.alive = false;
        p.killedBy = killerName(srcIdx, idx);
        const kt = killerText(srcIdx, idx);
        revealDeadRole(p, kt);
        if (srcIdx === G.myPlayerIdx) G.myKills++;
        Sound.play('death');
        await FX.death(idx, ROLES[p.role].name, kt);
        break;
      }
      if (ch === 'know') {
        p.knowledge--;
        p.hp++;
        addLog(`${p.name} 消耗学识自救`, 'heal');
        FX.healGlow(idx);
        continue;
      }
      if (ch === 'shield') {
        p.shield--;
        p.hp++;
        addLog(`${p.name} 消耗护盾自救`, 'heal');
        FX.healGlow(idx);
        continue;
      }
      if (String(ch).startsWith('card_')) {
        const id = Number(String(ch).slice(5));
        const c = p.hand.find((x) => x.id === id);
        if (c) {
          if (c.sub !== 'tao' && c.sub !== 'jiu') markConvertUse(p, c, 'tao', outside);
          discardCard(p, c);
          p.hp++;
          addLog(`${p.name} 使用【${c.name}】自救`, 'heal');
          FX.healGlow(idx);
          continue;
        }
      }
    }
  }
  render();
}

/** 击杀者名字：有明确来源（非自己、非环境/判定伤害）时返回其名字，否则为空 */
function killerName(srcIdx: number, tgtIdx: number): string {
  if (srcIdx < 0 || srcIdx === tgtIdx) return '';
  return G.players[srcIdx]?.name || '';
}

/** 击杀者文案：如「被 曹操 击杀」，无明确来源时为空 */
function killerText(srcIdx: number, tgtIdx: number): string {
  const n = killerName(srcIdx, tgtIdx);
  return n ? `被 ${n} 击杀` : '';
}

export function revealDeadRole(p: (typeof G)['players'][number], killer?: string): void {
  if (!p || p.alive) return;
  const wasRevealed = p.roleRevealed;
  p.roleRevealed = true;
  const by = killer ? `（${killer}）` : '';
  if (wasRevealed) {
    addLog(`☠ ${p.name} 阵亡${by}`, 'dmg');
  } else {
    addLog(`☠ ${p.name} 阵亡，身份公开：${ROLES[p.role].name}${by}`, 'hl');
  }
  if (NET.isHost && NET.mode === 'host') scheduleSync();
}

export function checkWin(): void {
  if (G.gameOver) return;
  const alive = G.players.filter((p) => p.alive);
  const lord = G.players.find((p) => p.role === 'lord');
  const rebelsAlive = alive.some((p) => p.role === 'rebel');
  const spiesAlive = alive.some((p) => p.role === 'spy');
  let bannerShown = false;
  const finish = (text: string): void => {
    G.gameOver = true;
    G.winnerText = text;
    // 对局结束：揭示全部角色身份（含仍存活者），座位列表与结算面板统一公开
    G.players.forEach((q) => {
      q.roleRevealed = true;
    });
    addLog('⚑ ' + text, 'hl');
    addLog(
      `🎭 身份揭晓：${G.players.map((q) => `${q.name}=${ROLES[q.role].name}`).join('、')}`,
      'hl',
    );
    if (!bannerShown) {
      bannerShown = true;
      const win = localPlayerWin();
      Sound.play(win ? 'win' : 'lose');
      void resultBanner(text, win);
    }
    maybeSettle();
    render();
    if (NET.isHost && NET.mode === 'host') scheduleSync();
  };
  if (!lord?.alive) {
    if (!rebelsAlive && spiesAlive && alive.length === 1 && alive[0].role === 'spy') finish('内奸获胜');
    else finish('反贼获胜');
    return;
  }
  if (!rebelsAlive && !spiesAlive) finish('主公与忠臣获胜');
}
