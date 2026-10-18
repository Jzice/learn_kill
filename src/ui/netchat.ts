/* ==================== 小屏联机聊天面板（固定底部，可折叠） ====================
 * 仅 ≤600px 联机对局显示：展开为 消息列表+输入框（默认），折叠为一行最新消息+未读数。
 * 收到新消息保持当前折叠状态，仅在折叠态累计未读。
 */
import { G } from '../game/state';
import { addChat, chatMessages, chatListHtml } from '../game/chat';
import { NET } from '../net/network';
import { PROFILE } from '../profile/profile';

let collapsed = false;
let unread = 0;
let userHeight = Number(localStorage.getItem('netChatH')) || 0; // 用户拖拽设定的高度（0=默认150）
const mq = window.matchMedia('(max-width:600px)');

function applyHeight(): void {
  const panel = document.getElementById('netChatPanel');
  const shown = !!panel?.classList.contains('show');
  const h = shown ? (collapsed ? 40 : userHeight || 150) : 0;
  document.body.style.setProperty('--chat-h', h + 'px');
  if (panel) panel.style.height = shown ? h + 'px' : '';
}

/** 顶部拖动条：调整聊天区高度，并记忆到 localStorage */
function initNetChatResize(): void {
  const handle = document.getElementById('netChatResize');
  const panel = document.getElementById('netChatPanel');
  if (!handle || !panel) return;
  let startY = 0;
  let startH = 0;
  const onMove = (e: PointerEvent) => {
    e.preventDefault();
    let h = startH + (startY - e.clientY); // 向上拖动 → 增高
    h = Math.max(90, Math.min(window.innerHeight * 0.7, h));
    userHeight = Math.round(h);
    document.body.style.setProperty('--chat-h', userHeight + 'px');
    panel.style.height = userHeight + 'px';
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    try { localStorage.setItem('netChatH', String(userHeight)); } catch (_) {}
  };
  handle.addEventListener('pointerdown', (e: PointerEvent) => {
    if (collapsed) return;
    e.preventDefault();
    startY = e.clientY;
    startH = panel.getBoundingClientRect().height;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });
}

/** 绑定屏宽切换（init 时调用一次） */
export function bindNetChat(): void {
  initNetChatResize();
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
  // 携带自己的头像/心情（即「一句话」），随消息广播让各端都能显示人物块
  const avatar = PROFILE.avatar || me.avatar;
  const moodIcon = PROFILE.moodIcon;
  const mood = PROFILE.mood;
  addChat(me.name, text, 'self', avatar, moodIcon, mood);
  if (input) input.value = '';
  if (NET.isHost) NET.broadcast({ type: 'chat', name: me.name, text, avatar, moodIcon, mood });
  else if (NET.myConn) NET.myConn.send({ type: 'chat', name: me.name, text, avatar, moodIcon, mood });
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
