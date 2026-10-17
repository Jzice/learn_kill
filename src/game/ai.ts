/* ==================== AI ==================== */
import type { Player } from '../core/types';
import { G } from './state';
import { sleep } from '../core/dom';
import { Sound } from '../core/sound';
import { equipFx } from '../core/fx';
import { FACTIONS } from '../data/factions';
import { addChat } from './chat';
import { addLog, addPlayLog } from './log';
import { discardCard, drawCards, inRange } from './rules';
import { render } from '../ui/render';
import { showPlayCard } from '../ui/playzone';
import { useActiveSkill } from './skills';
import { useTao, useTrick, useSha } from './actions';
import { NET, syncStateToClients } from '../net/network';

export function aiQuiz(rate = 0.6): boolean {
  return Math.random() < rate;
}

export function isEnemy(a: Player, b: Player): boolean {
  if (a.role === 'lord' || a.role === 'loyal') return b.role === 'rebel' || b.role === 'spy';
  if (a.role === 'rebel') return b.role === 'lord' || b.role === 'loyal';
  if (a.role === 'spy') {
    const ra = G.players.filter((p) => p.alive && p.role === 'rebel').length;
    if (ra > 0) return b.role === 'rebel';
    return b.role === 'lord' || b.role === 'loyal';
  }
  return false;
}

export async function aiPlayPhase(idx: number): Promise<void> {
  const p = G.players[idx];
  if (!p.flags.skillUsed && p.skills.some((s) => s.type === 'active') && Math.random() < 0.5) {
    const act = p.skills.find((s) => s.type === 'active')!;
    await useActiveSkill(idx, act.id);
    await sleep(400);
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
        if (p.equip.armor) G.discard.push(p.equip.armor);
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
  if (p.alive && !p.flags.noSha && (p.flags.shaUsed || 0) < 1) {
    const sha = p.hand.find((c) => c.sub === 'sha');
    if (sha) {
      const ts: number[] = [];
      for (let i = 0; i < G.players.length; i++) {
        if (i === idx || !G.players[i].alive) continue;
        if (inRange(idx, i) && isEnemy(p, G.players[i])) ts.push(i);
      }
      if (ts.length > 0) {
        discardCard(p, sha);
        await useSha(idx, ts[0]);
        await sleep(300);
      }
    }
  }
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
  addChat(p.name, text, 'ai');
  if (NET.isHost) NET.broadcast({ type: 'chat', name: p.name, text });
}
