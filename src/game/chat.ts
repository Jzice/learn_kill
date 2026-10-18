/* ==================== 聊天 ==================== */
import type { ChatKind, ChatMessage } from '../core/types';
import { escapeHtml, inputValue } from '../core/dom';
import { G } from './state';
import { NET } from '../net/network';
import { bumpNetChatUnread, renderNetChat } from '../ui/netchat';
import { pushNotify } from '../ui/notify';
import { PROFILE } from '../profile/profile';

export let chatMessages: ChatMessage[] = [];

export function chatListHtml(): string {
  return chatMessages
    .map((m) => {
      // 系统消息：居中气泡，无人物块
      if (m.kind === 'sys') {
        return `<div class="chat-msg sys"><div class="cm-bubble">${escapeHtml(m.text)}</div></div>`;
      }
      const who = `<div class="cm-who"><span class="cm-avatar">${escapeHtml(m.avatar || '🧑‍🎓')}</span><span class="cm-meta"><span class="cm-name">${escapeHtml(m.name)}</span>${m.mood ? `<span class="cm-mood">${escapeHtml(m.moodIcon || '🙂')} ${escapeHtml(m.mood)}</span>` : ''}</span></div>`;
      return `<div class="chat-msg ${m.kind}">${who}<div class="cm-bubble">${escapeHtml(m.text)}</div></div>`;
    })
    .join('');
}

export function addChat(
  name: string,
  text: string,
  kind: ChatKind = 'ai',
  avatar?: string,
  moodIcon?: string,
  mood?: string,
): void {
  // 未显式提供头像时，从在场玩家按昵称兜底（如 AI 角色头像）
  let av = avatar;
  if (!av) {
    const pl = G.players.find((p) => p.name === name);
    if (pl) av = pl.avatar;
  }
  chatMessages.push({ name, text, kind, avatar: av, moodIcon, mood });
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
  // 携带自己的头像/心情（即「一句话」），随消息广播让各端都能显示人物块
  const avatar = PROFILE.avatar || me.avatar;
  const moodIcon = PROFILE.moodIcon;
  const mood = PROFILE.mood;
  addChat(me.name, text, 'self', avatar, moodIcon, mood);
  const input = document.getElementById('chatInput') as HTMLInputElement | null;
  if (input) input.value = '';
  if (NET.isHost) NET.broadcast({ type: 'chat', name: me.name, text, avatar, moodIcon, mood });
  else if (NET.myConn) NET.myConn.send({ type: 'chat', name: me.name, text, avatar, moodIcon, mood });
}

export function resetChatMessages(): void {
  chatMessages = [];
}
