/* ==================== 开局装配 / 启动 ==================== */
import type { Card, Character, EquipSlot, Loadout, Player, PlayerIdentity, Role } from '../core/types';
import { G, quizStats } from './state';
import { FACTIONS } from '../data/factions';
import { ROLES, ROLE_CONFIG } from '../data/characters';
import { charPoolForPacket } from '../data/packets';
import { expansionEquipById, expansionItemById } from '../data/expansion';
import { buildDeck, shuffle } from '../data/cards';
import { loadGrade } from '../data/questionBank';
import { drawCards } from './rules';
import { addChat, resetChatMessages } from './chat';
import { addLog, resetPlayLog } from './log';
import { clearRoleMarks } from './marks';
import { render } from '../ui/render';
import { clearPlayZone } from '../ui/playzone';
import { resetNetChat } from '../ui/netchat';
import { gameLoop } from './loop';
import { aiSpeak } from './ai';
import {
  SELECTED_CHAR,
  SELECTED_COUNT,
  SELECTED_GRADE,
  SELECTED_PACKET,
  SELECTED_ROLE,
  SELECTED_TIMER_ON,
  SELECTED_TIMER_SEC,
  ensureCharValid,
  mergedCharPool,
  pickRandomCharIfNotChosen,
} from '../ui/lobby';
import { NET, NET_PLAYER_NAMES } from '../net/network';
import {
  identityFromProfile,
  localIdentity,
  PROFILE,
  refreshProfileUI,
  saveProfile,
} from '../profile/profile';
import { LOADOUT_EQUIP_LIMIT, LOADOUT_ITEM_LIMIT } from '../profile/credits';
import { Sound } from '../core/sound';

/** 应用开局选项：回合限时（开关 + 秒数），联机由房主下发给客人 */
function applyTimerSetting(): void {
  G.timerOn = SELECTED_TIMER_ON;
  G.timerSec = SELECTED_TIMER_SEC;
  G.timerEnd = null;
}

/**
 * 局前配装注入：把玩家档案里的已解锁装备折算为当局加成。
 * 联机适配：self 用本地 PROFILE；远程玩家由房主传入其上报的 loadout + unlockedEquips，
 * 房主校验「仅已解锁装备 / 槽位匹配 / 件数上限」，非法数据静默回退为空，不报错。
 * 装备不进牌堆，其效果以 flags / equip 槽位形式存在，局末随 G 重置自动清空。
 */
let loadoutCardSeq = 90000;
function applyLoadoutTo(p: Player, loadout: Loadout | undefined, unlockedEquips: string[] | undefined): void {
  const l: Loadout = loadout || { weapon: null, armor: null, horsePlus: null, horseMinus: null, items: {} };
  const unlocked = new Set(unlockedEquips || []);
  let equipCount = 0;
  const apply = (slot: EquipSlot, id: string | null) => {
    if (!id) return;
    if (!unlocked.has(id)) return; // 仅允许已解锁装备
    const e = expansionEquipById(id);
    if (!e || e.slot !== slot) return; // 槽位 / ID 不匹配 → 回退为空
    if (equipCount >= LOADOUT_EQUIP_LIMIT) return; // 装备件数上限，超出部分丢弃
    equipCount++;
    const card: Card = {
      id: loadoutCardSeq++,
      name: e.name,
      type: 'equip',
      sub: slot === 'weapon' ? 'weapon' : slot === 'armor' ? 'armor' : slot === 'horsePlus' ? 'horse+' : 'horse-',
      suit: '✦',
      num: '',
    };
    if (slot === 'weapon') {
      if (e.fx.range) card.range = e.fx.range;
      if (e.fx.dmg) p.flags.bonusDmg = (p.flags.bonusDmg || 0) + e.fx.dmg;
      p.equip.weapon = card;
    } else if (slot === 'armor') {
      if (e.fx.reduce) p.flags.dmgReduce = (p.flags.dmgReduce || 0) + e.fx.reduce;
      if (e.fx.shield) p.shield += e.fx.shield;
      p.equip.armor = card;
    } else if (slot === 'horsePlus') {
      p.equip.horsePlus = card;
      if (e.fx.distMinus) p.equip.horseMinus = { ...card }; // 的卢：同时具备 -1 马
    } else if (slot === 'horseMinus') {
      p.equip.horseMinus = card;
    }
  };
  apply('weapon', l.weapon);
  apply('armor', l.armor);
  apply('horsePlus', l.horsePlus);
  apply('horseMinus', l.horseMinus);
  // 携带道具（局内消耗，局末清空），逐项封顶
  const items: Record<string, number> = {};
  for (const [id, n] of Object.entries(l.items || {})) {
    if (n > 0 && expansionItemById(id)) items[id] = Math.min(n, LOADOUT_ITEM_LIMIT);
  }
  p.items = items;
}

function setupPlayers(playerCount: number, localChar: Character, localName: string): void {
  const roleDeck = [...(ROLE_CONFIG[playerCount] || ROLE_CONFIG[4])];
  const available = [...new Set(roleDeck)];
  let myRole: Role;
  if (SELECTED_ROLE !== 'random' && available.includes(SELECTED_ROLE)) myRole = SELECTED_ROLE;
  else myRole = roleDeck[Math.floor(Math.random() * roleDeck.length)];
  const rem = [...roleDeck];
  rem.splice(rem.indexOf(myRole), 1);
  shuffle(rem); // 借用洗牌打乱剩余角色分配
  const roles: Role[] = [myRole, ...rem];
  const pool = mergedCharPool(SELECTED_GRADE, SELECTED_PACKET);
  const aiChars = pool.filter((c) => c.id !== localChar.id);
  shuffle(aiChars);
  G.players = [];
  G.grade = SELECTED_GRADE;
  G.playerCount = playerCount;
  G.gameOver = false;
  G.winnerText = '';
  G.settled = false;
  G.myKills = 0;
  G.deck = buildDeck();
  G.discard = [];
  quizStats.total = 0;
  quizStats.correct = 0;
  resetPlayLog();
  resetChatMessages();
  resetNetChat();
  clearRoleMarks();

  const newPlayer = (
    id: number,
    name: string,
    char: Character,
    role: Role,
    isAI: boolean,
    peerId: string | null,
    identity: PlayerIdentity | null = null,
    self: boolean = false,
  ): Player => {
    let skills = [...char.skills];
    if (role === 'lord') {
      const ls = FACTIONS[char.faction].lordSkill;
      if (!skills.some((s) => s.id === ls.id)) skills.push({ ...ls });
    }
    const p: Player = {
      id,
      name,
      avatar: char.avatar,
      identity,
      subject: char.subject,
      charId: char.id,
      faction: char.faction,
      role,
      roleRevealed: role === 'lord',
      hp: role === 'lord' ? char.hp + 1 : char.hp,
      maxHp: role === 'lord' ? char.hp + 1 : char.hp,
      hand: [],
      equip: { weapon: null, armor: null, horsePlus: null, horseMinus: null },
      judge: [],
      knowledge: 0,
      shield: 0,
      combo: 0,
      maxCombo: 0,
      subjectMastery: {},
      alive: true,
      isAI,
      skills,
      peerId: peerId || null,
      flags: { shaUsed: 0, skillUsed: false, extraDamage: 0, skipPlay: false, noSha: false, jiuUsed: false },
      chained: false,
      turned: false,
      items: {},
    };
    // 局前配装注入：self 用本地档案；远程玩家在 setupPlayers 中按上报数据应用
    if (self) applyLoadoutTo(p, PROFILE.loadout, PROFILE.unlockedEquips);
    return p;
  };

  // 座位顺序：以房主权威的座位表为准（默认随机入座，座主与加入者均可手动调整）；
  // 无座位表时退回「房主 + 连接顺序」
  const myPeer = NET.isHost ? NET.myPeerId : null;
  const seatPeers: (string | null)[] =
    NET.isHost && NET.seats.length
      ? NET.seats.map((s) => (s ? s.peerId : null))
      : [myPeer, ...Object.keys(NET.playerConns)];
  const hostSeat = NET.isHost && myPeer ? Math.max(0, seatPeers.indexOf(myPeer)) : 0;
  // 身份分配：房主自选身份落到自己的座位上，其余随机
  const roleAtSeat: Role[] = new Array(playerCount);
  roleAtSeat[hostSeat] = myRole;
  {
    const others = [...rem];
    for (let i = 0, k = 0; i < playerCount; i++) if (i !== hostSeat) roleAtSeat[i] = others[k++];
  }
  for (let i = 0; i < playerCount; i++) {
    const peerId = i < seatPeers.length ? seatPeers[i] : null;
    // 自己：房主按座位表定位；单机模式固定 0 号
    const isSelf = NET.isHost ? !!myPeer && peerId === myPeer : i === 0;
    if (isSelf) {
      G.players.push(newPlayer(i, localName, localChar, roleAtSeat[i], false, NET.isHost ? peerId : null, localIdentity(), true));
    } else if (peerId) {
      const conn = NET.playerConns[peerId];
      const member = NET.roomMembers.find((m) => m.peerId === peerId);
      const rawName = conn?.metadata?.name;
      // 远程玩家的个性化身份：优先用其同步来的档案
      const identity =
        identityFromProfile(member?.profile ?? null) ??
        (typeof rawName === 'string' && rawName ? { ...localIdentity(), name: rawName } : null);
      const name = identity?.name || member?.name || (typeof rawName === 'string' && rawName) || '玩家' + i;
      // 远程玩家：优先采用其在设置界面自选的阵营 / 角色偏好
      const fallback = aiChars.length ? aiChars[i % aiChars.length] : pool[0];
      const byFaction = member?.pref?.faction
        ? aiChars.find((c) => c.faction === member.pref!.faction) ?? fallback
        : fallback;
      const char =
        (member?.pref?.charId && pool.find((c) => c.id === member.pref!.charId)) || byFaction;
      const pl = newPlayer(i, name, char, roleAtSeat[i], false, peerId, identity);
      // 联机配装同步：房主按远程玩家上报的合法配装注入（未上报则无配装）
      if (member?.pref) applyLoadoutTo(pl, member.pref.loadout, member.pref.unlockedEquips);
      G.players.push(pl);
    } else {
      const ch = aiChars.length ? aiChars[i % aiChars.length] : pool[0];
      G.players.push(newPlayer(i, 'AI·' + (ch ? ch.name : '同学'), ch, roleAtSeat[i], true, null));
    }
  }
  resetBrain(); // 新对局：清空 AI 信念/恩怨
  G.players.forEach((p) => drawCards(p, 4));
  G.current = G.players.findIndex((p) => p.role === 'lord');
  if (G.current < 0) G.current = 0;
  G.myPlayerIdx = hostSeat;
  G.started = true;
}

import { resetBrain } from './aibrain';

function readNickname(fallback: string): string {
  // 昵称统一取档案（在顶栏「🧑 个性化资料」中编辑）
  return (PROFILE.name || fallback).trim().slice(0, 12);
}

export async function startSingle(): Promise<void> {
  Sound.init();
  pickRandomCharIfNotChosen();
  ensureCharValid();
  await loadGrade(SELECTED_GRADE); // 按需载入选定年级题库
  const localChar = SELECTED_CHAR!;
  const nickname = readNickname('你');
  if (nickname) {
    PROFILE.name = nickname;
    saveProfile();
    refreshProfileUI();
  }
  NET.mode = 'single';
  NET.isHost = false;
  setupPlayers(SELECTED_COUNT, localChar, nickname);
  applyTimerSetting();
  document.getElementById('screenLobby')!.classList.remove('active');
  document.getElementById('screenSetup')!.classList.remove('active');
  document.getElementById('screenGame')!.classList.add('active');
  document.getElementById('topBar')?.classList.add('in-game');
  clearPlayZone();
  document.getElementById('chatPanel')!.style.display = 'none';
  addLog(`游戏开始（${G.grade}）。你是 ${FACTIONS[localChar.faction].name} 阵营 ${ROLES[G.players[0].role].name}。`, 'hl');
  render();
  setTimeout(() => {
    if (G.players[1]) aiSpeak(G.players[1], 'greet');
  }, 1500);
  gameLoop();
}

export async function hostStartGame(): Promise<void> {
  Sound.init();
  pickRandomCharIfNotChosen();
  ensureCharValid();
  await loadGrade(SELECTED_GRADE); // 按需载入选定年级题库
  const localChar = SELECTED_CHAR!;
  const nick = readNickname('房主');
  if (nick) {
    PROFILE.name = nick;
    saveProfile();
    refreshProfileUI();
  }
  const rc = Object.keys(NET.playerConns).length;
  if (rc + 1 > SELECTED_COUNT) {
    alert('已连接玩家超过目标人数');
    return;
  }
  NET.mode = 'host';
  NET.isHost = true;
  setupPlayers(SELECTED_COUNT, localChar, nick);
  applyTimerSetting();
  const remotePlayers = G.players.filter((p) => !p.isAI && p.peerId !== NET.myPeerId);
  remotePlayers.forEach((p) => {
    const idx = G.players.indexOf(p);
    NET.sendToPlayer(p.peerId!, {
      type: 'start_game',
      players: G.players,
      myPlayerIdx: idx,
      grade: G.grade,
      playerCount: SELECTED_COUNT,
      timerOn: G.timerOn,
      timerSec: G.timerSec,
    });
  });
  document.getElementById('screenLobby')!.classList.remove('active');
  document.getElementById('screenSetup')!.classList.remove('active');
  document.getElementById('screenGame')!.classList.add('active');
  document.getElementById('topBar')?.classList.add('in-game');
  clearPlayZone();
  document.getElementById('chatPanel')!.style.display = 'flex';
  addLog(`游戏开始（${G.grade}）。你是 ${FACTIONS[localChar.faction].name} 阵营 ${ROLES[G.players[0].role].name}。`, 'hl');
  addChat('系统', '欢迎来到学堂杀联机房！', 'sys');
  render();
  if (G.players[1])
    setTimeout(() => {
      aiSpeak(G.players[1], 'greet');
    }, 1500);
  gameLoop();
}

export function exitGame(): void {
  document.querySelectorAll('.rules-modal,#quizModal,#markModal,#profileModal').forEach((el) => el.classList.remove('show'));
  try {
    G.gameOver = true;
    if (NET.isHost) NET.broadcast({ type: 'host_closed' });
    if (!NET.isHost && NET.myConn) {
      try {
        NET.myConn.send({ type: 'leave_room', name: NET_PLAYER_NAMES[NET.myPeerId!] || '玩家' });
      } catch (e) {
        /* ignore */
      }
    }
    if (NET.peer) {
      try {
        NET.peer.destroy();
      } catch (e) {
        /* ignore */
      }
    }
  } catch (e) {
    /* ignore */
  }
  setTimeout(() => {
    window.location.href = window.location.pathname + '?t=' + Date.now();
  }, 150);
}
