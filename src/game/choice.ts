/* ==================== 选择等待（Promise 桥接本地/远程玩家） ==================== */
import type { ChoiceOption, PendingType } from '../core/types';
import { G } from './state';
import { Sound } from '../core/sound';
import { render } from '../ui/render';
import { NET, isLocalPlayer, syncStateToClients } from '../net/network';

export function waitChoice(
  playerIdx: number,
  options: ChoiceOption[],
  type: PendingType = 'list',
): Promise<string | number> {
  return new Promise((resolve) => {
    const p = G.players[playerIdx];
    if (!p) {
      resolve(options[options.length - 1].value);
      return;
    }
    G.pendingOptions = options;
    G.pendingType = type;
    G.pendingPlayer = playerIdx;
    G.pendingResolve = resolve;
    if (isLocalPlayer(playerIdx)) {
      render();
    } else if (NET.isHost) {
      const send = (): void => {
        NET.sendToPlayer(p.peerId!, {
          type: 'choose_request',
          options,
          myPlayerIdx: G.players.indexOf(p),
          choiceType: type,
        });
      };
      send();
      // 心跳重发：远程玩家若因消息丢失看不到选择界面，房主仍在等待时会周期性补发，
      // 选择被响应后（pendingResolve 被清空）自动停止。纯幂等重发，不改变协议。
      let tries = 0;
      const timer = setInterval(() => {
        if (G.pendingResolve !== resolve || ++tries > 15) {
          clearInterval(timer);
          return;
        }
        send();
      }, 4000);
      render();
      syncStateToClients();
    } else render();
  });
}

export function resolveChoice(v: string | number): void {
  Sound.play('click');
  if (!G.pendingResolve) return;
  const r = G.pendingResolve;
  G.pendingResolve = null;
  G.pendingOptions = null;
  G.pendingPlayer = null;
  r(v);
  if (NET.isHost) syncStateToClients();
  render();
}

export function clientResolveChoice(v: string | number): void {
  Sound.play('click');
  if (!G.pendingOptions) return;
  G.pendingOptions = null;
  G.pendingPlayer = null;
  NET.sendToHost({ type: 'choose_response', value: v });
  render();
}

export function handleLocalChoice(v: string | number): void {
  if (NET.mode === 'join') clientResolveChoice(v);
  else resolveChoice(v);
}
