/* ==================== 一局结束结算（战绩 / 积分 / 新成就 / 重开） ==================== */
import { escapeHtml } from '../core/dom';
import { Sound } from '../core/sound';
import type { Player } from '../core/types';
import { ROLES, ROLE_ICON } from '../data/characters';
import { FACTIONS } from '../data/factions';
import { NET } from '../net/network';
import { G } from '../game/state';
import { victoryFx, type WinCamp } from '../core/fx';
import { clearPlayZone } from './playzone';
import { renderStudyPanel } from './study';
import { renderSetupSummary } from './lobby';
import { refreshProfileUI } from '../profile/profile';

export interface SettleInfo {
  win: boolean;
  gained: number;
  correct: number;
  total: number;
  newAch: { icon: string; name: string }[];
  score: number;
}

/** 获胜阵营（用于选择胜利动画）：主公 / 反贼 / 内奸；我方败北则为 lose */
export function winnerCamp(win: boolean): WinCamp {
  if (!win) return 'lose';
  if (G.winnerText === '内奸获胜') return 'spy';
  if (G.winnerText === '反贼获胜') return 'rebel';
  return 'lord';
}

/** 本局各玩家战绩行 */
function playerRows(): string {
  return G.players
    .map((p: Player) => {
      const role = ROLES[p.role];
      const f = FACTIONS[p.faction];
      const me = p.id === (G.myPlayerIdx ?? 0);
      const status = p.alive
        ? '<span style="color:#5fe08a">存活</span>'
        : `<span style="color:#c96">阵亡 · ${escapeHtml(role.name)}</span>`;
      return `<tr class="${me ? 'me' : ''}">
        <td>${escapeHtml(p.identity?.avatar || '👤')} ${escapeHtml(p.name)}${me ? ' <span class="sd-me">我</span>' : ''}</td>
        <td>${p.roleRevealed ? escapeHtml(role.name) : '<span style="color:var(--muted)">???</span>'}</td>
        <td style="color:${f.color}">${escapeHtml(f.name)}</td>
        <td>${status}</td>
        <td>${p.knowledge}</td>
        <td>${p.maxCombo || 0}</td>
        <td>${p.hp}/${p.maxHp}</td>
      </tr>`;
    })
    .join('');
}

/** 渲染并展示结算面板 */
export function showSettle(info: SettleInfo): void {
  const box = document.getElementById('settleBody');
  const modal = document.getElementById('settleModal');
  if (!box || !modal) return;
  const me = G.players[G.myPlayerIdx ?? 0];
  const camp = winnerCamp(info.win);
  const role = me ? ROLES[me.role] : null;
  const rate = info.total > 0 ? Math.round((info.correct / info.total) * 100) : 0;
  const net = NET.mode === 'host' || NET.mode === 'join';
  const heroTitle = info.win ? '胜利！' : '败北';
  const heroSub = info.win
    ? camp === 'lord'
      ? '忠臣护卫有功，主公登基'
      : camp === 'rebel'
        ? '义旗所指，檄告天下'
        : '鹬蚌相争，渔翁得利'
    : '胜败乃兵家常事，再接再厉';

  box.innerHTML = `
    <div id="settleHero" class="settle-hero ${camp}">
      <div class="sh-text"><div class="sh-title">${heroTitle}</div><div class="sh-sub">${escapeHtml(G.winnerText || '')} · ${escapeHtml(heroSub)}</div></div>
    </div>
    <div class="settle-idcard">
      <span class="si-av">${escapeHtml(me?.identity?.avatar || '👤')}</span>
      <span class="si-main">
        <span class="si-name">${escapeHtml(me?.name || '玩家')}${me ? ' ' + (ROLE_ICON[me.role] || '') : ''}</span>
        <span class="si-role">${role ? escapeHtml(role.name) : ''}${me ? ' · ' + escapeHtml(FACTIONS[me.faction].name) : ''}</span>
      </span>
      <span class="si-result ${info.win ? 'win' : 'lose'}">${info.win ? '本方获胜' : '本方落败'}</span>
    </div>
    <div class="settle-stats">
      <div class="ss-cell"><b>${info.correct}/${info.total}</b><span>答题正确（${rate}%）</span></div>
      <div class="ss-cell"><b>${me?.knowledge || 0}</b><span>学识值</span></div>
      <div class="ss-cell"><b>${me?.maxCombo || 0}</b><span>最高连击</span></div>
      <div class="ss-cell"><b>+${info.gained}</b><span>本局积分</span></div>
    </div>
    <div class="settle-score">总积分 ${info.score} 分</div>
    ${
      info.newAch.length
        ? `<div class="rule-section"><h4>🎉 本局解锁成就（${info.newAch.length}）</h4><div class="settle-ach">${info.newAch
            .map((a) => `<span class="sd-ach">${a.icon} ${escapeHtml(a.name)}</span>`)
            .join('')}</div></div>`
        : ''
    }
    <div class="rule-section"><h4>📋 本局战绩</h4>
      <table class="settle-table">
        <thead><tr><th>玩家</th><th>身份</th><th>阵营</th><th>状态</th><th>学识</th><th>连击</th><th>体力</th></tr></thead>
        <tbody>${playerRows()}</tbody>
      </table>
    </div>
    <div class="settle-btns">
      ${
        net
          ? NET.isHost
            ? '<button class="btn btn-accent" onclick="requestRematch()">🔁 直接重开一局</button>'
            : '<button class="btn btn-accent" onclick="requestRematch()">📨 申请再来一局</button>'
          : '<button class="btn btn-accent" onclick="closeSettle();startSingleGame()">🔁 再来一局</button>'
      }
      <button class="btn" onclick="settleReturn()">返回</button>
    </div>`;
  modal.classList.add('show');
  victoryFx(camp, 'settleHero');
}

/** 关闭结算面板 */
export function closeSettle(): void {
  document.getElementById('settleModal')?.classList.remove('show');
}

/**
 * 结算面板「返回」：
 *  - 单机：退出对局，回到主界面（首页）
 *  - 联机：二次确认后回到房间准备界面（保留房间与成员，可重新开始），
 *    与「再来一局」同向但不直接重开
 */
export function settleReturn(): void {
  const net = NET.mode === 'host' || NET.mode === 'join';
  if (net) {
    if (!confirm('返回后将结束当前对局并回到房间准备界面（房间与成员保留，可重新开始）。确定返回吗？')) return;
    Sound.play('click');
    closeSettle();
    showRoomForRematch();
    return;
  }
  Sound.play('click');
  closeSettle();
  exitToLobby();
}

/** 单机：退出对局回到主界面（首页）——停局、作废待决选择、切屏并刷新主界面各面板 */
function exitToLobby(): void {
  // 停局：主循环与触发技均以 G.gameOver 为闸；待决选择直接作废
  //（悬空的 Promise 不再被续接，其计时器/心跳回调会自行失效，见 choice.ts）
  G.gameOver = true;
  G.started = false;
  G.pendingOptions = null;
  G.pendingResolve = null;
  G.pendingPlayer = null;
  G.timerEnd = null;
  G.thinkingSeat = null;
  document.getElementById('screenGame')?.classList.remove('active');
  document.getElementById('screenLobby')?.classList.add('active');
  document.getElementById('topBar')?.classList.remove('in-game');
  document.getElementById('chatPanel')!.style.display = 'none';
  clearPlayZone();
  // 主界面刷新：积分/等级（结算时已入账） + 学习面板 + 设置摘要
  refreshProfileUI();
  renderStudyPanel();
  renderSetupSummary();
}

/** 单机：直接重开一局（由 main.ts 绑定 startSingle 包装） */
export function startSingleGame(): void {
  closeSettle();
  void import('../game/setup').then((m) => m.startSingle());
}

/**
 * 重开一局
 *  - 房主：直接重开（保留房间成员与已调整的座位）
 *  - 加入方：向房主申请，收到同意后一同重开
 */
export function requestRematch(): void {
  Sound.play('click');
  closeSettle();
  if (NET.isHost && NET.mode === 'host') {
    NET.broadcast({ type: 'rematch' });
    showRoomForRematch();
  } else if (NET.mode === 'join') {
    NET.sendToHost({ type: 'rematch_request' });
    addRematchTip('已向房主申请再来一局，等待房主开始…');
  } else {
    startSingleGame();
  }
}

/** 房主收到加入方的重开申请 → 直接开始重开 */
export function hostHandleRematchRequest(fromName: string): void {
  NET.broadcast({ type: 'rematch' });
  showRoomForRematch();
  if (NET.isHost) {
    const info = document.getElementById('roomInfo');
    if (info) info.insertAdjacentHTML('beforeend', `<div style="font-size:11px;color:#5fe08a">${escapeHtml(fromName)} 申请再来一局，可点击「开始游戏」</div>`);
  }
}

/** 客户端收到重开指令 → 回到房间界面等待 */
export function backToRoomForRematch(): void {
  closeSettle();
  showRoomForRematch();
}

/** 回到房间配置界面（保留房间与座位） */
export function showRoomForRematch(): void {
  document.getElementById('screenGame')?.classList.remove('active');
  document.getElementById('screenLobby')?.classList.remove('active');
  document.getElementById('screenSetup')?.classList.add('active');
  document.getElementById('topBar')?.classList.remove('in-game');
  document.getElementById('roomConfig')!.style.display = 'block';
  const sb = document.getElementById('hostStartBtn') as HTMLButtonElement | null;
  if (sb) sb.style.display = 'block';
  const st = document.getElementById('joinStatus');
  if (st) st.innerHTML = '<span style="color:var(--gold)">🔁 等待房主开始新一局…</span>';
}

/** 在房间信息处追加一条提示（重开申请等） */
function addRematchTip(text: string): void {
  const st = document.getElementById('joinStatus');
  if (st) st.innerHTML = `<span style="color:#5fe08a">${escapeHtml(text)}</span>`;
}