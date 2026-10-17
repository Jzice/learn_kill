/* ==================== 卡牌点击 ==================== */
import type { Card } from '../core/types';
import { G } from '../game/state';
import { Sound } from '../core/sound';
import { handleLocalChoice } from '../game/choice';

export function isCardClickable(card: Card): boolean {
  if (!G.pendingOptions || G.pendingPlayer !== G.myPlayerIdx) return false;
  const type = G.pendingType;
  if (type === 'play')
    return G.pendingOptions.some(
      (o) =>
        o.value === `sha_${card.id}` ||
        o.value === `tao_${card.id}` ||
        o.value === `jiu_${card.id}` ||
        o.value === `trick_${card.id}` ||
        o.value === `equip_${card.id}`,
    );
  if (type === 'discard') return G.pendingOptions.some((o) => o.value === card.id || String(o.value) === String(card.id));
  if (type === 'rescue' || type === 'shan') return G.pendingOptions.some((o) => o.value === `card_${card.id}`);
  return false;
}

export function cardClickHint(card: Card): string {
  if (!G.pendingOptions || G.pendingPlayer !== G.myPlayerIdx) return '';
  const type = G.pendingType;
  if (type === 'discard' && isCardClickable(card)) return 'card-discard-hint';
  if (type === 'rescue' && isCardClickable(card)) return 'card-rescue-hint';
  if (type === 'shan' && isCardClickable(card)) return 'card-shan-hint';
  return '';
}

export function clickHandCard(cardId: number): void {
  if (!G.pendingOptions) return;
  const type = G.pendingType;
  let matched: string | number | null = null;
  if (type === 'play') {
    const vals = [`sha_${cardId}`, `tao_${cardId}`, `jiu_${cardId}`, `trick_${cardId}`, `equip_${cardId}`];
    matched = G.pendingOptions.find((o) => vals.includes(String(o.value)))?.value ?? null;
  } else if (type === 'discard') {
    matched = G.pendingOptions.find((o) => o.value === cardId || String(o.value) === String(cardId))?.value ?? null;
  } else if (type === 'rescue' || type === 'shan') {
    matched = G.pendingOptions.find((o) => o.value === `card_${cardId}`)?.value ?? null;
  }
  if (matched !== null) {
    Sound.play('click');
    handleLocalChoice(matched);
  }
}

export function clickTargetSeat(idx: number): void {
  if (!G.pendingOptions || G.pendingType !== 'target') return;
  const opt = G.pendingOptions.find((o) => o.value === idx);
  if (opt) {
    Sound.play('click');
    handleLocalChoice(idx);
  }
}
