/* ==================== 大厅 UI / 选角 / 题库管理 / 房间成员 ==================== */
import type { Character, FactionId, PublicProfile, Role } from '../core/types';
import { escapeHtml, inputValue } from '../core/dom';
import { Sound } from '../core/sound';
import { FACTIONS } from '../data/factions';
import { ROLES, ROLE_CONFIG, ROLE_ICON, CHARACTERS, charPoolForGrade } from '../data/characters';
import { sortedGrades } from '../data/grades';
import {
  BUILTIN_QUESTION_BANK,
  EXTERNAL_STATS,
  QUESTION_BANK,
  loadBankFromUrl,
  mergeBankData,
  parseBankText,
  resetExternalStats,
} from '../data/questionBank';
import { levelOf, PROFILE, refreshProfileUI, saveProfile, showAchievements } from '../profile/profile';
import { startSingle } from '../game/setup';

/* ---- 大厅选择状态（原版全局变量，仅本模块写入，其他模块只读） ---- */
export let SELECTED_GRADE = '初二上';
export let SELECTED_COUNT = 4;
export let SELECTED_CHAR: Character | null = null;
export let SELECTED_FACTION: FactionId = 'chinese';
export let SELECTED_MODE: 'single' | 'host' | 'join' = 'single';
export let USER_CHOSEN = false;
export let SELECTED_ROLE: Role | 'random' = 'random';

export function renderGradePicker(): void {
  const grid = document.getElementById('gradePicker');
  if (!grid) return;
  const grades = sortedGrades();
  if (!grades.length) {
    grid.innerHTML = '<span style="color:var(--muted);font-size:11px;">题库为空，请先导入题库</span>';
    return;
  }
  if (!grades.includes(SELECTED_GRADE)) SELECTED_GRADE = grades[0];
  grid.innerHTML = grades
    .map((g) => {
      const n = (QUESTION_BANK[g] || []).length;
      const cn = charPoolForGrade(g).length;
      return `<button class="opt-btn ${g === SELECTED_GRADE ? 'active' : ''}" data-grade="${g}">${g}<small>${n}题 · ${cn}角色</small></button>`;
    })
    .join('');
}

export function getAvailableRoles(count: number): Role[] {
  const deck = ROLE_CONFIG[count] || ROLE_CONFIG[4];
  return [...new Set(deck)];
}

export function renderRolePicker(): void {
  const grid = document.getElementById('rolePicker');
  if (!grid) return;
  const roles = getAvailableRoles(SELECTED_COUNT);
  let html = `<div class="role-card ${SELECTED_ROLE === 'random' ? 'selected' : ''}" style="border-color:#8a6d3b;color:#8a6d3b;" onclick="selectRole('random')"><div class="r-icon">🎲</div><div class="r-name">随机</div></div>`;
  roles.forEach((r) => {
    const info = ROLES[r];
    html += `<div class="role-card ${SELECTED_ROLE === r ? 'selected' : ''}" style="border-color:${info.color};color:${info.color};" onclick="selectRole('${r}')"><div class="r-icon">${ROLE_ICON[r] || '❓'}</div><div class="r-name">${info.name}</div></div>`;
  });
  grid.innerHTML = html;
}

export function selectRole(r: Role | 'random'): void {
  Sound.play('click');
  SELECTED_ROLE = r;
  renderRolePicker();
}

export function renderFactionPicker(): void {
  const grid = document.getElementById('factionPicker');
  if (!grid) return;
  const pool = charPoolForGrade(SELECTED_GRADE);
  const fset = new Set(pool.map((c) => c.faction));
  grid.innerHTML = Object.entries(FACTIONS)
    .map(([k, f]) => {
      const disabled = !fset.has(k as FactionId);
      const cnt = pool.filter((c) => c.faction === k).length;
      return `<div class="faction-card ${k === SELECTED_FACTION && !disabled ? 'selected' : ''}" style="border-color:${f.color};color:${f.color};${disabled ? 'opacity:.35;' : ''}${k === SELECTED_FACTION && !disabled ? 'box-shadow:0 0 16px ' + f.color : ''}" onclick="selectFaction('${k}')">
      <div class="f-icon">${f.icon}</div>
      <div class="f-name" style="color:${f.color};">${f.name}</div>
      <div class="f-desc">${disabled ? '本年级暂无角色' : '主公技：' + f.lordSkill.name + ' · ' + cnt + '角色'}</div>
    </div>`;
    })
    .join('');
}

export function selectFaction(k: FactionId): void {
  Sound.play('click');
  const pool = charPoolForGrade(SELECTED_GRADE).filter((c) => c.faction === k);
  if (!pool.length) {
    alert('当前年级下该阵营暂无角色，请提高年级或导入题库');
    return;
  }
  USER_CHOSEN = true;
  SELECTED_FACTION = k;
  if (!SELECTED_CHAR || SELECTED_CHAR.faction !== k) SELECTED_CHAR = pool[0];
  renderFactionPicker();
  renderCharPicker();
}

export function renderCharPicker(): void {
  const grid = document.getElementById('charGrid');
  if (!grid) return;
  const pool = charPoolForGrade(SELECTED_GRADE).filter((c) => c.faction === SELECTED_FACTION);
  const hint = document.getElementById('charPoolHint');
  if (hint) hint.textContent = `（当前可选角色池共 ${charPoolForGrade(SELECTED_GRADE).length} 名）`;
  if (!pool.length) {
    grid.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px;">该阵营在当前年级暂无角色</div>';
    return;
  }
  if (!SELECTED_CHAR || !pool.some((c) => c.id === SELECTED_CHAR!.id)) SELECTED_CHAR = pool[0];
  grid.innerHTML = pool
    .map((c) => {
      const f = FACTIONS[c.faction];
      const sel = SELECTED_CHAR && SELECTED_CHAR.id === c.id;
      return `<div class="char-card ${sel ? 'selected' : ''}" style="border-color:${f.color};color:${f.color};${sel ? 'box-shadow:0 0 16px ' + f.color : ''}" onclick="selectChar('${c.id}')">
      <div class="faction-badge" style="color:${f.color};">${f.icon}</div>
      <div class="ctop"><span class="cavatar">${c.avatar}</span><div><div class="cname" style="color:${f.color};">${c.name}</div><div class="ctitle">${c.title}</div></div></div>
      <div class="csubject" style="color:${f.color};">${f.name} · 体力${c.hp}</div>
      <div class="cskill">${c.skills.map((s) => `<b>${s.name}</b>：${s.desc}`).join('<br>')}</div>
      <div class="cgrade">${c.grade}</div>
    </div>`;
    })
    .join('');
}

export function selectChar(id: string): void {
  Sound.play('click');
  USER_CHOSEN = true;
  SELECTED_CHAR = CHARACTERS.find((c) => c.id === id) || null;
  renderCharPicker();
}

export function updateLobbyMode(): void {
  const hc = document.getElementById('hostConfig')!;
  const jc = document.getElementById('joinConfig')!;
  const sb = document.getElementById('startBtn') as HTMLButtonElement | null;
  const rc = document.getElementById('roomConfig');
  if (SELECTED_MODE === 'single') {
    hc.style.display = 'block';
    jc.style.display = 'none';
    if (rc) rc.style.display = 'none';
    if (sb) {
      sb.textContent = '开始单机对局';
      sb.onclick = startSingle;
      sb.style.display = 'block';
    }
  } else if (SELECTED_MODE === 'host') {
    hc.style.display = 'block';
    jc.style.display = 'none';
    if (rc) rc.style.display = 'block';
    if (sb) sb.style.display = 'none';
  } else {
    hc.style.display = 'none';
    jc.style.display = 'block';
    if (sb) sb.style.display = 'none';
  }
}

export function updateAIHint(): void {
  const h = document.getElementById('aiCountHint');
  if (h) h.textContent = `将补充 ${SELECTED_COUNT - 1} 名 AI`;
}

/** 保证当前选角在年级/阵营池内合法 */
export function ensureCharValid(): void {
  const pool = charPoolForGrade(SELECTED_GRADE).filter((c) => c.faction === SELECTED_FACTION);
  if (!pool.length) {
    const allPool = charPoolForGrade(SELECTED_GRADE);
    if (allPool.length) {
      SELECTED_FACTION = allPool[0].faction;
      SELECTED_CHAR = allPool[0];
    }
    return;
  }
  if (!SELECTED_CHAR || !pool.some((c) => c.id === SELECTED_CHAR!.id)) SELECTED_CHAR = pool[0];
}

/** 未手动选择时随机派发阵营与角色 */
export function pickRandomCharIfNotChosen(): void {
  if (USER_CHOSEN) return;
  const pool = charPoolForGrade(SELECTED_GRADE);
  if (!pool.length) return;
  const fset = [...new Set(pool.map((c) => c.faction))];
  SELECTED_FACTION = fset[Math.floor(Math.random() * fset.length)];
  const chars = pool.filter((c) => c.faction === SELECTED_FACTION);
  SELECTED_CHAR = chars[Math.floor(Math.random() * chars.length)];
  renderFactionPicker();
  renderCharPicker();
}

/** 大厅选择器事件绑定（原版在脚本顶层 addEventListener） */
export function bindLobbyEvents(): void {
  document.getElementById('gradePicker')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('.opt-btn') as HTMLElement | null;
    if (!b) return;
    Sound.play('click');
    document.querySelectorAll('#gradePicker .opt-btn').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    SELECTED_GRADE = b.dataset.grade || SELECTED_GRADE;
    ensureCharValid();
    renderFactionPicker();
    renderCharPicker();
  });
  document.getElementById('playerCountPicker')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('.opt-btn') as HTMLElement | null;
    if (!b) return;
    Sound.play('click');
    document.querySelectorAll('#playerCountPicker .opt-btn').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    SELECTED_COUNT = Number(b.dataset.count);
    updateAIHint();
    renderRolePicker();
  });
  document.getElementById('modePicker')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('.opt-btn') as HTMLElement | null;
    if (!b) return;
    Sound.play('click');
    document.querySelectorAll('#modePicker .opt-btn').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    SELECTED_MODE = (b.dataset.mode as 'single' | 'host' | 'join') || 'single';
    updateLobbyMode();
  });
}

/* ==================== 房间成员列表 ==================== */
interface RoomStateLike {
  roomCode: string;
  hostName: string;
  members: { name: string; isHost: boolean; profile: PublicProfile | null }[];
  currentCount: number;
  targetCount: number;
}

function memberListHtml(members: RoomStateLike['members'], currentCount: number, targetCount: number, tail: string): string {
  let h = `<div style="color:#f5c542;font-size:11px;margin-bottom:4px;">房间成员（${currentCount}/${targetCount}）· 点击查看成就</div>`;
  members.forEach((m) => {
    const isHost = m.isHost;
    const icon = isHost ? '👑' : '🎓';
    const tag = isHost ? '房主' : '玩家';
    const tc = isHost ? '' : 'guest';
    const pf = m.profile;
    const lv = pf ? levelOf(pf.score || 0).n : '未同步';
    const safeName = escapeHtml(m.name || '玩家');
    h += `<div class="rm-item ${isHost ? 'host' : ''}" onclick="viewMemberProfile('${safeName}',${m.profile ? JSON.stringify(m.profile).replace(/"/g, '&quot;') : 'null'})">
      <span class="rm-avatar">${icon}</span>
      <span class="rm-name">${safeName}</span>
      <span class="rm-lv">${lv}</span>
      <span class="rm-tag ${tc}">${tag}</span>
    </div>`;
  });
  return h + tail;
}

export function updateHostRoomInfo(state: RoomStateLike): void {
  const info = document.getElementById('roomInfo');
  const ml = document.getElementById('hostMemberList');
  const sb = document.getElementById('hostStartBtn');
  const cb = document.getElementById('closeRoomBtn');
  const crb = document.getElementById('createRoomBtn');
  if (!info) return;
  info.innerHTML = `<div style="font-size:14px;letter-spacing:2px;margin-bottom:4px">房间号：<span style="font-size:20px;color:#f5c542;">${state.roomCode}</span></div>
    <div style="font-size:11px;color:#a89880">已加入：<b style="color:#f5c542">${state.currentCount}</b> / ${state.targetCount} 人</div>`;
  ml!.style.display = 'block';
  ml!.innerHTML = memberListHtml(state.members, state.currentCount, state.targetCount, '');
  sb!.style.display = 'block';
  cb!.style.display = 'inline-block';
  crb!.style.display = 'none';
}

export function updateGuestRoomInfo(state: RoomStateLike): void {
  const st = document.getElementById('joinStatus');
  const ml = document.getElementById('guestMemberList');
  const lb = document.getElementById('leaveRoomBtn');
  const jb = document.getElementById('joinRoomBtn');
  if (!st) return;
  st.innerHTML = `<span style="color:#27ae60;">✅ 已连接房主：${escapeHtml(state.hostName)}</span>`;
  ml!.style.display = 'block';
  ml!.innerHTML = memberListHtml(
    state.members,
    state.currentCount,
    state.targetCount,
    '<div style="font-size:10px;color:#a89880;margin-top:6px;text-align:center">等待房主开始游戏…</div>',
  );
  lb!.style.display = 'inline-block';
  jb!.style.display = 'none';
}

export function viewMemberProfile(name: string, profile: PublicProfile | null): void {
  if (!profile) {
    alert(`【${name}】尚未同步档案`);
    return;
  }
  const p = Object.assign(
    { name, score: 0, games: 0, wins: 0, achievements: {}, subjects: {}, correctQuiz: 0 },
    profile,
  ) as PublicProfile;
  showAchievements(p, `${name} 的成就`);
}

/* ==================== 题库管理 ==================== */
export function updateBankInfo(): void {
  const bi = document.getElementById('bankInfo');
  if (!bi) return;
  const grades = sortedGrades();
  if (!grades.length) {
    bi.textContent = '暂无题库';
    return;
  }
  let tb = 0,
    te = 0;
  const parts: string[] = [];
  grades.forEach((g) => {
    const ext = EXTERNAL_STATS[g] || 0;
    const total = (QUESTION_BANK[g] || []).length;
    const builtin = Math.max(0, total - ext);
    tb += builtin;
    te += ext;
    parts.push(`${g}:${builtin}${ext ? '+' + ext : ''}`);
  });
  bi.innerHTML = `年级：<b>${grades.length}</b> 个 ｜ 内置 <b>${tb}</b> 题 ｜ 外部 <b style="color:#8fd0ff">${te}</b> 题<br>
    <span style="font-size:10px;line-height:1.6">${parts.join('　')}</span>`;
}

export function loadBankFromUrlInput(): void {
  const v = inputValue('bankUrlInput').trim();
  if (!v) {
    alert('请输入题库 URL');
    return;
  }
  loadBankFromUrl(v, false);
}

export function importQuestionBank(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = parseBankText(String(e.target?.result ?? ''));
      if (!data) throw new Error('未找到题库数据');
      const r = mergeBankData(data);
      updateBankInfo();
      renderGradePicker();
      alert(`✅ 题库导入完成\n\n${r.reps.join('\n')}\n\n总计：新增 ${r.added}，重复 ${r.dup}，无效 ${r.invalid}`);
      input.value = '';
    } catch (err) {
      alert('❌ 导入失败：' + (err as Error).message);
      input.value = '';
    }
  };
  reader.readAsText(file);
}

export function clearExternalBank(): void {
  if (!confirm('确认清空所有外部题库（URL / 本地导入）？')) return;
  for (const g of Object.keys(QUESTION_BANK)) {
    const builtin = BUILTIN_QUESTION_BANK[g] || [];
    if (!builtin.length) {
      delete QUESTION_BANK[g];
      continue;
    }
    const set = new Set(builtin.map((q) => q.q));
    QUESTION_BANK[g] = QUESTION_BANK[g].filter((q) => set.has(q.q));
  }
  resetExternalStats();
  updateBankInfo();
  renderGradePicker();
}

/* ==================== 昵称持久化 ==================== */
export function bindNicknamePersistence(): void {
  ['nicknameInput', 'joinNick'].forEach((id) => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el) return;
    el.value = PROFILE.name || '玩家';
    el.addEventListener('input', () => {
      const v = (el.value || '').trim().slice(0, 12);
      if (v) {
        PROFILE.name = v;
        saveProfile();
      }
    });
  });
}
