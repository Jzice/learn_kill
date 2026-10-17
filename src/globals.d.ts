/* ==================== 内联事件处理函数的 Window 全局声明 ====================
 * 原版 HTML 通过 onclick="fn()" 直接调用全局函数；模块化后由 main.ts 统一挂载。
 */
import type { PublicProfile } from './core/types';

declare global {
  interface Window {
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
    // 聊天 / dock
    sendChat: () => void;
    sendChatFromMobile: () => void;
    openDock: (tab: 'log' | 'chat') => void;
    closeDock: () => void;
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
    // 游戏内交互
    clickHandCard: (cardId: number) => void;
    clickTargetSeat: (idx: number) => void;
    handleLocalChoice: (v: string | number) => void;
  }
}

export {};
