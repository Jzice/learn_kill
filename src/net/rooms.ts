/* ==================== 房间生命周期（创建/加入/退出/关闭） ==================== */
import { inputValue } from '../core/dom';
import { NET } from './network';
import { updateHostRoomInfo } from '../ui/lobby';
import { PROFILE, publicProfile, refreshProfileUI, saveProfile } from '../profile/profile';
import { SELECTED_COUNT } from '../ui/lobby';
import { setInviteLink } from '../ui/share';

export async function createRoom(): Promise<void> {
  // 昵称统一取档案（在顶栏「🧑 个性化资料」中编辑）
  const nick = (PROFILE.name || '房主').trim().slice(0, 12);
  const code = String(Math.floor(100000 + Math.random() * 900000));
  document.getElementById('roomInfo')!.innerHTML = '正在连接…';
  try {
    await NET.createRoom(code, nick);
    NET.addRoomMember(NET.myPeerId!, nick, true, publicProfile());
    updateHostRoomInfo({
      roomCode: code,
      hostName: nick,
      members: [{ name: nick, isHost: true, profile: publicProfile() }],
      currentCount: 1,
      targetCount: SELECTED_COUNT,
    });
    setInviteLink(`${location.origin}${location.pathname}?room=${code}`);
  } catch (e) {
    document.getElementById('roomInfo')!.innerHTML =
      '<span style="color:#e74c3c;">连接失败：' + (e as { type?: string }).type + '</span>';
  }
}

export async function joinRoom(): Promise<void> {
  // 昵称统一取档案（在顶栏「🧑 个性化资料」中编辑）
  const nick = (PROFILE.name || '玩家').trim().slice(0, 12);
  const code = inputValue('joinCode').trim();
  if (!/^\d{6}$/.test(code)) {
    alert('请输入6位数字房间号');
    return;
  }
  document.getElementById('joinStatus')!.textContent = '正在连接房间…';
  try {
    await NET.joinRoom(code, nick);
    document.getElementById('chatPanel')!.style.display = 'flex';
  } catch (e) {
    document.getElementById('joinStatus')!.innerHTML =
      '<span style="color:#e74c3c;">连接失败：' + (e as { type?: string }).type + '</span>';
  }
}

export function leaveRoom(): void {
  if (NET.mode !== 'join') return;
  if (!confirm('确认退出房间？')) return;
  try {
    if (NET.myConn)
      NET.myConn.send({ type: 'leave_room', name: NET.myPeerId ? PROFILE.name : '玩家' });
  } catch (e) {
    /* ignore */
  }
  setTimeout(() => {
    try {
      if (NET.myConn) NET.myConn.close();
    } catch (e) {
      /* ignore */
    }
    try {
      if (NET.peer) NET.peer.destroy();
    } catch (e) {
      /* ignore */
    }
    location.reload();
  }, 150);
}

export function closeRoom(): void {
  if (!NET.isHost) return;
  if (!confirm('确认关闭房间？所有玩家会被通知。')) return;
  try {
    NET.broadcast({ type: 'host_closed' });
  } catch (e) {
    /* ignore */
  }
  setTimeout(() => {
    try {
      if (NET.peer) NET.peer.destroy();
    } catch (e) {
      /* ignore */
    }
    location.reload();
  }, 400);
}
