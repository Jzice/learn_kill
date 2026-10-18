/* ==================== 答题 & 学习奖励 ==================== */
import type { Player, Question, QuizScope } from '../core/types';
import { escapeHtml } from '../core/dom';
import { Sound } from '../core/sound';
import { comboFx } from '../core/fx';
import { FACTIONS, SUBJECT_ICON } from '../data/factions';
import { QUESTION_BANK, loadGrade, sortedGrades } from '../data/questionBank';
import { G, quizStats } from './state';
import { addPlayLog } from './log';
import { drawCards } from './rules';
import { PROFILE, saveProfile } from '../profile/profile';
import {
  MASTER_STREAK,
  isMastered,
  quizScope,
  recOf,
  recordAnswer,
  scopeGrades,
  weightedPick,
  wrongBoostRate,
  wrongKpSet,
} from '../profile/quizbook';
import { NET, isLocalPlayer, type PendingQuiz } from '../net/network';
import { aiQuiz } from './ai';

let quizResolve: ((v: boolean) => void) | null = null;

/** 取当前年级题库（若尚未加载则动态加载），无题时回退到首个有题的年级 */
async function currentBank(): Promise<Question[]> {
  await loadGrade(G.grade);
  const b = QUESTION_BANK[G.grade];
  if (b && b.length) return b;
  for (const g of sortedGrades()) {
    await loadGrade(g);
    if (QUESTION_BANK[g] && QUESTION_BANK[g].length) return QUESTION_BANK[g];
  }
  return [];
}

/** 按出题范围加载题库：跨年级合并去重，并给每题打上所属年级标签 g */
async function scopedBank(scope: QuizScope | undefined, grade: string): Promise<Question[]> {
  const grades = scopeGrades(scope ?? quizScope(), grade);
  const pool: Question[] = [];
  const seen = new Set<string>();
  for (const gr of grades.length ? grades : [grade]) {
    await loadGrade(gr);
    const b = QUESTION_BANK[gr];
    if (!b || !b.length) continue;
    for (const q of b) {
      if (seen.has(q.q)) continue;
      seen.add(q.q);
      pool.push({ ...q, g: gr });
    }
  }
  return pool;
}

/** 取题：范围过滤 → 剔除已掌握 → 错题加权 → 学科偏好
 *  scope 缺省用本地设置；联机时房主为某玩家出题可传该玩家的范围 */
export async function pickQ(p?: Player, scope?: QuizScope): Promise<Question> {
  const grade = G.grade;
  let pool = await scopedBank(scope, grade);
  if (!pool.length) pool = await scopedBank('grade', grade);
  if (!pool.length) pool = (await currentBank()).map((q) => ({ ...q, g: grade }));
  if (!pool.length)
    return { s: '综合', kp: '综合', q: '（题库为空，请先导入题库）', o: ['继续', '跳过'], a: 0 };
  // 连续答对达标 → 已掌握，不再出现（全部掌握时退回全池避免无题可出）
  const fresh = pool.filter((q) => !isMastered(q));
  const base = fresh.length ? fresh : pool;
  // 错题/同知识点优先：概率随错题占比提升（15%~60%）
  const kps = wrongKpSet();
  if (Math.random() < wrongBoostRate(base.length)) {
    const hot = base.filter((q) => {
      const r = recOf(q);
      return (!!r && r.w > 0) || kps.has(`${q.s}|${q.kp}`);
    });
    if (hot.length) {
      const pick = weightedPick(hot, kps);
      if (pick) return pick;
    }
  }
  // 学科偏好：阵营学科 50% / 角色学科 70%（沿用原有手感）
  let cand = base;
  if (p) {
    const f = FACTIONS[p.faction];
    if (f && Math.random() < 0.5) {
      const sub = base.filter((q) => q.s === f.subject);
      if (sub.length) cand = sub;
    }
    if (p.subject && Math.random() < 0.7) {
      const sub = cand.filter((q) => q.s === p.subject);
      if (sub.length) cand = sub;
    }
  }
  return weightedPick(cand, kps) || base[0];
}

export function displayQuiz(q: Question, player: Player, isSkill: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    quizResolve = resolve;
    document.getElementById('quizIcon')!.textContent = SUBJECT_ICON[q.s] || '📖';
    document.getElementById('quizSubject')!.textContent = q.s + (isSkill ? ' · 技能挑战' : ' · 知识挑战');
    document.getElementById('quizProgress')!.textContent = `${G.grade} · 已答 ${quizStats.total} 题 · 正确 ${quizStats.correct} 题`;
    document.getElementById('quizKP')!.textContent = '知识点：' + (q.kp || '综合');
    document.getElementById('quizQuestion')!.textContent = q.q;
    const opts = document.getElementById('quizOptions')!;
    opts.innerHTML = q.o
      .map((o, i) => `<button class="quiz-option" data-i="${i}"><span class="tag">${String.fromCharCode(65 + i)}</span>${escapeHtml(o)}</button>`)
      .join('');
    document.getElementById('quizFeedback')!.textContent = '';
    opts.querySelectorAll('.quiz-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number((btn as HTMLElement).dataset.i);
        const correct = i === q.a;
        opts.querySelectorAll('.quiz-option').forEach((b) => {
          (b as HTMLButtonElement).disabled = true;
          if (Number((b as HTMLElement).dataset.i) === q.a) b.classList.add('correct');
        });
        if (!correct) btn.classList.add('wrong');
        const fb = document.getElementById('quizFeedback')!;
        quizStats.total++;
        if (correct) {
          quizStats.correct++;
          if (player) player.knowledge += 1;
          // 记录本地玩家科目正确数 + 个人错题本/掌握度
          let bookNote = '';
          if (player && G.players[G.myPlayerIdx] === player) {
            if (q.s) {
              PROFILE.subjects[q.s] = (PROFILE.subjects[q.s] || 0) + 1;
              saveProfile();
            }
            const rec = recordAnswer(q, true, q.g || G.grade);
            bookNote =
              rec.c >= MASTER_STREAK
                ? `<br><span style="font-size:10.5px;color:#8a6a10">🎓 该知识点累计答对 ${rec.c} 次，已掌握，后续不再出现</span>`
                : `<br><span style="font-size:10.5px;color:#8a6a10">掌握进度 ${rec.c}/${MASTER_STREAK}（连对 ${MASTER_STREAK} 次即出本）</span>`;
          }
          const rewards = grantLearningReward(player, isSkill, q);
          fb.innerHTML = `✓ 答对！知识点【${q.kp || '综合'}】+1学识<br><span style="font-size:10.5px;color:#1e7a3a;">${rewards.join(' · ')}</span>${bookNote}`;
          fb.style.color = '#1e7a3a';
          Sound.play('correct');
          if (player) addPlayLog(player.name, 'kp', `${q.s}·${q.kp || '综合'}`, '', 'kp');
        } else {
          if (player) player.combo = 0;
          let wrongNote = '';
          if (player && G.players[G.myPlayerIdx] === player) {
            const rec = recordAnswer(q, false, q.g || G.grade);
            wrongNote = `<br><span style="font-size:10.5px;color:#a02020">📕 已记入错题本（累计错 ${rec.w} 次），将优先重复出现</span>`;
          }
          fb.innerHTML = `✗ 正确答案是 ${String.fromCharCode(65 + q.a)}<br><span style="font-size:10.5px;">知识点【${q.kp || '综合'}】</span>${wrongNote}`;
          fb.style.color = '#a02020';
          Sound.play('wrong');
        }
        setTimeout(() => {
          document.getElementById('quizModal')!.classList.remove('show');
          if (quizResolve) {
            const r = quizResolve;
            quizResolve = null;
            r(correct);
          }
        }, 1500);
      });
    });
    document.getElementById('quizModal')!.classList.add('show');
  });
}

export async function askQuiz(player: Player, isSkill = false): Promise<boolean> {
  const q = await pickQ(player);
  return displayQuiz(q, player, isSkill);
}

let quizSeq = 0;

async function askQuizRemote(player: Player, isSkill: boolean): Promise<boolean> {
  const conn = NET.playerConns[player.peerId!];
  if (!conn) return aiQuiz(0.6);
  // 房主按该玩家自己同步来的出题范围出题（未同步则用房主本地设置）
  const member = NET.roomMembers.find((m) => m.peerId === player.peerId);
  const q = await pickQ(player, member?.scope);
  return new Promise((resolve) => {
    const quizId = ++quizSeq;
    const entry: PendingQuiz = { resolve, player, q, quizId, timer: null };
    entry.timer = setTimeout(() => {
      // 仅清理仍属于本题的挂起项；已被响应或已被新题替换则不动
      if (NET.pendingQuiz === entry) {
        NET.pendingQuiz = null;
        resolve(false);
      }
    }, 20000);
    NET.pendingQuiz = entry;
    conn.send({ type: 'ask_quiz_request', question: q, isSkill, quizId });
  });
}

/** 客户端收到房主转发的答题请求 */
export async function onAskQuizRequest(question: Question, isSkill: boolean, quizId: number): Promise<void> {
  const player = G.players[G.myPlayerIdx];
  const correct = await displayQuiz(question, player, isSkill);
  NET.sendToHost({ type: 'quiz_response', correct, quizId });
}

export async function askQuizForPlayer(player: Player, isSkill = false): Promise<boolean> {
  if (!player) return false;
  if (player.isAI) return aiQuiz(isSkill ? 0.62 : 0.6);
  const idx = G.players.indexOf(player);
  if (isLocalPlayer(idx)) return await askQuiz(player, isSkill);
  if (NET.isHost && player.peerId) return await askQuizRemote(player, isSkill);
  return aiQuiz(0.6);
}

/* ==================== 学习奖励 ==================== */
export function grantLearningReward(player: Player, isSkillQuiz: boolean, question: Question): string[] {
  if (!player) return [];
  const rewards: string[] = [];
  player.subjectMastery = player.subjectMastery || {};
  const sub = question ? question.s : null;
  if (sub) player.subjectMastery[sub] = (player.subjectMastery[sub] || 0) + 1;
  player.combo = (player.combo || 0) + 1;
  if (player.combo > (player.maxCombo || 0)) player.maxCombo = player.combo;
  const faction = FACTIONS[player.faction];
  if (faction && sub && faction.subject === sub) {
    player.knowledge += 1;
    drawCards(player, 1);
    rewards.push(`🏛️【${faction.name}】+1学识+摸1牌`);
    addPlayLog(player.name, 'faction', faction.name + '加成', '', 'faction');
  }
  const roll = Math.random();
  if (roll < 0.3) {
    player.shield = (player.shield || 0) + 1;
    rewards.push('🛡️+1护盾');
  } else if (roll < 0.55) {
    drawCards(player, 1);
    rewards.push('🎴摸1张');
  } else if (roll < 0.72) {
    if (player.hp < player.maxHp) {
      player.hp++;
      rewards.push('💚回复1点');
    } else {
      drawCards(player, 1);
      rewards.push('🎴满血改摸1张');
    }
  } else if (roll < 0.88) {
    player.flags.extraDamage = (player.flags.extraDamage || 0) + 1;
    rewards.push('⚔️下张杀+1');
  } else {
    player.knowledge += 1;
    rewards.push('🔮额外+1学识');
  }
  if (isSkillQuiz) {
    player.shield = (player.shield || 0) + 1;
    rewards.push('✨技能+1护盾');
  }
  if (player.combo === 3) {
    drawCards(player, 1);
    rewards.push('🔥连击3摸1张');
  } else if (player.combo === 5) {
    player.hp = Math.min(player.maxHp, player.hp + 1);
    player.shield = (player.shield || 0) + 1;
    rewards.push('🔥连击5回1血+1护盾');
  } else if (player.combo >= 7) {
    player.knowledge += 2;
    rewards.push('🔥连击' + player.combo + '学识+2');
  }
  if (player.combo === 3 || player.combo === 5 || player.combo >= 7) {
    Sound.play('combo');
    const pi = G.players.indexOf(player);
    if (pi >= 0) comboFx(pi, player.combo);
  }
  if (sub && player.subjectMastery[sub] === 5) {
    player.flags.extraDamage = (player.flags.extraDamage || 0) + 1;
    rewards.push(`🎓【${sub}精通】下张杀+1`);
  }
  if (rewards.length > 0)
    rewards.forEach((r) => addPlayLog(player.name, 'reward', r.replace(/^[^\s]+\s*/, ''), '', 'reward'));
  return rewards;
}
