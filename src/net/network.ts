/* ==================== 网络层（房主权威） ==================== */
import type { NetMode, Player, PublicProfile, Question, RoomMember } from '../core/types';
import type { NetMessage } from './protocol';
import { getPeerCtor } from '#peer';
import { G } from '../game/state';
import { addChat } from '../game/chat';
import { addLog, appendPlayLog, playLog, setPlayLog } from '../game/log';
import { render } from '../ui/render';
import { clearPlayZone } from '../ui/playzone';
import { SELECTED_COUNT, updateGuestRoomInfo, updateHostRoomInfo } from '../ui/lobby';
import { onAskQuizRequest } from '../game/quiz';
import { maybeSettle, publicProfile } from '../profile/profile';

export const NET_PLAYER_NAMES: Record<string, string> = {};

export interface PendingQuiz {
  resolve: (v: boolean) => void;
  player: Player;
  q: Question;
  /** 本题的编号（用于丢弃迟到的旧回复） */
  quizId: number;
  /** 20 秒超时定时器（解析时需清除） */
  timer: ReturnType<typeof setTimeout> | null;
}

export const NET = {
  peer: null as PeerJS | null,
  conns: [] as PeerJS.DataConnection[],
  myConn: null as PeerJS.DataConnection | null,
  isHost: false,
  mode: 'single' as NetMode,
  roomCode: null as string | null,
  myPeerId: null as string | null,
  playerConns: {} as Record<string, PeerJS.DataConnection>,
  pendingQuiz: null as PendingQuiz | null,
  roomMembers: [] as RoomMember[],

  addRoomMember(peerId: string, name: string, isHost: boolean, profile: PublicProfile | null): void {
    const ex = this.roomMembers.find((m) => m.peerId === peerId);
    if (ex) {
      ex.name = name;
      if (profile) ex.profile = profile;
      return;
    }
    this.roomMembers.push({ peerId, name, isHost: !!isHost, profile: profile || null });
  },
  removeRoomMember(peerId: string): void {
    this.roomMembers = this.roomMembers.filter((m) => m.peerId !== peerId);
  },
  broadcastRoomState(): void {
    if (!this.isHost) return;
    const hm = this.roomMembers.find((m) => m.isHost);
    const state = {
      type: 'room_state' as const,
      roomCode: this.roomCode || '',
      hostName: hm ? hm.name : '房主',
      members: this.roomMembers.map((m) => ({ name: m.name, isHost: m.isHost, profile: m.profile || null })),
      currentCount: this.roomMembers.length,
      targetCount: SELECTED_COUNT,
    };
    this.broadcast(state);
    updateHostRoomInfo(state);
  },
  async createRoom(code: string, hostName: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.roomCode = code;
      this.isHost = true;
      this.mode = 'host';
      const PeerCtor = getPeerCtor();
      this.peer = new PeerCtor('xts-' + code, { debug: 1 });
      this.peer.on('open', (id) => {
        this.myPeerId = id;
        resolve(id);
      });
      this.peer.on('error', (e) => reject(e));
      this.peer.on('connection', (conn) => {
        this.conns.push(conn);
        conn.on('open', () => {
          this.playerConns[conn.peer] = conn;
          onPeerConnected(conn);
        });
        conn.on('data', (d) => onPeerData(conn, d as NetMessage));
        conn.on('close', () => {
          this.conns = this.conns.filter((c) => c !== conn);
          delete this.playerConns[conn.peer];
          const leavingName = NET_PLAYER_NAMES[conn.peer] || '玩家';
          this.removeRoomMember(conn.peer);
          delete NET_PLAYER_NAMES[conn.peer];
          addChat('系统', `📤 ${leavingName} 断开了连接。`, 'sys');
          this.broadcast({ type: 'chat', name: '系统', text: `📤 ${leavingName} 断开了连接。` });
          this.broadcastRoomState();
          const idx = G.players.findIndex((pl) => pl.peerId === conn.peer);
          const p = idx >= 0 ? G.players[idx] : null;
          if (p && p.alive) {
            addLog(`${p.name} 断线，转为AI`);
            p.isAI = true;
            p.peerId = null;
            // 若房主正在等待该玩家的选择，用默认项（通常是放弃/承受/结束）结算，防止游戏挂起
            if (G.pendingPlayer === idx && G.pendingResolve && G.pendingOptions && G.pendingOptions.length) {
              const r = G.pendingResolve;
              const fallback = G.pendingOptions[G.pendingOptions.length - 1].value;
              G.pendingResolve = null;
              G.pendingOptions = null;
              G.pendingPlayer = null;
              r(fallback);
            }
            // 若房主正在等待该玩家的答题，立即按答错结算
            if (NET.pendingQuiz && NET.pendingQuiz.player === p) {
              if (NET.pendingQuiz.timer) clearTimeout(NET.pendingQuiz.timer);
              const r = NET.pendingQuiz.resolve;
              NET.pendingQuiz = null;
              r(false);
            }
            render();
          }
        });
      });
    });
  },
  async joinRoom(code: string, myName: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.roomCode = code;
      this.isHost = false;
      this.mode = 'join';
      const PeerCtor = getPeerCtor();
      this.peer = new PeerCtor({ debug: 1 });
      this.peer.on('open', (id) => {
        this.myPeerId = id;
        const conn = this.peer!.connect('xts-' + code, {
          metadata: { name: myName },
          // 有序可靠信道：choose_request / state_sync 必须按发送顺序交付，
          // 否则旧的状态快照可能后置到达，清空客人端的选择提示造成双端卡死
          reliable: true,
        });
        this.myConn = conn;
        this.conns = [conn];
        conn.on('open', () => {
          try {
            conn.send({ type: 'hello_profile', profile: publicProfile() });
          } catch (e) {
            /* ignore */
          }
          resolve(id);
        });
        conn.on('data', (d) => onClientData(d as NetMessage));
        conn.on('error', (e) => reject(e));
      });
      this.peer.on('error', (e) => reject(e));
    });
  },
  broadcast(msg: NetMessage): void {
    if (!this.isHost) return;
    this.conns.forEach((c) => {
      try {
        c.send(msg);
      } catch (e) {
        /* ignore */
      }
    });
  },
  sendToHost(msg: NetMessage): void {
    if (this.isHost) return;
    if (this.myConn) {
      try {
        this.myConn.send(msg);
      } catch (e) {
        /* ignore */
      }
    }
  },
  sendToPlayer(pid: string, msg: NetMessage): void {
    if (!this.isHost) return;
    const c = this.playerConns[pid];
    if (c) {
      try {
        c.send(msg);
      } catch (e) {
        /* ignore */
      }
    }
  },
};

export function onPeerConnected(conn: PeerJS.DataConnection): void {
  const rawName = conn.metadata?.name;
  const name = (typeof rawName === 'string' && rawName) || '玩家';
  NET.addRoomMember(conn.peer, name, false, null);
  NET_PLAYER_NAMES[conn.peer] = name;
  addChat('系统', `📥 ${name} 加入了房间。`, 'sys');
  NET.broadcast({ type: 'chat', name: '系统', text: `📥 ${name} 加入了房间。` });
  NET.broadcastRoomState();
}

export function onPeerData(conn: PeerJS.DataConnection, data: NetMessage): void {
  if (!NET.isHost) return;
  if (data.type === 'hello_profile') {
    const m = NET.roomMembers.find((x) => x.peerId === conn.peer);
    if (m) {
      m.profile = data.profile;
      if (data.profile && data.profile.name) {
        m.name = data.profile.name;
        NET_PLAYER_NAMES[conn.peer] = data.profile.name;
      }
    }
    NET.broadcastRoomState();
  } else if (data.type === 'guest_pref') {
    const m = NET.roomMembers.find((x) => x.peerId === conn.peer);
    if (m) {
      m.pref = data.pref;
      NET.broadcastRoomState();
    }
  } else if (data.type === 'choose_response') {
    if (G.pendingPlayer != null && G.pendingResolve) {
      const r = G.pendingResolve;
      G.pendingResolve = null;
      G.pendingOptions = null;
      G.pendingPlayer = null;
      r(data.value);
    }
  } else if (data.type === 'quiz_response') {
    const pq = NET.pendingQuiz;
    // 仅接受与当前挂起答题编号一致的回复，迟到的旧回复直接丢弃
    if (pq && pq.quizId === data.quizId) {
      if (pq.timer) clearTimeout(pq.timer);
      NET.pendingQuiz = null;
      pq.resolve(data.correct);
    }
  } else if (data.type === 'chat') {
    addChat(data.name, data.text, 'ai');
    NET.broadcast(data);
  } else if (data.type === 'leave_room') {
    const ln = data.name || NET_PLAYER_NAMES[conn.peer] || '玩家';
    NET.removeRoomMember(conn.peer);
    delete NET_PLAYER_NAMES[conn.peer];
    addChat('系统', `📤 ${ln} 离开了房间。`, 'sys');
    NET.broadcast({ type: 'chat', name: '系统', text: `📤 ${ln} 离开了房间。` });
    NET.broadcastRoomState();
    try {
      conn.close();
    } catch (e) {
      /* ignore */
    }
  }
}

export function onClientData(data: NetMessage): void {
  if (data.type === 'start_game') {
    G.players = data.players;
    G.myPlayerIdx = data.myPlayerIdx;
    G.grade = data.grade;
    G.playerCount = data.playerCount;
    G.started = true;
    G.deck = [];
    G.discard = [];
    G.settled = false;
    G.myKills = 0;
    document.getElementById('screenLobby')!.classList.remove('active');
    document.getElementById('screenSetup')!.classList.remove('active');
    document.getElementById('screenGame')!.classList.add('active');
    document.getElementById('topBar')?.classList.add('in-game');
    clearPlayZone();
    render();
  } else if (data.type === 'state_sync') {
    G.players = data.players;
    G.current = data.current;
    G.deck = data.deck;
    G.discard = data.discard;
    G.gameOver = data.gameOver;
    G.winnerText = data.winnerText;
    G.pendingOptions = data.pendingOptions;
    G.pendingPlayer = data.pendingPlayer;
    G.pendingType = data.pendingType || 'list';
    if (data.playLog) {
      setPlayLog(data.playLog);
    }
    if (G.gameOver) maybeSettle();
    render();
  } else if (data.type === 'choose_request') {
    G.pendingOptions = data.options;
    G.pendingPlayer = data.myPlayerIdx;
    G.pendingType = data.choiceType || 'list';
    render();
  } else if (data.type === 'ask_quiz_request') {
    onAskQuizRequest(data.question, data.isSkill, data.quizId);
  } else if (data.type === 'chat') {
    addChat(data.name, data.text, 'ai');
  } else if (data.type === 'play_log') {
    if (data.entry) {
      appendPlayLog(data.entry);
    }
  } else if (data.type === 'room_state') {
    updateGuestRoomInfo(data);
  } else if (data.type === 'host_closed') {
    alert('⚠️ 房主已关闭房间，游戏结束');
    try {
      if (NET.peer) NET.peer.destroy();
    } catch (e) {
      /* ignore */
    }
    setTimeout(() => {
      location.reload();
    }, 400);
  }
}

export function syncStateToClients(): void {
  if (!NET.isHost) return;
  NET.broadcast({
    type: 'state_sync',
    players: G.players,
    current: G.current,
    deck: G.deck,
    discard: G.discard,
    gameOver: G.gameOver,
    winnerText: G.winnerText,
    pendingOptions: G.pendingOptions,
    pendingType: G.pendingType,
    pendingPlayer: G.pendingPlayer,
    playLog: playLog.slice(-60),
  });
}

let _syncTimer: ReturnType<typeof setTimeout> | null = null;
export function scheduleSync(): void {
  if (!NET.isHost) return;
  if (_syncTimer) return;
  _syncTimer = setTimeout(() => {
    _syncTimer = null;
    try {
      syncStateToClients();
    } catch (e) {
      /* ignore */
    }
  }, 80);
}

export function isLocalPlayer(idx: number): boolean {
  if (NET.mode === 'single') return true;
  if (NET.mode === 'host') {
    const p = G.players[idx];
    return !p.isAI && p.peerId === NET.myPeerId;
  }
  if (NET.mode === 'join') return idx === G.myPlayerIdx;
  return false;
}
