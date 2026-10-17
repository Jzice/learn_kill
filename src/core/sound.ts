/* ==================== 音效（WebAudio 振荡器合成，无音频资源） ==================== */

export const Sound = {
  ctx: null as AudioContext | null,
  enabled: true,
  init(): AudioContext | null {
    if (!this.ctx) {
      try {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Ctor) {
          this.enabled = false;
          return null;
        }
        this.ctx = new Ctor();
      } catch (e) {
        this.enabled = false;
        return null;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  play(t: string): void {
    if (!this.enabled) return;
    const c = this.init();
    if (!c) return;
    const n = c.currentTime;
    const tone = (f: number, d: number, tp: OscillatorType = 'sine', v = 0.1): void => {
      const o = c.createOscillator(),
        g = c.createGain();
      o.type = tp;
      o.frequency.setValueAtTime(f, n);
      g.gain.setValueAtTime(v, n);
      g.gain.exponentialRampToValueAtTime(0.001, n + d);
      o.connect(g);
      g.connect(c.destination);
      o.start(n);
      o.stop(n + d);
    };
    switch (t) {
      case 'click':
        tone(880, 0.06, 'triangle', 0.06);
        break;
      case 'draw':
        tone(1200, 0.1, 'sine', 0.07);
        break;
      case 'play':
        tone(520, 0.14, 'triangle', 0.12);
        break;
      case 'sha':
        tone(130, 0.32, 'sine', 0.3);
        break;
      case 'shan':
        [1500, 2250, 3000].forEach((f) => tone(f, 0.4, 'sine', 0.06));
        break;
      case 'tao':
        [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sine', 0.1), i * 80));
        break;
      case 'hit':
        tone(180, 0.28, 'square', 0.2);
        break;
      case 'skill':
        tone(280, 0.45, 'sawtooth', 0.09);
        break;
      case 'correct':
        [659, 880, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sine', 0.08), i * 70));
        break;
      case 'wrong':
        tone(200, 0.42, 'square', 0.11);
        break;
      case 'win':
        [523, 659, 784, 1046].forEach((f, i) =>
          setTimeout(() => tone(f, 0.5, 'triangle', 0.1), i * 120),
        );
        break;
    }
  },
};

export function toggleSound(): void {
  Sound.enabled = !Sound.enabled;
  const b = document.getElementById('soundToggle');
  if (b) {
    b.textContent = Sound.enabled ? '🔊' : '🔇';
    b.classList.toggle('muted', !Sound.enabled);
  }
  if (Sound.enabled) {
    Sound.init();
    Sound.play('click');
  }
}
