import { AudioEngine } from './AudioEngine';

export class SoundEffects {
  private engine: AudioEngine;
  constructor(engine: AudioEngine) { this.engine = engine; }
  private get ctx() { return this.engine.context; }
  private get vol() { return this.engine.sfxVolume; }

  move(): void {
    const t = this.ctx.currentTime;
    const n = this.engine.createNoise(0.05);
    const g = this.engine.createGain(this.vol * 0.3);
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.setValueAtTime(4000, t);
    n.connect(f); f.connect(g); g.connect(this.engine.master);
    n.start(t); n.stop(t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  }

  rotate(): void {
    const t = this.ctx.currentTime;
    const o = this.engine.createOscillator('sine', 800);
    const g = this.engine.createGain(this.vol * 0.2);
    o.frequency.exponentialRampToValueAtTime(1600, t + 0.08);
    o.connect(g); g.connect(this.engine.master);
    o.start(t); o.stop(t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  }

  softDrop(): void {
    const t = this.ctx.currentTime;
    const o = this.engine.createOscillator('sine', 150);
    const g = this.engine.createGain(this.vol * 0.15);
    o.connect(g); g.connect(this.engine.master);
    o.start(t); o.stop(t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  }

  hardDrop(): void {
    const t = this.ctx.currentTime;
    const o = this.engine.createOscillator('triangle', 80);
    const g1 = this.engine.createGain(this.vol * 0.5);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    o.connect(g1); g1.connect(this.engine.master);
    o.start(t); o.stop(t + 0.15);
    const n = this.engine.createNoise(0.1);
    const g2 = this.engine.createGain(this.vol * 0.3);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(500, t);
    n.connect(f); f.connect(g2); g2.connect(this.engine.master);
    n.start(t); n.stop(t + 0.1);
  }

  planeClear(count: number): void {
    const t = this.ctx.currentTime;
    for (let i = 0; i < count; i++) {
      const delay = i * 0.08;
      const freq = 600 + i * 200;
      const o = this.engine.createOscillator('sine', freq);
      const g = this.engine.createGain(this.vol * 0.3);
      o.frequency.exponentialRampToValueAtTime(freq + 400, t + delay + 0.3);
      o.connect(g); g.connect(this.engine.master);
      o.start(t + delay); o.stop(t + delay + 0.3);
      g.gain.setValueAtTime(this.vol * 0.3, t + delay);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.3);
    }
    const n = this.engine.createNoise(0.2);
    const ng = this.engine.createGain(this.vol * 0.15);
    const bf = this.ctx.createBiquadFilter();
    bf.type = 'bandpass'; bf.frequency.setValueAtTime(3000, t);
    n.connect(bf); bf.connect(ng); ng.connect(this.engine.master);
    n.start(t); n.stop(t + 0.2);
  }

  combo(multiplier: number): void {
    const t = this.ctx.currentTime;
    const freq = 400 + multiplier * 200;
    const o = this.engine.createOscillator('sine', freq);
    const g = this.engine.createGain(this.vol * 0.25);
    o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.15);
    o.connect(g); g.connect(this.engine.master);
    o.start(t); o.stop(t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  }

  levelUp(): void {
    const t = this.ctx.currentTime;
    [523, 659, 784, 1047].forEach((freq, i) => {
      const d = i * 0.1;
      const o = this.engine.createOscillator('sine', freq);
      const g = this.engine.createGain(this.vol * 0.3);
      o.connect(g); g.connect(this.engine.master);
      o.start(t + d); o.stop(t + d + 0.15);
      g.gain.setValueAtTime(this.vol * 0.3, t + d);
      g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.15);
    });
  }

  gameOver(): void {
    const t = this.ctx.currentTime;
    [523, 392, 330, 262].forEach((freq, i) => {
      const d = i * 0.25;
      const o = this.engine.createOscillator('triangle', freq);
      const g = this.engine.createGain(this.vol * 0.4);
      o.connect(g); g.connect(this.engine.master);
      o.start(t + d); o.stop(t + d + 0.4);
      g.gain.setValueAtTime(this.vol * 0.4, t + d);
      g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.4);
    });
  }
}
