/* ==================== 个人档案 / 成就 / 结算 ==================== */
import type {
  Achievement,
  Gender,
  Level,
  PlayerIdentity,
  Profile,
  PublicProfile,
} from '../core/types';
import { escapeHtml } from '../core/dom';
import { showSettle } from '../ui/settle';
import { SUBJECT_ICON } from '../data/factions';
import { G, quizStats } from '../game/state';
import { addLog } from '../game/log';
import { NET } from '../net/network';

const PROFILE_KEY = 'xuetangsha_profile_v1';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ==================== 个性化选项 ==================== */
export const DEFAULT_AVATAR = '🧑‍🎓';
export const DEFAULT_MOOD_ICON = '🙂';

/** 可选头像（emoji） */
export const AVATAR_OPTIONS: string[] = [
  '🧑‍🎓','👦','👧','🧒','👨‍🏫','👩‍🏫','🧑‍🏫','👨‍🎓','👩‍🎓','🧑‍🔬','👨‍🔬','👩‍🔬',
  '🧑‍🎨','👨‍🎤','🧑‍💻','🦸','🦹','🧙','🧝','🤴','👸','🥷','🕵️','🧑‍🚀',
];

/** 可选心情图标（emoji） */
export const MOOD_ICON_OPTIONS: string[] = [
  '🙂','😀','😎','🤔','😤','🥳','😴','🤯','🥰','😭','🤡','👻',
  '💪','🔥','🌟','🍀','🎯','📚','✏️','🎧','☕','🌙','⚡','🏆',
];

/** 性别选项：值 / 显示名 / 图标 */
export const GENDER_OPTIONS: { value: Gender; label: string; icon: string }[] = [
  { value: 'male', label: '男生', icon: '👦' },
  { value: 'female', label: '女生', icon: '👧' },
  { value: 'hidden', label: '保密', icon: '🕶️' },
];

export function genderIcon(g: Gender): string {
  return GENDER_OPTIONS.find((x) => x.value === g)?.icon ?? '🕶️';
}

export function genderLabel(g: Gender): string {
  return GENDER_OPTIONS.find((x) => x.value === g)?.label ?? '保密';
}

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
    avatar: DEFAULT_AVATAR,
    gender: 'hidden',
    mood: '',
    moodIcon: DEFAULT_MOOD_ICON,
    themeMode: 'night',
    themeStyle: 'gold',
    quizScope: 'grade',
    quizRec: {},
    // 学分体系（仅由学习行为产出，仅用于解锁/购买）
    credits: 0,
    creditDaily: { date: todayStr(), earned: 0, missionEarned: 0, sources: {} },
    // 每日学习任务（v1.8.1）
    missionDaily: { date: todayStr(), quiz: 0, review: 0, wrongFixed: 0, combo: 0, claimed: [] },
    // 已解锁（购买）内容
    unlockedChars: [],
    unlockedEquips: [],
    items: {},
    // 局前配装
    loadout: { weapon: null, armor: null, horsePlus: null, horseMinus: null, items: {} },
    // 学段学习量（各学期累计答对题数）与新手礼包发放标记
    gradeStats: {},
    newbieGift: false,
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
        // 兼容旧档案：补齐个性化字段
        avatar: p.avatar || DEFAULT_AVATAR,
        gender: p.gender ?? 'hidden',
        mood: typeof p.mood === 'string' ? p.mood : '',
        moodIcon: p.moodIcon || DEFAULT_MOOD_ICON,
        // 兼容旧档案：补齐学习档案字段（出题范围 / 错题本）
        quizScope: p.quizScope === 'past' || p.quizScope === 'junior' || p.quizScope === 'senior' ? p.quizScope : 'grade',
        quizRec: p.quizRec && typeof p.quizRec === 'object' ? p.quizRec : {},
        // 兼容旧档案：补齐学分体系字段（旧档缺字段绝不能白屏）
        credits: typeof p.credits === 'number' ? p.credits : 0,
        creditDaily: p.creditDaily && typeof p.creditDaily === 'object' && typeof p.creditDaily.date === 'string'
          ? {
              date: p.creditDaily.date,
              earned: p.creditDaily.earned || 0,
              missionEarned: p.creditDaily.missionEarned || 0,
              sources:
                p.creditDaily.sources && typeof p.creditDaily.sources === 'object'
                  ? p.creditDaily.sources
                  : {},
            }
          : { date: todayStr(), earned: 0, missionEarned: 0, sources: {} },
        // 兼容旧档案：补每日学习任务字段（v1.8.1）
        missionDaily:
          p.missionDaily && typeof p.missionDaily === 'object' && typeof p.missionDaily.date === 'string'
            ? {
                date: p.missionDaily.date,
                quiz: p.missionDaily.quiz || 0,
                review: p.missionDaily.review || 0,
                wrongFixed: p.missionDaily.wrongFixed || 0,
                combo: p.missionDaily.combo || 0,
                claimed: Array.isArray(p.missionDaily.claimed) ? p.missionDaily.claimed : [],
              }
            : { date: todayStr(), quiz: 0, review: 0, wrongFixed: 0, combo: 0, claimed: [] },
        unlockedChars: Array.isArray(p.unlockedChars) ? p.unlockedChars : [],
        unlockedEquips: Array.isArray(p.unlockedEquips) ? p.unlockedEquips : [],
        items: p.items && typeof p.items === 'object' ? p.items : {},
        loadout: p.loadout && typeof p.loadout === 'object'
          ? {
              weapon: p.loadout.weapon ?? null,
              armor: p.loadout.armor ?? null,
              horsePlus: p.loadout.horsePlus ?? null,
              horseMinus: p.loadout.horseMinus ?? null,
              items: p.loadout.items && typeof p.loadout.items === 'object' ? p.loadout.items : {},
            }
          : { weapon: null, armor: null, horsePlus: null, horseMinus: null, items: {} },
        // 兼容旧档案：补学段学习量与新手礼包字段（v1.8.0 学习成果解锁）
        gradeStats: p.gradeStats && typeof p.gradeStats === 'object' ? p.gradeStats : {},
        newbieGift: typeof p.newbieGift === 'boolean' ? p.newbieGift : false,
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
    avatar: PROFILE.avatar || DEFAULT_AVATAR,
    gender: PROFILE.gender ?? 'hidden',
    mood: PROFILE.mood || '',
    moodIcon: PROFILE.moodIcon || DEFAULT_MOOD_ICON,
    score: PROFILE.score,
    games: PROFILE.games,
    wins: PROFILE.wins,
    achievements: PROFILE.achievements || {},
    subjects: PROFILE.subjects || {},
    correctQuiz: PROFILE.correctQuiz || 0,
    bestStreak: PROFILE.bestStreak || 0,
  };
}

/** 本人的个性化身份（用于写入 Player.identity） */
export function localIdentity(): PlayerIdentity {
  return {
    name: PROFILE.name || '玩家',
    avatar: PROFILE.avatar || DEFAULT_AVATAR,
    gender: PROFILE.gender ?? 'hidden',
    mood: PROFILE.mood || '',
    moodIcon: PROFILE.moodIcon || DEFAULT_MOOD_ICON,
  };
}

/** 由联机同步来的档案还原个性化身份 */
export function identityFromProfile(p: PublicProfile | null): PlayerIdentity | null {
  if (!p) return null;
  return {
    name: p.name || '玩家',
    avatar: p.avatar || DEFAULT_AVATAR,
    gender: p.gender ?? 'hidden',
    mood: p.mood || '',
    moodIcon: p.moodIcon || DEFAULT_MOOD_ICON,
  };
}

/* ==================== 个性化资料编辑 ==================== */
function setName(v: string): void {
  PROFILE.name = v.slice(0, 12);
  saveProfile();
}

function setAvatar(v: string): void {
  PROFILE.avatar = v;
  saveProfile();
}

function setGender(v: Gender): void {
  PROFILE.gender = v;
  saveProfile();
}

function setMood(v: string): void {
  PROFILE.mood = v.slice(0, 24);
  saveProfile();
}

function setMoodIcon(v: string): void {
  PROFILE.moodIcon = v;
  saveProfile();
}

export const setters = { setName, setAvatar, setGender, setMood, setMoodIcon };

export function achCount(p: Profile | PublicProfile): number {
  return Object.keys((p && p.achievements) || {}).length;
}

export function refreshProfileUI(): void {
  const lv = levelOf(PROFILE.score),
    nx = nextLevelOf(PROFILE.score);
  let barPct = 100;
  if (nx) {
    const base = lv.min,
      span = Math.max(1, nx.min - base);
    barPct = Math.max(2, Math.min(100, Math.round(((PROFILE.score - base) / span) * 100)));
  }
  const wr = PROFILE.games ? Math.round((PROFILE.wins / PROFILE.games) * 100) : 0;
  const avatar = PROFILE.avatar || DEFAULT_AVATAR;
  const mood = PROFILE.mood || '';
  const moodIcon = PROFILE.moodIcon || DEFAULT_MOOD_ICON;
  const idtip = mood ? ` ${moodIcon} ${escapeHtml(mood)}` : '';

  // 主界面名片：只展示设置后的信息
  const nc = document.getElementById('nameCard');
  if (nc) {
    nc.innerHTML = `<div class="name-card">
      <div class="nc-avatar">${avatar}</div>
      <div class="nc-main">
        <div class="nc-name">${escapeHtml(PROFILE.name || '玩家')}<span class="nc-gender">${genderIcon(PROFILE.gender ?? 'hidden')}</span></div>
        <div class="nc-level">${lv.n} · 积分 ${PROFILE.score}${nx ? ` / ${nx.min}` : ''}</div>
        ${mood ? `<div class="nc-mood">${moodIcon} ${escapeHtml(mood)}</div>` : ''}
        <div class="nc-stats">对局 ${PROFILE.games} ｜ 胜率 ${wr}% ｜ 成就 ${achCount(PROFILE)}/${ACHIEVEMENTS.length}</div>
      </div>
    </div>`;
  }

  // 兼容：若页面仍存在旧档案卡容器则一并渲染
  const el = document.getElementById('profileCard');
  if (el) {
    el.innerHTML = `<div class="profile-card">
    <div class="profile-avatar">${PROFILE.avatar || DEFAULT_AVATAR}</div>
    <div class="profile-main">
      <div class="profile-name">${escapeHtml(PROFILE.name || '玩家')} <span class="profile-gender">${genderIcon(PROFILE.gender ?? 'hidden')}</span></div>
      <div class="profile-level">${lv.n} · 积分 ${PROFILE.score}${nx ? ` / ${nx.min}` : ''}</div>
      <div class="profile-bar"><i style="width:${barPct}%"></i></div>
      ${idtip ? `<div class="profile-mood">${idtip}</div>` : ''}
      <div class="profile-stats">对局 ${PROFILE.games} ｜ 胜场 ${PROFILE.wins}（${wr}%）｜ 最高连胜 ${PROFILE.bestStreak} ｜ 答对 ${PROFILE.correctQuiz} 题 ｜ 成就 ${achCount(PROFILE)}/${ACHIEVEMENTS.length}</div>
    </div>
    <button class="btn btn-sm" onclick="showAchievements(PROFILE,'我的成就')">🏅 查看成就</button>
  </div>`;
  }
  // 通知顶栏 / 成就网格刷新（lobby.ts 监听，避免循环依赖）
  try {
    window.dispatchEvent(new CustomEvent('profile-updated'));
  } catch (e) {
    /* ignore */
  }
}

export function showAchievements(p: Profile | PublicProfile, title: string, opts?: { editor?: boolean }): void {
  // 自我视图（editor）：标题栏附等级/积分徽章；他人档案仅标题
  const titleEl = document.getElementById('profileModalTitle')!;
  if (opts?.editor) {
    const lv0 = levelOf(p.score || 0);
    titleEl.innerHTML = `${escapeHtml(title || '成就')}<span class="pm-badge">Lv.${lv0.n}</span><span class="pm-badge">⭐ ${p.score || 0}</span>`;
  } else {
    titleEl.textContent = title || '成就';
  }
  const lv = levelOf(p.score || 0);
  const avatar = (p as PublicProfile).avatar || DEFAULT_AVATAR;
  const gender = (p as PublicProfile).gender ?? 'hidden';
  const mood = (p as PublicProfile).mood || '';
  const moodIcon = (p as PublicProfile).moodIcon || DEFAULT_MOOD_ICON;
  const grid = ACHIEVEMENTS.map((a) => {
    const un = !!(p.achievements && p.achievements[a.id]);
    return `<div class="ach-item ${un ? 'unlocked' : 'locked'}"><div class="ach-icon">${un ? a.icon : '🔒'}</div><div class="ach-name">${a.name}</div><div class="ach-desc">${a.desc}</div></div>`;
  }).join('');
  const subs = p.subjects || {};
  const subNames = Object.keys(SUBJECT_ICON);
  const subHtml = subNames
    .map((s) => `<span style="display:inline-block;min-width:70px;font-size:11px;color:${(subs[s] || 0) > 0 ? '#8fd0ff' : '#5a4a3a'}">${SUBJECT_ICON[s]} ${s}：${subs[s] || 0}</span>`)
    .join('');
  document.getElementById('profileModalBody')!.innerHTML = `
    <div class="rule-section" style="padding:10px;background:rgba(0,0,0,.25);border-radius:8px;border-left:3px solid var(--gold);margin-bottom:10px">
      <div style="font-size:15px;color:var(--gold);font-weight:700">${avatar} ${escapeHtml(p.name || '玩家')} <span style="font-size:12px">${genderIcon(gender)}</span>${mood ? `<span style="font-size:12px;color:var(--muted)"> ${moodIcon} ${escapeHtml(mood)}</span>` : ''}</div>
      <div style="font-size:11.5px;color:#8fd0ff;margin-top:3px">等级：${lv.n} ｜ 积分：${p.score || 0} ｜ 对局：${p.games || 0} ｜ 胜场：${p.wins || 0} ｜ 答对：${p.correctQuiz || 0} 题</div>
      <div style="font-size:11px;color:var(--muted);margin-top:6px;line-height:1.9">${subHtml}</div>
    </div>
    <div class="rule-section"><h4>🏅 成就（${achCount(p)}/${ACHIEVEMENTS.length}）</h4>
      <div class="ach-grid">${grid}</div>
    </div>
    ${opts?.editor ? `<div class="rule-section"><h4>🎨 个性化资料</h4><div style="font-size:10.5px;color:var(--muted);margin-bottom:8px">设置后的信息会展示在主界面名片上，联机时其他玩家也能看到。</div><div id="profileEditor"></div></div>` : ''}
    ${opts?.editor ? '<div class="rule-section" id="wrongBookBox"></div>' : ''}`;
  document.getElementById('profileModal')!.classList.add('show');
}

export function closeProfileModal(): void {
  document.getElementById('profileModal')!.classList.remove('show');
}

/* ==================== 游戏结算 ==================== */
export function localPlayerWin(): boolean {
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
  // 一局结束结算面板（含按胜利方式的个性动画 + 重开一局入口）
  showSettle({
    win,
    gained,
    correct,
    total,
    score: PROFILE.score,
    newAch: newAch
      .map((id) => ACHIEVEMENTS.find((x) => x.id === id))
      .filter((a): a is (typeof ACHIEVEMENTS)[number] => !!a)
      .map((a) => ({ icon: a.icon, name: a.name })),
  });
}
