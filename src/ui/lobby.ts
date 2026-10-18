/* ==================== 大厅 UI / 选角 / 题库管理 / 房间成员 ==================== */
import type { Character, FactionId, Gender, PublicProfile, Role } from '../core/types';
import { escapeHtml, inputValue } from '../core/dom';
import { Sound } from '../core/sound';
import { FACTIONS } from '../data/factions';
import { ROLES, ROLE_CONFIG, ROLE_ICON, CHARACTERS, charPoolForGrade } from '../data/characters';
import { NET } from '../net/network';
import {
  EXTERNAL_STATS,
  QUESTION_BANK,
  loadBankFromUrl,
  mergeBankData,
  parseBankText,
  resetExternalStats,
  sortedGrades,
  builtinCount,
  isGradeLoaded,
} from '../data/questionBank';
import {
  AVATAR_OPTIONS,
  DEFAULT_AVATAR,
  GENDER_OPTIONS,
  MOOD_ICON_OPTIONS,
  genderIcon,
  levelOf,
  PROFILE,
  refreshProfileUI,
  ACHIEVEMENTS,
  saveProfile,
  setters,
  showAchievements,
} from '../profile/profile';
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
      // 题数来自年级清单（内置）+ 外部导入，无需加载题目本身
      const n = builtinCount(g) + (EXTERNAL_STATS[g] || 0);
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
  pushGuestPref();
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
  pushGuestPref();
}

/* ==================== 加入档：阵营 / 角色选择（同步给房主） ==================== */
/** 渲染加入方专用选择器（使用全量角色池，不限定年级） */
export function renderJoinPickers(): void {
  const fp = document.getElementById('joinFactionPicker');
  if (fp) {
    fp.innerHTML = Object.entries(FACTIONS)
      .map(
        ([k, f]) =>
          `<div class="faction-card ${k === SELECTED_FACTION ? 'selected' : ''}" style="border-color:${f.color};color:${f.color};${k === SELECTED_FACTION ? 'box-shadow:0 0 16px ' + f.color : ''}" onclick="selectFaction('${k}')">
          <div class="f-icon">${f.icon}</div>
          <div class="f-name" style="color:${f.color};">${f.name}</div>
          <div class="f-desc">主公技：${f.lordSkill.name}</div></div>`,
      )
      .join('');
  }
  const cg = document.getElementById('joinCharGrid');
  if (cg) {
    const pool = CHARACTERS.filter((c) => c.faction === SELECTED_FACTION);
    if (!SELECTED_CHAR || SELECTED_CHAR.faction !== SELECTED_FACTION) SELECTED_CHAR = pool[0] ?? null;
    cg.innerHTML = pool
      .map((c) => {
        const f = FACTIONS[c.faction];
        const sel = SELECTED_CHAR && SELECTED_CHAR.id === c.id;
        return `<div class="char-card ${sel ? 'selected' : ''}" style="border-color:${f.color};color:${f.color};${sel ? 'box-shadow:0 0 16px ' + f.color : ''}" onclick="selectChar('${c.id}')">
          <div class="faction-badge" style="color:${f.color};">${f.icon}</div>
          <div class="ctop"><span class="cavatar">${c.avatar}</span><div><div class="cname" style="color:${f.color};">${c.name}</div><div class="ctitle">${c.title}</div></div></div>
          <div class="csubject" style="color:${f.color};">${f.name} · 体力${c.hp}</div>
          <div class="cskill">${c.skills.map((s) => `<b>${s.name}</b>：${s.desc}`).join('<br>')}</div>
          <div class="cgrade">${c.grade}</div></div>`;
      })
      .join('');
  }
}

/** 加入方选择阵营 / 角色后，把偏好同步给房主 */
export function pushGuestPref(): void {
  if (SELECTED_MODE !== 'join') return;
  if (NET.isHost) return; // 仅客户端发送
  NET.sendToHost({
    type: 'guest_pref',
    pref: { faction: SELECTED_FACTION, charId: SELECTED_CHAR ? SELECTED_CHAR.id : null },
  });
  renderJoinPickers();
}

/* ==================== 二级菜单 / 子界面导航 ==================== */
const MODE_TITLE: Record<'single' | 'host' | 'join', string> = {
  single: '单机对局设置',
  host: '联机房主设置',
  join: '加入房间',
};

/** 进入对局设置子界面（选定模式后） */
export function enterSetup(mode: 'single' | 'host' | 'join'): void {
  SELECTED_MODE = mode;
  updateLobbyMode();
  renderSetupSummary();
  document.getElementById('screenLobby')!.classList.remove('active');
  document.getElementById('screenSetup')!.classList.add('active');
  Sound.play('click');
}

/** 返回主界面 */
export function backToLobby(): void {
  Sound.play('click');
  document.getElementById('screenSetup')!.classList.remove('active');
  document.getElementById('screenLobby')!.classList.add('active');
  renderSetupSummary();
}

/** 主界面配置摘要：只显示设置后的结果 */
export function renderSetupSummary(): void {
  const box = document.getElementById('setupSummary');
  if (!box) return;
  const faction = FACTIONS[SELECTED_FACTION];
  const roleName = SELECTED_ROLE === 'random' ? '随机' : ROLES[SELECTED_ROLE].name;
  const charName = SELECTED_CHAR ? `${SELECTED_CHAR.avatar} ${SELECTED_CHAR.name}` : '未选择';
  const modeName =
    SELECTED_MODE === 'single' ? '单机对局' : SELECTED_MODE === 'host' ? '创建房间' : '加入房间';
  box.innerHTML = `
    <div class="sum-row"><span class="sum-k">模式</span><b>${modeName}</b></div>
    <div class="sum-row"><span class="sum-k">年级</span><b>${SELECTED_GRADE}</b></div>
    <div class="sum-row"><span class="sum-k">人数</span><b>${SELECTED_COUNT} 人</b>（含 ${SELECTED_COUNT - 1} 名 AI）</div>
    <div class="sum-row"><span class="sum-k">身份</span><b>${roleName}</b></div>
    <div class="sum-row"><span class="sum-k">阵营</span><b style="color:${faction.color}">${faction.icon} ${faction.name}</b></div>
    <div class="sum-row"><span class="sum-k">角色</span><b>${charName}</b></div>
    <div class="sum-tip">选择上方任一模式即进入设置界面修改</div>`;
}

/** 个人信息（点头像）：我的档案 + 个性化资料 合并弹窗 */
export function openProfileMenu(): void {
  Sound.play('click');
  showAchievements(PROFILE, '我的档案', { editor: true });
  renderProfileEditor(); // 填充档案弹窗内的编辑器容器
}

/** 题库管理二级菜单 */
export function openBankMenu(): void {
  Sound.play('click');
  updateBankInfo();
  document.getElementById('bankModal')!.classList.add('show');
}

export function closeBankMenu(): void {
  document.getElementById('bankModal')!.classList.remove('show');
}

/* ==================== 固定顶栏 / 个人成就 / 设置抽屉 ==================== */
export function renderTopBar(): void {
  const lv = levelOf(PROFILE.score);
  const av = document.getElementById('tbAvatar');
  const nm = document.getElementById('tbName');
  const lvEl = document.getElementById('tbLevel');
  const sc = document.getElementById('tbScore');
  if (av) av.textContent = PROFILE.avatar || DEFAULT_AVATAR;
  if (nm) nm.textContent = PROFILE.name || '玩家';
  if (lvEl) lvEl.textContent = lv.n;
  if (sc) sc.textContent = `${PROFILE.score} 分`;
}

export function renderAchievements(): void {
  const grid = document.getElementById('achGrid');
  const sum = document.getElementById('achSummary');
  if (!grid) return;
  const got = ACHIEVEMENTS.filter((a) => (PROFILE.achievements || {})[a.id]);
  if (sum) sum.textContent = `已解锁 ${got.length}/${ACHIEVEMENTS.length}`;
  grid.innerHTML = ACHIEVEMENTS.map((a) => {
    const has = !!(PROFILE.achievements || {})[a.id];
    return `<div class="ach-item ${has ? '' : 'locked'}" title="${escapeHtml(a.desc || '')}">
      <div class="ai">${a.icon}</div>
      <div class="an">${escapeHtml(a.name)}</div>
      <div class="ap">${has ? '已解锁' : escapeHtml(a.desc || '')}</div></div>`;
  }).join('');
}



export function updateLobbyMode(): void {
  const hc = document.getElementById('hostConfig')!;
  const jc = document.getElementById('joinConfig')!;
  const np = document.getElementById('netModePanel')!;
  const sb = document.getElementById('startBtn') as HTMLButtonElement | null;
  const rc = document.getElementById('roomConfig');
  const title = document.getElementById('setupTitle');
  if (title) title.textContent = MODE_TITLE[SELECTED_MODE];
  // 联机方式二选一只在联机模式显示
  np.style.display = SELECTED_MODE === 'single' ? 'none' : 'block';
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
    if (rc) rc.style.display = 'none';
    if (sb) sb.style.display = 'none';
    renderJoinPickers();
  }
}

/** 联机建立 / 加入 二选一 */
export function setNetMode(net: 'host' | 'join'): void {
  Sound.play('click');
  document.querySelectorAll('#netModePicker .opt-btn').forEach((x) => x.classList.remove('active'));
  const btn = document.querySelector(`#netModePicker .opt-btn[data-net="${net}"]`) as HTMLElement | null;
  if (btn) btn.classList.add('active');
  // 切换联机方式：把模式切到 host / join
  enterSetup(net === 'host' ? 'host' : 'join');
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
  // 玩家总数改为滑块（见 bindCountSlider）
  document.getElementById('modePicker')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('.mode-card') as HTMLElement | null;
    if (!b) return;
    document.querySelectorAll('#modePicker .mode-card').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    const mode = (b.dataset.mode as 'single' | 'host' | 'join' | 'net') || 'single';
    // 选定模式后进入对局设置子界面（联机卡默认建立服务器档，下一屏联机方式可切换）
    enterSetup(mode === 'net' ? 'host' : mode);
  });
  // 档案变更时同步刷新顶栏 / 成就网格
  window.addEventListener('profile-updated', () => {
    renderTopBar();
    renderAchievements();
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
    // 个性化：头像 / 性别 / 心情（未同步档案时用默认）
    const av = pf?.avatar || DEFAULT_AVATAR;
    const gd = genderIcon(pf?.gender ?? 'hidden');
    const mood = pf?.mood ? `<span class="rm-mood">${pf.moodIcon || '🙂'} ${escapeHtml(pf.mood)}</span>` : '';
    h += `<div class="rm-item ${isHost ? 'host' : ''}" onclick="viewMemberProfile('${safeName}',${m.profile ? JSON.stringify(m.profile).replace(/"/g, '&quot;') : 'null'})">
      <span class="rm-avatar">${av}</span>
      <span class="rm-name">${safeName} <span class="rm-gender">${gd}</span>${mood}</span>
      <span class="rm-hosticon">${icon}</span>
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
    const builtin = builtinCount(g);
    tb += builtin;
    te += ext;
    parts.push(`${g}:${builtin}${ext ? '+' + ext : ''}${isGradeLoaded(g) ? '' : '·'}`);
  });
  bi.innerHTML = `年级：<b>${grades.length}</b> 个 ｜ 内置 <b>${tb}</b> 题 ｜ 外部 <b style="color:#8fd0ff">${te}</b> 题<br>
    <span style="font-size:10px;line-height:1.6">${parts.join('　')}</span>
    <span style="font-size:10px;color:var(--muted)">（按年级懒加载，开局时按需载入选中的年级；带 · 表示尚未加载）</span>`;
  const hint = document.getElementById('bankEntryHint');
  if (hint) hint.textContent = `${grades.length} 年级 · 内置 ${tb} 题${te ? ` · 外部 ${te} 题` : ''}`;
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
    const n = builtinCount(g);
    if (n && isGradeLoaded(g)) {
      // 已加载年级：内置题始终排在数组前 n 位，其后为外部导入题
      QUESTION_BANK[g] = QUESTION_BANK[g].slice(0, n);
    } else {
      // 未加载（全为外部题）或纯外部年级：整级移除，下次用时再懒加载
      delete QUESTION_BANK[g];
    }
  }
  resetExternalStats();
  updateBankInfo();
  renderGradePicker();
}

/* ==================== 个性化资料（昵称 / 头像 / 性别 / 心情） ==================== */
export function renderProfileEditor(): void {
  const box = document.getElementById('profileEditor');
  if (!box) return;
  const avatars = AVATAR_OPTIONS.map(
    (a) =>
      `<div class="pick-item ${a === PROFILE.avatar ? 'selected' : ''}" onclick="selectAvatar('${a}')">${a}</div>`,
  ).join('');
  const genders = GENDER_OPTIONS.map(
    (g) =>
      `<div class="pick-item pick-wide ${g.value === PROFILE.gender ? 'selected' : ''}" onclick="selectGender('${g.value}')">${g.icon} ${g.label}</div>`,
  ).join('');
  const icons = MOOD_ICON_OPTIONS.map(
    (i) =>
      `<div class="pick-item ${i === PROFILE.moodIcon ? 'selected' : ''}" onclick="selectMoodIcon('${i}')">${i}</div>`,
  ).join('');
  box.innerHTML = `
    <div class="pe-row">
      <label class="pe-label">昵称</label>
      <input type="text" id="profileNameInput" class="pe-input" maxlength="12" placeholder="给自己起个名字" value="${escapeHtml(PROFILE.name || '')}">
    </div>
    <div class="pe-row"><label class="pe-label">头像</label><div class="pick-grid" id="avatarGrid">${avatars}</div></div>
    <div class="pe-row"><label class="pe-label">性别</label><div class="pick-grid pick-grid-3">${genders}</div></div>
    <div class="pe-row">
      <label class="pe-label">心情</label>
      <input type="text" id="moodInput" class="pe-input" maxlength="24" placeholder="一句话心情（联机可见）" value="${escapeHtml(PROFILE.mood || '')}">
    </div>
    <div class="pe-row"><label class="pe-label">心情图标</label><div class="pick-grid" id="moodIconGrid">${icons}</div></div>
  `;
  const nameEl = document.getElementById('profileNameInput') as HTMLInputElement | null;
  nameEl?.addEventListener('input', () => {
    const v = (nameEl.value || '').trim().slice(0, 12);
    if (v) {
      setters.setName(v);
      refreshProfileUI();
    }
  });
  const moodEl = document.getElementById('moodInput') as HTMLInputElement | null;
  moodEl?.addEventListener('input', () => {
    setters.setMood(moodEl.value || '');
    refreshProfileUI();
  });
}

export function selectAvatar(v: string): void {
  Sound.play('click');
  setters.setAvatar(v);
  renderProfileEditor();
  refreshProfileUI();
}

export function selectGender(v: Gender): void {
  Sound.play('click');
  setters.setGender(v);
  renderProfileEditor();
  refreshProfileUI();
}

export function selectMoodIcon(v: string): void {
  Sound.play('click');
  setters.setMoodIcon(v);
  renderProfileEditor();
  refreshProfileUI();
}

/* ==================== 玩家总数滑块 ==================== */
export function setPlayerCount(n: number): void {
  const v = Math.max(2, Math.min(8, Math.round(n)));
  SELECTED_COUNT = v;
  const slider = document.getElementById('countSlider') as HTMLInputElement | null;
  if (slider) slider.value = String(v);
  const label = document.getElementById('countValue');
  if (label) label.textContent = v + ' 人';
  updateAIHint();
  renderRolePicker();
  Sound.play('click');
}

export function bindCountSlider(): void {
  const slider = document.getElementById('countSlider') as HTMLInputElement | null;
  if (!slider) return;
  slider.value = String(SELECTED_COUNT);
  slider.addEventListener('input', () => {
    setPlayerCount(Number(slider.value));
  });
}


