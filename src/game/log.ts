/* ==================== 战报 ==================== */
import type { LogAction, LogEntry } from '../core/types';
import { NET } from '../net/network';
import { bumpUnreadLog, isDockOpen, refreshMobileDrawer } from '../ui/dock';

export let playLog: LogEntry[] = [];

export function addLog(t: string, cls = ''): void {
  playLog.push({ action: 'log', text: t, cls });
  if (playLog.length > 100) playLog.shift();
  renderPlayLog();
  if (NET.isHost) NET.broadcast({ type: 'play_log', entry: { action: 'log', text: t, cls } });
  if (!isDockOpen('log')) bumpUnreadLog();
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
  if (!isDockOpen('log')) bumpUnreadLog();
}

/** 客户端追加一条广播来的战报（不二次广播） */
export function appendPlayLog(entry: LogEntry): void {
  playLog.push(entry);
  if (playLog.length > 100) playLog.shift();
  renderPlayLog();
  if (!isDockOpen('log')) bumpUnreadLog();
}

export function renderPlayLog(): void {
  const el = document.getElementById('playLogList');
  if (!el) return;
  el.innerHTML = playLog
    .slice(-60)
    .map((l) => {
      if (l.action === 'log') return `<div class="play-log-item ${l.cls || ''}">${l.text}</div>`;
      if (l.action === 'use')
        return `<div class="play-log-item ${l.cls || ''}"><span class="pl-from">${l.fromName}</span> 使用 <span class="pl-card">【${l.cardName}】</span>${l.toName ? ' → <span class="pl-to">' + l.toName + '</span>' : ''}</div>`;
      if (l.action === 'damage')
        return `<div class="play-log-item dmg"><span class="pl-to">${l.toName}</span> 受到 <span class="pl-card">${l.cardName}</span> 点伤害</div>`;
      if (l.action === 'heal')
        return `<div class="play-log-item heal"><span class="pl-to">${l.toName}</span> 回复 <span class="pl-card">${l.cardName}</span> 点体力</div>`;
      if (l.action === 'skill')
        return `<div class="play-log-item skill"><span class="pl-from">${l.fromName}</span> 发动 <span class="pl-card">【${l.cardName}】</span></div>`;
      if (l.action === 'reward')
        return `<div class="play-log-item reward"><span class="pl-from">${l.fromName}</span> 获得 <span class="pl-card">${l.cardName}</span></div>`;
      if (l.action === 'faction')
        return `<div class="play-log-item faction">${l.fromName} ${l.cardName}</div>`;
      if (l.action === 'kp') return `<div class="play-log-item kp">📖 ${l.fromName} 答对【${l.cardName}】</div>`;
      if (l.action === 'sys') return `<div class="play-log-item sys">${l.text || ''}</div>`;
      return '';
    })
    .join('');
  document.getElementById('playLogBadge')!.textContent = String(playLog.length);
  el.scrollTop = el.scrollHeight;
  refreshMobileDrawer();
}

export function resetPlayLog(): void {
  playLog = [];
}

export function setPlayLog(entries: LogEntry[]): void {
  playLog = entries.slice(-60);
  renderPlayLog();
}
