/* ==================== 特效（DOM 动画层） ==================== */
import type { Card } from './types';
import { escapeHtml, isSim, sleep } from './dom';

export const FX = {
  anchor(idx: number): { x: number; y: number } {
    const s = document.querySelector(`.seat[data-idx="${idx}"] .p-card`);
    if (!s) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const r = s.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  },
  attackLunge(idx: number): void {
    const e = document.querySelector(`.seat[data-idx="${idx}"] .p-card`);
    if (!e) return;
    e.classList.remove('attacking');
    void (e as HTMLElement).offsetWidth;
    e.classList.add('attacking');
    setTimeout(() => e.classList.remove('attacking'), 480);
  },
  hitShake(idx: number): void {
    const e = document.querySelector(`.seat[data-idx="${idx}"] .p-card`);
    if (!e) return;
    e.classList.remove('hit-shake');
    void (e as HTMLElement).offsetWidth;
    e.classList.add('hit-shake');
    setTimeout(() => e.classList.remove('hit-shake'), 520);
  },
  async flyCard(
    fi: number,
    ti: number,
    text: string,
    type = 'basic',
    dur = 520,
  ): Promise<void> {
    const from = this.anchor(fi),
      to = this.anchor(ti);
    const e = document.createElement('div');
    e.className = 'fly-card ' + (type !== 'basic' ? type : '');
    e.textContent = text;
    e.style.left = from.x - 22 + 'px';
    e.style.top = from.y - 31 + 'px';
    document.getElementById('fxLayer')!.appendChild(e);
    const dx = to.x - from.x,
      dy = to.y - from.y;
    const frames: Keyframe[] = [
      { transform: 'translate(0,0) scale(.5)', opacity: 0 },
      { transform: 'translate(0,0) scale(1.08)', opacity: 1, offset: 0.14 },
      {
        transform: `translate(${dx * 0.5}px,${dy * 0.5 - 55}px) scale(1.1) rotate(180deg)`,
        opacity: 1,
        offset: 0.62,
      },
      {
        transform: `translate(${dx}px,${dy}px) scale(.5) rotate(360deg)`,
        opacity: 0.15,
      },
    ];
    const a = e.animate(frames, {
      duration: dur,
      easing: 'cubic-bezier(.45,.05,.65,.95)',
      fill: 'forwards',
    });
    await a.finished;
    e.remove();
  },
  async slash(idx: number): Promise<void> {
    const a = this.anchor(idx);
    this.hitShake(idx);
    const f = document.createElement('div');
    f.className = 'slash-fx';
    f.textContent = '杀';
    f.style.left = a.x - 35 + 'px';
    f.style.top = a.y - 40 + 'px';
    document.getElementById('fxLayer')!.appendChild(f);
    setTimeout(() => f.remove(), 880);
    await sleep(340);
  },
  async shield(idx: number): Promise<void> {
    const a = this.anchor(idx);
    const r = document.createElement('div');
    r.className = 'shield-fx';
    r.style.left = a.x - 60 + 'px';
    r.style.top = a.y - 60 + 'px';
    document.getElementById('fxLayer')!.appendChild(r);
    floatTextFx(idx, '闪', '#4af');
    setTimeout(() => r.remove(), 720);
    await sleep(320);
  },
  healGlow(idx: number): void {
    const a = this.anchor(idx);
    const f = document.createElement('div');
    f.className = 'heal-fx';
    f.style.left = a.x - 42 + 'px';
    f.style.top = a.y - 42 + 'px';
    document.getElementById('fxLayer')!.appendChild(f);
    setTimeout(() => f.remove(), 950);
  },
  skillWave(idx: number): void {
    const a = this.anchor(idx);
    const f = document.createElement('div');
    f.className = 'skill-ripple';
    f.style.left = a.x - 75 + 'px';
    f.style.top = a.y - 75 + 'px';
    document.getElementById('fxLayer')!.appendChild(f);
    setTimeout(() => f.remove(), 900);
  },
  async judge(idx: number, card: Card): Promise<void> {
    const a = this.anchor(idx);
    const isRed = card.suit === '♥' || card.suit === '♦';
    const f = document.createElement('div');
    f.className = 'judge-fx ' + (isRed ? 'red' : 'black');
    f.innerHTML = `<div class="jsuit">${card.suit}</div><div class="jnum">${card.num}</div><div class="jname">${card.name}</div>`;
    f.style.left = a.x - 30 + 'px';
    f.style.top = a.y - 44 + 'px';
    document.getElementById('fxLayer')!.appendChild(f);
    await sleep(900);
    f.remove();
  },
  /**
   * 阵亡动画：显示身份与击杀者（二者可选）。
   * @param roleText 身份名，如「反贼」；@param killerText 击杀说明，如「被 曹操 击杀」
   */
  async death(idx: number, roleText?: string, killerText?: string): Promise<void> {
    const a = this.anchor(idx);
    const f = document.createElement('div');
    f.className = 'death-fx';
    f.innerHTML =
      '<div class="df-title">☠ 阵亡</div>' +
      (roleText ? `<div class="df-role">${escapeHtml(roleText)}</div>` : '') +
      (killerText ? `<div class="df-killer">${escapeHtml(killerText)}</div>` : '');
    f.style.left = a.x - 90 + 'px';
    f.style.top = a.y - 30 + 'px';
    document.getElementById('fxLayer')!.appendChild(f);
    await sleep(1250);
    f.remove();
  },
};

/** 无头模拟模式：关闭全部 DOM 动画（anchor 保留，供坐标计算） */
for (const k of Object.keys(FX) as (keyof typeof FX)[]) {
  if (k === 'anchor') continue;
  const orig = (FX as unknown as Record<string, unknown>)[k];
  (FX as unknown as Record<string, unknown>)[k] = (...args: unknown[]) =>
    isSim() ? Promise.resolve() : (orig as (...a: unknown[]) => unknown).apply(FX, args);
}

export function floatTextFx(idx: number, text: string, color: string): void {
  const a = FX.anchor(idx);
  const f = document.createElement('div');
  f.className = 'float-text';
  f.textContent = text;
  f.style.color = color;
  f.style.left = a.x - 16 + 'px';
  f.style.top = a.y - 14 + 'px';
  document.getElementById('fxLayer')!.appendChild(f);
  setTimeout(() => f.remove(), 1150);
}

/* ==================== 锦囊牌 / 装备 / 摸弃牌特效 ==================== */

/** 锦囊牌图标（按子类区分视觉） */
const TRICK_ICON: Record<string, string> = {
  wuzhong: '🎴',
  guohe: '🧨',
  shunshou: '🤲',
  juedou: '⚔️',
  nanman: '🐘',
  wanjian: '🏹',
  taoyuan: '🌸',
  wuxie: '🛡️',
  lebu: '🎋',
  shandian: '⚡',
};

/** 锦囊释放特效：目标座位卡牌翻转 + 中央光环 + 图标浮出 */
export async function trickCast(
  idx: number,
  cardName: string,
  sub: string,
  color = '#b57fff',
  dur = 900,
): Promise<void> {
  const a = FX.anchor(idx);
  const icon = TRICK_ICON[sub] || '🎴';
  const wrap = document.createElement('div');
  wrap.className = 'trick-fx';
  wrap.style.left = a.x + 'px';
  wrap.style.top = a.y + 'px';
  wrap.innerHTML = `<div class="trick-ring" style="border-color:${color}"></div>
    <div class="trick-card" style="border-color:${color}"><span class="tc-icon">${icon}</span><span class="tc-name">${cardName}</span></div>`;
  document.getElementById('fxLayer')!.appendChild(wrap);
  const ring = wrap.querySelector<HTMLElement>('.trick-ring');
  const card = wrap.querySelector<HTMLElement>('.trick-card');
  ring?.animate(
    [
      { transform: 'translate(-50%,-50%) scale(.2)', opacity: 0 },
      { transform: 'translate(-50%,-50%) scale(1.1)', opacity: 1, offset: 0.35 },
      { transform: 'translate(-50%,-50%) scale(1.7)', opacity: 0 },
    ],
    { duration: dur, easing: 'ease-out', fill: 'forwards' },
  );
  card?.animate(
    [
      /* 翻牌：可见停留阶段必须在 rotateY(360deg)（≡0°正向）。
         此前停在 rotateY(180deg)，单层元素转到 180° 时正面内容左右镜像 */
      { transform: 'translate(-50%,-50%) scale(.4) rotateY(180deg)', opacity: 0 },
      { transform: 'translate(-50%,-50%) scale(1.05) rotateY(360deg)', opacity: 1, offset: 0.4 },
      { transform: 'translate(-50%,-50%) scale(1.05) rotateY(360deg)', opacity: 1, offset: 0.7 },
      { transform: 'translate(-50%,-50%) scale(.85) rotateY(360deg) translateY(-24px)', opacity: 0 },
    ],
    { duration: dur, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'forwards' },
  );
  await sleep(dur * 0.72);
  setTimeout(() => wrap.remove(), dur);
}

/** 群攻锦囊（南蛮/万箭）：从中心向全体扩散的冲击波 */
export async function aoeFx(fromIdx: number, targetIdx: number[], color = '#e74c3c'): Promise<void> {
  const from = FX.anchor(fromIdx);
  const wave = document.createElement('div');
  wave.className = 'aoe-wave';
  wave.style.left = from.x + 'px';
  wave.style.top = from.y + 'px';
  wave.style.borderColor = color;
  document.getElementById('fxLayer')!.appendChild(wave);
  wave.animate(
    [
      { transform: 'translate(-50%,-50%) scale(.1)', opacity: 0.9 },
      { transform: 'translate(-50%,-50%) scale(2.4)', opacity: 0 },
    ],
    { duration: 620, easing: 'ease-out', fill: 'forwards' },
  );
  setTimeout(() => wave.remove(), 660);
  // 每个目标一次闪光
  targetIdx.forEach((i, k) => {
    setTimeout(() => FX.hitShake(i), 120 + k * 90);
  });
  await sleep(360);
}

/** 装备：卡牌飞入并定格在座位装备区 */
export async function equipFx(idx: number, cardName: string): Promise<void> {
  const a = FX.anchor(idx);
  const e = document.createElement('div');
  e.className = 'equip-fx';
  e.textContent = cardName;
  e.style.left = a.x + 'px';
  e.style.top = a.y + 'px';
  document.getElementById('fxLayer')!.appendChild(e);
  e.animate(
    [
      { transform: 'translate(-50%,-50%) scale(.5) translateY(-40px)', opacity: 0 },
      { transform: 'translate(-50%,-50%) scale(1) translateY(0)', opacity: 1, offset: 0.35 },
      { transform: 'translate(-50%,-50%) scale(.9) translateY(10px)', opacity: 0 },
    ],
    { duration: 760, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'forwards' },
  );
  await sleep(420);
  setTimeout(() => e.remove(), 400);
}

/** 摸牌：牌堆向座位飞牌 */
export function drawFx(idx: number, n: number): void {
  const pile = document.querySelector<HTMLElement>('.pile-stack');
  const from = pile
    ? (() => {
        const r = pile.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      })()
    : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const to = FX.anchor(idx);
  for (let i = 0; i < Math.min(n, 4); i++) {
    const e = document.createElement('div');
    e.className = 'fly-card draw';
    e.style.left = from.x - 16 + 'px';
    e.style.top = from.y - 22 + 'px';
    document.getElementById('fxLayer')!.appendChild(e);
    e.animate(
      [
        { transform: 'translate(0,0) scale(.6)', opacity: 0 },
        { transform: 'translate(0,0) scale(1)', opacity: 1, offset: 0.2 },
        {
          transform: `translate(${to.x - from.x}px,${to.y - from.y}px) scale(.5) rotate(180deg)`,
          opacity: 0.1,
        },
      ],
      { duration: 480, delay: i * 90, easing: 'cubic-bezier(.45,.05,.65,.95)', fill: 'forwards' },
    );
    setTimeout(() => e.remove(), 480 + i * 90 + 60);
  }
}

/** 弃牌：手牌区向弃牌堆飞出 */
export function discardFx(idx: number): void {
  const to = document.querySelector<HTMLElement>('.pile-stack:last-of-type');
  const from = FX.anchor(idx);
  const dest = to
    ? (() => {
        const r = to.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      })()
    : { x: window.innerWidth - 60, y: window.innerHeight / 2 };
  const e = document.createElement('div');
  e.className = 'fly-card discard';
  e.style.left = from.x - 16 + 'px';
  e.style.top = from.y - 22 + 'px';
  document.getElementById('fxLayer')!.appendChild(e);
  e.animate(
    [
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dest.x - from.x}px,${dest.y - from.y}px) scale(.4) rotate(-160deg)`, opacity: 0.15 },
    ],
    { duration: 420, easing: 'ease-in', fill: 'forwards' },
  );
  setTimeout(() => e.remove(), 480);
}

/** 连击特效 */
export function comboFx(idx: number, combo: number): void {
  floatTextFx(idx, `⚡${combo} 连击`, '#ffd166');
  const a = FX.anchor(idx);
  const r = document.createElement('div');
  r.className = 'skill-ripple combo';
  r.style.left = a.x - 75 + 'px';
  r.style.top = a.y - 75 + 'px';
  document.getElementById('fxLayer')!.appendChild(r);
  setTimeout(() => r.remove(), 900);
}

/** 结算横幅（胜/负） */
export async function resultBanner(text: string, win: boolean): Promise<void> {
  const el = document.createElement('div');
  el.className = 'result-banner ' + (win ? 'win' : 'lose');
  el.innerHTML = `<span class="rb-icon">${win ? '🏆' : '💀'}</span><span class="rb-text">${text}</span>`;
  document.getElementById('fxLayer')!.appendChild(el);
  el.animate(
    [
      { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
      { transform: 'translate(-50%,-50%) scale(1.08)', opacity: 1, offset: 0.25 },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.8 },
      { transform: 'translate(-50%,-50%) scale(1.05)', opacity: 0 },
    ],
    { duration: 2000, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'forwards' },
  );
  await sleep(1400);
    setTimeout(() => el.remove(), 700);
  }

  /** 胜利方式：按获胜阵营区分不同个性动画 */
  export type WinCamp = 'lord' | 'rebel' | 'spy' | 'lose';

  /**
   * 结算胜利动画：不同胜利方式各不相同
   *  - lord  主公阵营：金色光柱 + 旋转光芒 + 皇冠加冕
   *  - rebel 反贼胜利：红色冲击波 + 火焰升腾
   *  - spy   内奸胜利：紫色迷雾 + 翻牌
   *  - lose  我方败北：灰色碎片飘落
   */
  export function victoryFx(camp: WinCamp, mountId = 'settleHero'): void {
    const mount = document.getElementById(mountId) || document.getElementById('fxLayer');
    if (!mount) return;
    const wrap = document.createElement('div');
    wrap.className = `vic-fx vic-${camp}`;
    if (camp === 'lord') {
      wrap.innerHTML = `<div class="vic-beam"></div><div class="vic-rays"></div><div class="vic-icon">👑</div><div class="vic-word">加冕</div>`;
    } else if (camp === 'rebel') {
      wrap.innerHTML = `<div class="vic-boom b1"></div><div class="vic-boom b2"></div><div class="vic-fire">🔥</div><div class="vic-icon">🔥</div><div class="vic-word">揭竿</div>`;
    } else if (camp === 'spy') {
      wrap.innerHTML = `<div class="vic-smoke"></div><div class="vic-cards">🂠 🂡 🂢</div><div class="vic-icon">🦊</div><div class="vic-word">渔利</div>`;
    } else {
      wrap.innerHTML = `<div class="vic-shard s1"></div><div class="vic-shard s2"></div><div class="vic-shard s3"></div><div class="vic-icon">💔</div><div class="vic-word">折戟</div>`;
    }
    mount.appendChild(wrap);
    setTimeout(() => wrap.remove(), 4000);
  }
