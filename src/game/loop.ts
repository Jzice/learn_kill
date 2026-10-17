/* ==================== 主循环 ==================== */
import { G } from './state';
import { sleep } from '../core/dom';
import { render } from '../ui/render';
import { runTurn } from './turn';

export async function gameLoop(): Promise<void> {
  while (!G.gameOver) {
    const p = G.players[G.current];
    if (p.alive) await runTurn(G.current);
    if (G.gameOver) break;
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
  render();
}
