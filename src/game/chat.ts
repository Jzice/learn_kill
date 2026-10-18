/* ==================== 聊天 ==================== */
import type { ChatKind, ChatMessage } from '../core/types';
import { escapeHtml, inputValue } from '../core/dom';
import { G } from './state';
import { NET } from '../net/network';
import { bumpNetChatUnread, renderNetChat } from '../ui/netchat';
import { pushNotify } from '../ui/notify';

export let chatMessages: ChatMessage[] = [];

export function chatListHtml(): string {
  return chatMessages
    .map(
      (m) =>
        `<div class="chat-msg ${m.kind}"><span class="chat-name">${escapeHtml(m.name)}</span><span class="chat-text">${escapeHtml(m.text)}</span></div>`,
    )
    .join('');
}

export function addChat(name: string, text: string, kind: ChatKind = 'ai'): void {
  chatMessages.push({ name, text, kind });
  if (chatMessages.length > 100) chatMessages.shift();
  renderChat();
  // 小屏折叠态累计聊天未读
  bumpNetChatUnread();
  // 顶栏通知：他人聊天 → 💬；系统消息 → 🔗 联机事件 / ⚙️ 系统提示；自己发言不通知
  if (kind !== 'self') {
    if (kind === 'sys' || name === '系统') {
      pushNotify(/加入|离开|断开|开始|关闭/.test(text) ? 'net' : 'sys', text);
    } else {
      pushNotify('chat', `${name}：${text}`);
    }
  }
}

export function renderChat(): void {
  const el = document.getElementById('chatList');
  if (el) {
    el.innerHTML = chatListHtml();
    el.scrollTop = el.scrollHeight;
  }
  renderNetChat();
}

export function sendChat(): void {
  const text = inputValue('chatInput').trim();
  if (!text) return;
  const me = G.players[G.myPlayerIdx];
  if (!me) return;
  addChat(me.name, text, 'self');
  const input = document.getElementById('chatInput') as HTMLInputElement | null;
  if (input) input.value = '';
  if (NET.isHost) NET.broadcast({ type: 'chat', name: me.name, text });
  else if (NET.myConn) NET.myConn.send({ type: 'chat', name: me.name, text });
}

export function resetChatMessages(): void {
  chatMessages = [];
}
