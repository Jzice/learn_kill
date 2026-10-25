/* ==================== 武将完整卡展示 + 开局亮将确认（v1.8.3） ====================
 * 随机模式下，开局前需完整展示将使用的武将（体力 / 技能 / 主公技 / 解锁来源），
 * 并允许「换一个」重新派发（仍在开局前，保持「开局所见即所得」）。
 * charCardHtml 由设置界面预览卡（lobby.renderCharPreview）与亮将弹窗共用。
 */
import type { Character } from '../core/types';
import { escapeHtml } from '../core/dom';
import { FACTIONS } from '../data/factions';
import { charConditions, masterySnapshot } from '../profile/unlockCondition';

export interface CharCardOpts {
  /** 角标文案：「✅ 已选择」/「🎲 随机派发」 */
  label: string;
  /** 随机派发模式：控制「🎲 随机派发」角标与样式（不决定是否显示卡内换将按钮） */
  random: boolean;
  /** 是否在武将卡内部显示「🎲 换一个」按钮；缺省时跟随 random。
   *  亮将弹窗底部已有可用的换将按钮，故弹窗内传 false 避免重复且失效的卡内按钮。 */
  cardReroll?: boolean;
  /** 学分解锁的扩展包角色：展示解锁来源与条件进度 */
  expanded: boolean;
}

/** 完整武将卡 HTML（设置界面预览与开局亮将弹窗共用） */
export function charCardHtml(c: Character, opts: CharCardOpts): string {
  const f = FACTIONS[c.faction];
  const skills = c.skills
    .map(
      (s) =>
        `<div class="rcp-skill"><b>${escapeHtml(s.name)}</b><span class="rcp-type">${
          s.type === 'active' ? '主动' : '触发'
        }</span>：${escapeHtml(s.desc)}</div>`,
    )
    .join('');
  const src = opts.expanded ? srcHtml(c) : '';
  return `<div class="rcp ${opts.random ? 'random' : ''}">
    <div class="rcp-head">
      <span class="rcp-avatar">${c.avatar}</span>
      <div class="rcp-id">
        <div class="rcp-name" style="color:${f.color}">${escapeHtml(c.name)}</div>
        <div class="rcp-title">${escapeHtml(c.title || '')}</div>
      </div>
      <span class="rcp-label">${escapeHtml(opts.label)}</span>
    </div>
    <div class="rcp-meta" style="color:${f.color}">${f.icon} ${escapeHtml(f.name)} · 体力 ${c.hp} · ${escapeHtml(c.grade)}</div>
    <div class="rcp-skills">${skills}</div>
    <div class="rcp-lord">👑 主公技 <b>${escapeHtml(f.lordSkill.name)}</b>：${escapeHtml(f.lordSkill.desc)}</div>
    ${src}
    ${(opts.cardReroll ?? opts.random) ? '<button class="btn btn-sm rcp-reroll" onclick="rerollRandomChar()">🎲 换一个</button>' : ''}
  </div>`;
}

/** 学分解锁来源与条件进度 */
function srcHtml(c: Character): string {
  const conds = charConditions(c, masterySnapshot()).filter((x) => x.group === 'either');
  const prog = conds.map((x) => `${escapeHtml(x.label)} ${x.cur}/${x.need}`).join(' 或 ');
  return `<div class="rcp-src">🔓 学分解锁（${escapeHtml(c.subject)}）｜ 解锁条件：${prog}</div>`;
}

/* ---------------- 开局亮将弹窗 ---------------- */

let revealResolve: ((c: Character | null) => void) | null = null;
let revealRerollFn: (() => Character | null) | null = null;
let revealChar: Character | null = null;

/**
 * 弹出亮将确认（随机模式专用）。返回确认使用的角色；
 * 返回 null 表示用户选择「返回设置」（调用方应中止开局）。
 */
export function confirmReveal(c: Character, onReroll: () => Character | null): Promise<Character | null> {
  return new Promise((resolve) => {
    revealResolve = resolve;
    revealRerollFn = onReroll;
    revealChar = c;
    renderReveal();
    document.getElementById('revealModal')?.classList.add('show');
  });
}

function renderReveal(): void {
  const body = document.getElementById('revealBody');
  if (!body || !revealChar) return;
  body.innerHTML =
    `<div class="rv-tip">本局你将使用以下武将，确认后开局（也可先换一个）</div>` +
    charCardHtml(revealChar, { label: '🎲 随机派发', random: true, cardReroll: false, expanded: revealChar.id.startsWith('ex_') }) +
    `<div class="rv-actions">
      <button class="btn btn-accent" onclick="revealConfirm()">🎮 开始对局</button>
      <button class="btn" onclick="revealReroll()">🎲 换一个</button>
      <button class="btn" onclick="revealCancel()">↩ 返回设置</button>
    </div>`;
}

/** 确认开局 */
export function revealConfirm(): void {
  const c = revealChar;
  const r = revealResolve;
  closeReveal();
  r?.(c);
}

/** 亮将弹窗内换将 */
export function revealReroll(): void {
  const c = revealRerollFn?.();
  if (c) {
    revealChar = c;
    renderReveal();
  }
}

/** 返回设置（中止开局） */
export function revealCancel(): void {
  const r = revealResolve;
  closeReveal();
  r?.(null);
}

function closeReveal(): void {
  document.getElementById('revealModal')?.classList.remove('show');
  revealResolve = null;
  revealRerollFn = null;
  revealChar = null;
}
