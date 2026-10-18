/* ==================== 顶栏消息通知中心 ====================
 * 🔔 统一收录三类消息：💬 用户聊天 / ⚙️ 系统提示（开局·断线等） / 🔗 联机事件（加入·离开）。
 * 顶栏铃铛显示未读数；下拉列表点击条目跳转：聊天→展开聊天面板，系统/联机→查看战报。
 */
import { escapeHtml } from '../core/dom';
import { expandNetChat } from './netchat';

export type NotifyKind = 'chat' | 'sys' | 'net';

interface NotifyItem {
  kind: NotifyKind;
  text: string;
}

const ICON: Record<NotifyKind, string> = { chat: '💬', sys: '⚙️', net: '🔗' };

let items: NotifyItem[] = [];
let unread = 0;

function renderBadge(): void {
  const b = document.getElementById('notifyBadge');
  if (!b) return;
  b.textContent = unread > 99 ? '99+' : String(unread);
  b.classList.toggle('show', unread > 0);
}

function renderList(): void {
  const list = document.getElementById('notifyList');
  if (!list) return;
  list.innerHTML = items.length
    ? items
        .map(
          (it, i) =>
            `<div class="notify-item" onclick="notifyJump(${i})"><span class="ni-icon">${ICON[it.kind]}</span><span class="ni-text">${escapeHtml(it.text)}</span></div>`,
        )
        .join('')
    : '<div class="notify-empty">暂无消息</div>';
  list.scrollTop = list.scrollHeight;
}

/** 追加一条通知；面板未打开时累计未读数 */
export function pushNotify(kind: NotifyKind, text: string): void {
  if (!text) return;
  items.push({ kind, text });
  if (items.length > 30) items.shift();
  const panel = document.getElementById('notifyPanel');
  if (panel?.classList.contains('show')) renderList();
  else {
    unread++;
    renderBadge();
  }
}

/** 展开/收起下拉通知列表（铃铛点击） */
export function toggleNotifyPanel(): void {
  const panel = document.getElementById('notifyPanel');
  if (!panel) return;
  const show = !panel.classList.contains('show');
  panel.classList.toggle('show', show);
  if (show) {
    unread = 0;
    renderBadge();
    renderList();
  }
}

export function closeNotifyPanel(): void {
  document.getElementById('notifyPanel')?.classList.remove('show');
}

/** 点击通知条目跳转对应位置 */
export function notifyJump(i: number): void {
  const it = items[i];
  closeNotifyPanel();
  if (!it) return;
  if (it.kind === 'chat') {
    expandNetChat();
    document.querySelector('#chatPanel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    document.getElementById('playLogPanel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

/** init 时绑定：点击面板与铃铛以外的区域自动收起 */
export function bindNotify(): void {
  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement | null;
    if (!t) return;
    if (t.closest('#notifyPanel') || t.closest('.tb-notify')) return;
    closeNotifyPanel();
  });
}
