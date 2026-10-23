/* ==================== 大模型接管：配置持久化 ==================== */
import type { LlmConfig, LlmProvider } from './types';

const STORAGE_KEY = 'xuetangsha_llm_v1';

export function defaultLlmConfig(): LlmConfig {
  return {
    enabled: false,
    provider: 'deepseek',
    baseURL: 'https://api.deepseek.com/v1',
    apiKey: '',
    model: 'deepseek-chat',
    temperature: 0.7,
    maxTokens: 800,
    timeoutMs: 12000,
    takeoverAll: true,
    takeoverSeats: [],
    debug: false,
  };
}

let cache: LlmConfig | null = null;

export function getLlmConfig(): LlmConfig {
  if (cache) return cache;
  const def = defaultLlmConfig();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LlmConfig>;
      cache = { ...def, ...parsed };
      return cache;
    }
  } catch {
    /* 解析失败回退默认 */
  }
  cache = def;
  return cache;
}

export function setLlmConfig(cfg: LlmConfig): void {
  cache = cfg;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    /* 隐私模式写入失败：仅内存生效 */
  }
}

/** 配置是否可用于发起请求（开关 + 地址 + 模型齐备） */
export function llmReady(): boolean {
  const c = getLlmConfig();
  return c.enabled && !!c.baseURL.trim() && !!c.model.trim();
}

/** 判断某个座位是否应由大模型接管（仅在 isAI 的座位上生效） */
export function llmEnabledForSeat(seatIdx: number): boolean {
  const c = getLlmConfig();
  if (!c.enabled) return false;
  if (c.takeoverAll) return true;
  return c.takeoverSeats.includes(seatIdx);
}

/** 是否打印大模型决策 debug 日志（在对局战报中输出「原始输出 / 最终选择」） */
export function llmDebug(): boolean {
  return getLlmConfig().debug;
}

/** 厂商默认 baseURL / 模型（选择预设时联动填入，仍可被用户覆盖） */
export const PROVIDER_DEFAULTS: Record<LlmProvider, { baseURL: string; model: string; needsKey: boolean }> = {
  openai: { baseURL: 'https://api.openai.com/v1', model: 'gpt-4o-mini', needsKey: true },
  deepseek: { baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-chat', needsKey: true },
  qwen: { baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', needsKey: true },
  zhipu: { baseURL: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', needsKey: true },
  ollama: { baseURL: 'http://localhost:11434/v1', model: 'llama3', needsKey: false },
  custom: { baseURL: '', model: '', needsKey: true },
};

export const PROVIDER_LABELS: Record<LlmProvider, string> = {
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
  qwen: '通义千问',
  zhipu: '智谱 GLM',
  ollama: 'Ollama（本地）',
  custom: '自定义',
};
