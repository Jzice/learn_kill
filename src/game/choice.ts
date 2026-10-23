/* ==================== 选择等待（Promise 桥接本地/远程玩家） ==================== */
import type { ChoiceOption, PendingType } from '../core/types';
import { G } from './state';
import { isSim } from '../core/dom';
import { Sound } from '../core/sound';
import { addLog } from './log';
import { render } from '../ui/render';
import { NET, isLocalPlayer, syncStateToClients, syncTimerToClients } from '../net/network';
import { defaultChoiceFor, timerActionText, timerEnabled, timerSec } from './timer';

/** 当前决策环节的计时器（房主权威；本地单人即为自己） */
let choiceTimer: ReturnType<typeof setTimeout> | null = null;

function clearChoiceTimer(): void {
  if (choiceTimer) {
    clearTimeout(choiceTimer);
    choiceTimer = null;
  }
  if (G.timerEnd) G.timerEnd = null;
}

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
    // 无头模拟模式：所有选择自动按默认规则结算（技能发动按 AI 概率 0.62），避免批量对战卡死
    if (isSim()) {
      const yesOpt = options.find((o) => String(o.value) === 'yes');
      if (yesOpt) {
        resolve(Math.random() < 0.62 ? 'yes' : 'no');
      } else {
        resolve(defaultChoiceFor(type, options));
      }
      return;
    }
    G.pendingOptions = options;
    G.pendingType = type;
    G.pendingPlayer = playerIdx;
    G.pendingResolve = resolve;
    // 回合限时：真人玩家的每个决策环节独立计时，超时按默认规则自动处理并跳到下一步
    //（AI 不计时；联机由房主为所有真人玩家计时，倒计时随 state_sync / timer_sync 下发到客人端）
    if (timerEnabled() && !p.isAI) {
      const ms = timerSec() * 1000;
      G.timerEnd = Date.now() + ms;
      choiceTimer = setTimeout(() => {
        choiceTimer = null;
        G.timerEnd = null;
        if (G.pendingResolve !== resolve) return;
        const v = defaultChoiceFor(type, options);
        const who = G.players[playerIdx]?.name || '玩家';
        addLog(`⏱ ${who} 超时未决策，自动${timerActionText(type)}`, 'sys');
        resolveChoice(v);
      }, ms);
    }
    if (isLocalPlayer(playerIdx)) {
      render();
      // 房主自己出牌：pendingOptions 是房主自己的，不能下发；改发 timer_sync 让客人端显示房主倒计时
      if (NET.isHost) syncTimerToClients();
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
  clearChoiceTimer();
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
