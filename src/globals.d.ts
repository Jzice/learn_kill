/* ==================== 内联事件处理函数的 Window 全局声明 ====================
 * 原版 HTML 通过 onclick="fn()" 直接调用全局函数；模块化后由 main.ts 统一挂载。
 */
import type { PublicProfile, SubjectBankSlice } from './core/types';

declare global {
  /** 构建期由 vite define 注入（取自 package.json 的 version），供顶栏显示版本号 */
  const __APP_VERSION__: string;

  interface Window {
    /** 外部题库分片仓库：由 public/banks/<学期>/<学科>.js 经典脚本写入 */
    __XTS_BANK__?: Record<string, SubjectBankSlice>;
    // 工具 / 音效
    togglePanel: (id: string) => void;
    toggleSound: () => void;
    exitGame: () => void;
    // 弹窗
    openRules: () => void;
    closeRules: () => void;
    switchRulesTab: (tab: string) => void;
    openMarkMenu: (idx: number) => void;
    setMark: (role: 'lord' | 'loyal' | 'rebel' | 'spy' | null) => void;
    closeMarkMenu: () => void;
    showAchievements: (p: PublicProfile, title: string) => void;
    closeProfileModal: () => void;
    viewMemberProfile: (name: string, profile: PublicProfile | null) => void;
    // 聊天 / 通知
    sendChat: () => void;
    sendNetChat: () => void;
    toggleNetChat: () => void;
    toggleNotifyPanel: () => void;
    closeNotifyPanel: () => void;
    notifyJump: (i: number) => void;
    // 主题设置
    openThemePanel: () => void;
    closeThemePanel: () => void;
    setThemeMode: (m: string) => void;
    setThemeStyle: (s: string) => void;
    // 大厅
    startSingle: () => Promise<void>;
    createRoom: () => Promise<void>;
    closeRoom: () => void;
    hostStartGame: () => Promise<void>;
    joinRoom: () => Promise<void>;
    leaveRoom: () => void;
    loadBankFromUrlInput: () => void;
    importQuestionBank: (event: Event) => void;
    clearExternalBank: () => void;
    selectRole: (r: 'lord' | 'loyal' | 'rebel' | 'spy' | 'random') => void;
    selectFaction: (k: string) => void;
    selectChar: (id: string) => void;
    // 个性化资料
    selectAvatar: (v: string) => void;
    selectGender: (v: 'male' | 'female' | 'hidden') => void;
    selectMoodIcon: (v: string) => void;
    setPlayerCount: (n: number) => void;
    // 学习档案：出题范围 / 错题本
    setQuizScopeMode: (s: 'grade' | 'past' | 'junior' | 'senior') => void;
    // 回合限时：关闭 / 选择档位（10 / 20 / 30 秒）
    setTimerOn: (on: boolean) => void;
    setTimerSec: (sec: number) => void;
    // 扩展包：决定可选角色的学段（初中 / 高中 / 全部）
    setPacket: (id: 'all' | 'junior' | 'senior') => void;
    renderPacketPicker: () => void;
    clearWrongBook: () => void;
    // 首页学习情况：展开错题解析 / 展开已攻克列表 / 标记已复习 / 复习模式
    toggleStudyItem: (key: string) => void;
    toggleMasteredWrongs: () => void;
    markStudyReviewed: (key: string) => void;
    startReview: (kp?: string, s?: string) => void;
    startReviewByKey: (key: string) => void;
    answerReview: (pos: number) => void;
    closeReview: () => void;
    // 题库刷题：开始一组 / 作答 / 关闭
    startDrill: () => void;
    answerDrill: (pos: number) => void;
    closeDrill: () => void;
    // 知识图谱：点击脑图节点查看讲解 / 由知识点跳回题目视图搜索
    selectKpNode: (kp: string) => void;
    bankSearchKp: (kp: string) => void;
    // 联机座位：自己换座 / 座主代他人换座 / 随机分配
    requestSeatMove: (toIndex: number) => void;
    pickSeatMember: (peerId: string) => void;
    randomizeSeats: () => void;
    // 一局结束结算
    closeSettle: () => void;
    requestRematch: () => void;
    startSingleGame: () => void;
    // 二级菜单 / 对局设置子界面
    openProfileMenu: () => void;
    openBankMenu: () => void;
    closeBankMenu: () => void;
    openBankBrowser: () => void;
    closeBankBrowser: () => void;
    copyInviteLink: () => void;
    nativeShare: () => void;
    setNetMode: (net: 'host' | 'join') => void;
    backToLobby: () => void;
    enterSetup: (mode: 'single' | 'host' | 'join') => void;
    // 学分商店 & 局前配装 & 消耗类道具
    openShop: (tab?: 'chars' | 'equips' | 'items' | 'missions') => void;
    closeShop: () => void;
    shopSetTab: (t: 'chars' | 'equips' | 'items') => void;
    shopSetGrade: (g: string) => void;
    shopUnlockChar: (id: string) => void;
    shopBuyEquip: (id: string) => void;
    shopBuyItem: (id: string, n?: number) => void;
    shopGrantNewbie: (id: string) => void;
    shopJumpBank: () => void;
    shopClaimMission: (id: string) => void;
    shopSetLoadoutSlot: (slot: 'weapon' | 'armor' | 'horsePlus' | 'horseMinus', value: string) => void;
    shopAddLoadoutItem: (id: string, n?: number) => void;
    shopRemoveLoadoutItem: (id: string, n?: number) => void;
    shopClearLoadout: () => void;
    renderLoadoutBar: () => void;
    useItem: (idx: number, itemId: string) => void;
    // 游戏内交互
    clickHandCard: (cardId: number) => void;
    clickTargetSeat: (idx: number) => void;
    handleLocalChoice: (v: string | number) => void;
  }
}

export {};
