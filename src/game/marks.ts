/* ==================== 身份标记 ==================== */
import type { Role } from '../core/types';
import { G } from './state';
import { ROLE_ICON } from '../data/characters';
import { render } from '../ui/render';

export const ROLE_MARKS: Record<number, Role> = {};
let markTargetIdx: number | null = null;

export function openMarkMenu(idx: number): void {
  if (!G.started) return;
  const p = G.players[idx];
  if (!p) return;
  markTargetIdx = idx;
  document.getElementById('markTargetName')!.textContent = p.name;
  const opts = document.getElementById('markOptions')!;
  const cur = ROLE_MARKS[idx];
  opts.innerHTML = `
    ${cur ? `<button class="mark-btn clear" onclick="setMark(null)">✕ 清除当前标记</button>` : ''}
    <button class="mark-btn lord" onclick="setMark('lord')">${ROLE_ICON.lord} 主公</button>
    <button class="mark-btn loyal" onclick="setMark('loyal')">${ROLE_ICON.loyal} 忠臣</button>
    <button class="mark-btn rebel" onclick="setMark('rebel')">${ROLE_ICON.rebel} 反贼</button>
    <button class="mark-btn spy" onclick="setMark('spy')">${ROLE_ICON.spy} 内奸</button>
  `;
  document.getElementById('markModal')!.classList.add('show');
}

export function setMark(role: Role | null): void {
  if (markTargetIdx == null) return;
  if (role) ROLE_MARKS[markTargetIdx] = role;
  else delete ROLE_MARKS[markTargetIdx];
  closeMarkMenu();
  render();
}

export function closeMarkMenu(): void {
  markTargetIdx = null;
  document.getElementById('markModal')!.classList.remove('show');
}

export function clearRoleMarks(): void {
  Object.keys(ROLE_MARKS).forEach((k) => delete ROLE_MARKS[Number(k)]);
}
