/* ==================== 个人档案 / 成就 / 结算 ==================== */
import type { Achievement, Level, Profile, PublicProfile } from '../core/types';
import { escapeHtml } from '../core/dom';
import { SUBJECT_ICON } from '../data/factions';
import { G, quizStats } from '../game/state';
import { addLog } from '../game/log';
import { NET } from '../net/network';

const PROFILE_KEY = 'xuetangsha_profile_v1';

const LEVELS: Level[] = [
  { n: '蒙童', min: 0 },
  { n: '学童', min: 120 },
  { n: '秀才', min: 350 },
  { n: '举人', min: 700 },
  { n: '贡士', min: 1100 },
  { n: '进士', min: 1600 },
  { n: '探花', min: 2300 },
  { n: '榜眼', min: 3100 },
  { n: '状元', min: 4200 },
  { n: '大儒', min: 5600 },
  { n: '宗师', min: 7500 },
];

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_game', name: '初入学堂', desc: '完成第一局游戏', icon: '🎒' },
  { id: 'first_win', name: '首战告捷', desc: '赢得第一场胜利', icon: '🏆' },
  { id: 'win_3', name: '连胜三场', desc: '取得3连胜', icon: '🔥' },
  { id: 'quiz_10', name: '小试牛刀', desc: '累计答对10题', icon: '📝' },
  { id: 'quiz_50', name: '学富五车', desc: '累计答对50题', icon: '📚' },
  { id: 'combo_5', name: '一气呵成', desc: '单局达成5连击', icon: '⚡' },
  { id: 'lord_win', name: '君临天下', desc: '以主公身份获胜', icon: '👑' },
  { id: 'rebel_win', name: '揭竿而起', desc: '以反贼身份获胜', icon: '⚔️' },
  { id: 'spy_win', name: '暗度陈仓', desc: '以内奸身份获胜', icon: '🦊' },
  { id: 'kill_3', name: '杀伐果断', desc: '单局击杀3名角色', icon: '💀' },
  { id: 'score_1000', name: '千分学士', desc: '积分达到1000', icon: '🎖️' },
  { id: 'all_subjects', name: '博学多才', desc: '答对全部9个科目的题目', icon: '🌟' },
];

function defaultProfile(): Profile {
  return {
    name: '玩家',
    score: 0,
    games: 0,
    wins: 0,
    winStreak: 0,
    bestStreak: 0,
    totalQuiz: 0,
    correctQuiz: 0,
    maxCombo: 0,
    achievements: {},
    subjects: {},
  };
}

function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Profile>;
      return Object.assign(defaultProfile(), p, {
        achievements: p.achievements || {},
        subjects: p.subjects || {},
      });
    }
  } catch (e) {
    /* ignore */
  }
  return defaultProfile();
}

export let PROFILE: Profile = loadProfile();

export function saveProfile(): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(PROFILE));
  } catch (e) {
    /* ignore */
  }
}

export function levelOf(score: number): Level {
  let l = LEVELS[0];
  for (const x of LEVELS) {
    if (score >= x.min) l = x;
  }
  return l;
}

export function nextLevelOf(score: number): Level | null {
  for (const x of LEVELS) {
    if (x.min > score) return x;
  }
  return null;
}

export function publicProfile(): PublicProfile {
  return {
    name: PROFILE.name,
    score: PROFILE.score,
    games: PROFILE.games,
    wins: PROFILE.wins,
    achievements: PROFILE.achievements || {},
    subjects: PROFILE.subjects || {},
    correctQuiz: PROFILE.correctQuiz || 0,
    bestStreak: PROFILE.bestStreak || 0,
  };
}

export function achCount(p: Profile | PublicProfile): number {
  return Object.keys((p && p.achievements) || {}).length;
}

export function refreshProfileUI(): void {
  const el = document.getElementById('profileCard');
  if (!el) return;
  const lv = levelOf(PROFILE.score),
    nx = nextLevelOf(PROFILE.score);
  let barPct = 100;
  if (nx) {
    const base = lv.min,
      span = Math.max(1, nx.min - base);
    barPct = Math.max(2, Math.min(100, Math.round(((PROFILE.score - base) / span) * 100)));
  }
  const wr = PROFILE.games ? Math.round((PROFILE.wins / PROFILE.games) * 100) : 0;
  el.innerHTML = `<div class="profile-card">
    <div class="profile-avatar">${lv.n.slice(0, 1)}</div>
    <div class="profile-main">
      <div class="profile-name">${escapeHtml(PROFILE.name || '玩家')}</div>
      <div class="profile-level">${lv.n} · 积分 ${PROFILE.score}${nx ? ` / ${nx.min}` : ''}</div>
      <div class="profile-bar"><i style="width:${barPct}%"></i></div>
      <div class="profile-stats">对局 ${PROFILE.games} ｜ 胜场 ${PROFILE.wins}（${wr}%）｜ 最高连胜 ${PROFILE.bestStreak} ｜ 答对 ${PROFILE.correctQuiz} 题 ｜ 成就 ${achCount(PROFILE)}/${ACHIEVEMENTS.length}</div>
    </div>
    <button class="btn btn-sm" onclick="showAchievements(PROFILE,'我的成就')">🏅 查看成就</button>
  </div>`;
}

export function showAchievements(p: Profile | PublicProfile, title: string): void {
  document.getElementById('profileModalTitle')!.textContent = title || '成就';
  const lv = levelOf(p.score || 0);
  const grid = ACHIEVEMENTS.map((a) => {
    const un = !!(p.achievements && p.achievements[a.id]);
    return `<div class="ach-item ${un ? 'unlocked' : ''}"><div class="ach-icon">${a.icon}</div><div class="ach-name">${a.name}</div><div class="ach-desc">${a.desc}</div></div>`;
  }).join('');
  const subs = p.subjects || {};
  const subNames = Object.keys(SUBJECT_ICON);
  const subHtml = subNames
    .map((s) => `<span style="display:inline-block;min-width:70px;font-size:11px;color:${(subs[s] || 0) > 0 ? '#8fd0ff' : '#5a4a3a'}">${SUBJECT_ICON[s]} ${s}：${subs[s] || 0}</span>`)
    .join('');
  document.getElementById('profileModalBody')!.innerHTML = `
    <div class="rule-section" style="padding:10px;background:rgba(0,0,0,.25);border-radius:8px;border-left:3px solid var(--gold);margin-bottom:10px">
      <div style="font-size:15px;color:var(--gold);font-weight:700">${escapeHtml(p.name || '玩家')}</div>
      <div style="font-size:11.5px;color:#8fd0ff;margin-top:3px">等级：${lv.n} ｜ 积分：${p.score || 0} ｜ 对局：${p.games || 0} ｜ 胜场：${p.wins || 0} ｜ 答对：${p.correctQuiz || 0} 题</div>
      <div style="font-size:11px;color:var(--muted);margin-top:6px;line-height:1.9">${subHtml}</div>
    </div>
    <div class="rule-section"><h4>🏅 成就（${achCount(p)}/${ACHIEVEMENTS.length}）</h4>
      <div class="ach-grid">${grid}</div>
    </div>`;
  document.getElementById('profileModal')!.classList.add('show');
}

export function closeProfileModal(): void {
  document.getElementById('profileModal')!.classList.remove('show');
}

/* ==================== 游戏结算 ==================== */
function localPlayerWin(): boolean {
  if (!G.gameOver) return false;
  const me = G.players[G.myPlayerIdx];
  if (!me) return false;
  const wt = G.winnerText;
  if (wt === '反贼获胜') return me.role === 'rebel';
  if (wt === '内奸获胜') return me.role === 'spy';
  if (wt === '主公与忠臣获胜') return me.role === 'lord' || me.role === 'loyal';
  return false;
}

export function maybeSettle(): void {
  if (!G.gameOver || G.settled) return;
  G.settled = true;
  const win = localPlayerWin();
  const correct = quizStats.correct,
    total = quizStats.total;
  PROFILE.games++;
  if (win) {
    PROFILE.wins++;
    PROFILE.winStreak++;
    if (PROFILE.winStreak > PROFILE.bestStreak) PROFILE.bestStreak = PROFILE.winStreak;
  } else PROFILE.winStreak = 0;
  PROFILE.totalQuiz += total;
  PROFILE.correctQuiz += correct;
  let gained = win ? 120 : 40;
  gained += correct * 6;
  const newAch: string[] = [];
  const unlock = (id: string): void => {
    if (!PROFILE.achievements[id]) {
      PROFILE.achievements[id] = Date.now();
      newAch.push(id);
      gained += 30;
    }
  };
  unlock('first_game');
  if (win) unlock('first_win');
  if (PROFILE.winStreak >= 3) unlock('win_3');
  if (PROFILE.correctQuiz >= 10) unlock('quiz_10');
  if (PROFILE.correctQuiz >= 50) unlock('quiz_50');
  const me = G.players[G.myPlayerIdx];
  if (me) {
    if (win && me.role === 'lord') unlock('lord_win');
    if (win && me.role === 'rebel') unlock('rebel_win');
    if (win && me.role === 'spy') unlock('spy_win');
    if ((me.maxCombo || 0) >= 5) unlock('combo_5');
  }
  if ((G.myKills || 0) >= 3) unlock('kill_3');
  const subs = Object.keys(PROFILE.subjects || {}).filter((k) => PROFILE.subjects[k] > 0);
  if (subs.length >= 9) unlock('all_subjects');
  PROFILE.score += gained;
  if (PROFILE.score >= 1000) unlock('score_1000');
  saveProfile();
  addLog(`📊 本局结算：${win ? '胜利' : '败北'} ｜ 答题 ${correct}/${total} ｜ 积分 +${gained}`, 'hl');
  newAch.forEach((id) => {
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (a) addLog(`🏅 解锁成就【${a.name}】`, 'reward');
  });
  refreshProfileUI();
  if (NET.isHost && NET.mode === 'host') {
    NET.broadcast({ type: 'chat', name: '系统', text: `${PROFILE.name} 本局${win ? '胜利' : '败北'}，积分 +${gained}` });
  }
}
