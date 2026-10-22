/* ==================== DOM / 工具 ==================== */

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(s: unknown): string {
  return String(s).replace(/[&<>"']/g, (c) => ESCAPE_MAP[c] ?? c);
}

/* ---------------- 无头模拟模式 ----------------
 * 开启后所有动画等待立即返回（scripts/balance.mjs 批量跑局用）。
 * 仅影响节奏，不改变任何结算逻辑。
 */
let SIM = false;
export function setSim(on: boolean): void {
  SIM = !!on;
}
export function isSim(): boolean {
  return SIM;
}
export function sleep(ms: number): Promise<void> {
  if (SIM) return Promise.resolve();
  return new Promise((r) => setTimeout(r, ms));
}

/** 读取输入框 value（原版散落的 getElementById(...).value 统一收口） */
export function inputValue(id: string): string {
  const el = document.getElementById(id) as HTMLInputElement | null;
  return el?.value ?? '';
}

export function togglePanel(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('collapsed');
  const btn = el.querySelector<HTMLElement>('.panel-toggle');
  if (btn) btn.textContent = el.classList.contains('collapsed') ? '▸' : '▾';
}
