import { AudioEngine } from './AudioEngine';

export class MusicGenerator {
  private engine: AudioEngine;
  private oscillators: OscillatorNode[] = [];
  private isPlaying = false;
  private level = 1;
  private loopTimer: number | null = null;

  constructor(engine: AudioEngine) { this.engine = engine; }
  private get ctx() { return this.engine.context; }

  start(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.createPad();
    this.scheduleArpeggio();
  }

  stop(): void {
    this.isPlaying = false;
    for (const o of this.oscillators) { try { o.stop(); } catch {} }
    this.oscillators = [];
    if (this.loopTimer !== null) { clearTimeout(this.loopTimer); this.loopTimer = null; }
  }

  setLevel(level: number): void { this.level = level; }

  private createPad(): void {
    const t = this.ctx.currentTime;
    const vol = this.engine.musicVolume;
    for (const freq of [65.41, 98.0]) {
      const osc = this.engine.createOscillator('sine', freq);
      const gain = this.engine.createGain(vol * 0.08);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200 + this.level * 20, t);
      const lfo = this.engine.createOscillator('sine', 0.3 + this.level * 0.05);
      const lfoGain = this.engine.createGain(3);
      lfo.connect(lfoGain); lfoGain.connect(osc.frequency); lfo.start(t);
      osc.connect(filter); filter.connect(gain); gain.connect(this.engine.master);
      osc.start(t);
      this.oscillators.push(osc, lfo);
    }
  }

  private scheduleArpeggio(): void {
    if (!this.isPlaying) return;
    const t = this.ctx.currentTime;
    const vol = this.engine.musicVolume;
    const scale = [130.81, 146.83, 164.81, 196.0, 220.0, 261.63, 293.66, 329.63];
    const tempo = 0.3 - Math.min(this.level * 0.01, 0.15);
    const numNotes = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < numNotes; i++) {
      const freq = scale[Math.floor(Math.random() * scale.length)];
      const d = i * tempo;
      const o = this.engine.createOscillator('sine', freq);
      const g = this.engine.createGain(vol * 0.06);
      o.connect(g); g.connect(this.engine.master);
      o.start(t + d); o.stop(t + d + tempo * 0.8);
      g.gain.setValueAtTime(vol * 0.06, t + d);
      g.gain.exponentialRampToValueAtTime(0.001, t + d + tempo * 0.8);
    }
    this.loopTimer = window.setTimeout(() => this.scheduleArpeggio(), (numNotes * tempo + 0.5) * 1000);
  }
}
