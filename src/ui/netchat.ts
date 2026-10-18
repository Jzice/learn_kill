/* ==================== 小屏联机聊天面板（固定底部，可折叠） ====================
 * 仅 ≤600px 联机对局显示：展开为 消息列表+输入框（默认），折叠为一行最新消息+未读数。
 * 收到新消息保持当前折叠状态，仅在折叠态累计未读。
 */
import { G } from '../game/state';
import { addChat, chatMessages, chatListHtml } from '../game/chat';
import { NET } from '../net/network';

let collapsed = false;
let unread = 0;
const mq = window.matchMedia('(max-width:600px)');

function applyHeight(): void {
  const shown = !!document.getElementById('netChatPanel')?.classList.contains('show');
  document.body.style.setProperty('--chat-h', shown ? (collapsed ? '40px' : '150px') : '0px');
}

/** 绑定屏宽切换（init 时调用一次） */
export function bindNetChat(): void {
  try {
    mq.addEventListener('change', updateNetChatVisible);
  } catch (e) {
    (mq as unknown as { addListener: (f: () => void) => void }).addListener(updateNetChatVisible);
  }
}

/** 依据 当前界面/联机状态/屏宽 显示或隐藏面板（render 时调用） */
export function updateNetChatVisible(): void {
  const panel = document.getElementById('netChatPanel');
  if (!panel) return;
  const inGame = document.getElementById('screenGame')?.classList.contains('active') ?? false;
  const show = inGame && NET.mode !== 'single' && mq.matches;
  const was = panel.classList.contains('show');
  panel.classList.toggle('show', show);
  if (show !== was) applyHeight();
  if (show) renderNetChat();
}

function updateBadge(): void {
  const b = document.getElementById('netChatBadge');
  if (!b) return;
  b.textContent = unread > 99 ? '99+' : String(unread);
  b.classList.toggle('show', unread > 0);
}

/** 折叠态累计未读（展开或面板隐藏时不计） */
export function bumpNetChatUnread(): void {
  const panel = document.getElementById('netChatPanel');
  if (!panel?.classList.contains('show') || !collapsed) return;
  unread++;
  updateBadge();
}

/** 渲染面板：折叠态仅更新最新一行；展开态渲染完整列表 */
export function renderNetChat(): void {
  const latest = document.getElementById('netChatLatest');
  const last = chatMessages[chatMessages.length - 1];
  if (latest) latest.textContent = last ? `${last.name}：${last.text}` : '';
  if (collapsed) return;
  const list = document.getElementById('netChatList');
  if (!list) return;
  list.innerHTML = chatListHtml();
  list.scrollTop = list.scrollHeight;
}

/** 展开/折叠（面板标题整行可点） */
export function toggleNetChat(): void {
  collapsed = !collapsed;
  const panel = document.getElementById('netChatPanel');
  if (!panel) return;
  panel.classList.toggle('collapsed', collapsed);
  const t = document.getElementById('netChatToggle');
  if (t) t.textContent = collapsed ? '▴' : '▾';
  if (!collapsed) {
    unread = 0;
    updateBadge();
  }
  applyHeight();
  renderNetChat();
}

/** 通知中心跳转入口：确保聊天面板展开并滚入视野 */
export function expandNetChat(): void {
  const panel = document.getElementById('netChatPanel');
  if (!panel?.classList.contains('show')) return;
  if (collapsed) toggleNetChat();
  panel.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

/** 面板内发送 */
export function sendNetChat(): void {
  const input = document.getElementById('netChatInput') as HTMLInputElement | null;
  const text = (input?.value || '').trim();
  if (!text) return;
  const me = G.players[G.myPlayerIdx];
  if (!me) return;
  addChat(me.name, text, 'self');
  if (input) input.value = '';
  if (NET.isHost) NET.broadcast({ type: 'chat', name: me.name, text });
  else if (NET.myConn) NET.myConn.send({ type: 'chat', name: me.name, text });
}

/** 新对局重置：默认展开、清空未读 */
export function resetNetChat(): void {
  collapsed = false;
  unread = 0;
  const panel = document.getElementById('netChatPanel');
  panel?.classList.remove('collapsed');
  const t = document.getElementById('netChatToggle');
  if (t) t.textContent = '▾';
  updateBadge();
  applyHeight();
}
