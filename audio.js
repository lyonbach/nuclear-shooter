import { ROCKET_IGNITION_DELAY } from './core.js';

// Music uses local soundtrack files, with synthesized scores as an offline fallback.
export class SoundEngine {
  constructor(settings) {
    this.settings = settings; this.active = false; this.step = 0; this.nextBeat = 0;
    this.musicScene = 'menu'; this.musicTrack = null; this.trackStates = new Map();
  }
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
        const rotorNoise = this.ctx.createGain(); rotorNoise.gain.value = 0.62;
        const bladePulse = this.ctx.createOscillator(), bladePulseGain = this.ctx.createGain();
        const bladeAir = this.ctx.createBiquadFilter(), bladeAirGain = this.ctx.createGain(), bladeAirPulseGain = this.ctx.createGain();
        bladePulse.type = 'square'; bladePulse.frequency.value = 18; bladePulseGain.gain.value = 0.2;
        bladeAir.type = 'bandpass'; bladeAir.frequency.value = 1550; bladeAir.Q.value = 1.2; bladeAirGain.gain.value = 0.09; bladeAirPulseGain.gain.value = 0.075;
        noise.connect(filter); filter.connect(rotorNoise); rotorNoise.connect(this.rotor);
        noise.connect(bladeAir); bladeAir.connect(bladeAirGain); bladeAirGain.connect(this.rotor);
        bladePulse.connect(bladePulseGain); bladePulseGain.connect(rotorNoise.gain); noise.start(); bladePulse.start();
        bladePulse.connect(bladeAirPulseGain); bladeAirPulseGain.connect(bladeAirGain.gain);
        this.bladePulse = bladePulse; this.bladeAir = bladeAir;
        const engine = this.ctx.createOscillator(); engine.type = 'triangle'; engine.frequency.value = 43;
        const engineGain = this.ctx.createGain(); engineGain.gain.value = 0.12;
        engine.connect(engineGain); engineGain.connect(this.rotor); engine.start();
        this.rotor.gain.value = 0;
      }
      await this.ctx.resume(); this.configure(); this.playMusicTrack(this.musicScene);
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
  setMusicScene(scene) {
    if (this.musicScene === scene) return;
    this.musicScene = scene;
    this.step = 0;
    this.nextBeat = 0;
    if (this.musicTrack) {
      this.musicTrack.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      const previous = this.musicTrack;
      this.musicTrack = null;
      setTimeout(() => { if (this.musicTrack !== previous) previous.audio.pause(); }, 350);
    }
    this.playMusicTrack(scene);
  }
  playMusicTrack(scene) {
    if (!this.ctx || !scene) return;
    if (this.musicTrack?.scene === scene && !this.musicTrack.audio.paused) return;
    const paths = {
      menu: 'sound/Blackout Protocol - Main Menu.mp3',
      waves: 'sound/Blackout Protocol - Enemy Waves.mp3',
      boss: 'sound/Blackout Protocol - Goliath On The Run.mp3'
    };
    const path = paths[scene];
    const existing = this.trackStates.get(scene);
    if (existing) {
      if (existing.status === 'ready') this.startMusicTrack(existing.track);
      return;
    }
    if (!path || typeof Audio === 'undefined') return;
    try {
      const audio = new Audio(path);
      audio.loop = true; audio.preload = 'auto';
      const source = this.ctx.createMediaElementSource(audio), gain = this.ctx.createGain();
      gain.gain.value = 0; source.connect(gain); gain.connect(this.music);
      const track = { audio, gain, scene };
      this.trackStates.set(scene, { status: 'loading', track });
      this.startMusicTrack(track);
    } catch (error) {
      this.trackStates.set(scene, { status: 'failed' });
      console.warn(`Could not load music track: ${path}; using synthesized music.`, error);
    }
  }
  startMusicTrack(track) {
    if (this.musicScene !== track.scene) { track.audio.pause(); return; }
    if (this.musicTrack && this.musicTrack !== track) {
      this.musicTrack.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      const previous = this.musicTrack;
      setTimeout(() => { if (this.musicTrack !== previous) previous.audio.pause(); }, 350);
    }
    this.musicTrack = track;
    try { track.audio.currentTime = 0; } catch { /* Metadata may not be ready yet. */ }
    track.audio.play().then(() => {
      this.trackStates.set(track.scene, { status: 'ready', track });
      if (this.musicTrack !== track) { track.audio.pause(); return; }
      track.gain.gain.setTargetAtTime(1, this.ctx.currentTime, 0.35);
    }).catch(error => {
      // Switching scenes pauses a pending play(); that is not a load failure.
      if (error?.name === 'AbortError') { this.trackStates.set(track.scene, { status: 'ready', track }); return; }
      this.trackStates.set(track.scene, { status: 'failed' });
      if (this.musicTrack === track) this.musicTrack = null;
      track.audio.pause();
      const path = {
        menu: 'sound/Blackout Protocol - Main Menu.mp3',
        waves: 'sound/Blackout Protocol - Enemy Waves.mp3',
        boss: 'sound/Blackout Protocol - Goliath On The Run.mp3'
      }[track.scene];
      console.warn(`Could not play music track: ${path}; using synthesized music.`);
    });
  }
  tone(freq, end, duration, volume = 0.1, type = 'sine', bus = this.fx, time = this.ctx?.currentTime) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, time); osc.frequency.exponentialRampToValueAtTime(Math.max(10, end), time + duration);
    gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(volume, time + 0.006); gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(gain); gain.connect(bus); osc.start(time); osc.stop(time + duration + 0.03);
  }
  hiss(duration, volume, frequency, pan = 0, time = this.ctx?.currentTime) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const source = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter(), gain = this.ctx.createGain();
    source.buffer = this.noise; filter.type = 'lowpass'; filter.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, time); gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    source.connect(filter); filter.connect(gain);
    if (this.ctx.createStereoPanner) { const panner = this.ctx.createStereoPanner(); panner.pan.value = Math.max(-1, Math.min(1, pan)); gain.connect(panner); panner.connect(this.fx); }
    else gain.connect(this.fx);
    source.start(time, Math.random()); source.stop(time + duration);
  }
  play(name, pan = 0, gain = 1) {
    if (!this.ctx || this.settings.muted) return;
    const level = volume => volume * gain;
    const random = (value, spread = 0.1) => value * (1 + (Math.random() * 2 - 1) * spread);
    if (name === 'shot') { this.hiss(0.09, level(0.24), 4200, pan); this.hiss(0.04, level(0.12), 7200, pan); this.tone(180, 65, 0.06, level(0.07), 'sine'); }
    if (name === 'enemy') { this.hiss(0.05, level(0.07), 1900, pan); this.tone(120, 45, 0.12, level(0.045), 'sawtooth'); }
    if (name === 'aa') { this.hiss(0.028, level(0.045), 1500, pan); this.tone(92, 58, 0.065, level(0.04), 'triangle'); }
    if (name === 'hit') { const pitch=random(1,0.08),decay=random(1,0.12),heavy=Math.random()<1/20; this.hiss(0.01*decay, level(0.07), 7200*pitch, pan); this.hiss(0.028*decay, level(0.17), 2800*pitch, pan); this.hiss(0.045*decay, level(0.1), 800*pitch, pan); this.tone(85*pitch, 28*pitch, 0.055*decay, level(0.14), 'sine'); this.tone(1050*pitch, 680*pitch, 0.025*decay, level(0.016), 'sine'); if(heavy){this.hiss(0.05*decay, level(0.12), 1200*pitch, pan);this.tone(58*pitch, 22*pitch, 0.07*decay, level(0.13), 'sine');this.tone(700*pitch, 420*pitch, 0.04*decay, level(0.024), 'sine');} }
    if (name === 'explode') { const pitch=random(1,0.16),decay=random(1,0.14),crack=random(1,0.2),debris=Math.random()<0.45; this.hiss(0.82*decay, level(0.48), 1000*pitch, pan); this.tone(100*pitch, 22*pitch, 0.78*decay, level(0.32)); this.hiss(0.22*decay, level(0.2), 4200*pitch*crack, pan); this.hiss(0.09*decay, level(0.11), 6200*pitch*crack, pan); if(debris)this.hiss(0.055*decay, level(0.06), 7600*pitch*crack, pan); }
    if (name === 'rocket') { const whooshAt=this.ctx.currentTime+ROCKET_IGNITION_DELAY,pitch=random(1,0.08),duration=random(1,0.1); this.hiss(0.06, level(0.24), 4200*pitch, pan); this.tone(125*pitch, 45*pitch, 0.08, level(0.1), 'sine'); this.hiss(1.05*duration, level(0.72), 1700*pitch, pan, whooshAt); this.hiss(0.9*duration, level(0.24), 650*pitch, pan, whooshAt); }
    if (name === 'missile') { const whooshAt=this.ctx.currentTime+ROCKET_IGNITION_DELAY,pitch=random(1,0.08),duration=random(1,0.1); this.hiss(0.05, level(0.18), 4000*pitch, pan); this.tone(115*pitch, 40*pitch, 0.07, level(0.08), 'sine'); this.hiss(1.15*duration, level(0.68), 1500*pitch, pan, whooshAt); this.hiss(0.95*duration, level(0.28), 650*pitch, pan, whooshAt); }
    if (name === 'flare') { const pitch=random(1,0.1); this.hiss(0.025, level(0.13), 4000*pitch, pan); this.tone(110*pitch, 42*pitch, 0.045, level(0.06), 'sine'); this.hiss(0.24, level(0.25), 1600*pitch, pan); this.hiss(0.18, level(0.1), 650*pitch, pan); }
    if (name === 'dash') { this.hiss(0.28, level(0.2), 1400); this.tone(150, 60, 0.3, level(0.1)); }
    if (name === 'damage') { this.hiss(0.22, level(0.3), 700); this.tone(160, 50, 0.25, level(0.16), 'sawtooth'); }
    if (name === 'pickup' || name === 'upgrade') [440, 554, 659].forEach((f, i) => this.tone(f, f, 0.3, level(0.1), 'sine', this.fx, this.ctx.currentTime + i * 0.08));
    if (name === 'wave') [330, 440, 660].forEach((f, i) => this.tone(f, f, 0.2, level(0.1), 'triangle', this.fx, this.ctx.currentTime + i * 0.13));
    if (name === 'alert') { this.tone(440, 330, 0.25, level(0.1), 'square'); }
    if (name === 'ui') this.tone(700, 1000, 0.08, level(0.06));
  }
  update(speed = 0, rotorUpgrade = 0) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    this.bladePulse?.frequency.setTargetAtTime(18 * Math.pow(1.12, rotorUpgrade), t, 0.06);
    this.bladeAir?.frequency.setTargetAtTime(1550 * Math.pow(1.13, rotorUpgrade), t, 0.08);
    if (this.active) this.rotor.gain.setTargetAtTime((0.24 + Math.sin(t * 42) * 0.045) + speed * 0.045, t, 0.015);
    if (!this.settings.music || this.musicTrack || t < this.nextBeat) return;
    const scores = {
      menu: { tempo: 0.72, notes: [55, 65.41, 73.42, 49, 55, 82.41, 65.41, 49], type: 'sine' },
      waves: { tempo: 0.32, notes: [55, 55, 82.41, 65.41, 55, 73.42, 65.41, 49], type: 'triangle' },
      boss: { tempo: 0.24, notes: [49, 49, 73.42, 55, 46.25, 55, 65.41, 46.25], type: 'sawtooth' }
    };
    const score = scores[this.musicScene] || scores.menu;
    const beat = this.step % 16, root = score.notes[Math.floor(this.step / 4) % score.notes.length];
    if (beat % 4 === 0) this.tone(root, root * 0.98, score.tempo * 1.8, this.musicScene === 'boss' ? 0.22 : 0.16, score.type, this.music);
    if (beat % 2 === 0) {
      const melody = root * ([1, 1.5, 2, 1.5][Math.floor(beat / 2)]);
      this.tone(melody, melody, score.tempo * 0.8, this.musicScene === 'menu' ? 0.035 : 0.07, 'triangle', this.music);
    }
    if (beat === 0 && this.musicScene !== 'menu') this.tone(this.musicScene === 'boss' ? 38 : 45, 28, 0.16, 0.22, 'sine', this.music);
    this.step++; this.nextBeat = t + score.tempo;
  }
}
