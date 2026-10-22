/* ==================== 游戏状态 ==================== */
import type { GameState, QuizStats } from '../core/types';

/** 全局唯一游戏状态对象（联机 state_sync 直接序列化此结构的字段） */
export const G: GameState = {
  players: [],
  deck: [],
  discard: [],
  current: 0,
  started: false,
  grade: '初二上',
  myPlayerIdx: 0,
  pendingOptions: null,
  pendingType: 'list',
  pendingResolve: null,
  pendingPlayer: null,
  gameOver: false,
  winnerText: '',
  playerCount: 4,
  settled: false,
  myKills: 0,
  // 回合限时（开局选项，默认关闭）
  timerOn: false,
  timerSec: 20,
  timerEnd: null,
  // 大模型「思考中」座位（默认无）
  thinkingSeat: null,
};

/** 答题统计（const 对象，字段 mutate；setup 重置时逐字段清零） */
export const quizStats: QuizStats = { total: 0, correct: 0 };
