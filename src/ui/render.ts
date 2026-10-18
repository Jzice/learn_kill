/* ==================== 渲染 ==================== */
import type { Player } from '../core/types';
import { G } from '../game/state';
import { FACTIONS } from '../data/factions';
import { ROLES, ROLE_ICON, EQUIP_SHORT } from '../data/characters';
import { genderIcon } from '../profile/profile';
import { escapeHtml } from '../core/dom';
import { displayOrder, handLimit } from '../game/rules';
import { isCardClickable, cardClickHint } from './hand';
import { ROLE_MARKS } from '../game/marks';
import { updateNetChatVisible } from './netchat';
import { NET, scheduleSync } from '../net/network';

const EQUIP_ICON: Record<string, string> = {
  weapon: '⚔️',
  armor: '🛡️',
  horsePlus: '🐎',
  horseMinus: '🐎',
};
const EQUIP_LABEL: Record<string, string> = {
  weapon: '武器',
  armor: '防具',
  horsePlus: '+1马',
  horseMinus: '-1马',
};
const JUDGE_ICON: Record<string, string> = { lebu: '🎋', shandian: '⚡' };

function buildPlayerCard(p: Player, i: number): string {
  // 当前出牌（回合）角色：游戏进行中高亮其座位；对局结束不再标识
  const isTurn = i === G.current && !G.gameOver;
  const isSelf = i === G.myPlayerIdx;
  const mark = ROLE_MARKS[i];
  const isMarked = !!mark && !isSelf && !p.roleRevealed;
  // 身份展示：自己/已公开 → 真实身份；被自己标记且未公开 → 标记身份（虚线框区分）；否则未知
  let roleName: string;
  let roleColor: string;
  if (isSelf || p.roleRevealed) {
    roleName = '【' + ROLES[p.role].name + '】';
    roleColor = ROLES[p.role].color;
  } else if (mark) {
    roleName = '【' + ROLES[mark].name + '】';
    roleColor = ROLES[mark].color;
  } else {
    roleName = '身份未知';
    roleColor = '#5a4a3a';
  }
  const faction = FACTIONS[p.faction];
  const fColor = faction.color;
  const hpGems = Array.from({ length: p.maxHp }, (_, k) => {
    const f = k < p.hp;
    const low = p.hp <= 1 && f;
    return `<span class="hp-gem ${f ? '' : 'empty'} ${low ? 'low' : ''}"></span>`;
  }).join('');
  const equipSlots = ['weapon', 'armor', 'horsePlus', 'horseMinus']
    .map((k) => {
      const eq = p.equip[k as keyof typeof p.equip];
      const f = !!eq;
      const tip = f ? eq!.name : EQUIP_LABEL[k] + '（空）';
      const short = f ? EQUIP_SHORT[eq!.name] || eq!.name.slice(0, 1) : '';
      return `<div class="equip-slot ${f ? 'filled' : ''}" title="${tip}"><span class="eq-icon">${EQUIP_ICON[k]}</span>${f ? `<span class="eq-short">${short}</span>` : ''}</div>`;
    })
    .join('');
  const equipNames: string[] = [];
  ['weapon', 'armor', 'horsePlus', 'horseMinus'].forEach((k) => {
    if (p.equip[k as keyof typeof p.equip]) equipNames.push(p.equip[k as keyof typeof p.equip]!.name);
  });
  const equipNamesHtml = equipNames.length
    ? `<div class="pequip-names" title="${equipNames.join(' · ')}">${equipNames.join(' · ')}</div>`
    : '<div class="pequip-names"></div>';
  const handCount = p.hand.length;
  const dispCount = Math.min(handCount, 4);
  const miniCards = Array.from({ length: dispCount }, () => '<div class="mini-card"></div>').join('');
  const judgeTags = p.judge.map((j) => `<span class="judge-tag">${JUDGE_ICON[j.judgeType || ''] || '❓'}${j.name}</span>`).join('');
  const aiTag = p.isAI ? '<span style="font-size:8px;color:#8a8070;">[AI]</span>' : '';
  // 个性化：真人玩家优先展示其自定义头像 / 性别 / 心情
  const idt = p.identity;
  const shownAvatar = idt?.avatar || p.avatar;
  const genderIconHtml = idt ? `<span class="p-gender">${genderIcon(idt.gender)}</span>` : '';
  const moodHtml =
    idt && idt.mood
      ? `<div class="pmood" title="${escapeHtml(idt.mood)}">${idt.moodIcon} ${escapeHtml(idt.mood)}</div>`
      : '';
  let badges = '';
  if (!p.alive && p.roleRevealed) badges += `<span class="badge badge-reveal">☠ ${ROLES[p.role].name}</span>`;
  if ((p.shield || 0) > 0) badges += `<span class="badge badge-shield">🛡️${p.shield}</span>`;
  if ((p.combo || 0) >= 2) badges += `<span class="badge badge-combo">⚡${p.combo}</span>`;
  const markBtn = isSelf || !p.alive ? '' : `<button class="p-mark-btn" title="标记身份" onclick="event.stopPropagation();openMarkMenu(${i})">🏷️</button>`;
  return `<div class="p-card ${!p.alive ? 'dead' : ''} ${isTurn ? 'turn' : ''} ${isSelf ? 'is-self' : ''} ${isMarked ? 'role-marked' : ''}" style="--faction-color:${fColor};${isMarked ? 'border:2px dashed ' + roleColor + ';' : ''}">
    <div class="faction-icon" style="border-color:${fColor};color:${fColor};">${faction.icon}</div>
    ${markBtn}
    <div class="pheader"><div class="pavatar" style="border-color:${fColor};">${shownAvatar}</div><div class="pname-block"><div class="pname">${isTurn && p.alive ? '<span class="turn-arrow">▶</span>' : ''}${p.name} ${genderIconHtml}${aiTag}</div><div class="prole" style="color:${roleColor}">${roleName} · <span style="color:${fColor};">${faction.name}</span></div>${moodHtml}</div></div>
    <div class="pknow">🔮${p.knowledge}</div>
    <div class="php-bar">${hpGems}</div>
    <div class="pequip-slots">${equipSlots}</div>
    ${equipNamesHtml}
    <div class="pfooter"><div class="hand-pile">${miniCards}<span class="hand-count">${handCount}</span></div></div>
    <div class="p-badges">${badges}</div>
    ${judgeTags ? `<div class="pjudge-row">${judgeTags}</div>` : ''}
  </div>`;
}

function seatPos(rel: number, total: number): { x: number; y: number } {
  const angle = 90 - (rel * 360) / total;
  const rad = (angle * Math.PI) / 180;
  return { x: 50 + 38 * Math.cos(rad), y: 50 + 36 * Math.sin(rad) };
}

function renderSeats(): void {
  const ring = document.getElementById('seatRing');
  if (!ring) return;
  const total = G.players.length;
  const order = displayOrder(); // 本人第一
  const targetValues = new Set<number>();
  if (G.targetSelectable && G.pendingOptions) {
    G.pendingOptions.forEach((o) => {
      if (typeof o.value === 'number' && o.value >= 0 && o.value < total) targetValues.add(o.value);
    });
  }
  let html = '';
  order.forEach((i, pos) => {
    const p = G.players[i];
    const isTarget = targetValues.has(i);
    const clickAttr = isTarget ? `onclick="clickTargetSeat(${i})"` : '';
    const cls = isTarget ? 'seat seat-targetable' : 'seat';
    // 始终写入 left/top，不再按渲染时的屏宽决定：≤600 时由 CSS 的 !important 覆盖为 static 横滚
    // 布局（style.css 600px 媒体查询），窗口放大到 600px 以上后 absolute 定位立即生效。
    // 反之若窄屏渲染时不写坐标，放大后座位会因缺少 left/top 而全部堆叠在静态位置
    // （曾复现：560px 开局放大到 620~1000px，4 个座位全重叠在 (-40,36) 且部分在视口外，整体不可见）
    const ppos = seatPos(pos, total);
    html += `<div class="${cls}" data-idx="${i}" ${clickAttr} style="left:${ppos.x}%;top:${ppos.y}%;">${buildPlayerCard(p, i)}</div>`;
  });
  ring.innerHTML = html;
}

/* ---- 手牌排序：类型 → 牌名(拼音) → 大小 → 花色 ---- */
const HAND_TYPE_ORDER: Record<string, number> = { basic: 0, trick: 1, equip: 2 };
const HAND_SUIT_ORDER: Record<string, number> = { '♠': 0, '♥': 1, '♣': 2, '♦': 3 };
function handNumVal(num: string | number): number {
  const s = String(num).toUpperCase();
  if (s === 'A') return 1;
  if (s === 'J') return 11;
  if (s === 'Q') return 12;
  if (s === 'K') return 13;
  const v = parseInt(s, 10);
  return isNaN(v) ? 99 : v;
}
function handSuitVal(suit: string): number {
  return HAND_SUIT_ORDER[suit] ?? 9;
}

export function render(): void {
  if (!G.started) return;
  const me = G.players[G.myPlayerIdx];
  if (!me) return;
  let hintText = '';
  let btnHtml = '';
  let hintClass = '';
  G.handClickable = !!(G.pendingOptions && G.pendingPlayer === G.myPlayerIdx);
  G.targetSelectable = false;

  if (G.gameOver) {
    hintText = `<span style="color:var(--gold);font-size:15px">${G.winnerText}</span>`;
    G.handClickable = false;
  } else if (G.pendingOptions && G.pendingPlayer === G.myPlayerIdx) {
    const type = G.pendingType;
    if (type === 'play') {
      hintText = '💡 点击手牌出牌 · 点击技能（需答题） · 或结束出牌';
      hintClass = 'hint-play';
      const skillBtns = G.pendingOptions.filter((o) => typeof o.value === 'string' && o.value.startsWith('skill_'));
      skillBtns.forEach((o) => {
        btnHtml += `<button class="btn btn-sm ${o.lord ? 'btn-lord' : 'btn-skill'}" onclick="handleLocalChoice('${o.value}')">${o.label}</button>`;
      });
      if (G.pendingOptions.some((o) => o.value === 'end'))
        btnHtml += `<button class="btn btn-sm" onclick="handleLocalChoice('end')">结束出牌</button>`;
    } else if (type === 'discard') {
      const need = Math.max(0, me.hand.length - handLimit(me));
      hintText = `🗑️ 点击手牌弃置（还需弃 ${need} 张）`;
      hintClass = 'hint-play';
    } else if (type === 'rescue') {
      hintText = '💔 濒死！点击手牌【桃】/【酒】自救';
      hintClass = 'hint-urgent';
      const others = G.pendingOptions.filter((o) => !String(o.value).startsWith('card_'));
      btnHtml = others.map((o) => `<button class="btn btn-sm" onclick="handleLocalChoice('${o.value}')">${o.label}</button>`).join('');
    } else if (type === 'shan') {
      hintText = '🛡️ 需要出【闪】！点击手牌中的【闪】';
      hintClass = 'hint-urgent';
      const others = G.pendingOptions.filter((o) => !String(o.value).startsWith('card_'));
      btnHtml = others.map((o) => `<button class="btn btn-sm" onclick="handleLocalChoice('${o.value}')">${o.label}</button>`).join('');
    } else if (type === 'target') {
      hintText = '🎯 点击座位卡选择目标';
      hintClass = 'hint-target';
      if (G.pendingOptions.some((o) => o.value === -1))
        btnHtml += `<button class="btn btn-sm" onclick="handleLocalChoice(-1)">取消</button>`;
      G.targetSelectable = true;
      G.handClickable = false;
    } else {
      hintText = '请选择：';
      btnHtml = G.pendingOptions
        .map((o) => {
          const v = typeof o.value === 'number' ? o.value : `'${o.value}'`;
          return `<button class="btn btn-sm ${o.skill ? 'btn-skill' : ''}" onclick="handleLocalChoice(${v})">${o.label}</button>`;
        })
        .join('');
      G.handClickable = false;
    }
  } else if (G.pendingOptions && G.pendingPlayer !== G.myPlayerIdx) {
    const other = G.players[G.pendingPlayer as number];
    hintText = `等待 ${other?.name || '?'} 选择中…`;
  } else if (G.players[G.current] && G.players[G.current].isAI) {
    hintText = `等待 ${G.players[G.current].name} 行动…`;
  } else if (G.players[G.current] === me) {
    hintText = '请稍候…';
  } else {
    hintText = `等待 ${G.players[G.current].name} 行动…`;
  }

  const gsTurn = document.getElementById('gsTurn');
  if (gsTurn) gsTurn.textContent = '回合：' + (G.players[G.current]?.name || '—');
  const gsRole = document.getElementById('gsRole');
  if (gsRole && me) {
    const roleInfo = ROLES[me.role];
    gsRole.textContent = `${ROLE_ICON[me.role]} ${roleInfo.name}`;
  }
  const gsConn = document.getElementById('gsConn');
  if (gsConn) gsConn.innerHTML = NET.mode === 'host' ? `房间 ${NET.roomCode}` : NET.mode === 'join' ? '已连接' : '';

  renderSeats();

  const hand = document.getElementById('handRow')!;
  hand.innerHTML =
    [...me.hand]
      .sort((a, b) =>
        (HAND_TYPE_ORDER[a.type] ?? 9) - (HAND_TYPE_ORDER[b.type] ?? 9) ||
        a.name.localeCompare(b.name, 'zh') ||
        handNumVal(a.num) - handNumVal(b.num) ||
        handSuitVal(a.suit) - handSuitVal(b.suit))
      .map((c) => {
        const color = c.suit === '♥' || c.suit === '♦' ? 'red' : 'black';
        let cardCls = '';
        let onclick = '';
        if (G.handClickable && isCardClickable(c)) {
          cardCls = 'clickable ' + cardClickHint(c);
          onclick = `onclick="clickHandCard(${c.id})"`;
        } else if (G.handClickable) cardCls = 'disabled';
        const typeCls = c.type === 'trick' ? ' trick-tag' : c.type === 'equip' ? ' equip-tag' : '';
        return `<div class="card ${color} ${cardCls}${typeCls}" ${onclick}><span class="suit">${c.suit}</span><span class="num">${c.num}</span><span class="cname">${c.name}</span><span class="ctype">${c.type === 'basic' ? '基本' : c.type === 'trick' ? '锦囊' : '装备'}</span></div>`;
      })
      .join('') || '<div style="color:var(--muted);font-size:12px;padding:20px">无手牌</div>';

  const hintEl = document.getElementById('actionHint')!;
  hintEl.innerHTML = hintText;
  hintEl.className = 'action-hint ' + (hintClass || '');
  document.getElementById('actionBtns')!.innerHTML = btnHtml;
  // 操作提示区始终保留占位（不再 display:none），避免手牌区随其显隐上下跳动。
  // 内容由上面的 hintText 决定：本地方有决策→显示操作提示；否则→显示其他角色的操作信息。
  const centerArea = document.getElementById('centerArea');
  if (centerArea) centerArea.style.display = 'flex';
  document.getElementById('deckCount')!.textContent = String(G.deck.length || 0);
  document.getElementById('discardCount')!.textContent = String(G.discard.length || 0);

  const chatPanel = document.getElementById('chatPanel');
  if (chatPanel) chatPanel.style.display = NET.mode === 'single' ? 'none' : 'flex';
  // 小屏联机聊天面板：仅联机对局 + 窄屏显示（内部自行判定并驱动 --chat-h 让位）
  updateNetChatVisible();

  if (NET.isHost && NET.mode === 'host' && G.started) scheduleSync();
}
