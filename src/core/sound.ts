/* ==================== 音效（WebAudio 振荡器合成，无音频资源，可开关） ==================== */
import { isSim } from './dom';
export const Sound = {
  ctx: null as AudioContext | null,
  enabled: true,
  init(): AudioContext | null {
    if (!this.ctx) {
      try {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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
    if (this.ctx.state === 'suspended') {
      try {
        this.ctx.resume();
      } catch (e) {
        /* ignore */
      }
    }
    return this.ctx;
  },
  /** 独立音符：在指定延迟播放一个音 */
  note(c: AudioContext, freq: number, dur: number, type: OscillatorType, vol: number, delay = 0): void {
    const n = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, n);
    g.gain.setValueAtTime(0.0001, n);
    g.gain.exponentialRampToValueAtTime(vol, n + Math.min(0.02, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(n);
    o.stop(n + dur + 0.02);
  },
  /** 一串音符（琶音） */
  seq(c: AudioContext, freqs: number[], step: number, dur: number, type: OscillatorType, vol: number): void {
    freqs.forEach((f, i) => this.note(c, f, dur, type, vol, i * step));
  },
  play(t: string): void {
    if (!this.enabled || isSim()) return;
    const c = this.init();
    if (!c) return;
    const N = (f: number, d: number, tp: OscillatorType = 'sine', v = 0.1, delay = 0): void =>
      this.note(c, f, d, tp, v, delay);
    const S = (fs: number[], step: number, d: number, tp: OscillatorType = 'sine', v = 0.1): void =>
      this.seq(c, fs, step, d, tp, v);
    switch (t) {
      /* --- 界面 --- */
      case 'click':
        N(880, 0.06, 'triangle', 0.06);
        break;
      case 'toggle':
        S([660, 990], 0.05, 0.08, 'triangle', 0.07);
        break;
      /* --- 基本牌 --- */
      case 'draw':
        N(1200, 0.1, 'sine', 0.07);
        break;
      case 'play':
        N(520, 0.14, 'triangle', 0.12);
        break;
      case 'sha':
        N(130, 0.32, 'sine', 0.3);
        N(220, 0.18, 'sawtooth', 0.08, 0.04);
        break;
      case 'shan':
        S([1500, 2250, 3000], 0.05, 0.35, 'sine', 0.06);
        break;
      case 'tao':
        S([523, 659, 784], 0.08, 0.3, 'sine', 0.1);
        break;
      case 'jiu':
        S([392, 523, 659], 0.07, 0.28, 'triangle', 0.11);
        break;
      case 'discard':
        N(300, 0.12, 'triangle', 0.07);
        N(200, 0.1, 'sine', 0.05, 0.06);
        break;
      case 'equip':
        S([523, 784, 1046], 0.06, 0.22, 'square', 0.06);
        break;
      /* --- 锦囊牌 --- */
      case 'trick':
        S([784, 1046, 1318], 0.06, 0.24, 'triangle', 0.09);
        break;
      case 'trick_aoe':
        // 南蛮/万箭：低频冲击 + 上行扫频
        N(90, 0.45, 'sawtooth', 0.22);
        S([330, 440, 587, 784], 0.07, 0.3, 'sawtooth', 0.08);
        break;
      case 'trick_heal':
        // 桃园结义：柔和上行
        S([523, 587, 659, 784, 880], 0.08, 0.4, 'sine', 0.09);
        break;
      case 'trick_delay':
        // 乐不思蜀/闪电：悬疑下行
        S([880, 740, 622, 523], 0.09, 0.3, 'triangle', 0.08);
        break;
      case 'trick_steal':
        // 过河拆桥/顺手牵羊：短促挑动
        S([1046, 784, 1046], 0.05, 0.16, 'square', 0.06);
        break;
      case 'duel':
        S([440, 494, 440, 494], 0.09, 0.22, 'square', 0.07);
        break;
      /* --- 技能 / 答题 --- */
      case 'skill':
        N(280, 0.45, 'sawtooth', 0.09);
        N(560, 0.3, 'triangle', 0.05, 0.05);
        break;
      case 'skill_fail':
        S([440, 330, 247], 0.08, 0.24, 'triangle', 0.08);
        break;
      case 'correct':
        S([659, 880, 1046], 0.07, 0.3, 'sine', 0.08);
        break;
      case 'wrong':
        N(200, 0.42, 'square', 0.11);
        break;
      case 'combo':
        S([784, 988, 1175, 1568], 0.06, 0.28, 'triangle', 0.09);
        break;
      /* --- 状态 --- */
      case 'hit':
        N(180, 0.28, 'square', 0.2);
        N(90, 0.3, 'sine', 0.14);
        break;
      case 'judge':
        S([1046, 1318], 0.05, 0.18, 'sine', 0.07);
        break;
      case 'death':
        S([392, 330, 262, 196], 0.12, 0.5, 'sine', 0.12);
        break;
      case 'turn':
        N(587, 0.16, 'sine', 0.06);
        N(784, 0.14, 'sine', 0.05, 0.09);
        break;
      case 'win':
        S([523, 659, 784, 1046], 0.12, 0.5, 'triangle', 0.1);
        break;
      case 'lose':
        S([523, 466, 392, 311], 0.14, 0.55, 'sine', 0.1);
        break;
    }
  },
};

/** 开关音效（供程序调用） */
export function setSoundEnabled(on: boolean): void {
  Sound.enabled = on;
  if (on) {
    Sound.init();
    Sound.play('toggle');
  }
  saveSoundPref();
  updateSoundButtons();
}

export function isSoundEnabled(): boolean {
  return Sound.enabled;
}

export function toggleSound(): void {
  Sound.enabled = !Sound.enabled;
  if (Sound.enabled) {
    Sound.init();
    Sound.play('toggle');
  }
  saveSoundPref();
  updateSoundButtons();
}

/** 同步所有音效开关按钮的显示状态 */
export function updateSoundButtons(): void {
  const on = Sound.enabled;
  const btn = document.getElementById('soundToggle');
  if (btn) {
    btn.textContent = on ? '🔊' : '🔇';
    btn.classList.toggle('muted', !on);
  }
  document.querySelectorAll<HTMLElement>('.sound-switch').forEach((el) => {
    el.innerHTML = `${on ? '🔊' : '🔇'} 音效：<b style="color:${on ? '#27ae60' : '#e74c3c'}">${on ? '开' : '关'}</b>`;
    el.setAttribute('aria-pressed', String(on));
  });
}

/** 渲染音效开关条目（用于二级菜单/列表） */
export function soundSwitchHtml(): string {
  return '<button class="sound-switch" onclick="toggleSound()" aria-pressed="false">🔊 音效：<b>开</b></button>';
}

/** 渲染后刷新文案（由 init 调用） */
export function refreshSoundSwitch(): void {
  const on = Sound.enabled;
  document.querySelectorAll<HTMLElement>('.sound-switch').forEach((el) => {
    el.innerHTML = `${on ? '🔊' : '🔇'} 音效：<b style="color:${on ? '#27ae60' : '#e74c3c'}">${on ? '开' : '关'}</b>`;
    el.setAttribute('aria-pressed', String(on));
  });
}

/** 持久化音效开关 */
const SOUND_KEY = 'xuetangsha_sound';
export function loadSoundPref(): void {
  try {
    const v = localStorage.getItem(SOUND_KEY);
    if (v === '0') Sound.enabled = false;
    else if (v === '1') Sound.enabled = true;
  } catch (e) {
    /* ignore */
  }
}
export function saveSoundPref(): void {
  try {
    localStorage.setItem(SOUND_KEY, Sound.enabled ? '1' : '0');
  } catch (e) {
    /* ignore */
  }
}
