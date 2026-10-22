/* ==================== 大模型接管：OpenAI 兼容客户端 ==================== */
import type { LlmConfig, LlmMessage } from './types';
import { getLlmConfig } from './config';

/**
 * 厂商适配层：把「请求构造 / 响应解析」抽象为可替换的适配器。
 * 默认 openAiAdapter 覆盖 OpenAI、DeepSeek、通义、智谱、Ollama 等绝大多数兼容接口；
 * 后续接入文心 / Claude / Gemini 等原生接口时，只需新增一个 ProviderAdapter，不改调用方。
 */
export interface ProviderAdapter {
  /** 构造 fetch 请求（含鉴权头与 URL） */
  build(urlBase: string, apiKey: string, messages: LlmMessage[], cfg: LlmConfig): RequestInit & { url: string };
  /** 从响应体解析出助手文本内容 */
  parse(body: unknown): string;
}

function chatCompletionsUrl(base: string): string {
  const b = base.trim().replace(/\/+$/, '');
  return `${b}/chat/completions`;
}

export const openAiAdapter: ProviderAdapter = {
  build(urlBase, apiKey, messages, cfg) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    return {
      url: chatCompletionsUrl(urlBase),
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: cfg.temperature,
        max_tokens: cfg.maxTokens,
        response_format: { type: 'json_object' },
      }),
    };
  },
  parse(body) {
    const data = body as { choices?: { message?: { content?: string } }[] };
    const content = data?.choices?.[0]?.message?.content;
    return typeof content === 'string' ? content : '';
  },
};

/** 当前生效的适配器（预留：可按 cfg.provider 选择不同 adapter） */
function adapterFor(_provider: string): ProviderAdapter {
  return openAiAdapter;
}

/** 发起一次补全；超时由 AbortController 控制，异常向上抛出由调用方回退 */
export async function callLlm(messages: LlmMessage[], cfgOverride?: LlmConfig): Promise<string> {
  const cfg = cfgOverride ?? getLlmConfig();
  const adapter = adapterFor(cfg.provider);
  const req = adapter.build(cfg.baseURL, cfg.apiKey, messages, cfg);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.max(1000, cfg.timeoutMs));
  try {
    const res = await fetch(req.url, { ...req, signal: ctrl.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`LLM HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const body = await res.json();
    return adapter.parse(body);
  } finally {
    clearTimeout(timer);
  }
}

/** 从模型文本中提取第一个 JSON 对象（容错：去掉 ```json 围栏、取首尾花括号） */
export function parseJsonSafe<T>(text: string): T | null {
  if (!text) return null;
  let s = text.trim();
  // 去除 markdown 代码围栏
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  // 截取首个 { 到末个 }
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

/** 设置弹窗「测试连接」：发起一次 1 token 最小补全，返回是否成功 */
export async function testLlmConnection(): Promise<{ ok: boolean; msg: string }> {
  try {
    const res = await callLlm(
      [
        { role: 'system', content: '你是测试助手，只回复 JSON。' },
        { role: 'user', content: '请只输出 {"ok":true}' },
      ],
      { ...getLlmConfig(), maxTokens: 16, timeoutMs: Math.min(15000, getLlmConfig().timeoutMs) },
    );
    const j = parseJsonSafe<{ ok?: boolean }>(res);
    if (j && j.ok === true) return { ok: true, msg: '连接成功' };
    return { ok: true, msg: '已收到响应（模型未严格返回 JSON，但可通信）' };
  } catch (e) {
    return { ok: false, msg: '连接失败：' + (e instanceof Error ? e.message : String(e)) };
  }
}
