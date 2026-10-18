/* ==================== 战报 ==================== */
import type { LogAction, LogEntry } from '../core/types';
import { NET } from '../net/network';
import { G } from './state';
import { escapeHtml } from '../core/dom';

export let playLog: LogEntry[] = [];

/** 按角色名解析头像（对局玩家 → 房间成员档案 → 兜底） */
export function avatarOf(name: string): string {
  const n = (name || '').trim();
  if (!n) return '';
  const p = G.players.find((x) => x.name === n);
  if (p?.identity?.avatar) return p.identity.avatar;
  if (p?.avatar) return p.avatar;
  const m = NET.roomMembers?.find((x) => x.name === n);
  if (m?.profile?.avatar) return m.profile.avatar;
  return '👤';
}

/** 战报中的角色片段：头像 + 名字 */
function who(name: string | undefined, cls: string): string {
  const n = escapeHtml((name || '').trim());
  if (!n) return '';
  const av = avatarOf(name!);
  return `<span class="pl-who ${cls}">${av ? `<span class="pl-av">${escapeHtml(av)}</span>` : ''}<span class="${cls}">${n}</span></span>`;
}

export function addLog(t: string, cls = ''): void {
  playLog.push({ action: 'log', text: t, cls });
  if (playLog.length > 100) playLog.shift();
  renderPlayLog();
  if (NET.isHost) NET.broadcast({ type: 'play_log', entry: { action: 'log', text: t, cls } });
}

export function addPlayLog(
  fromName: string,
  action: LogAction,
  cardName: string | number,
  toName: string,
  cls = '',
): void {
  const entry: LogEntry = { action, fromName, cardName, toName, cls };
  playLog.push(entry);
  if (playLog.length > 100) playLog.shift();
  renderPlayLog();
  if (NET.isHost) NET.broadcast({ type: 'play_log', entry });
}

/** 客户端追加一条广播来的战报（不二次广播） */
export function appendPlayLog(entry: LogEntry): void {
  playLog.push(entry);
  if (playLog.length > 100) playLog.shift();
  renderPlayLog();
}

export function renderPlayLog(): void {
  const el = document.getElementById('playLogList');
  if (!el) return;
  el.innerHTML = playLog
    .slice(-60)
    .map((l) => {
      if (l.action === 'log') return `<div class="play-log-item ${l.cls || ''}">${l.text}</div>`;
      if (l.action === 'use')
        return `<div class="play-log-item ${l.cls || ''}">${who(l.fromName, 'pl-from')} 使用 <span class="pl-card">【${l.cardName}】</span>${l.toName ? ' → ' + who(l.toName, 'pl-to') : ''}</div>`;
      if (l.action === 'damage')
        return `<div class="play-log-item dmg">${who(l.toName, 'pl-to')} 受到 <span class="pl-card">${l.cardName}</span> 点伤害</div>`;
      if (l.action === 'heal')
        return `<div class="play-log-item heal">${who(l.toName, 'pl-to')} 回复 <span class="pl-card">${l.cardName}</span> 点体力</div>`;
      if (l.action === 'skill')
        return `<div class="play-log-item skill">${who(l.fromName, 'pl-from')} 发动 <span class="pl-card">【${l.cardName}】</span></div>`;
      if (l.action === 'reward')
        return `<div class="play-log-item reward">${who(l.fromName, 'pl-from')} 获得 <span class="pl-card">${l.cardName}</span></div>`;
      if (l.action === 'faction')
        return `<div class="play-log-item faction">${who(l.fromName, '')} ${l.cardName}</div>`;
      if (l.action === 'kp') return `<div class="play-log-item kp">📖 ${who(l.fromName, '')} 答对【${l.cardName}】</div>`;
      if (l.action === 'sys') return `<div class="play-log-item sys">${l.text || ''}</div>`;
      return '';
    })
    .join('');
  document.getElementById('playLogBadge')!.textContent = String(playLog.length);
  el.scrollTop = el.scrollHeight;
}

export function resetPlayLog(): void {
  playLog = [];
}

export function setPlayLog(entries: LogEntry[]): void {
  playLog = entries.slice(-60);
  renderPlayLog();
}
