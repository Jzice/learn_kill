/* ==================== 联机消息协议 ====================
 * 房主权威模式：host 运行游戏逻辑并广播 state_sync；
 * 客户端发送 choose_response / quiz_response 等响应类消息。
 */
import type {
  Card,
  ChoiceOption,
  LogEntry,
  PendingType,
  Player,
  PlayerPref,
  PublicProfile,
  Question,
  RoomMember,
  SeatSlot,
} from '../core/types';

export interface RoomStateMsg {
  type: 'room_state';
  roomCode: string;
  hostName: string;
  members: { name: string; isHost: boolean; profile: PublicProfile | null }[];
  currentCount: number;
  targetCount: number;
}

export type NetMessage =
  // ---- 客户端 → 房主 ----
  | { type: 'hello_profile'; profile: PublicProfile }
  | { type: 'guest_pref'; pref: PlayerPref }
  | { type: 'choose_response'; value: string | number }
  | { type: 'quiz_response'; correct: boolean; quizId: number }
  | { type: 'leave_room'; name?: string }
  /** 请求换座（仅能移动自己）：与目标座位占位者互换，空位则直接落座 */
  | { type: 'seat_move_request'; toIndex: number }
  /** 加入方申请直接重开一局 */
  | { type: 'rematch_request' }
  // ---- 房主 → 客户端 ----
  | { type: 'chat'; name: string; text: string; avatar?: string; moodIcon?: string; mood?: string }
  | { type: 'play_log'; entry: LogEntry }
  | RoomStateMsg
  | {
      type: 'start_game';
      players: Player[];
      myPlayerIdx: number;
      grade: string;
      playerCount: number;
      /** 回合限时（开局选项）：是否开启 + 秒数 */
      timerOn?: boolean;
      timerSec?: number;
    }
  | {
      type: 'state_sync';
      players: Player[];
      current: number;
      deck: Card[];
      discard: Card[];
      gameOver: boolean;
      winnerText: string;
      pendingOptions: ChoiceOption[] | null;
      pendingType: PendingType;
      pendingPlayer: number | null;
      playLog: LogEntry[];
      /** 回合限时：开关 / 秒数 / 当前决策截止时间戳（客人端据此显示倒计时） */
      timerOn?: boolean;
      timerSec?: number;
      timerEnd?: number | null;
      /** 大模型接管：房主开关状态与接管范围（客人端只读展示） */
      llmEnabled?: boolean;
      llmTakeoverAll?: boolean;
      /** 大模型「思考中」座位（客人端据此显示呼吸式思考指示） */
      thinkingSeat?: number | null;
    }
  | {
      /** 仅同步回合限时字段：房主自己出牌（pendingOptions 属房主，不得下发）时广播倒计时用 */
      type: 'timer_sync';
      timerOn?: boolean;
      timerSec?: number;
      timerEnd?: number | null;
    }
  | {
      type: 'choose_request';
      options: ChoiceOption[];
      myPlayerIdx: number;
      choiceType: PendingType;
    }
  | { type: 'ask_quiz_request'; question: Question; isSkill: boolean; quizId: number }
  /** 座位表更新（下标即座位号，null 由 AI 补齐） */
  | { type: 'seat_update'; seats: (SeatSlot | null)[]; targetCount: number }
  /** 房主拒绝加入：对局进行中且无 AI 席位可接管/顶替（真人已满） */
  | { type: 'join_rejected'; reason: string }
  /** 房主通知全体：回到房间界面直接重开一局 */
  | { type: 'rematch' }
  | { type: 'host_closed' };

/** 客户端加入时房主保存的成员信息（含 peerId，不广播） */
export type { RoomMember };
