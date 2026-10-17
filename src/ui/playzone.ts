/* ==================== 出牌区 ==================== */
import type { PlayCardView } from '../core/types';

export function showPlayCard(card: PlayCardView, ownerName: string, ownerColor: string): void {
  const z = document.getElementById('playZoneCards');
  if (!z) return;
  const em = z.querySelector('.play-zone-empty');
  if (em) em.remove();
  const isRed = card.suit === '♥' || card.suit === '♦';
  const cls = card.type === 'trick' ? 'trick' : card.type === 'equip' ? 'equip' : isRed ? 'red' : '';
  const e = document.createElement('div');
  e.className = 'play-card ' + cls;
  if (ownerColor) e.style.borderColor = ownerColor;
  e.innerHTML = `<span class="pcsuit">${card.suit}</span><span class="pcnum">${card.num}</span><span class="pcname">${card.name}</span><span class="pcowner">${ownerName || ''}</span>`;
  while (z.querySelectorAll('.play-card').length >= 4) {
    const f = z.querySelector('.play-card');
    if (f) f.remove();
  }
  z.appendChild(e);
  setTimeout(() => {
    e.classList.add('fade-out');
    setTimeout(() => {
      if (e.parentNode) e.parentNode.removeChild(e);
      if (z.querySelectorAll('.play-card').length === 0)
        z.innerHTML = '<div class="play-zone-label">出 牌 区</div><span class="play-zone-empty">— 牌桌中央 —</span>';
    }, 420);
  }, 2200);
}

export function clearPlayZone(): void {
  const z = document.getElementById('playZoneCards');
  if (z) z.innerHTML = '<div class="play-zone-label">出 牌 区</div><span class="play-zone-empty">— 牌桌中央 —</span>';
}
