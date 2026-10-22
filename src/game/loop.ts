/* ==================== 主循环 ==================== */
import { G } from './state';
import { sleep } from '../core/dom';
import { render } from '../ui/render';
import { runTurn } from './turn';

/** 对局序号：每次 gameLoop 启动自增。旧循环据此立即退出，避免「多循环并发驱动同一局」。 */
let loopSeq = 0;
/** 当前存活的主循环数（无头批量跑局据此等待上一局彻底收尾） */
let activeLoops = 0;

/** 当前存活的主循环数量（scripts/balance.mjs、scripts/ai-eval.mjs 等待收尾用） */
export function activeLoopCount(): number {
  return activeLoops;
}

export async function gameLoop(): Promise<void> {
  const mySeq = ++loopSeq;
  activeLoops++;
  try {
    while (!G.gameOver && mySeq === loopSeq) {
      const p = G.players[G.current];
      if (p.alive) await runTurn(G.current);
      // 上一局若在 runTurn 中途结束，本循环可能已「过期」——立即让位给新循环
      if (G.gameOver || mySeq !== loopSeq) break;
      let next = G.current;
      for (let k = 1; k <= G.players.length; k++) {
        const idx = (G.current + k) % G.players.length;
        if (G.players[idx].alive) {
          next = idx;
          break;
        }
      }
      G.current = next;
      await sleep(200);
    }
  } finally {
    activeLoops--;
  }
  render();
}
