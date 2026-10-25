/* ==================== 回合倒计时显示 ====================
 * 房主权威计时：G.timerEnd 随 state_sync 下发，房主端与客人端共用同一个截止时间戳，
 * 因此两端都能看到一致的剩余秒数（客人端不做本地计时，只做显示）。
 */
import { G } from '../game/state';

let ticker: ReturnType<typeof setInterval> | null = null;

/** 启动倒计时刷新（每 250ms 更新一次剩余秒数） */
export function initTimerTicker(): void {
  if (ticker) return;
  ticker = setInterval(() => {
    const el = document.getElementById('timerChip');
    const qel = document.getElementById('quizTimer');
    if (!el && !qel) return;
    if (!G.timerOn || !G.timerEnd) {
      if (el && el.textContent) {
        el.textContent = '';
        el.className = 'timer-chip';
      }
      if (qel && qel.textContent) qel.textContent = '';
      return;
    }
    const left = Math.max(0, Math.floor((G.timerEnd - Date.now()) / 1000));
    const txt = `⏱ ${left}s`;
    if (el) {
      if (el.textContent !== txt) el.textContent = txt;
      el.className = 'timer-chip' + (left <= 5 ? ' urgent' : '');
    }
    if (qel) {
      if (qel.textContent !== txt) qel.textContent = txt;
      qel.className = 'quiz-timer' + (left <= 5 ? ' urgent' : '');
    }
  }, 250);
}
