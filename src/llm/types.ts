/* ==================== 大模型接管：类型定义 ==================== */

/** 决策提供者模式：'heuristic' = 原启发式 AI，'llm' = 由大模型驱动 */
export type LlmMode = 'heuristic' | 'llm';

/** 厂商预设标识（决定默认 baseURL / 模型 / 鉴权头，请求构造仍走 OpenAI 兼容接口） */
export type LlmProvider = 'openai' | 'deepseek' | 'qwen' | 'zhipu' | 'ollama' | 'custom';

/** 大模型连接配置（持久化于 localStorage，独立于玩家 profile） */
export interface LlmConfig {
  /** 总开关：是否用大模型接管 AI */
  enabled: boolean;
  /** 厂商预设 */
  provider: LlmProvider;
  /** 接口地址（可指向本地代理端口，复用同一套直连逻辑） */
  baseURL: string;
  /** API Key（仅存本机 localStorage） */
  apiKey: string;
  /** 模型名 */
  model: string;
  /** 采样温度 */
  temperature: number;
  /** 单次最大生成 token */
  maxTokens: number;
  /** 请求超时（毫秒），默认 20000 */
  timeoutMs: number;
  /** 接管范围：true = 接管全部 AI 座位；false = 仅接管 takeoverSeats 指定的座位 */
  takeoverAll: boolean;
  /** takeoverAll=false 时，接管的全局座位号（AI 座位） */
  takeoverSeats: number[];
  /** Debug：在对局战报中打印大模型每次决策的「原始输出 / 最终选择」，便于排查「不出杀」等问题 */
  debug: boolean;
}

/** 决策种类：供 prompt 构造与路由区分 */
export type LlmDecisionKind = 'play' | 'target' | 'counter' | 'save' | 'quiz' | 'discard' | 'list' | 'rescue' | 'shan';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** 大模型返回的一次性出牌动作（整回合规划用，可选；当前采用逐步决策，保留以便扩展） */
export interface LlmPlayAction {
  action: string;
  cardId?: number;
  target?: number;
  second?: number;
}
