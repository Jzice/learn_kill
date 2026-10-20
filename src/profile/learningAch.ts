/* ==================== 学习类成就判定与发奖（v1.8.2） ====================
 * 设计依据：docs/学分商店学习激励方案.md §4.7
 * 11 个新成就全部为确定性判定（累计答对 / 知识点掌握数 / 连对 / 连续学习 /
 * 学科学期精通 / 单局全对 / 战令满级 / 首次解锁），解锁时发 学分 50 + 积分 30。
 * 调用点：局内结算、刷题小结、首页复习/攻克、任务/战令领取、商店解锁成功后。
 */
import { addLog } from '../game/log';
import { addCredits } from './credits';
import { PROFILE, saveProfile } from './profile';
import { masterySnapshot } from './unlockCondition';
import { PASS_MAX_LEVEL, passLevelOf, passState } from './pass';

/** 每个学习类成就的奖励学分 */
export const LEARNING_ACH_CREDIT = 50;
/** 每个学习类成就的奖励积分 */
export const LEARNING_ACH_SCORE = 30;

/**
 * 检查并发放学习类成就，返回本次新解锁的成就 id 列表。
 * 纯本地计算（kpStats 派生 + 档案字段），不加载题库分片。
 */
export function checkLearningAchievements(): string[] {
  const fresh: string[] = [];
  const unlock = (id: string): void => {
    if (!PROFILE.achievements[id]) {
      PROFILE.achievements[id] = Date.now();
      fresh.push(id);
    }
  };
  const snap = masterySnapshot();
  if ((PROFILE.correctQuiz || 0) >= 100) unlock('quiz_100');
  if ((PROFILE.correctQuiz || 0) >= 300) unlock('quiz_300');
  if (snap.total >= 20) unlock('kp_20');
  if (snap.total >= 60) unlock('kp_60');
  if ((PROFILE.maxCombo || 0) >= 10) unlock('streak_10');
  if ((PROFILE.studyStreak?.days || 0) >= 7) unlock('daily_7');
  if (snap.masters >= 1) unlock('subject_master');
  if (snap.masters >= 9) unlock('all_master_9');
  if (passLevelOf(passState().exp) >= PASS_MAX_LEVEL) unlock('pass_30');
  if (!fresh.length) return fresh;
  for (const id of fresh) {
    addCredits(LEARNING_ACH_CREDIT, 'mission');
    PROFILE.score += LEARNING_ACH_SCORE;
  }
  saveProfile();
  for (const id of fresh) {
    const a = ACH_NAME[id];
    if (a) addLog(`🏅 解锁学习成就【${a}】｜ 学分 +${LEARNING_ACH_CREDIT} ｜ 积分 +${LEARNING_ACH_SCORE}`, 'reward');
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('profile-updated'));
  }
  return fresh;
}

/** 成就 id → 名称（用于日志；避免循环引入 ACHIEVEMENTS 全表） */
const ACH_NAME: Record<string, string> = {
  quiz_100: '百题斩',
  quiz_300: '题海无涯',
  kp_20: '初窥门径',
  kp_60: '博闻强识',
  streak_10: '十连绝世',
  daily_7: '七日不辍',
  subject_master: '学科精通',
  all_master_9: '九科学霸',
  perfect_game: '全对达人',
  pass_30: '学期圆满',
  first_unlock: '学有所用',
};
