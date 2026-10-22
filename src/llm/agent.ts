/* ==================== 大模型接管：决策路由 ====================
 * 本模块把大模型作为「决策提供者」插入现有 AI 决策链：
 *  - 仅在座位 aiMode==='llm' 且配置可用时调用模型；
 *  - 任何异常/超时/非法输出都 try/catch 后回退原启发式，保证零死锁；
 *  - 模型结果经二次校验（选项必须存在）后再交引擎执行。
 * 全部为函数体内调用，无顶层副作用，符合 AGENTS.md 模块循环约束。
 */
import type { ChoiceOption } from '../core/types';
import { G } from '../game/state';
import { addLog } from '../game/log';
import { render } from '../ui/render';
import { callLlm, parseJsonSafe } from './client';
import { buildDecisionMessages, buildQuizMessages } from './prompts';
import { llmReady, llmDebug } from './config';
import type { LlmDecisionKind } from './types';
import { aiQuiz } from '../game/ai';
import { aiQuizRate, aiShouldCounter, aiShouldSave } from '../game/aibrain';

export { llmReady } from './config';

/** Debug 日志：仅在配置开启 debug 时打印大模型决策过程（输出到对局战报） */
function dbg(idx: number, tag: string, info: string): void {
  if (!llmDebug()) return;
  addLog(`🤖[LLM·座位${idx}] ${tag}: ${info}`, 'sys');
}

/** 在「思考中」状态下执行模型调用（设置/清除 G.thinkingSeat 触发 UI 指示） */
async function withThinking<T>(idx: number, fn: () => Promise<T>): Promise<T> {
  G.thinkingSeat = idx;
  try {
    render();
  } catch {
    /* 渲染失败不阻塞决策 */
  }
  try {
    return await fn();
  } finally {
    if (G.thinkingSeat === idx) {
      G.thinkingSeat = null;
      try {
        render();
      } catch {
        /* ignore */
      }
    }
  }
}

function instructionFor(kind: LlmDecisionKind): string {
  switch (kind) {
    case 'play':
      return '出牌阶段：选择你要执行的动作（或结束出牌）。只要手中有【杀】且场上有可攻击的敌对目标，应优先出【杀】打击；技能通常需要答题才能发动。';
    case 'target':
      return '选择一个目标座位（value 为座位号，-1 表示取消/不选择）。出【杀】或锦囊时务必选定一名敌对角色，不要选 -1 取消。';
    case 'discard':
      return '选择要弃置的牌。';
    case 'rescue':
      return '濒死：选择自救方式（无【桃】则放弃）。';
    case 'shan':
      return '需要出【闪】：选择手牌中的【闪】。';
    default:
      return '请选择一项。';
  }
}

/**
 * 让模型在给定合法选项中做一次选择。
 * 成功返回选项 value；任何失败返回 null（由调用方回退）。
 */
export async function llmChooseAction(
  idx: number,
  opts: ChoiceOption[],
  kind: LlmDecisionKind,
): Promise<string | number | null> {
  if (!llmReady()) {
    dbg(idx, '未就绪', `kind=${kind}，回退 null（配置未开启或缺失 baseURL/model）`);
    return null;
  }
  const valid = opts.filter((o) => !o.disabled);
  if (!valid.length) {
    dbg(idx, '无合法选项', `kind=${kind}`);
    return null;
  }
  const messages = buildDecisionMessages(idx, kind, opts, instructionFor(kind));
  try {
    const text = await withThinking(idx, () => callLlm(messages));
    const j = parseJsonSafe<{ choice?: string | number }>(text);
    if (!j || j.choice === undefined) {
      dbg(idx, '解析失败', `kind=${kind} 原始输出=${JSON.stringify((text || '').slice(0, 200))}`);
      return null;
    }
    const v = j.choice;
    const found = valid.find((o) => String(o.value) === String(v) || o.value === v);
    if (found) {
      dbg(idx, '已选择', `kind=${kind} → ${JSON.stringify(found.value)}（${found.label}）`);
      return found.value;
    }
    // 允许模型用 "skip" / -1 表达「不行动」，映射到取消项
    if (String(v) === 'skip' || v === -1) {
      const cancel = opts.find((o) => o.value === -1 || String(o.value) === 'skip');
      dbg(idx, '选择取消', `kind=${kind} 模型返回 ${JSON.stringify(v)} → ${cancel ? JSON.stringify(cancel.value) : 'null'}`);
      return cancel ? cancel.value : null;
    }
    dbg(idx, '非法选择', `kind=${kind} 模型返回 ${JSON.stringify(v)} 不在合法选项中`);
    return null;
  } catch (e) {
    dbg(idx, '调用异常', `kind=${kind} ${(e instanceof Error ? e.message : String(e)).slice(0, 200)}`);
    return null;
  }
}

/** 通用布尔决策（用于无懈可击 / 救援），返回 null 表示失败 */
async function llmDecideBool(idx: number, instruction: string): Promise<boolean | null> {
  if (!llmReady()) return null;
  const opts: ChoiceOption[] = [
    { label: '行动', value: 'use' },
    { label: '不行动', value: 'skip' },
  ];
  const messages = buildDecisionMessages(idx, 'list', opts, instruction);
  try {
    const text = await withThinking(idx, () => callLlm(messages));
    const j = parseJsonSafe<{ choice?: string | number }>(text);
    if (!j) return null;
    return String(j.choice) === 'use';
  } catch {
    return null;
  }
}

/** 无懈可击决策；失败回退原启发式 */
export async function llmShouldCounter(
  pid: number,
  srcIdx: number,
  countered: boolean,
  sub: string,
  primary: number | null,
  lastCounterer: number,
): Promise<boolean> {
  const src = G.players[srcIdx]?.name || '某人';
  const trickName = trickZh(sub);
  const harm = primary === pid ? '该锦囊直接指向你（对你有害）' : '该锦囊不直接指向你';
  const instr = `是否打出【无懈可击】抵消【${trickName}】？来源：${src}。${harm}。${countered ? '该锦囊已被他人无懈过一次。' : ''}`;
  const r = await llmDecideBool(pid, instr);
  if (r === null) {
    dbg(pid, '无懈回退', `【${trickName}】→ 原启发式`);
    return aiShouldCounter(pid, srcIdx, countered, sub, primary, lastCounterer);
  }
  dbg(pid, '无懈决策', `【${trickName}】→ ${r ? '打出' : '不无懈'}`);
  if (r === false) addLog(`${G.players[pid]?.name || 'AI'} 经大模型判断不无懈`, 'sys');
  return r;
}

/** 救援决策；失败回退原启发式（意愿 >0 视为救） */
export async function llmShouldSave(hIdx: number, dIdx: number): Promise<boolean> {
  const h = G.players[hIdx];
  const d = G.players[dIdx];
  if (!h || !d) return false;
  const instr = `角色 ${d.name} 正处于濒死（体力 ${d.hp}），你是否使用手牌【桃】救援？考虑你的身份目标与阵营关系。`;
  const r = await llmDecideBool(hIdx, instr);
  if (r === null) {
    dbg(hIdx, '救援回退', `救 ${d.name} → 原启发式`);
    return aiShouldSave(hIdx, dIdx) > 0;
  }
  dbg(hIdx, '救援决策', `救 ${d.name} → ${r ? '救援' : '不救'}`);
  if (r === false) addLog(`${h.name} 经大模型判断不救援`, 'sys');
  return r;
}

/** 答题参与决策；失败回退原启发式（按角色体力动态概率） */
export async function llmQuizDecide(idx: number): Promise<boolean> {
  const p = G.players[idx];
  if (!p) return false;
  if (!llmReady()) {
    dbg(idx, '答题回退', '配置未就绪 → 原启发式');
    return aiQuiz(aiQuizRate(p));
  }
  try {
    const text = await withThinking(idx, () => callLlm(buildQuizMessages(idx)));
    const j = parseJsonSafe<{ quiz?: boolean }>(text);
    if (!j || typeof j.quiz !== 'boolean') {
      dbg(idx, '答题解析失败', `原始输出=${JSON.stringify((text || '').slice(0, 200))} → 原启发式`);
      return aiQuiz(aiQuizRate(p));
    }
    dbg(idx, '答题决策', `→ ${j.quiz ? '参悟' : '不参悟'}`);
    return j.quiz;
  } catch (e) {
    dbg(idx, '答题异常', `${(e instanceof Error ? e.message : String(e)).slice(0, 200)} → 原启发式`);
    return aiQuiz(aiQuizRate(p));
  }
}

function trickZh(sub: string): string {
  const m: Record<string, string> = {
    guohe: '过河拆桥',
    shunshou: '顺手牵羊',
    juedou: '决斗',
    lebu: '乐不思蜀',
    huogong: '火攻',
    tiesuo: '铁索连环',
    nanman: '南蛮入侵',
    wanjian: '万箭齐发',
    taoyuan: '桃园结义',
    wuzhong: '无中生有',
    wugu: '五谷丰登',
  };
  return m[sub] || sub;
}
