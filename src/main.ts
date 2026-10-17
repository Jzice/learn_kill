/* ==================== 入口 ====================
 * 职责：1) 挂载内联事件所需的 window 全局函数；2) 执行初始化序列（与原版脚本底部一致）。
 * 业务逻辑全部在各模块中，本文件不做任何游戏逻辑。
 */
import './style.css';

import type { FactionId } from './core/types';
import { togglePanel } from './core/dom';
import { toggleSound } from './core/sound';

import { exitGame, hostStartGame, startSingle } from './game/setup';
import { clickHandCard, clickTargetSeat } from './ui/hand';
import { handleLocalChoice } from './game/choice';
import { closeMarkMenu, openMarkMenu, setMark } from './game/marks';
import { closeProfileModal, refreshProfileUI, showAchievements } from './profile/profile';
import { sendChat } from './game/chat';
import { closeDock, openDock, sendChatFromMobile } from './ui/dock';
import { closeRules, openRules, switchRulesTab } from './ui/modals';
import {
  bindLobbyEvents,
  bindNicknamePersistence,
  clearExternalBank,
  ensureCharValid,
  importQuestionBank,
  loadBankFromUrlInput,
  renderCharPicker,
  renderFactionPicker,
  renderGradePicker,
  renderRolePicker,
  selectChar,
  selectFaction,
  selectRole,
  updateAIHint,
  updateBankInfo,
  updateLobbyMode,
  viewMemberProfile,
} from './ui/lobby';
import { closeRoom, createRoom, joinRoom, leaveRoom } from './net/rooms';
import { EXTERNAL_BANK_URLS, loadBankFromUrl } from './data/questionBank';

/* ---- 1. window 全局挂载（供 HTML 内联 onclick / 动态模板调用） ---- */
window.togglePanel = togglePanel;
window.toggleSound = toggleSound;
window.exitGame = exitGame;
window.startSingle = startSingle;
window.hostStartGame = hostStartGame;
window.createRoom = createRoom;
window.closeRoom = closeRoom;
window.joinRoom = joinRoom;
window.leaveRoom = leaveRoom;
window.openRules = openRules;
window.closeRules = closeRules;
window.switchRulesTab = switchRulesTab;
window.openMarkMenu = openMarkMenu;
window.setMark = setMark;
window.closeMarkMenu = closeMarkMenu;
window.showAchievements = showAchievements;
window.closeProfileModal = closeProfileModal;
window.viewMemberProfile = viewMemberProfile;
window.sendChat = sendChat;
window.sendChatFromMobile = sendChatFromMobile;
window.openDock = openDock;
window.closeDock = closeDock;
window.clickHandCard = clickHandCard;
window.clickTargetSeat = clickTargetSeat;
window.handleLocalChoice = handleLocalChoice;
window.loadBankFromUrlInput = loadBankFromUrlInput;
window.importQuestionBank = importQuestionBank;
window.clearExternalBank = clearExternalBank;
window.selectRole = selectRole;
window.selectFaction = (k: string) => selectFaction(k as FactionId);
window.selectChar = selectChar;

/* ---- 2. 初始化序列（顺序与原版脚本底部一致） ---- */
function init(): void {
  bindLobbyEvents();
  refreshProfileUI();
  bindNicknamePersistence();
  ensureCharValid();
  renderGradePicker();
  renderFactionPicker();
  renderCharPicker();
  renderRolePicker();
  updateAIHint();
  updateLobbyMode();
  updateBankInfo();

  if (EXTERNAL_BANK_URLS.length) {
    Promise.all(EXTERNAL_BANK_URLS.map((u) => loadBankFromUrl(u, true))).then(() => {
      updateBankInfo();
      renderGradePicker();
    });
  }

  window.addEventListener('error', (e) => {
    console.error('全局错误:', e.error || e.message);
  });
}

init();
