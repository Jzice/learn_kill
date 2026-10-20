/* ==================== 入口 ====================
 * 职责：1) 挂载内联事件所需的 window 全局函数；2) 执行初始化序列（与原版脚本底部一致）。
 * 业务逻辑全部在各模块中，本文件不做任何游戏逻辑。
 */
import './style.css';

import { G } from './game/state';
import { dealDamage, checkWin } from './game/damage';
import { useTrick } from './game/actions';

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
import { bindLogResize } from './ui/logresize';
import { bindNotify, closeNotifyPanel, notifyJump, toggleNotifyPanel } from './ui/notify';
import { applyTheme, closeThemePanel, openThemePanel, setThemeMode, setThemeStyle } from './ui/theme';
import { closeRules, openRules, switchRulesTab } from './ui/modals';
import { copyInviteLink, nativeShare } from './ui/share';
import {
  backToLobby,
  bindCountSlider,
  bindLobbyEvents,
  clearExternalBank,
  closeBankMenu,
  enterSetup,
  openBankMenu,
  openProfileMenu,
  ensureCharValid,
  importQuestionBank,
  loadBankFromUrlInput,
  renderAchievements,
  renderCharPicker,
  renderFactionPicker,
  renderGradePicker,
  renderScopePicker,
  renderPacketPicker,
  renderTimerPicker,
  setQuizScopeMode,
  setPacket,
  setTimerOn,
  setTimerSec,
  renderProfileEditor,
  pickSeatMember,
  randomizeSeats,
  requestSeatMove,
  renderRolePicker,
  renderSetupSummary,
  renderTopBar,
  restoreSetupPrefs,
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
import { answerDrill, closeDrill, startDrill } from './ui/drill';
import { clearWrongBook } from './profile/quizbook';
import {
  answerReview,
  closeReview,
  markStudyReviewed,
  renderStudyPanel,
  resetStudyPanel,
  startReview,
  startReviewByKey,
  toggleMasteredWrongs,
  toggleStudyItem,
} from './ui/study';
import { initTimerTicker } from './ui/timer';
import { closeSettle, requestRematch, startSingleGame } from './ui/settle';
import { closeRoom, createRoom, joinRoom, leaveRoom } from './net/rooms';
import { EXTERNAL_BANK_URLS, loadBankFromUrl } from './data/questionBank';
import {
  closeShop,
  openShop,
  renderLoadoutBar,
  shopAddLoadoutItem,
  shopBuyEquip,
  shopBuyItem,
  shopClearLoadout,
  shopRemoveLoadoutItem,
  shopSetGrade,
  shopSetLoadoutSlot,
  shopSetTab,
  shopUnlockChar,
} from './ui/shop';
import { useItem } from './game/actions';

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
window.openThemePanel = openThemePanel;
window.closeThemePanel = closeThemePanel;
window.setThemeMode = setThemeMode;
window.setThemeStyle = setThemeStyle;
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
window.openBankMenu = openBankMenu;
window.closeBankMenu = closeBankMenu;
window.backToLobby = backToLobby;
window.enterSetup = enterSetup;
window.setNetMode = setNetMode;
window.setQuizScopeMode = setQuizScopeMode;
window.setPacket = setPacket;
window.setTimerOn = setTimerOn;
window.setTimerSec = setTimerSec;
window.renderPacketPicker = renderPacketPicker;
window.clearWrongBook = () => {
  clearWrongBook();
  resetStudyPanel(); // 清空后首页学习面板同步复位
};
// 首页学习情况面板（知识点掌握 / 错题复习）
window.toggleStudyItem = toggleStudyItem;
window.toggleMasteredWrongs = toggleMasteredWrongs;
window.markStudyReviewed = markStudyReviewed;
window.startReview = startReview;
window.startReviewByKey = startReviewByKey;
window.answerReview = answerReview;
window.closeReview = closeReview;
// 题库刷题（答对赚学分）
window.startDrill = () => {
  void startDrill();
};
window.answerDrill = answerDrill;
window.closeDrill = closeDrill;
window.requestSeatMove = requestSeatMove;
window.pickSeatMember = pickSeatMember;
window.randomizeSeats = randomizeSeats;
window.closeSettle = closeSettle;
window.requestRematch = requestRematch;
window.startSingleGame = startSingleGame;
window.selectFaction = (k: string) => selectFaction(k as FactionId);
window.selectChar = selectChar;
window.openBankBrowser = openBankBrowser;
window.closeBankBrowser = closeBankBrowser;
// 学分商店 & 局前配装 & 消耗类道具
window.openShop = openShop;
window.closeShop = closeShop;
window.shopSetTab = shopSetTab;
window.shopSetGrade = shopSetGrade;
window.shopUnlockChar = shopUnlockChar;
window.shopBuyEquip = shopBuyEquip;
window.shopBuyItem = shopBuyItem;
window.shopSetLoadoutSlot = shopSetLoadoutSlot;
window.shopAddLoadoutItem = shopAddLoadoutItem;
window.shopRemoveLoadoutItem = shopRemoveLoadoutItem;
window.shopClearLoadout = shopClearLoadout;
window.renderLoadoutBar = renderLoadoutBar;
window.useItem = useItem;

/** 动态测量顶栏实际高度（换行行数随屏宽变化），写入 CSS 变量供 body 顶部让位；
 *  并实测切换布局模式：单行放得下=单行(品牌左, 等级积分+按钮+个人信息靠右)；
 *  放不下=恒定两行(第一行 品牌左+个人信息右, 第二行 等级积分左+按钮组右)，更窄时整栏横向滚动 */
function syncTopBarHeight(): void {
  const tb = document.getElementById('topBar');
  if (!tb) return;
  const brand = tb.querySelector<HTMLElement>('.tb-brand');
  const chip = tb.querySelector<HTMLElement>('.tb-user-chip');
  const right = tb.querySelector<HTMLElement>('.tb-right');
  const stats = tb.querySelector<HTMLElement>('.tb-stats');
  const set = () => {
    document.documentElement.style.setProperty('--tb-h', tb.offsetHeight + 6 + 'px');
    if (!brand || !chip || !right) return;
    tb.classList.remove('tb-mode2'); // 先按默认样式测自然宽度
    const cs = getComputedStyle(tb);
    const avail = tb.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const gap = parseFloat(cs.columnGap) || 10;
    const nat = (el: HTMLElement) => el.scrollWidth + (el.offsetWidth - el.clientWidth);
    const wStats = stats ? nat(stats) : 0;
    // 单行放得下则单行；否则恒定两行（更窄时整栏横向滚动，含第一行，不再回落单行）
    const allFit = nat(brand) + wStats + nat(right) + nat(chip) + gap * 3 <= avail;
    const wantMode2 = !allFit;
    if (wantMode2 !== tb.classList.contains('tb-mode2')) tb.classList.toggle('tb-mode2', wantMode2);
  };
  // 测量过程会临时移除 tb-mode2（回到单行）再切回，属于「回调内改布局」；
  // 延到下一帧执行，避免 ResizeObserver 判定为 undelivered notifications 并报错
  const setLater = () => requestAnimationFrame(set);
  set();
  try {
    const ro = new ResizeObserver(setLater);
    ro.observe(tb);
    if (chip) ro.observe(chip);
    if (right) ro.observe(right);
  } catch (e) {
    window.addEventListener('resize', setLater);
  }
}

window.copyInviteLink = copyInviteLink;
window.nativeShare = nativeShare;

/** 通过 ?room=XXXXXX 分享链接进入时，自动进入加入模式并预填房间号、发起加入 */
function handleSharedRoom(): void {
  let code = '';
  try {
    code = new URLSearchParams(location.search).get('room') || '';
  } catch {
    return;
  }
  if (!/^\d{6}$/.test(code)) return;
  enterSetup('join');
  const inp = document.getElementById('joinCode') as HTMLInputElement | null;
  if (inp) inp.value = code;
  const st = document.getElementById('joinStatus');
  if (st) st.textContent = `已自动填入房间号 ${code}，正在加入…`;
  setTimeout(() => {
    void joinRoom();
  }, 50);
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
  applyTheme();
  restoreSetupPrefs(); // 恢复上次选择的玩家总数 / 回合限时（须在渲染选择器与绑定滑块前）
  loadSoundPref();
  updateSoundButtons();
  refreshSoundSwitch();
  bindLobbyEvents();
  bindCountSlider();
  refreshProfileUI();
  renderProfileEditor();
  ensureCharValid();
  renderGradePicker();
  renderScopePicker();
  renderPacketPicker();
  renderTimerPicker();
  renderFactionPicker();
  renderCharPicker();
  renderRolePicker();
  updateAIHint();
  updateLobbyMode();
  updateBankInfo();
  renderSetupSummary();
  // 固定顶栏 / 个人成就 / 题库浏览
  renderTopBar();
  const verEl = document.getElementById('tbVersion');
  if (verEl) verEl.textContent = `v${__APP_VERSION__}`;
  renderAchievements();
  renderStudyPanel();
  initTimerTicker(); // 回合倒计时刷新（房主与客人端共用 G.timerEnd）
  bindBankBrowser();
  syncTopBarHeight();
  bindPlayLogRelayout();
  bindLogResize();
  bindNetChat();
  bindNotify();
  handleSharedRoom();

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

// 调试钩子：仅在 URL 带 ?debug=1 时暴露内部状态/函数，供自动化测试驱动（生产构建无此对象）
if (new URLSearchParams(location.search).has('debug')) {
  (window as unknown as { __game: unknown }).__game = {
    get G() {
      return G;
    },
    dealDamage,
    checkWin,
    useTrick,
  };
}
