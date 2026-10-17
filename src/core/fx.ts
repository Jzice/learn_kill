/* ==================== 特效（DOM 动画层） ==================== */
import type { Card } from './types';
import { sleep } from './dom';

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
  async death(idx: number): Promise<void> {
    const a = this.anchor(idx);
    const f = document.createElement('div');
    f.className = 'death-fx';
    f.textContent = '☠ 阵亡';
    f.style.left = a.x - 62 + 'px';
    f.style.top = a.y - 26 + 'px';
    document.getElementById('fxLayer')!.appendChild(f);
    await sleep(1250);
    f.remove();
  },
};

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
