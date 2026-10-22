/* ==================== 大模型接管：Prompt 构造 ====================
 * 一次决策的上下文由以下各段拼装（详见 docs/AI机制.md §3.3）：
 *   system ：角色设定 + 输出契约 + 进攻倾向纠偏 + 身份目标
 *   user   ：① 自身视角（私有信息：手牌 / 装备 / 技能 / 体力 / 自己的身份）
 *            ② 他人视角（严格公开信息 + 距离与可攻击标记）
 *            ③ 信念摘要（对各座位身份的推断概率，来自 aibrain）
 *            ④ 恩怨摘要（谁攻击过你 / 谁救过你）
 *            ⑤ 近期战报（谁对谁做了什么）
 *            ⑥ 决策引导语 + 枚举选项 + 输出格式要求
 *
 * 信息不对称是硬约束：② 中绝不泄露他人手牌内容与未揭示身份。
 * 上下文为「无状态全量重述」——不保留多轮对话，跨回合记忆由 ③④⑤ 显式注入。
 */
import type { ChoiceOption, LogEntry, Player } from '../core/types';
import { G } from '../game/state';
import { ROLES } from '../data/characters';
import { FACTIONS } from '../data/factions';
import { attackRange, distBetween, inRange } from '../game/rules';
import { beliefProbs, favorOf, grudgeOf } from '../game/aibrain';
import { playLog } from '../game/log';
import type { LlmDecisionKind, LlmMessage } from './types';

const ROLE_OBJ: Record<string, string> = {
  lord: '主公方（含主公与忠臣，目标：消灭所有反贼与内奸）',
  loyal: '忠臣（辅佐主公，目标：消灭反贼与内奸，保护主公）',
  rebel: '反贼（目标：最先击杀主公）',
  spy: '内奸（目标：先帮主公方清场，最后单挑主公获胜）',
};

/** 战报摘要条数上限（控制 token；太多会稀释当前局面） */
const HISTORY_LINES = 12;
/** 信念摘要中低于该概率的身份不展示，避免噪声 */
const BELIEF_MIN = 0.15;

function pubRole(p: Player): string {
  if (p.roleRevealed) return ROLES[p.role].name;
  return '隐藏（未亮明）';
}

/** 决策者的自身视角（手牌/装备/体力/身份均为其已知信息） */
function selfView(idx: number): string {
  const p = G.players[idx];
  const hand = p.hand
    .map((c) => `「${c.name}」${c.suit}${c.num}${c.sub ? `[${c.sub}]` : ''}`)
    .join('、');
  const eq: string[] = [];
  if (p.equip.weapon) eq.push('武器:' + p.equip.weapon.name + `(攻击范围${attackRange(p)})`);
  if (p.equip.armor) eq.push('防具:' + p.equip.armor.name);
  if (p.equip.horsePlus) eq.push('+1马:' + p.equip.horsePlus.name);
  if (p.equip.horseMinus) eq.push('-1马:' + p.equip.horseMinus.name);
  const skills = p.skills.map((s) => s.name).join('、') || '无';
  const roleTxt =
    p.roleRevealed || true // 玩家始终知道自己的身份
      ? ROLES[p.role].name + '（' + ROLE_OBJ[p.role] + '）'
      : '隐藏';
  return [
    `【你】${p.name}（${FACTIONS[p.faction].name}阵营 · 角色${p.charId}）`,
    `身份：${roleTxt}`,
    `体力：${p.hp}/${p.maxHp}　手牌数：${p.hand.length}`,
    `装备：${eq.length ? eq.join('，') : '无'}`,
    `技能：${skills}`,
    `手牌：${hand || '（空）'}`,
  ].join('\n');
}

/**
 * 其他角色公开信息（绝不泄露未揭示身份，只给可见线索）。
 * 额外注入「距离 / 是否在攻击范围内」——这是模型判断「能不能打到」的必要信息，
 * 缺失时模型会因不确定而过度保守（总选「结束出牌」）。
 */
function othersView(idx: number): string {
  const me = G.players[idx];
  const range = attackRange(me);
  const lines: string[] = [];
  for (let i = 0; i < G.players.length; i++) {
    if (i === idx) continue;
    const p = G.players[i];
    if (!p.alive) {
      lines.push(`座位${i} ${p.name}：已阵亡`);
      continue;
    }
    const eq: string[] = [];
    if (p.equip.weapon) eq.push('武器');
    if (p.equip.armor) eq.push('防具');
    if (p.equip.horsePlus) eq.push('+1马');
    if (p.equip.horseMinus) eq.push('-1马');
    const role = p.roleRevealed ? `身份:${ROLES[p.role].name}` : '身份:隐藏';
    const dOut = distBetween(idx, i);
    const dIn = distBetween(i, idx);
    const reach = inRange(idx, i)
      ? `✅在你攻击范围内（你的攻击范围${range}，距离${dOut}）`
      : `✖超出攻击范围（你的攻击范围${range}，距离${dOut}）`;
    lines.push(
      `座位${i} ${p.name}（${FACTIONS[p.faction].name}）体力:${p.hp}/${p.maxHp} 手牌数:${p.hand.length} 装备:${eq.join(',') || '无'} ${role} 你到他距离:${dOut} 他到你距离:${dIn} ${reach}`,
    );
  }
  return lines.join('\n');
}

/**
 * 信念摘要：把 aibrain 的身份推断概率注入上下文。
 * 这让大模型具备与启发式 AI 同等的「打谁」依据，而不是只能按体力/手牌数瞎猜。
 */
function beliefView(idx: number): string {
  const lines: string[] = [];
  for (let i = 0; i < G.players.length; i++) {
    if (i === idx) continue;
    const p = G.players[i];
    if (!p.alive || p.roleRevealed) continue; // 已公开者无需推断
    const pr = beliefProbs(idx, i);
    const keys = Object.keys(pr) as Array<keyof typeof pr>;
    const top = keys
      .map((k) => ({ k, v: pr[k] }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 2)
      .filter((x) => x.v >= BELIEF_MIN);
    if (!top.length) continue;
    const txt = top.map((x) => `${ROLES[x.k].name} ${Math.round(x.v * 100)}%`).join(' / ');
    lines.push(`  座位${i} ${p.name}：疑似 ${txt}`);
  }
  if (!lines.length) return '';
  return '你的身份推断（依据近期行为观察，不是确定事实）：\n' + lines.join('\n');
}

/** 恩怨摘要：谁攻击过你 / 谁救过你（互惠性线索） */
function grudgeView(idx: number): string {
  const parts: string[] = [];
  for (let i = 0; i < G.players.length; i++) {
    if (i === idx) continue;
    const g = grudgeOf(idx, i);
    const f = favorOf(idx, i);
    if (!g && !f) continue;
    const seg: string[] = [];
    if (g) seg.push(`攻击过你${g}次`);
    if (f) seg.push(`救过你${f}次`);
    parts.push(`${G.players[i].name}（座位${i}）${seg.join('、')}`);
  }
  if (!parts.length) return '';
  return '恩怨：' + parts.join('；') + '。';
}

/** 战报条目渲染为一行纯文本（与 UI 渲染口径一致，去掉 HTML） */
function renderLogLine(l: LogEntry): string {
  switch (l.action) {
    case 'log':
      return String(l.text || '');
    case 'use':
      return `${l.fromName} 使用【${l.cardName}】${l.toName ? ' → ' + l.toName : ''}`;
    case 'damage':
      return `${l.toName} 受到 ${l.cardName} 点伤害`;
    case 'heal':
      return `${l.toName} 回复 ${l.cardName} 点体力`;
    case 'skill':
      return `${l.fromName} 发动【${l.cardName}】`;
    case 'reward':
      return `${l.fromName} 获得 ${l.cardName}`;
    case 'faction':
      return `${l.fromName} ${l.cardName}`;
    case 'kp':
      return `${l.fromName} 答对【${l.cardName}】`;
    case 'sys':
      return String(l.text || '');
    default:
      return '';
  }
}

/**
 * 近期战报摘要：让模型看到「谁对谁做了什么」。
 * 过滤掉大模型自身的 debug 日志，避免污染上下文。
 */
function historyView(): string {
  const lines: string[] = [];
  for (const l of playLog) {
    const t = renderLogLine(l);
    if (!t) continue;
    if (t.includes('🤖[LLM')) continue; // 排除大模型 debug 输出
    lines.push(t);
  }
  const recent = lines.slice(-HISTORY_LINES);
  if (!recent.length) return '';
  return '近期战报（按时间顺序）：\n' + recent.map((t) => '  ' + t).join('\n');
}

/** 局面段：自身 + 他人 + 信念 + 恩怨 + 战报，按顺序拼接（缺省段落自动跳过） */
function situationView(idx: number): string {
  const segs = [
    selfView(idx),
    '其他角色：\n' + othersView(idx),
    beliefView(idx),
    grudgeView(idx),
    historyView(),
  ].filter(Boolean);
  return segs.join('\n\n');
}

const SYSTEM_BASE =
  '你是桌游《学堂杀》（三国杀-like 学科阵营身份局）中一名由大模型驱动的 AI 玩家。' +
  '请基于当前局面与你的身份目标，做出最合理的决策。' +
  '你只能在给出的「可选动作」列表里选择，严格按要求的 JSON 格式输出，不要输出多余文字。' +
  '【进攻倾向】不要过度保守：只要手牌中有【杀】且攻击范围内存在敌对阵营（身份目标中的敌人）角色，' +
  '就应优先出【杀】打击，推进你的阵营目标；仅在确实没有任何收益（无牌可出 / 所有动作都会损害自己）时才选择「结束出牌」。' +
  '出【杀】后还需在弹出的「选择目标」中指定一名敌对角色，请务必完成这一步，不要中途取消。';

/** 输出格式示例（few-shot，稳定 JSON 形态、降低「自由发挥」概率） */
const FORMAT_EXAMPLES =
  '【输出格式示例】\n' +
  '· 要出某张杀（选项 value 为 "sha_417"）→ {"choice":"sha_417"}\n' +
  '· 要结束出牌（选项 value 为 "end"）→ {"choice":"end"}\n' +
  '· 要选择座位 2 为目标 → {"choice":2}\n' +
  '· 不打算行动（选项 value 为 "skip"）→ {"choice":"skip"}\n' +
  'value 必须与「可选动作」列表中的某一项完全一致（数字不要加引号，字符串必须加引号）。';

/**
 * 构造一次决策的 messages。
 * @param idx 决策者座位
 * @param kind 决策种类（用于微调引导语）
 * @param opts 合法选项（含 value 与 label）
 * @param instruction 该决策的具体引导语（如"选择【杀】的目标"）
 */
export function buildDecisionMessages(
  idx: number,
  kind: LlmDecisionKind,
  opts: ChoiceOption[],
  instruction: string,
): LlmMessage[] {
  const p = G.players[idx];
  const roleHint = `你的身份目标：${ROLE_OBJ[p.role] ?? '隐藏'}。优先保护自己阵营、打击敌对阵营。`;
  const enumOpts = opts
    .map((o, i) => `${i + 1}. [value=${JSON.stringify(o.value)}] ${o.label}${o.disabled ? '（当前不可用）' : ''}`)
    .join('\n');
  const user =
    `${situationView(idx)}\n\n` +
    `【决策】${instruction}\n` +
    `可选动作（只能选其一，value 为内部标识）：\n${enumOpts}\n\n` +
    `请只输出 JSON：{"choice": <某一个 value>}` +
    (kind === 'counter' || kind === 'save'
      ? '（若认为不应行动，选择 value 为 "skip" 或 -1 的项；若无此类项则选表示不行动的选项）'
      : '') +
    '。不要解释。';
  return [
    { role: 'system', content: SYSTEM_BASE + '\n' + FORMAT_EXAMPLES + '\n' + roleHint },
    { role: 'user', content: user },
  ];
}

/**
 * 出牌阶段「回合级规划」提示：一次请求让模型给出多步动作序列。
 * 把原本每步一次请求的开销压到每回合 1~2 次（引擎仍逐步校验，失效步骤自动跳过）。
 */
export function buildPlanMessages(idx: number, opts: ChoiceOption[], maxSteps: number): LlmMessage[] {
  const p = G.players[idx];
  const roleHint = `你的身份目标：${ROLE_OBJ[p.role] ?? '隐藏'}。优先保护自己阵营、打击敌对阵营。`;
  const enumOpts = opts
    .map((o, i) => `${i + 1}. [value=${JSON.stringify(o.value)}] ${o.label}${o.disabled ? '（当前不可用）' : ''}`)
    .join('\n');
  const user =
    `${situationView(idx)}\n\n` +
    `【决策】出牌阶段：请一次性规划本回合你打算依次执行的动作序列（最多 ${maxSteps} 步）。\n` +
    `注意：执行过程中手牌与局面会变化，若某步届时已不可用会被自动跳过。\n` +
    `可选动作（value 为内部标识）：\n${enumOpts}\n\n` +
    `请只输出 JSON：{"actions": [<value1>, <value2>, ...]}（最多 ${maxSteps} 项）；` +
    `若打算直接结束出牌，输出 {"actions":["end"]}。不要解释。`;
  return [
    { role: 'system', content: SYSTEM_BASE + '\n' + FORMAT_EXAMPLES + '\n' + roleHint },
    { role: 'user', content: user },
  ];
}

/** 答题决策提示（是否参与参悟答题） */
export function buildQuizMessages(idx: number): LlmMessage[] {
  const p = G.players[idx];
  const user =
    `${situationView(idx)}\n\n` +
    `【决策】出牌前是否参与「参悟答题」？答对可多摸1张牌并获得学识奖励，答错无惩罚。\n` +
    `请只输出 JSON：{"quiz": true} 或 {"quiz": false}。不要解释。`;
  return [
    { role: 'system', content: SYSTEM_BASE + '\n' + `你的身份目标：${ROLE_OBJ[p.role] ?? '隐藏'}。` },
    { role: 'user', content: user },
  ];
}
