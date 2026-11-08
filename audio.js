// All sound is synthesized locally. No files, network requests, or autoplay.
export class SoundEngine {
  constructor(settings) { this.settings = settings; this.active = false; this.step = 0; this.nextBeat = 0; }
  async init() {
    try {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        const limiter = this.ctx.createDynamicsCompressor();
        limiter.threshold.value = -16; limiter.ratio.value = 8;
        this.master.connect(limiter); limiter.connect(this.ctx.destination);
        this.fx = this.ctx.createGain(); this.music = this.ctx.createGain(); this.rotor = this.ctx.createGain();
        this.fx.connect(this.master); this.music.connect(this.master); this.rotor.connect(this.fx);
        this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const noise = this.ctx.createBufferSource(); noise.buffer = this.noise; noise.loop = true;
        const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 240;
        noise.connect(filter); filter.connect(this.rotor); noise.start();
        const engine = this.ctx.createOscillator(); engine.type = 'triangle'; engine.frequency.value = 43;
        const engineGain = this.ctx.createGain(); engineGain.gain.value = 0.12;
        engine.connect(engineGain); engineGain.connect(this.rotor); engine.start();
        this.rotor.gain.value = 0;
      }
      await this.ctx.resume(); this.configure();
    } catch { /* The game remains playable when audio is unavailable. */ }
  }
  configure() {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(this.settings.muted ? 0 : this.settings.volume, this.ctx.currentTime, 0.03);
    this.music.gain.setTargetAtTime(this.settings.music ? 0.25 : 0, this.ctx.currentTime, 0.1);
  }
  setActive(active) {
    this.active = active;
    if (this.ctx) this.rotor.gain.setTargetAtTime(active ? 0.26 : 0, this.ctx.currentTime, 0.2);
  }
  tone(freq, end, duration, volume = 0.1, type = 'sine', bus = this.fx, time = this.ctx?.currentTime) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, time); osc.frequency.exponentialRampToValueAtTime(Math.max(10, end), time + duration);
    gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(volume, time + 0.006); gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(gain); gain.connect(bus); osc.start(time); osc.stop(time + duration + 0.03);
  }
  hiss(duration, volume, frequency, pan = 0) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const source = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter(), gain = this.ctx.createGain();
    source.buffer = this.noise; filter.type = 'lowpass'; filter.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, this.ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    source.connect(filter); filter.connect(gain);
    if (this.ctx.createStereoPanner) { const panner = this.ctx.createStereoPanner(); panner.pan.value = Math.max(-1, Math.min(1, pan)); gain.connect(panner); panner.connect(this.fx); }
    else gain.connect(this.fx);
    source.start(0, Math.random()); source.stop(this.ctx.currentTime + duration);
  }
  play(name, pan = 0) {
    if (!this.ctx || this.settings.muted) return;
    if (name === 'shot') { this.hiss(0.065, 0.15, 2500, pan); this.tone(160, 50, 0.07, 0.09, 'triangle'); }
    if (name === 'enemy') this.tone(110, 40, 0.12, 0.035, 'sawtooth');
    if (name === 'hit') this.hiss(0.1, 0.12, 3200, pan);
    if (name === 'explode') { this.hiss(0.6, 0.48, 1000, pan); this.tone(100, 22, 0.55, 0.32); }
    if (name === 'rocket') { this.hiss(0.45, 0.22, 1800, pan); this.tone(180, 450, 0.25, 0.08, 'sawtooth'); }
    if (name === 'dash') { this.hiss(0.28, 0.2, 1400); this.tone(150, 60, 0.3, 0.1); }
    if (name === 'damage') { this.hiss(0.22, 0.3, 700); this.tone(160, 50, 0.25, 0.16, 'sawtooth'); }
    if (name === 'pickup' || name === 'upgrade') [440, 554, 659].forEach((f, i) => this.tone(f, f, 0.3, 0.1, 'sine', this.fx, this.ctx.currentTime + i * 0.08));
    if (name === 'wave') [330, 440, 660].forEach((f, i) => this.tone(f, f, 0.2, 0.1, 'triangle', this.fx, this.ctx.currentTime + i * 0.13));
    if (name === 'alert') { this.tone(440, 330, 0.25, 0.1, 'square'); }
    if (name === 'ui') this.tone(700, 1000, 0.08, 0.06);
  }
  update(speed = 0) {
    if (!this.ctx || !this.active || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    this.rotor.gain.setTargetAtTime((0.24 + Math.sin(t * 42) * 0.045) + speed * 0.045, t, 0.015);
    if (this.settings.music && t >= this.nextBeat) {
      const notes = [55, 55, 82.41, 65.41, 55, 73.42, 65.41, 49];
      const f = notes[Math.floor(this.step / 4) % notes.length];
      this.tone(f * (this.step % 4 === 2 ? 2 : 1), f, 0.45, 0.14, 'triangle', this.music);
      if (this.step % 4 === 0) this.tone(90, 35, 0.18, 0.3, 'sine', this.music);
      this.step++; this.nextBeat = t + 0.3;
    }
  }
}
