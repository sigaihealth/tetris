export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private _sfxVolume = 0.7;
  private _musicVolume = 0.5;
  private _muted = false;

  get context(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  get master(): GainNode { this.context; return this.masterGain!; }
  get sfxVolume(): number { return this._sfxVolume; }
  set sfxVolume(v: number) { this._sfxVolume = Math.max(0, Math.min(1, v)); }
  get musicVolume(): number { return this._musicVolume; }
  set musicVolume(v: number) { this._musicVolume = Math.max(0, Math.min(1, v)); }
  get muted(): boolean { return this._muted; }

  toggleMute(): void {
    this._muted = !this._muted;
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this._muted ? 0 : 1, this.context.currentTime);
    }
  }

  resume(): void { if (this.ctx?.state === 'suspended') this.ctx.resume(); }

  createOscillator(type: OscillatorType, freq: number): OscillatorNode {
    const osc = this.context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.context.currentTime);
    return osc;
  }

  createGain(value: number): GainNode {
    const g = this.context.createGain();
    g.gain.setValueAtTime(value, this.context.currentTime);
    return g;
  }

  createNoise(duration: number): AudioBufferSourceNode {
    const size = this.context.sampleRate * duration;
    const buf = this.context.createBuffer(1, size, this.context.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    const src = this.context.createBufferSource();
    src.buffer = buf;
    return src;
  }
}
