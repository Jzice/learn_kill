/* ==================== 网络层（房主权威） ==================== */
import type { NetMode, Player, PublicProfile, Question, RoomMember, SeatSlot } from '../core/types';
import type { NetMessage } from './protocol';
import { getPeerCtor } from '#peer';
import { G } from '../game/state';
import { addChat } from '../game/chat';
import { addLog, appendPlayLog, playLog, setPlayLog } from '../game/log';
import { render } from '../ui/render';
import { clearPlayZone } from '../ui/playzone';
import { SELECTED_COUNT, SELECTED_EXTRA_PACKETS, SELECTED_GRADE, SELECTED_PACKET, renderSeatPanel, updateGuestRoomInfo, updateHostRoomInfo } from '../ui/lobby';
import { backToRoomForRematch, hostHandleRematchRequest } from '../ui/settle';
import { onAskQuizRequest } from '../game/quiz';
import { consumePackUse } from '../profile/packMeter';
import { applyLlmModes } from '../game/setup';
import { resolveChoice } from '../game/choice';
import { identityFromProfile, localIdentity, maybeSettle, publicProfile } from '../profile/profile';
import { FX } from '../core/fx';
import { getLlmConfig } from '../llm/config';
import { ROLES } from '../data/characters';

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

/** 已通过 leave_room 主动退出的 peer（关闭连接时不再重复播报“断线”） */
const leftByButton = new Set<string>();

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
      // 同步房主统一选的基础包与年级，使加入方能预览个人叠加选项与可选角色池
      packet: SELECTED_PACKET,
      grade: SELECTED_GRADE,
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
          const peerId = conn.peer;
          delete this.playerConns[peerId];
          const leavingName = NET_PLAYER_NAMES[peerId] || '玩家';
          const byButton = leftByButton.has(peerId);
          leftByButton.delete(peerId);
          this.removeRoomMember(peerId);
          delete NET_PLAYER_NAMES[peerId];
          const leaveMsg = byButton ? `📤 ${leavingName} 离开了房间。` : `📤 ${leavingName} 断开了连接。`;
          addChat('系统', leaveMsg, 'sys');
          this.broadcast({ type: 'chat', name: '系统', text: leaveMsg });
          this.broadcastRoomState();
          const idx = G.players.findIndex((pl) => pl.peerId === peerId);
          const p = idx >= 0 ? G.players[idx] : null;
          if (p && p.alive) {
            addLog(`${p.name} 离开，由 AI 接管`, 'hl');
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
            // 新晋 AI 座位必须标记决策模式：否则 aiMode 为 undefined，
            // 出牌/通用决策会误走 waitChoice 向 null 的 peerId 发请求而卡死对局
            applyLlmModes();
            // 立即向全体同步“转为 AI”的最新状态，避免客人端延迟看到空座位
            syncStateToClients();
            NET.broadcastSeats();
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

/* ==================== 局中接入：接管 / 顶替 AI 席位 ==================== */
/** 已入座、等待档案到达后执行接管的成员：peerId → AI 席位下标 */
const pendingTakeovers = new Map<string, number>();

/** 无席位可加入：通知对方并断开（对局进行中且真人已满） */
function rejectJoin(conn: PeerJS.DataConnection): void {
  try {
    conn.send({ type: 'join_rejected', reason: 'room_full' });
  } catch (e) {
    /* ignore */
  }
  setTimeout(() => {
    try {
      conn.close();
    } catch (e) {
      /* ignore */
    }
  }, 400);
}

/**
 * 局中接入：优先随机接管一个存活 AI 席位；仅剩已阵亡 AI 席位时顶替其作为观察者（下一局可直接参战）；
 * 完全没有 AI 席位（真人已满）则拒绝加入。
 * 成员先登记入房并直接落到目标席位（绕过大厅阶段的随机入座），
 * 待 hello_profile 档案到达后执行接管（1s 兜底，防档案丢失）。
 */
function beginTakeover(conn: PeerJS.DataConnection, idx: number, name: string): void {
  const peerId = conn.peer;
  NET.roomMembers.push({ peerId, name, isHost: false, profile: null });
  while (NET.seats.length <= idx) NET.seats.push(null);
  NET.seats[idx] = { peerId, name };
  pendingTakeovers.set(peerId, idx);
  const p = G.players[idx];
  const how = p.alive ? '接管' : '作为观察者顶替';
  const tip = `📥 ${name} 加入对局，${how} ${p.name} 的席位`;
  addChat('系统', `${tip}…`, 'sys');
  NET.broadcast({ type: 'chat', name: '系统', text: `${tip}…` });
  NET.broadcastRoomState();
  NET.broadcastSeats();
  setTimeout(() => {
    if (pendingTakeovers.has(peerId)) executeTakeover(peerId);
  }, 1000);
}

/**
 * 执行接管：AI 席位 → 该 peerId 对应的真人。
 * 保留席位全部进度（角色/身份/手牌/装备/血量/知识分），仅替换控制者与个性化身份；
 * 顶替已阵亡席位时该成员本局为观察者，rematch 重开时按座位表正常参战。
 */
function executeTakeover(peerId: string): void {
  const idx = pendingTakeovers.get(peerId);
  pendingTakeovers.delete(peerId);
  if (idx == null) return;
  if (!NET.playerConns[peerId]) return; // 接管前已断开
  const p = G.players[idx];
  if (!p || !p.isAI || G.gameOver) return;
  const member = NET.roomMembers.find((m) => m.peerId === peerId);
  const identity =
    identityFromProfile(member?.profile ?? null) ?? { ...localIdentity(), name: member?.name || '玩家' };
  const oldName = p.name;
  const spectate = !p.alive;
  p.isAI = false;
  p.peerId = peerId;
  p.name = identity.name;
  p.identity = identity;
  delete p.aiMode;
  const text = spectate
    ? `📥 ${identity.name} 作为观察者顶替了 ${oldName} 的席位，下一局可直接参战`
    : `📥 ${identity.name} 加入战斗，接管了 ${oldName} 的席位！`;
  addLog(text, 'hl');
  addChat('系统', text, 'sys');
  NET.broadcast({ type: 'chat', name: '系统', text });
  // 下发 start_game 使其直接进入游戏界面（myPlayerIdx = 接管席位），随后全量同步
  NET.sendToPlayer(peerId, {
    type: 'start_game',
    players: G.players,
    myPlayerIdx: idx,
    grade: G.grade,
    playerCount: G.playerCount,
    timerOn: G.timerOn,
    timerSec: G.timerSec,
  });
  syncStateToClients();
  render();
}

export function onPeerConnected(conn: PeerJS.DataConnection): void {
  const rawName = conn.metadata?.name;
  const name = (typeof rawName === 'string' && rawName) || '玩家';
  NET_PLAYER_NAMES[conn.peer] = name;
  // 局中接入：有 AI 席位则接管/顶替继续打；真人已满（无 AI 席位）则拒绝
  if (NET.isHost && G.started && !G.gameOver) {
    const aliveAi: number[] = [];
    const deadAi: number[] = [];
    G.players.forEach((pl, i) => {
      if (!pl.isAI) return;
      (pl.alive ? aliveAi : deadAi).push(i);
    });
    const cand = aliveAi.length ? aliveAi : deadAi;
    if (!cand.length) {
      rejectJoin(conn);
      return;
    }
    beginTakeover(conn, cand[Math.floor(Math.random() * cand.length)], name);
    return;
  }
  NET.addRoomMember(conn.peer, name, false, null);
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
    // 局中接管：档案到达后立即执行（先于 1s 兜底定时器）
    if (pendingTakeovers.has(conn.peer)) executeTakeover(conn.peer);
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
  } else if (data.type === 'rematch_request') {
    // 加入方申请重开：房主同意后全体回到房间界面
    const nm = NET.roomMembers.find((m) => m.peerId === conn.peer)?.name || '玩家';
    hostHandleRematchRequest(nm);
  } else if (data.type === 'choose_response') {
    // 仅接受「当前正挂起等待的该玩家」的回复：客人端陈旧界面（超时/同步延迟后未刷新的按钮）
    // 产生的迟到点击必须丢弃，否则会错误解析掉房主本人或他人正在进行的决策
    //（曾经的漏洞：迟到回复若值为 'end'，会让他人的出牌阶段被提前结束并跳进弃牌阶段）。
    // 走统一的 resolveChoice：清理房主端 choiceTimer 与 G.timerEnd，并同步给客人端，避免倒计时残留
    const pendingIdx = G.pendingPlayer;
    const pendingPeer = pendingIdx == null ? undefined : G.players[pendingIdx]?.peerId;
    if (G.pendingResolve && pendingIdx != null && pendingPeer === conn.peer) resolveChoice(data.value);
  } else if (data.type === 'quiz_response') {
    const pq = NET.pendingQuiz;
    // 仅接受与当前挂起答题编号一致的回复，迟到的旧回复直接丢弃
    if (pq && pq.quizId === data.quizId) {
      if (pq.timer) clearTimeout(pq.timer);
      NET.pendingQuiz = null;
      // 远程答题结束：清理房主端这次答题设置的 G.timerEnd（客人端由 displayQuiz 自行清理）
      if (G.timerEnd) {
        G.timerEnd = null;
        syncTimerToClients();
      }
      pq.resolve(data.correct);
    }
  } else if (data.type === 'chat') {
    addChat(data.name, data.text, 'ai', data.avatar, data.moodIcon, data.mood);
    NET.broadcast(data);
  } else if (data.type === 'leave_room') {
    const ln = data.name || NET_PLAYER_NAMES[conn.peer] || '玩家';
    leftByButton.add(conn.peer); // 标记为主动退出，关闭连接时不再重复播报“断线”
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
  } else if (data.type === 'rematch') {
    backToRoomForRematch();
  } else if (data.type === 'start_game') {
    // 远程客户端本地自结算：仅为「自己叠加启用的扩展包」付费（每日免费优先，否则扣学分）；
    // 房主基础包由房主自行结算，本端不代付。启用前 UI 已阻止不可负担的包，故此处必然可负担。
    if (SELECTED_EXTRA_PACKETS.length) {
      const r = consumePackUse(SELECTED_EXTRA_PACKETS);
      if (!r.ok) {
        // 极端情况下（如免费用尽且学分不足）仍允许进入，但提示未付费成功
        console.warn('[pack] 远程端扩展包扣费失败，仍按房主基础池进行');
      }
      window.dispatchEvent(new CustomEvent('credits-updated'));
    }
    G.players = data.players;
    G.myPlayerIdx = data.myPlayerIdx;
    G.grade = data.grade;
    G.playerCount = data.playerCount;
    G.timerOn = data.timerOn ?? false;
    G.timerSec = data.timerSec ?? 20;
    G.timerEnd = null;
    G.llmEnabled = false;
    G.llmTakeoverAll = false;
    G.thinkingSeat = null;
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
    const prevAlive = G.players.map((p) => p.alive);
    G.players = data.players;
    G.current = data.current;
    G.deck = data.deck;
    G.discard = data.discard;
    G.gameOver = data.gameOver;
    G.winnerText = data.winnerText;
    G.pendingOptions = data.pendingOptions;
    G.pendingPlayer = data.pendingPlayer;
    G.pendingType = data.pendingType || 'list';
    G.timerOn = data.timerOn ?? G.timerOn;
    G.timerSec = data.timerSec ?? G.timerSec;
    G.timerEnd = data.timerEnd ?? null;
    G.llmEnabled = data.llmEnabled ?? G.llmEnabled;
    G.llmTakeoverAll = data.llmTakeoverAll ?? G.llmTakeoverAll;
    G.thinkingSeat = data.thinkingSeat ?? null;
    if (data.playLog) {
      setPlayLog(data.playLog);
    }
    if (G.gameOver) maybeSettle();
    render();
    // 新阵亡者：客人端补播阵亡动画（身份 + 击杀者），与房主端表现一致
    G.players.forEach((p, i) => {
      if (prevAlive[i] && !p.alive) {
        void FX.death(i, ROLES[p.role].name, p.killedBy ? `被 ${p.killedBy} 击杀` : '');
      }
    });
  } else if (data.type === 'timer_sync') {
    // 房主自己出牌时只同步计时字段（不带 pendingOptions），客人端据此显示房主倒计时
    G.timerOn = data.timerOn ?? G.timerOn;
    G.timerSec = data.timerSec ?? G.timerSec;
    G.timerEnd = data.timerEnd ?? null;
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
  } else if (data.type === 'join_rejected') {
    // 房主拒绝加入：对局进行中且真人席位已满，无 AI 席位可接管/顶替
    alert('⚠️ 对局已开始，且没有可加入的席位（真人已满）');
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
    timerOn: G.timerOn,
    timerSec: G.timerSec,
    timerEnd: G.timerEnd ?? null,
    llmEnabled: getLlmConfig().enabled,
    llmTakeoverAll: getLlmConfig().takeoverAll,
    thinkingSeat: G.thinkingSeat ?? null,
  });
}

/**
 * 只同步回合限时字段（timerOn / timerSec / timerEnd），不携带 pendingOptions / pendingPlayer。
 * 用于房主自己出牌时：此时决策选项是房主自己的，绝不能下发给客人端，
 * 否则客人端会误以为轮到自己决策。客人端据此显示房主的倒计时。
 */
export function syncTimerToClients(): void {
  if (!NET.isHost) return;
  NET.broadcast({
    type: 'timer_sync',
    timerOn: G.timerOn,
    timerSec: G.timerSec,
    timerEnd: G.timerEnd ?? null,
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
