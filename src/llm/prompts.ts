/* ==================== 大模型接管：Prompt 构造 ==================== */
import type { ChoiceOption, Player } from '../core/types';
import { G } from '../game/state';
import { ROLES } from '../data/characters';
import { FACTIONS } from '../data/factions';
import type { LlmDecisionKind, LlmMessage } from './types';

const ROLE_OBJ: Record<string, string> = {
  lord: '主公方（含主公与忠臣，目标：消灭所有反贼与内奸）',
  loyal: '忠臣（辅佐主公，目标：消灭反贼与内奸，保护主公）',
  rebel: '反贼（目标：最先击杀主公）',
  spy: '内奸（目标：先帮主公方清场，最后单挑主公获胜）',
};

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
  if (p.equip.weapon) eq.push('武器:' + p.equip.weapon.name);
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

/** 其他角色公开信息（绝不泄露未揭示身份，只给可见线索） */
function othersView(idx: number): string {
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
    lines.push(
      `座位${i} ${p.name}（${FACTIONS[p.faction].name}）体力:${p.hp}/${p.maxHp} 手牌数:${p.hand.length} 装备:${eq.join(',') || '无'} ${role}`,
    );
  }
  return lines.join('\n');
}

const SYSTEM_BASE =
  '你是桌游《学堂杀》（三国杀-like 学科阵营身份局）中一名由大模型驱动的 AI 玩家。' +
  '请基于当前局面与你的身份目标，做出最合理的决策。' +
  '你只能在给出的「可选动作」列表里选择，严格按要求的 JSON 格式输出，不要输出多余文字。' +
  '【进攻倾向】不要过度保守：只要手牌中有【杀】且攻击范围内存在敌对阵营（身份目标中的敌人）角色，' +
  '就应优先出【杀】打击，推进你的阵营目标；仅在确实没有任何收益（无牌可出 / 所有动作都会损害自己）时才选择「结束出牌」。' +
  '出【杀】后还需在弹出的「选择目标」中指定一名敌对角色，请务必完成这一步，不要中途取消。';

/**
 * 构造一次决策的 messages。
 * @param idx 决策者座位
 * @param kind 决策种类（用于微调引导语）
 * @param opts 合法选项（含 value 与 label）
 * @param instruction 该决策的具体引导语（如“选择【杀】的目标”）
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
    `${selfView(idx)}\n\n其他角色：\n${othersView(idx)}\n\n` +
    `【决策】${instruction}\n` +
    `可选动作（只能选其一，value 为内部标识）：\n${enumOpts}\n\n` +
    `请只输出 JSON：{"choice": <某一个 value>}` +
    (kind === 'counter' || kind === 'save'
      ? '（若认为不应行动，选择 value 为 "skip" 或 -1 的项；若无此类项则选表示不行动的选项）'
      : '') +
    '。不要解释。';
  return [
    { role: 'system', content: SYSTEM_BASE + '\n' + roleHint },
    { role: 'user', content: user },
  ];
}

/** 答题决策提示（是否参与参悟答题） */
export function buildQuizMessages(idx: number): LlmMessage[] {
  const p = G.players[idx];
  const user =
    `${selfView(idx)}\n\n其他角色：\n${othersView(idx)}\n\n` +
    `【决策】出牌前是否参与「参悟答题」？答对可多摸1张牌并获得学识奖励，答错无惩罚。\n` +
    `请只输出 JSON：{"quiz": true} 或 {"quiz": false}。不要解释。`;
  return [
    { role: 'system', content: SYSTEM_BASE + '\n' + `你的身份目标：${ROLE_OBJ[p.role] ?? '隐藏'}。` },
    { role: 'user', content: user },
  ];
}
