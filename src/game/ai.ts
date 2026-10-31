/* ==================== AI ==================== */
import type { Card, Player } from '../core/types';
import { G } from './state';
import { sleep } from '../core/dom';
import { Sound } from '../core/sound';
import { equipFx } from '../core/fx';
import { FACTIONS } from '../data/factions';
import { addChat } from './chat';
import { addLog, addPlayLog } from './log';
import { discardCard, drawCards, inRange, sameFaction } from './rules';
import { render } from '../ui/render';
import { showPlayCard } from '../ui/playzone';
import { useActiveSkill } from './skills';
import { useTao, useTrick, useSha, useJiu } from './actions';
import { onLoseArmor } from './damage';
import { NET, syncStateToClients } from '../net/network';
import { defOf } from '../data/skilldefs';
import {
  canConvertAs,
  canPay,
  convertDamageType,
  limitLeft,
  markConvertUse,
  shaExtraCost,
  shaLimitOf,
} from './skillEngine';
import { noteAiTurn } from './aibrain';
import { AIPOLICY } from './aipolicy';
import {
  cardKeepValue,
  evAoe,
  evDuel,
  evHuogong,
  evSha,
  evTiesuo,
  pickTarget,
  softmaxPick,
  targetScore,
  tauNow,
} from './aieval';
import { SHA_SUBS } from '../data/cards';
import { filledEquipSlots } from './rules';

export function aiQuiz(rate = 0.6): boolean {
  return Math.random() < rate;
}

/**
 * AI 使用**扩展包锦囊**（卡牌扩展包启用后才可能出现）。
 * 原则：新卡必须有显式决策，且一律保守——
 *   - 收益给自己的（远交近攻 / 以逸待劳）优先给同阵营；
 *   - 群体牌（联军盛宴 / 敕令）按存活敌我比例决定；
 *   - 无合法目标时保留手牌，绝不强行打出，也绝不卡住回合。
 */
async function aiPlayExtraTricks(idx: number): Promise<void> {
  const p = G.players[idx];
  const alive = () => G.players.filter((q, i) => i !== idx && q.alive);
  const enemies = () => alive().filter((q) => !sameFaction(q, p));
  const allies = () => alive().filter((q) => sameFaction(q, p));
  /** 敌方优先、其次任意存活其他角色 */
  const pickEnemy = (need?: (q: Player) => boolean): number => {
    const es = enemies().filter((q) => !need || need(q));
    if (es.length) return G.players.indexOf(es[0]);
    const any = alive().filter((q) => !need || need(q));
    return any.length ? G.players.indexOf(any[0]) : -1;
  };
  const play = async (sub: string, tgt: number | null): Promise<void> => {
    const c = p.hand.find((x) => x.sub === sub);
    if (!c || !p.alive) return;
    if (tgt === null) return; // 无合法目标：保留手牌
    discardCard(p, c);
    await useTrick(idx, c, tgt);
    await sleep(300);
  };
  // 兵粮寸断：给敌方主力断补给（【太平要术】免疫延时锦囊，须排除）
  if (p.hand.some((c) => c.sub === 'bingliang')) {
    await play('bingliang', pickEnemy((q) => q.equip.armor?.skill !== 'taiping'));
  }
  // 草木皆兵：敌方手牌 ≥2 才值得
  if (p.hand.some((c) => c.sub === 'caomu')) {
    await play('caomu', pickEnemy((q) => q.hand.length >= 2));
  }
  // 知己知彼：敌方有手牌才看
  if (p.hand.some((c) => c.sub === 'zhiji')) {
    await play('zhiji', pickEnemy((q) => q.hand.length >= 1));
  }
  // 水淹七军 / 调虎离山：优先拆敌方装备
  if (p.hand.some((c) => c.sub === 'shuishui')) {
    await play('shuishui', pickEnemy((q) => filledEquipSlots(q).length > 0));
  }
  if (p.hand.some((c) => c.sub === 'diaohu')) {
    await play('diaohu', pickEnemy((q) => filledEquipSlots(q).length > 0));
  }
  // 火烧连营：对敌方造成火伤（连环目标额外 +1）
  if (p.hand.some((c) => c.sub === 'huoshao')) {
    await play('huoshao', pickEnemy());
  }
  // 远交近攻（目标 1 / 自己 2）：给同阵营，无同阵营则不用（避免资敌）
  if (p.hand.some((c) => c.sub === 'yuanjiao')) {
    const al = allies();
    await play('yuanjiao', al.length ? G.players.indexOf(al[0]) : null);
  }
  // 以逸待劳（目标 2 / 自己 1）：同理只给同阵营
  if (p.hand.some((c) => c.sub === 'yiyi')) {
    const al = allies();
    await play('yiyi', al.length ? G.players.indexOf(al[0]) : null);
  }
  // 联军盛宴（全员各摸 1）：己方存活数 ≥ 敌方时才开
  if (p.hand.some((c) => c.sub === 'lianjun')) {
    const ok = allies().length >= enemies().length;
    if (ok) {
      const c = p.hand.find((x) => x.sub === 'lianjun');
      if (c) {
        discardCard(p, c);
        await useTrick(idx, c, null);
        await sleep(300);
      }
    }
  }
  // 敕令（全员各弃 1）：敌方 ≥ 己方时才开
  if (p.hand.some((c) => c.sub === 'chiling')) {
    const ok = enemies().length >= allies().length;
    if (ok) {
      const c = p.hand.find((x) => x.sub === 'chiling');
      if (c) {
        discardCard(p, c);
        await useTrick(idx, c, null);
        await sleep(300);
      }
    }
  }
}

/** AI 主动技可用性：由技能声明（费用 + 每回合 / 整局限制）统一判定 */
export function aiSkillUsable(p: Player, id: string): boolean {
  const d = defOf(id);
  if (d) {
    if (!limitLeft(p, d)) return false;
    return canPay(p, d);
  }
  const sk = p.skills.find((s) => s.id === id);
  // 扩展包技能：按原语 costCard 判定费用门槛
  if (sk?.effects) {
    const cost = sk.effects.find((e) => e.kind === 'costCard');
    if (cost && cost.kind === 'costCard') return p.hand.length >= cost.n;
    return true;
  }
  return true;
}
/** AI 主动技收益粗估：据此在多个可用技能中挑一个（数值越大越优先） */
export function aiSkillValue(p: Player, id: string): number {
  const d = defOf(id);
  if (!d) return 1;
  let v = 0;
  for (const e of d.effects) {
    switch (e.kind) {
      case 'selfDraw': v += 0.6 * e.n; break;
      case 'targetDamage': v += 1.5 * e.n; break;
      case 'targetLoseHp': v += 1.3 * e.n; break;
      case 'targetHeal': v += (p.hp < p.maxHp ? 1.2 : 0.2) * e.n; break;
      case 'selfHeal': v += (p.hp < p.maxHp ? 1.2 : 0.1) * e.n; break;
      case 'targetDiscard': v += 1.0 * e.n; break;
      case 'allDiscard': v += 0.8 * e.n; break;
      case 'gainHand': v += 0.9 * e.n; break;
      case 'judgeIf': v += 1.0; break;
      case 'pointDuel': v += 1.0; break;
      case 'quizDuel': v += 0.8; break;
      case 'swapHp': v += p.hp <= 2 ? 2.0 : 0.3; break;
      case 'costCard': v -= e.require ? 0.5 * e.n : 0.3 * e.n; break;
      default: v += 0.2; break;
    }
  }
  return v;
}

export async function aiPlayPhase(idx: number): Promise<void> {
  const p = G.players[idx];
  if (!p.flags.skillUsed && p.alive) {
    // 观星 / 周期律 / 行医等「非出牌阶段」技能不在此发动
    const acts = p.skills.filter((s) => {
      const d = defOf(s.id);
      if (d && d.timing !== 'active') return false;
      return s.type === 'active';
    });
    if (acts.length && Math.random() < 0.62) {
      // 收益启发式：优先挑付得起费用且估值最高的技能，保留一定随机性
      const usable = acts.filter((s) => aiSkillUsable(p, s.id));
      const pool = usable.length ? usable : acts;
      let act: (typeof pool)[number];
      if (AIPOLICY.useEv) {
        // 博弈：softmax over 估值（差异大→确定，差异小→随机化，避免被读牌剥削）
        act = softmaxPick(pool, (s) => aiSkillValue(p, s.id), tauNow());
      } else {
        const best = pool.reduce((a, b) => (aiSkillValue(p, b.id) > aiSkillValue(p, a.id) ? b : a));
        act = Math.random() < 0.7 ? best : pool[Math.floor(Math.random() * pool.length)];
      }
      await useActiveSkill(idx, act.id);
      await sleep(400);
    }
  }
  let equipChanged = false;
  for (const c of [...p.hand]) {
    if (c.type === 'equip' && p.alive) {
      discardCard(p, c, false);
      showPlayCard(c, p.name, FACTIONS[p.faction].color);
      addPlayLog(p.name, 'use', c.name, '');
      if (c.sub === 'weapon') {
        if (p.equip.weapon) G.discard.push(p.equip.weapon);
        p.equip.weapon = c;
      } else if (c.sub === 'armor') {
        if (p.equip.armor) {
          onLoseArmor(p, p.equip.armor);
          G.discard.push(p.equip.armor);
        }
        p.equip.armor = c;
      } else if (c.sub === 'horse+') {
        if (p.equip.horsePlus) G.discard.push(p.equip.horsePlus);
        p.equip.horsePlus = c;
      } else if (c.sub === 'horse-') {
        if (p.equip.horseMinus) G.discard.push(p.equip.horseMinus);
        p.equip.horseMinus = c;
      }
      addLog(`${p.name} 装备【${c.name}】`);
      Sound.play('equip');
      void equipFx(idx, c.name);
      equipChanged = true;
      await sleep(300);
    }
  }
  if (equipChanged && NET.isHost) syncStateToClients();
  while (p.hp < p.maxHp && p.alive) {
    const tao = p.hand.find((c) => c.sub === 'tao');
    if (!tao) break;
    discardCard(p, tao);
    await useTao(idx);
    await sleep(300);
  }
  const wz = p.hand.find((c) => c.sub === 'wuzhong');
  if (wz) {
    discardCard(p, wz);
    await useTrick(idx, wz, null);
    await sleep(300);
  }
  // 五谷丰登：直接铺牌
  const wugu = p.hand.find((c) => c.sub === 'wugu');
  if (wugu && p.alive) {
    discardCard(p, wugu);
    await useTrick(idx, wugu, null);
    await sleep(300);
  }
  // 铁索连环：优先横置最多两名敌方目标，无乘之机则按概率重铸
  const tiesuo = p.hand.find((c) => c.sub === 'tiesuo');
  if (tiesuo && p.alive) {
    const enemies = G.players
      .map((q, i) => ({ q, i }))
      .filter(({ q, i }) => i !== idx && q.alive && !sameFaction(q, p) && !q.chained)
      .map(({ i }) => i);
    // 按目标价值排序取前二（原逻辑只是取数组前两个）
    const ranked = enemies.slice().sort((a, b) => targetScore(idx, b) - targetScore(idx, a));
    const picks = ranked.slice(0, 2);
    if (enemies.length && (!AIPOLICY.useEv || evTiesuo(idx, picks) >= AIPOLICY.tiesuoMin)) {
      discardCard(p, tiesuo);
      await useTrick(idx, tiesuo, picks[0], picks[1] ?? null);
      await sleep(300);
    } else if (Math.random() < 0.4) {
      discardCard(p, tiesuo);
      drawCards(p, 1);
      addLog(`${p.name} 重铸【铁索连环】，摸一张牌`);
      await sleep(200);
    }
  }
  // 火攻：对敌方目标使用（目标须有手牌，否则必败）
  const huogong = p.hand.find((c) => c.sub === 'huogong');
  if (huogong && p.alive) {
    const hi = pickTarget(idx);
    // 机会节点：火攻需「我方能弃出与目标展示牌同花色的牌」，按未见牌花色分布估成功概率
    if (hi >= 0 && G.players[hi].hand.length > 0) {
      if (!AIPOLICY.useEv || evHuogong(idx, hi) >= AIPOLICY.huogongMin) {
        discardCard(p, huogong);
        await useTrick(idx, huogong, hi);
        await sleep(300);
      }
    }
  }
  // 借刀杀人：优先借「敌方」的武器，并让受害者优先是非同阵营角色
  const jiedao = p.hand.find((c) => c.sub === 'jiedao');
  if (jiedao && p.alive) {
    let hi = -1,
      vi = -1;
    const holders: number[] = [];
    for (let i = 0; i < G.players.length; i++) {
      if (i === idx || !G.players[i].alive || !G.players[i].equip.weapon) continue;
      holders.push(i);
    }
    holders.sort(
      (x, y) =>
        (sameFaction(G.players[x], p) ? 1 : 0) - (sameFaction(G.players[y], p) ? 1 : 0),
    );
    for (const i of holders) {
      const victims: number[] = [];
      for (let j = 0; j < G.players.length; j++) {
        if (j === i || !G.players[j].alive) continue;
        if (inRange(i, j)) victims.push(j);
      }
      if (!victims.length) continue;
      victims.sort(
        (x, y) =>
          (sameFaction(G.players[x], p) ? 1 : 0) - (sameFaction(G.players[y], p) ? 1 : 0) ||
          G.players[x].hp - G.players[y].hp,
      );
      hi = i;
      vi = victims[0];
      break;
    }
    if (hi >= 0) {
      discardCard(p, jiedao);
      await useTrick(idx, jiedao, hi, vi);
      await sleep(300);
    }
  }
  // 决斗：对敌方目标使用
  const juedou = p.hand.find((c) => c.sub === 'juedou');
  if (juedou && p.alive) {
    const di = pickTarget(idx);
    // 子博弈闭式解：对方杀数 K~Bin(n,q)，我方胜 ⇔ K ≤ 我方杀数
    if (di >= 0 && (!AIPOLICY.useEv || evDuel(idx, di) >= AIPOLICY.duelMin)) {
      discardCard(p, juedou);
      await useTrick(idx, juedou, di);
      await sleep(300);
    }
  }
  // AOE：EV 版逐座位累加期望收益（天然处理误伤队友）；基线版沿用「有同阵营就不放」
  const allyAlive = G.players.some((q, i) => i !== idx && q.alive && q.faction === p.faction);
  for (const sub of ['nanman', 'wanjian'] as const) {
    const aoe = p.hand.find((c) => c.sub === sub);
    if (aoe && p.alive) {
      const ok = AIPOLICY.useEv ? evAoe(idx, sub) >= AIPOLICY.aoeMin : !allyAlive;
      if (ok) {
        discardCard(p, aoe);
        await useTrick(idx, aoe, null);
        await sleep(300);
      }
    }
  }
  // 扩展包锦囊（卡牌扩展包启用后才会在手牌里出现）：按「敌方/己方」与手牌规模做保守决策
  await aiPlayExtraTricks(idx);
  // 咆哮（伽利略·自由落体）放开每回合出杀上限
  const shaCap = shaLimitOf(p);
  if (p.alive && !p.flags.noSha && (p.flags.shaUsed || 0) < shaCap) {
    // 转化技：手牌中没有【杀】时可用黑色牌（茅盾·子夜）/ 红色牌（爱因斯坦·质能方程）当杀
    let shas = p.hand.filter((c) => SHA_SUBS.includes(c.sub));
    if (!shas.length) shas = p.hand.filter((c) => canConvertAs(p, c, 'sha', false));
    // 【酒】：本回合首次出杀前喝一口（每回合限一次，伤害 +1）
    if (shas.length && !p.flags.jiuUsed) {
      const jiu = p.hand.find((c) => c.sub === 'jiu');
      if (jiu) {
        discardCard(p, jiu);
        await useJiu(idx);
        await sleep(250);
      }
    }
    // 场上有人横置（连环）时，优先用属性杀打出去以触发传导
    const chainOn = G.players.some((q) => q.alive && q.chained);
    if (shas.length) {
      // 博弈式目标选择：基于信念推断与身份策略（可能观望/佯攻）
      let ti = pickTarget(idx);
      if (chainOn) {
        const ci = G.players.findIndex(
          (q, i) => i !== idx && q.alive && q.chained && inRange(idx, i) && !sameFaction(q, p),
        );
        if (ci >= 0) ti = ci;
      }
      if (ti >= 0) {
        // 藤甲目标：只用属性杀（优先火杀），普通杀会被挡下
        let sha: Card | null = shas[0];
        if (G.players[ti].equip.armor?.skill === 'tengjia') {
          sha = shas.find((c) => c.damageType === 'fire') || shas.find((c) => c.damageType === 'thunder') || null;
        } else if (chainOn) {
          sha = shas.find((c) => c.damageType === 'fire') || shas.find((c) => c.damageType === 'thunder') || shas[0];
        }
        if (sha) {
          // 方天画戟：此杀是最后一张手牌时，可指定至多 3 个目标（优先非同阵营）
          const multi = p.equip.weapon?.skill === 'fangtian' && p.hand.length === 1;
          const targets: number[] = [ti];
          if (multi) {
            // 附加目标按「出杀 EV」排序（含闪避概率与敌我信念），天然回避队友
            const elemental = sha.damageType === 'fire' || sha.damageType === 'thunder';
            const rest = G.players.map((_, i) => i)
              .filter((i) => i !== idx && i !== ti && G.players[i].alive && inRange(idx, i))
              .sort((x, y) =>
                AIPOLICY.useEv
                  ? evSha(idx, y, 1, elemental) - evSha(idx, x, 1, elemental)
                  : (sameFaction(G.players[x], p) ? 1 : 0) - (sameFaction(G.players[y], p) ? 1 : 0),
              );
            for (const i of rest) {
              if (targets.length >= 3) break;
              if (AIPOLICY.useEv && evSha(idx, i, 1, elemental) <= 0) continue;
              targets.push(i);
            }
          }
          // 转化技记账 + 咆哮额外弃牌代价
          if (!SHA_SUBS.includes(sha.sub)) markConvertUse(p, sha, 'sha', false);
          const extraCost = shaExtraCost(p);
          const rest = p.hand.filter((x) => x.id !== sha.id);
          for (let k = 0; k < extraCost && k < rest.length; k++) discardCard(p, rest[k]);
          discardCard(p, sha);
          const dmgType = sha.damageType || convertDamageType(p, sha, 'sha', false) || 'normal';
          for (let k = 0; k < targets.length; k++) {
            if (!G.players[targets[k]].alive) continue;
            await useSha(idx, targets[k], { suit: sha.suit, num: sha.num, damageType: dmgType, fromFangtian: k > 0 });
          }
          await sleep(300);
        }
      }
    }
  }
  // 丈八蛇矛：没有【杀】时，将两张手牌当【杀】使用
  if (
    p.alive &&
    !p.flags.noSha &&
    (p.flags.shaUsed || 0) < shaCap &&
    p.equip.weapon?.skill === 'zhangba' &&
    p.hand.length >= 2
  ) {
    const ti = pickTarget(idx);
    if (ti >= 0) {
      // 优先拿价值最低的两张（桃/闪/杀/装备之外）
      const junk = AIPOLICY.useEv
        ? // EV 版：按「保留价值」升序取两张（保留价值最低的先用掉）
          [...p.hand].sort((a, b) => cardKeepValue(p, a) - cardKeepValue(p, b)).slice(0, 2)
        : p.hand.filter(
            (c) => !SHA_SUBS.includes(c.sub) && c.sub !== 'tao' && c.sub !== 'shan' && c.type !== 'equip',
          );
      const src = junk.length >= 2 ? junk : p.hand;
      const two = src.slice(0, 2);
      if (two.length === 2) {
        discardCard(p, two[0]);
        discardCard(p, two[1]);
        const suit = two.every((c) => c.suit === '♥' || c.suit === '♦') ? '♥' : '♠';
        addLog(`${p.name} 丈八蛇矛：两张手牌当杀`, 'hl');
        await useSha(idx, ti, { suit });
        await sleep(300);
      }
    }
  }
  noteAiTurn();
  render();
}

/* ==================== AI 台词 ==================== */
type LineKind = 'idle' | 'attack' | 'heal' | 'skill' | 'greet';

const AI_LINES: Record<string, Partial<Record<LineKind, string[]>>> = {
  luxun: { idle: ['这局，我以笔为剑。'], attack: ['呐喊！'], heal: ['横眉冷对。'], skill: ['我以我血荐轩辕。'], greet: ['你好，同学。'] },
  libai: { idle: ['举杯邀明月。'], attack: ['十步杀一人！'], heal: ['将进酒。'], skill: ['诗成泣鬼神！'], greet: ['来，对饮？'] },
  zuchongzhi: { idle: ['圆周率还在算呢。'], attack: ['计算精准！'], heal: ['缀术补气。'], skill: ['密率·π！'], greet: ['数学作业交了吗？'] },
  hualuogeng: { idle: ['统筹安排。'], attack: ['优选法！'], heal: ['统筹气血。'], skill: ['统筹全局！'], greet: ['一起研究数学？'] },
  shashibiya: { idle: ['To be or not to be.'], attack: ['十四行诗！'], heal: ['诗意的疗愈。'], skill: ['哈姆雷特！'], greet: ['Hello!'] },
  niudun: { idle: ['力与反作用力。'], attack: ['F=ma！'], heal: ['恢复力场。'], skill: ['三大定律！'], greet: ['聊聊力学？'] },
  einstein: { idle: ['时空皆相对。'], attack: ['E=mc²！'], heal: ['时空修复。'], skill: ['相对论！'], greet: ['聊聊物理？'] },
  menjieliefu: { idle: ['元素周期表已备好。'], attack: ['周期律！'], heal: ['元素调和。'], skill: ['周期律！'], greet: ['背元素吗？'] },
  daerwen: { idle: ['物竞天择。'], attack: ['进化一击！'], heal: ['适应环境。'], skill: ['进化论！'], greet: ['聊聊物种起源？'] },
  qinshihuang: { idle: ['朕即天下。'], attack: ['统一！'], heal: ['朕之疆土。'], skill: ['统一六国！'], greet: ['朕在此。'] },
  yuefei: { idle: ['精忠报国。'], attack: ['精忠一击！'], heal: ['莫须有。'], skill: ['精忠报国！'], greet: ['同袍，有战事？'] },
  xuxiake: { idle: ['朝碧海暮苍梧。'], attack: ['游记一击！'], heal: ['山水疗愈。'], skill: ['游记山河！'], greet: ['去旅行？'] },
  kongzi: { idle: ['学而时习之。'], attack: ['论语一击！'], heal: ['仁者爱人。'], skill: ['论语！'], greet: ['有朋自远方来。'] },
  default: { idle: ['嗯……'], attack: ['出手。'], heal: ['恢复。'], skill: ['看招。'], greet: ['你好。'] },
};

export function aiSpeak(p: Player, t: LineKind): void {
  if (!p || !p.isAI) return;
  if (Math.random() > 0.55) return;
  const l = AI_LINES[p.charId] || AI_LINES.default;
  const arr = l[t] || l.idle;
  if (!arr || !arr.length) return;
  const text = arr[Math.floor(Math.random() * arr.length)];
  addChat(p.name, text, 'ai', p.avatar);
  if (NET.isHost) NET.broadcast({ type: 'chat', name: p.name, text, avatar: p.avatar });
}
