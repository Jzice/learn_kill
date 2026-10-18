// 界面主题：光线模式（白天/夜晚/黄昏）× 内置配色风格（鎏金/墨青/赤焰/紫宸/雪松/黛蓝）
// 仅通过 body[data-mode] / body[data-theme] 覆盖 CSS 语义变量，无需重渲染
import { PROFILE, saveProfile } from '../profile/profile';

export type ThemeMode = 'day' | 'night' | 'dusk';
export type ThemeStyle = 'gold' | 'teal' | 'red' | 'purple' | 'green' | 'blue';

export const THEME_MODES: { id: ThemeMode; label: string }[] = [
  { id: 'day', label: '☀️ 白天' },
  { id: 'night', label: '🌙 夜晚' },
  { id: 'dusk', label: '🌇 黄昏' },
];

export const THEME_STYLES: { id: ThemeStyle; label: string; sw: string }[] = [
  { id: 'gold', label: '鎏金', sw: '#f5c542' },
  { id: 'teal', label: '墨青', sw: '#2bbfa8' },
  { id: 'red', label: '赤焰', sw: '#ff6b4a' },
  { id: 'purple', label: '紫宸', sw: '#b07cff' },
  { id: 'green', label: '雪松', sw: '#5fd07a' },
  { id: 'blue', label: '黛蓝', sw: '#4aa8ff' },
];

/** 将当前 Profile 中的主题偏好写入 body 属性，触发 CSS 变量覆盖 */
export function applyTheme(): void {
  const mode = (['day', 'night', 'dusk'] as const).includes(PROFILE.themeMode as ThemeMode)
    ? PROFILE.themeMode
    : 'night';
  const style = THEME_STYLES.some((t) => t.id === PROFILE.themeStyle) ? PROFILE.themeStyle : 'gold';
  document.body.dataset.mode = mode;
  document.body.dataset.theme = style;
  markActive();
}

function markActive(): void {
  document.querySelectorAll('#themePanel .theme-mode').forEach((b) =>
    b.classList.toggle('active', (b as HTMLElement).dataset.mode === PROFILE.themeMode),
  );
  document.querySelectorAll('#themePanel .theme-style').forEach((b) =>
    b.classList.toggle('active', (b as HTMLElement).dataset.style === PROFILE.themeStyle),
  );
}

export function setThemeMode(m: string): void {
  if (!(THEME_MODES as { id: string }[]).some((t) => t.id === m)) return;
  PROFILE.themeMode = m as ThemeMode;
  saveProfile();
  applyTheme();
}

export function setThemeStyle(s: string): void {
  if (!THEME_STYLES.some((t) => t.id === s)) return;
  PROFILE.themeStyle = s as ThemeStyle;
  saveProfile();
  applyTheme();
}

export function openThemePanel(): void {
  const p = document.getElementById('themePanel');
  if (!p) return;
  // 避免与通知面板重叠
  document.getElementById('notifyPanel')?.classList.remove('show');
  const show = !p.classList.contains('show');
  p.classList.toggle('show', show);
  if (show) markActive();
}

export function closeThemePanel(): void {
  document.getElementById('themePanel')?.classList.remove('show');
}
