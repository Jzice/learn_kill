/* ==================== 入口 ====================
 * 职责：1) 挂载内联事件所需的 window 全局函数；2) 执行初始化序列（与原版脚本底部一致）。
 * 业务逻辑全部在各模块中，本文件不做任何游戏逻辑。
 */
import './style.css';

import { G } from './game/state';
import { dealDamage, checkWin } from './game/damage';
import { useTrick } from './game/actions';

import type { FactionId } from './core/types';
import { setSim, sleep, togglePanel } from './core/dom';
import { CHARACTERS } from './data/characters';
import { FACTIONS } from './data/factions';
import { defOf, SKILL_DEFS } from './data/skilldefs';
import { toggleSound, loadSoundPref, refreshSoundSwitch, updateSoundButtons } from './core/sound';

import { exitGame, hostStartGame, startSingle } from './game/setup';
import { clickHandCard, clickTargetSeat } from './ui/hand';
import { handleLocalChoice, resolveChoice } from './game/choice';
import { defaultChoiceFor } from './game/timer';
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
import { bankSearchKp, bindBankBrowser, closeBankBrowser, openBankBrowser } from './ui/bank';
import { answerDrill, closeDrill, startDrill } from './ui/drill';
import { selectKpNode } from './ui/knowledge';
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
  shopGrantNewbie,
  shopJumpBank,
  shopClaimMission,
  shopClaimPass,
  shopGrantPassEquip,
  shopRemoveLoadoutItem,
  shopSetGrade,
  shopSetLoadoutSlot,
  shopSetTab,
  shopUnlockChar,
} from './ui/shop';
import { rerollRandomChar } from './ui/lobby';
import { revealCancel, revealConfirm, revealReroll } from './ui/reveal';
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
// 知识图谱：点击脑图节点 / 由知识点跳回题目视图
window.selectKpNode = selectKpNode;
window.bankSearchKp = bankSearchKp;
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
window.shopGrantNewbie = shopGrantNewbie;
window.shopJumpBank = shopJumpBank;
window.shopClaimMission = shopClaimMission;
window.shopClaimPass = shopClaimPass;
window.shopGrantPassEquip = shopGrantPassEquip;
// 随机武将预览卡 / 开局亮将
window.rerollRandomChar = rerollRandomChar;
window.revealConfirm = revealConfirm;
window.revealReroll = revealReroll;
window.revealCancel = revealCancel;
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

/* ---- 无头模拟 / 技能自检（scripts/balance.mjs、scripts/smoke-skills.mjs 用） ---- */
window.xtsSim = (on: boolean) => setSim(!!on);
window.xtsMakeAllAI = () => {
  G.players.forEach((p) => {
    p.isAI = true;
  });
  // 若真人座位正处于等待选择中，按默认规则放行，避免模拟卡死
  if (G.pendingResolve && G.pendingOptions?.length) {
    resolveChoice(defaultChoiceFor(G.pendingType || 'list', G.pendingOptions));
  }
};
window.xtsSnapshot = () => ({
  started: G.started,
  gameOver: G.gameOver,
  winner: G.winnerText || '',
  players: G.players.map((p) => ({
    name: p.name,
    char: p.charId || '',
    role: p.role,
    alive: p.alive,
    hp: p.hp,
  })),
});
window.xtsSkillAudit = () => {
  const missing: string[] = [];
  for (const c of CHARACTERS) for (const s of c.skills) if (!defOf(s.id)) missing.push(`${c.id}:${s.id}`);
  for (const f of Object.values(FACTIONS)) {
    const ls = f.lordSkill;
    if (ls && !defOf(ls.id)) missing.push(`lord:${ls.id}`);
  }
  const ids = Object.keys(SKILL_DEFS);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  const zhuge = CHARACTERS.find((c) => c.id === 'zhugeliang')?.skills.map((s) => s.id) || [];
  const multi = CHARACTERS.filter((c) => c.skills.length >= 3).map((c) => c.id);
  return { total: ids.length, chars: CHARACTERS.length, missing, duplicates: dup, zhuge, multi };
};

/**
 * 无头批量 AI 对战（scripts/balance.mjs 用）。
 * 每局随机角色开局并把所有座位交 AI 托管，跑到 gameOver 后统计胜率 / 存活率。
 * 返回各角色与各身份的累计战绩，供平衡微调。
 */
window.xtsAutoRun = async (n: number, seats = 5) => {
  setSim(true);
  const charIds = CHARACTERS.map((c) => c.id);
  const byChar: Record<string, { games: number; wins: number; alive: number }> = {};
  const byCharRole: Record<string, Record<string, { games: number; wins: number; alive: number }>> = {};
  const byRole: Record<string, { games: number; wins: number }> = {
    lord: { games: 0, wins: 0 },
    loyal: { games: 0, wins: 0 },
    rebel: { games: 0, wins: 0 },
    spy: { games: 0, wins: 0 },
  };
  let stalls = 0;
  for (let i = 0; i < n; i++) {
    setPlayerCount(seats);
    selectChar(charIds[Math.floor(Math.random() * charIds.length)]);
    await startSingle(); // 建局并启动 gameLoop（fire-and-forget）
    window.xtsMakeAllAI();
    let guard = 0;
    while (!G.gameOver && guard < 500000) {
      await sleep(0);
      guard++;
    }
    if (!G.gameOver) {
      stalls++;
      G.gameOver = true; // 防止死循环：强制结束本局
    }
    const winner = G.winnerText;
    const winRoles: string[] =
      winner === '内奸获胜'
        ? ['spy']
        : winner === '反贼获胜'
          ? ['rebel']
          : winner === '主公与忠臣获胜'
            ? ['lord', 'loyal']
            : [];
    for (const p of G.players) {
      const cid = p.charId || '';
      if (!byChar[cid]) byChar[cid] = { games: 0, wins: 0, alive: 0 };
      byChar[cid].games++;
      if (winRoles.includes(p.role)) byChar[cid].wins++;
      if (p.alive) byChar[cid].alive++;
      const cr = (byCharRole[cid] ||= {});
      const rr = (cr[p.role] ||= { games: 0, wins: 0, alive: 0 });
      rr.games++;
      if (winRoles.includes(p.role)) rr.wins++;
      if (p.alive) rr.alive++;
      if (byRole[p.role]) {
        byRole[p.role].games++;
        if (winRoles.includes(p.role)) byRole[p.role].wins++;
      }
    }
  }
  return { games: n, stalls, byChar, byRole, byCharRole };
};

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
