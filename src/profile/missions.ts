/* ==================== 每日学习任务（确定性奖励，v1.8.1） ====================
 * 设计依据：docs/学分商店学习激励方案.md §4.5
 * 4 个固定每日任务，跨日 0 点自动重置；奖励为固定学分档位（零随机），
 * 走任务类独立日额度（CREDIT_RULE.missionDailyCap = 100），不与答题类 300 混算。
 * 计数只在真实学习事件埋点处 +1（答对 / 复习 / 攻克错题 / 连击），无法刷。
 */
import { addCredits } from './credits';
import { PROFILE, saveProfile } from './profile';

export type MissionId = 'quiz' | 'review' | 'wrongFixed' | 'combo';

export interface MissionDef {
  id: MissionId;
  label: string;
  target: number;
  reward: number;
}

/** 每日任务表（固定，无随机） */
export const MISSIONS: MissionDef[] = [
  { id: 'quiz', label: '日课·答对 10 题', target: 10, reward: 30 },
  { id: 'review', label: '日课·复习 3 题', target: 3, reward: 20 },
  { id: 'wrongFixed', label: '日课·攻克 2 错题', target: 2, reward: 25 },
  { id: 'combo', label: '日课·连对 5 题', target: 5, reward: 25 },
];

/** 任务奖励入学分时的来源标识（走任务类额度） */
export const MISSION_REASON = 'mission';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function today(): { date: string; quiz: number; review: number; wrongFixed: number; combo: number; claimed: string[] } {
  const d = todayStr();
  if (!PROFILE.missionDaily || PROFILE.missionDaily.date !== d) {
    PROFILE.missionDaily = { date: d, quiz: 0, review: 0, wrongFixed: 0, combo: 0, claimed: [] };
    saveProfile();
  }
  return PROFILE.missionDaily;
}

/** 埋点：学习行为发生时调用（与 addCredits 同址）。combo 传当日连击数取最大值 */
export function bumpMission(id: MissionId, n = 1): void {
  const m = today();
  if (id === 'combo') m.combo = Math.max(m.combo, n);
  else m[id] = (m[id] || 0) + n;
  saveProfile();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('missions-updated'));
  }
}

export interface MissionProgress {
  def: MissionDef;
  cur: number;
  done: boolean;
  claimed: boolean;
}

export function missionProgress(): MissionProgress[] {
  const m = today();
  return MISSIONS.map((def) => {
    const raw = m[def.id] || 0;
    return { def, cur: Math.min(raw, def.target), done: raw >= def.target, claimed: m.claimed.includes(def.id) };
  });
}

/** 可领取（已完成未领）的任务数（顶栏红点用） */
export function claimableCount(): number {
  return missionProgress().filter((m) => m.done && !m.claimed).length;
}

/** 领取任务奖励：固定学分档位；标记已领（即使触顶也标记，避免卡死） */
export function claimMission(id: MissionId): boolean {
  const m = today();
  const def = MISSIONS.find((x) => x.id === id);
  if (!def || m.claimed.includes(id)) return false;
  if ((m[id] || 0) < def.target) return false;
  m.claimed = [...m.claimed, id];
  saveProfile();
  addCredits(def.reward, MISSION_REASON);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('missions-updated'));
  }
  return true;
}
