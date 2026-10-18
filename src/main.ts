/* ==================== 入口 ====================
 * 职责：1) 挂载内联事件所需的 window 全局函数；2) 执行初始化序列（与原版脚本底部一致）。
 * 业务逻辑全部在各模块中，本文件不做任何游戏逻辑。
 */
import './style.css';

import type { FactionId } from './core/types';
import { togglePanel } from './core/dom';
import { toggleSound, loadSoundPref, refreshSoundSwitch, updateSoundButtons } from './core/sound';

import { exitGame, hostStartGame, startSingle } from './game/setup';
import { clickHandCard, clickTargetSeat } from './ui/hand';
import { handleLocalChoice } from './game/choice';
import { closeMarkMenu, openMarkMenu, setMark } from './game/marks';
import { closeProfileModal, refreshProfileUI, showAchievements } from './profile/profile';
import { sendChat } from './game/chat';
import { bindNetChat, sendNetChat, toggleNetChat } from './ui/netchat';
import { bindNotify, closeNotifyPanel, notifyJump, toggleNotifyPanel } from './ui/notify';
import { closeRules, openRules, switchRulesTab } from './ui/modals';
import {
  backToLobby,
  bindCountSlider,
  bindLobbyEvents,
  bindNicknamePersistence,
  clearExternalBank,
  closeBankMenu,
  closePersonaMenu,
  enterSetup,
  openBankMenu,
  openPersonaMenu,
  openProfileMenu,
  ensureCharValid,
  importQuestionBank,
  loadBankFromUrlInput,
  renderAchievements,
  renderCharPicker,
  renderFactionPicker,
  renderGradePicker,
  renderProfileEditor,
  renderRolePicker,
  renderSetupSummary,
  renderTopBar,
  selectAvatar,
  selectChar,
  selectFaction,
  selectGender,
  selectMoodIcon,
  selectRole,
  setNetMode,
  setPlayerCount,
  updateAIHint,
  updateBankInfo,
  updateLobbyMode,
  viewMemberProfile,
} from './ui/lobby';
import { bindBankBrowser, closeBankBrowser, openBankBrowser } from './ui/bank';
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
window.sendNetChat = sendNetChat;
window.toggleNetChat = toggleNetChat;
window.toggleNotifyPanel = toggleNotifyPanel;
window.closeNotifyPanel = closeNotifyPanel;
window.notifyJump = notifyJump;
window.clickHandCard = clickHandCard;
window.clickTargetSeat = clickTargetSeat;
window.handleLocalChoice = handleLocalChoice;
window.loadBankFromUrlInput = loadBankFromUrlInput;
window.importQuestionBank = importQuestionBank;
window.clearExternalBank = clearExternalBank;
window.selectAvatar = selectAvatar;
window.selectGender = selectGender;
window.selectMoodIcon = selectMoodIcon;
window.setPlayerCount = setPlayerCount;
window.selectRole = selectRole;
// 二级菜单与子界面导航
window.openProfileMenu = openProfileMenu;
window.openPersonaMenu = openPersonaMenu;
window.closePersonaMenu = closePersonaMenu;
window.openBankMenu = openBankMenu;
window.closeBankMenu = closeBankMenu;
window.backToLobby = backToLobby;
window.enterSetup = enterSetup;
window.setNetMode = setNetMode;
window.selectFaction = (k: string) => selectFaction(k as FactionId);
window.selectChar = selectChar;
window.openBankBrowser = openBankBrowser;
window.closeBankBrowser = closeBankBrowser;

/** 动态测量顶栏实际高度（换行行数随屏宽变化），写入 CSS 变量供 body 顶部让位；
 *  并实测三段宽度切换布局模式：单行放得下=单行(品牌左, 按钮+信息靠右)；
 *  放不下但「品牌+信息」可同行=两行(第一行 品牌+信息靠右, 第二行 按钮靠右)；否则回落单行(按钮区横向滚动) */
function syncTopBarHeight(): void {
  const tb = document.getElementById('topBar');
  if (!tb) return;
  const brand = tb.querySelector<HTMLElement>('.tb-brand');
  const chip = tb.querySelector<HTMLElement>('.tb-user-chip');
  const right = tb.querySelector<HTMLElement>('.tb-right');
  const set = () => {
    document.documentElement.style.setProperty('--tb-h', tb.offsetHeight + 6 + 'px');
    if (!brand || !chip || !right) return;
    tb.classList.remove('tb-mode2'); // 先按默认样式测自然宽度
    const cs = getComputedStyle(tb);
    const avail = tb.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const gap = parseFloat(cs.columnGap) || 10;
    const nat = (el: HTMLElement) => el.scrollWidth + (el.offsetWidth - el.clientWidth);
    const allFit = nat(brand) + nat(chip) + nat(right) + gap * 2 <= avail;
    // 两行模式：第一行放得下「品牌 + 用户信息」，第二行放按钮
    const brandChipFit = nat(brand) + nat(chip) + gap <= avail;
    const wantMode2 = !allFit && brandChipFit;
    if (wantMode2 !== tb.classList.contains('tb-mode2')) tb.classList.toggle('tb-mode2', wantMode2);
  };
  set();
  try {
    const ro = new ResizeObserver(set);
    ro.observe(tb);
    if (chip) ro.observe(chip);
    if (right) ro.observe(right);
  } catch (e) {
    window.addEventListener('resize', set);
  }
}

/** 小屏(≤600px)时战报移到出牌区下方，宽屏还原到侧栏 */
function bindPlayLogRelayout(): void {
  const log = document.getElementById('playLogPanel');
  const side = document.querySelector('.side-panel');
  const area = document.getElementById('tableArea');
  if (!log || !side || !area) return;
  const mq = window.matchMedia('(max-width:600px)');
  const apply = () => {
    if (mq.matches) {
      area.appendChild(log);
    } else {
      side.insertBefore(log, side.firstChild);
    }
  };
  apply();
  try {
    mq.addEventListener('change', apply);
  } catch (e) {
    (mq as unknown as { addListener: (f: () => void) => void }).addListener(apply);
  }
}

/* ---- 2. 初始化序列（顺序与原版脚本底部一致） ---- */
function init(): void {
  loadSoundPref();
  updateSoundButtons();
  refreshSoundSwitch();
  bindLobbyEvents();
  bindCountSlider();
  refreshProfileUI();
  renderProfileEditor();
  bindNicknamePersistence();
  ensureCharValid();
  renderGradePicker();
  renderFactionPicker();
  renderCharPicker();
  renderRolePicker();
  updateAIHint();
  updateLobbyMode();
  updateBankInfo();
  renderSetupSummary();
  // 固定顶栏 / 个人成就 / 题库浏览
  renderTopBar();
  renderAchievements();
  bindBankBrowser();
  syncTopBarHeight();
  bindPlayLogRelayout();
  bindNetChat();
  bindNotify();

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
