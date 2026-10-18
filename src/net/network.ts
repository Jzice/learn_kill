/* ==================== 网络层（房主权威） ==================== */
import type { NetMode, Player, PublicProfile, Question, RoomMember, SeatSlot } from '../core/types';
import type { NetMessage } from './protocol';
import { getPeerCtor } from '#peer';
import { G } from '../game/state';
import { addChat } from '../game/chat';
import { addLog, appendPlayLog, playLog, setPlayLog } from '../game/log';
import { render } from '../ui/render';
import { clearPlayZone } from '../ui/playzone';
import { SELECTED_COUNT, renderSeatPanel, updateGuestRoomInfo, updateHostRoomInfo } from '../ui/lobby';
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
  /** 座位表：定长（= 人数），下标即真实座位号，null 表示该座位由 AI 补齐；房主权威维护 */
  seats: [] as (SeatSlot | null)[],

  /* ---- 座位分配（默认随机，可由座主与加入者手动调整） ---- */

  /** 广播座位表给全体成员（保留空位，下标即真实座位号） */
  broadcastSeats(): void {
    if (!this.isHost) return;
    const total = Math.max(SELECTED_COUNT, this.seats.length, 1);
    const arr: (SeatSlot | null)[] = [];
    for (let i = 0; i < total; i++) arr.push(this.seats[i] ? { ...this.seats[i]! } : null);
    this.broadcast({ type: 'seat_update', seats: arr, targetCount: total });
    renderSeatPanel();
  },
  /** 成员入座：在空座位中随机落座（默认随机分配） */
  addSeat(peerId: string, name: string): void {
    if (this.seats.some((s) => s && s.peerId === peerId)) return;
    const total = Math.max(SELECTED_COUNT, this.seats.length, 1);
    const free: number[] = [];
    for (let i = 0; i < total; i++) if (!this.seats[i]) free.push(i);
    const idx = free.length ? free[Math.floor(Math.random() * free.length)] : this.seats.length;
    this.seats[idx] = { peerId, name };
    this.broadcastSeats();
  },
  /** 成员离座：座位留空（由 AI 补齐），其余成员座位号不变 */
  removeSeat(peerId: string): void {
    const i = this.seats.findIndex((s) => s && s.peerId === peerId);
    if (i < 0) return;
    this.seats[i] = null;
    this.broadcastSeats();
  },
  /** 换座：与目标座位互换；目标为空位（AI）则直接落座 */
  moveSeat(peerId: string, toIndex: number): boolean {
    const from = this.seats.findIndex((s) => s && s.peerId === peerId);
    if (from < 0) return false;
    const total = Math.max(SELECTED_COUNT, this.seats.length);
    const to = Math.max(0, Math.min(total - 1, Math.floor(toIndex)));
    if (to === from) return false;
    const self = this.seats[from];
    this.seats[from] = this.seats[to] ?? null;
    this.seats[to] = self;
    this.broadcastSeats();
    return true;
  },
  /** 全部成员重新随机落座（只在真人座位之间重排，AI 空位不变） */
  shuffleSeats(): void {
    const idxs: number[] = [];
    const arr: SeatSlot[] = [];
    this.seats.forEach((s, i) => {
      if (s) {
        idxs.push(i);
        arr.push(s);
      }
    });
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    idxs.forEach((seatIdx, k) => (this.seats[seatIdx] = arr[k]));
    this.broadcastSeats();
  },

  addRoomMember(peerId: string, name: string, isHost: boolean, profile: PublicProfile | null): void {
    const ex = this.roomMembers.find((m) => m.peerId === peerId);
    if (ex) {
      ex.name = name;
      if (profile) ex.profile = profile;
      this.renameSeat(peerId, name);
      return;
    }
    this.roomMembers.push({ peerId, name, isHost: !!isHost, profile: profile || null });
    // 新成员默认随机入座（房主权威维护座位表并广播）
    if (this.isHost) this.addSeat(peerId, name);
  },
  removeRoomMember(peerId: string): void {
    this.roomMembers = this.roomMembers.filter((m) => m.peerId !== peerId);
    if (this.isHost) this.removeSeat(peerId);
  },
  /** 座位表内改名（成员改名/档案同步后保持一致） */
  renameSeat(peerId: string, name: string): void {
    const s = this.seats.find((x) => x && x.peerId === peerId);
    if (s && s.name !== name) {
      s.name = name;
      this.broadcastSeats();
    }
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
      // 记下该玩家的出题范围：房主为他抽题时按其偏好覆盖年级
      if (data.pref?.scope) m.scope = data.pref.scope;
      NET.broadcastRoomState();
    }
  } else if (data.type === 'seat_move_request') {
    // 房主权威：只允许请求者移动自己（无法代他人操作，避免越权改他人座位）
    NET.moveSeat(conn.peer, data.toIndex);
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
    addChat(data.name, data.text, 'ai', data.avatar, data.moodIcon, data.mood);
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
  if (data.type === 'seat_update') {
    NET.seats = (data.seats || []).map((s) => (s ? { peerId: s.peerId, name: s.name } : null));
    renderSeatPanel();
  } else if (data.type === 'start_game') {
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
    addChat(data.name, data.text, 'ai', data.avatar, data.moodIcon, data.mood);
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
