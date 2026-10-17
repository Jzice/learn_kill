/* ==================== 聊天 ==================== */
import type { ChatKind, ChatMessage } from '../core/types';
import { escapeHtml, inputValue } from '../core/dom';
import { G } from './state';
import { NET } from '../net/network';
import { bumpUnreadChat, isDockOpen, refreshMobileDrawer } from '../ui/dock';

export let chatMessages: ChatMessage[] = [];

export function addChat(name: string, text: string, kind: ChatKind = 'ai'): void {
  chatMessages.push({ name, text, kind });
  if (chatMessages.length > 100) chatMessages.shift();
  renderChat();
  if (!isDockOpen('chat')) bumpUnreadChat();
}

export function renderChat(): void {
  const el = document.getElementById('chatList');
  if (!el) return;
  el.innerHTML = chatMessages
    .map(
      (m) =>
        `<div class="chat-msg ${m.kind}"><span class="chat-name">${escapeHtml(m.name)}</span><span class="chat-text">${escapeHtml(m.text)}</span></div>`,
    )
    .join('');
  el.scrollTop = el.scrollHeight;
  refreshMobileDrawer();
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
