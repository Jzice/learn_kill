/* ==================== 移动端 Dock / 抽屉 ==================== */
import { G } from '../game/state';
import { addChat } from '../game/chat';
import { NET } from '../net/network';

let mobileDockOpen: 'log' | 'chat' | null = null;
let unreadLog = 0,
  unreadChat = 0;

export function isDockOpen(tab: 'log' | 'chat'): boolean {
  return mobileDockOpen === tab;
}

export function bumpUnreadLog(): void {
  unreadLog++;
  updateDockBadge();
}

export function bumpUnreadChat(): void {
  unreadChat++;
  updateDockBadge();
}

function updateDockBadge(): void {
  const logB = document.getElementById('logDockBadge');
  const chatB = document.getElementById('chatDockBadge');
  const logBtn = document.getElementById('dockLogBtn');
  const chatBtn = document.getElementById('dockChatBtn');
  if (logB) {
    logB.textContent = unreadLog > 99 ? '99+' : String(unreadLog);
    logB.classList.toggle('show', unreadLog > 0);
  }
  if (chatB) {
    chatB.textContent = unreadChat > 99 ? '99+' : String(unreadChat);
    chatB.classList.toggle('show', unreadChat > 0);
  }
  if (logBtn) logBtn.classList.toggle('has-unread', unreadLog > 0);
  if (chatBtn) chatBtn.classList.toggle('has-unread', unreadChat > 0);
}

export function openDock(tab: 'log' | 'chat'): void {
  mobileDockOpen = tab;
  const drawer = document.getElementById('mobileDrawer')!;
  const title = document.getElementById('mobileDrawerTitle')!;
  const body = document.getElementById('mobileDrawerBody')!;
  document.getElementById('mobileDock')!.classList.add('dock-hidden');
  drawer.classList.add('show');
  if (tab === 'log') {
    title.textContent = '📋 战 报';
    unreadLog = 0;
    body.innerHTML = `<div class="play-log-list">${document.getElementById('playLogList')!.innerHTML}</div>`;
    setTimeout(() => {
      const pl = body.querySelector('.play-log-list');
      if (pl) pl.scrollTop = pl.scrollHeight;
    }, 50);
  } else {
    title.textContent = '💬 聊 天';
    unreadChat = 0;
    body.innerHTML = `<div class="chat-list" id="mobileChatList">${document.getElementById('chatList')!.innerHTML}</div>
      <div class="chat-input-row"><input id="mobileChatInput" placeholder="说点什么…" maxlength="40" onkeydown="if(event.key==='Enter')sendChatFromMobile()"><button onclick="sendChatFromMobile()">发送</button></div>`;
    setTimeout(() => {
      const cl = document.getElementById('mobileChatList');
      if (cl) cl.scrollTop = cl.scrollHeight;
    }, 50);
  }
  updateDockBadge();
}

export function closeDock(): void {
  mobileDockOpen = null;
  document.getElementById('mobileDrawer')!.classList.remove('show');
  document.getElementById('mobileDock')!.classList.remove('dock-hidden');
}

export function sendChatFromMobile(): void {
  const input = document.getElementById('mobileChatInput') as HTMLInputElement | null;
  const text = (input?.value || '').trim();
  if (!text) return;
  if (input) input.value = '';
  const me = G.players[G.myPlayerIdx];
  if (!me) return;
  addChat(me.name, text, 'self');
  if (NET.isHost) NET.broadcast({ type: 'chat', name: me.name, text });
  else if (NET.myConn) NET.myConn.send({ type: 'chat', name: me.name, text });
}

export function refreshMobileDrawer(): void {
  if (!mobileDockOpen) return;
  const body = document.getElementById('mobileDrawerBody');
  if (!body) return;
  if (mobileDockOpen === 'log') {
    const old = body.querySelector('.play-log-list');
    const scrollPos = old ? old.scrollTop : 0;
    const wasBottom = old ? Math.abs(old.scrollHeight - old.scrollTop - old.clientHeight) < 30 : true;
    body.innerHTML = `<div class="play-log-list">${document.getElementById('playLogList')!.innerHTML}</div>`;
    const nw = body.querySelector('.play-log-list');
    if (nw) nw.scrollTop = wasBottom ? nw.scrollHeight : scrollPos;
  } else {
    const old = body.querySelector('.chat-list');
    const scrollPos = old ? old.scrollTop : 0;
    const wasBottom = old ? Math.abs(old.scrollHeight - old.scrollTop - old.clientHeight) < 30 : true;
    const oldInput = document.getElementById('mobileChatInput') as HTMLInputElement | null;
    const inputVal = oldInput ? oldInput.value : '';
    body.innerHTML = `<div class="chat-list" id="mobileChatList">${document.getElementById('chatList')!.innerHTML}</div>
      <div class="chat-input-row"><input id="mobileChatInput" placeholder="说点什么…" maxlength="40" onkeydown="if(event.key==='Enter')sendChatFromMobile()" value="${inputVal.replace(/"/g, '&quot;')}"><button onclick="sendChatFromMobile()">发送</button></div>`;
    const nw = document.getElementById('mobileChatList');
    if (nw) nw.scrollTop = wasBottom ? nw.scrollHeight : scrollPos;
  }
}
