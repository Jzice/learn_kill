/* ==================== 回合限时（开局选项） ====================
 * 开启后，真人玩家的每个决策环节（出牌 / 出闪 / 濒死 / 弃牌 / 目标选择 / 无懈响应 / 答题）
 * 各自独立计时；超时按该环节的默认规则自动处理并跳到下一步。
 * AI 回合本来就瞬时完成，不计时。联机由房主统一计时，倒计时随 state_sync 下发给客人端显示。
 */
import type { ChoiceOption, PendingType } from '../core/types';
import { G } from './state';

/** 可选限时档位 */
export const TIMER_OPTIONS: { sec: number; label: string }[] = [
  { sec: 10, label: '10 秒' },
  { sec: 20, label: '20 秒' },
  { sec: 30, label: '30 秒' },
];
export const DEFAULT_TIMER_SEC = 20;

export function timerEnabled(): boolean {
  return !!G.timerOn;
}

export function timerSec(): number {
  return G.timerSec || DEFAULT_TIMER_SEC;
}

/** 超时代入的默认动作文案（战报用） */
export function timerActionText(type: PendingType): string {
  switch (type) {
    case 'play':
      return '结束出牌';
    case 'target':
      return '取消选择';
    case 'shan':
      return '承受伤害';
    case 'rescue':
      return '放弃自救';
    case 'discard':
      return '弃置一张手牌';
    default:
      return '放弃响应';
  }
}

/**
 * 超时默认处理：优先取该环节的「放弃 / 取消 / 承受」语义项，取不到则取末项。
 * 出牌=结束出牌 · 目标=取消 · 出闪=承受伤害 · 濒死=放弃 · 弃牌=自动弃一张 · 其余=不响应
 */
export function defaultChoiceFor(type: PendingType, options: ChoiceOption[]): string | number {
  if (!options.length) return '';
  const last = options[options.length - 1].value;
  const has = (v: string | number): string | number | undefined =>
    options.find((o) => String(o.value) === String(v))?.value;
  const byLabel = (kws: string[]): string | number | undefined =>
    options.find((o) => kws.some((k) => o.label.includes(k)))?.value;
  switch (type) {
    case 'play':
      return has('end') ?? last;
    case 'target':
      return has(-1) ?? last;
    case 'shan':
      return has('none') ?? byLabel(['承受']) ?? last;
    case 'rescue':
      return has('giveup') ?? byLabel(['放弃']) ?? last;
    case 'discard':
      return options[0].value; // 自动弃置一张，循环继续直到满足手牌上限
    default:
      return byLabel(['取消', '不响应', '不发动', '跳过']) ?? last;
  }
}
