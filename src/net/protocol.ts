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
  PublicProfile,
  Question,
  RoomMember,
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
  | { type: 'choose_response'; value: string | number }
  | { type: 'quiz_response'; correct: boolean; quizId: number }
  | { type: 'leave_room'; name?: string }
  // ---- 房主 → 客户端 ----
  | { type: 'chat'; name: string; text: string }
  | { type: 'play_log'; entry: LogEntry }
  | RoomStateMsg
  | {
      type: 'start_game';
      players: Player[];
      myPlayerIdx: number;
      grade: string;
      playerCount: number;
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
    }
  | {
      type: 'choose_request';
      options: ChoiceOption[];
      myPlayerIdx: number;
      choiceType: PendingType;
    }
  | { type: 'ask_quiz_request'; question: Question; isSkill: boolean; quizId: number }
  | { type: 'host_closed' };

/** 客户端加入时房主保存的成员信息（含 peerId，不广播） */
export type { RoomMember };
