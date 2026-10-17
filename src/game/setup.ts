/* ==================== 开局装配 / 启动 ==================== */
import type { Character, Player, PlayerIdentity, Role } from '../core/types';
import { G, quizStats } from './state';
import { FACTIONS } from '../data/factions';
import { ROLES, ROLE_CONFIG, charPoolForGrade } from '../data/characters';
import { buildDeck, shuffle } from '../data/cards';
import { loadGrade } from '../data/questionBank';
import { drawCards } from './rules';
import { addChat, resetChatMessages } from './chat';
import { addLog, resetPlayLog } from './log';
import { clearRoleMarks } from './marks';
import { render } from '../ui/render';
import { clearPlayZone } from '../ui/playzone';
import { gameLoop } from './loop';
import { aiSpeak } from './ai';
import {
  SELECTED_CHAR,
  SELECTED_COUNT,
  SELECTED_GRADE,
  SELECTED_ROLE,
  ensureCharValid,
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
import { Sound } from '../core/sound';

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
  const pool = charPoolForGrade(SELECTED_GRADE);
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
  clearRoleMarks();

  const newPlayer = (
    id: number,
    name: string,
    char: Character,
    role: Role,
    isAI: boolean,
    peerId: string | null,
    identity: PlayerIdentity | null = null,
  ): Player => {
    let skills = [...char.skills];
    if (role === 'lord') {
      const ls = FACTIONS[char.faction].lordSkill;
      if (!skills.some((s) => s.id === ls.id)) skills.push({ ...ls });
    }
    return {
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
      flags: { shaUsed: 0, skillUsed: false, extraDamage: 0, skipPlay: false, noSha: false },
    };
  };

  G.players.push(
    newPlayer(0, localName, localChar, roles[0], false, NET.isHost ? NET.myPeerId : null, localIdentity()),
  );
  const remoteIds = NET.isHost ? Object.keys(NET.playerConns) : [];
  for (let i = 1; i < playerCount; i++) {
    let name: string,
      char: Character,
      isAI: boolean,
      peerId: string | null,
      identity: PlayerIdentity | null = null;
    if (i - 1 < remoteIds.length) {
      const conn = NET.playerConns[remoteIds[i - 1]];
      const rawName = conn?.metadata?.name;
      peerId = remoteIds[i - 1];
      // 远程玩家的个性化身份：优先用其同步来的档案
      const member = NET.roomMembers.find((m) => m.peerId === peerId);
      identity =
        identityFromProfile(member?.profile ?? null) ??
        (typeof rawName === 'string' && rawName ? { ...localIdentity(), name: rawName } : null);
      name = identity?.name || (typeof rawName === 'string' && rawName) || '玩家' + i;
      // 远程玩家：优先采用其在设置界面自选的阵营 / 角色偏好
      const fallback = aiChars[(i - 1) % Math.max(1, aiChars.length)];
      const byFaction = member?.pref?.faction
        ? aiChars.find((c) => c.faction === member.pref!.faction) ?? fallback
        : fallback;
      char =
        (member?.pref?.charId && pool.find((c) => c.id === member.pref!.charId)) ||
        byFaction;
      isAI = false;
    } else {
      name = 'AI·' + (aiChars.length ? aiChars[(i - 1) % aiChars.length].name : '同学');
      char = aiChars.length ? aiChars[(i - 1) % aiChars.length] : pool[0];
      isAI = true;
      peerId = null;
    }
    G.players.push(newPlayer(i, name, char, roles[i], isAI, peerId, identity));
  }
  G.players.forEach((p) => drawCards(p, 4));
  G.current = G.players.findIndex((p) => p.role === 'lord');
  if (G.current < 0) G.current = 0;
  G.myPlayerIdx = 0;
  G.started = true;
}

function readNickname(fallback: string): string {
  const v = (document.getElementById('nicknameInput') as HTMLInputElement | null)?.value || '';
  return (v || PROFILE.name || fallback).trim().slice(0, 12);
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
  const remotePlayers = G.players.filter((p) => !p.isAI && p.peerId !== NET.myPeerId);
  remotePlayers.forEach((p) => {
    const idx = G.players.indexOf(p);
    NET.sendToPlayer(p.peerId!, {
      type: 'start_game',
      players: G.players,
      myPlayerIdx: idx,
      grade: G.grade,
      playerCount: SELECTED_COUNT,
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
