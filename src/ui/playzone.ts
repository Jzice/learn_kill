/* ==================== 出牌区 ==================== */
import type { PlayCardView } from '../core/types';

/** 重置出牌区；小屏时战报面板被移入区内，必须保留 */
function zoneReset(z: HTMLElement): void {
  if (!z.querySelector('.play-log-panel')) {
    z.innerHTML = '<div class="play-zone-label">出 牌 区</div><span class="play-zone-empty">— 牌桌中央 —</span>';
    return;
  }
  z.querySelectorAll('.play-card').forEach((c) => c.remove());
  if (!z.querySelector('.play-zone-label'))
    z.insertAdjacentHTML('afterbegin', '<div class="play-zone-label">出 牌 区</div>');
  if (!z.querySelector('.play-zone-empty')) {
    const empty = document.createElement('span');
    empty.className = 'play-zone-empty';
    empty.textContent = '— 牌桌中央 —';
    z.insertBefore(empty, z.querySelector('.play-log-panel'));
  }
}

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
  const log = z.querySelector('.play-log-panel');
  if (log) z.insertBefore(e, log);
  else z.appendChild(e);
  setTimeout(() => {
    e.classList.add('fade-out');
    setTimeout(() => {
      if (e.parentNode) e.parentNode.removeChild(e);
      if (z.querySelectorAll('.play-card').length === 0) zoneReset(z);
    }, 420);
  }, 2200);
}

export function clearPlayZone(): void {
  const z = document.getElementById('playZoneCards');
  if (z) zoneReset(z);
}
