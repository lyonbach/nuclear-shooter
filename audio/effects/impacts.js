import { SoundEffect } from '../core/effect.js';
import { Tone, Noise } from '../core/primitives.js';

export class Hit extends SoundEffect {
    static key = 'hit';
    render({ pan, gain, at, voice }) {
        const pitch = this.n('pitch'), decay = this.n('decay');
        const heavy = this.chance('heavyChance');

        new Noise(this.engine, { voice, duration: 0.01 * decay, gain: gain * this.n('snapGain'), frequency: 7200 * pitch, pan, time: at });
        new Noise(this.engine, { voice, duration: 0.028 * decay, gain: gain * this.n('bodyGain'), frequency: 2800 * pitch, pan, time: at });
        new Noise(this.engine, { voice, duration: 0.045 * decay, gain: gain * this.n('thudGain'), frequency: 800 * pitch, pan, time: at });
        new Tone(this.engine, { voice, freq: 85 * pitch, end: 28 * pitch, duration: 0.055 * decay, gain: gain * this.n('subGain'), type: 'sine', time: at });
        new Tone(this.engine, { voice, freq: 1050 * pitch, end: 680 * pitch, duration: 0.025 * decay, gain: gain * this.n('ringGain'), type: 'sine', time: at });
        if (heavy) {
            new Noise(this.engine, { voice, duration: 0.05 * decay, gain: gain * this.n('heavyGain'), frequency: 1200 * pitch, pan, time: at });
            new Tone(this.engine, { voice, freq: 58 * pitch, end: 22 * pitch, duration: 0.07 * decay, gain: gain * this.n('heavySubGain'), type: 'sine', time: at });
            new Tone(this.engine, { voice, freq: 700 * pitch, end: 420 * pitch, duration: 0.04 * decay, gain: gain * this.n('heavyRingGain'), type: 'sine', time: at });
        }
    }
}

export class Damage extends SoundEffect {
    static key = 'damage';
    render({ pan, gain, at, voice }) {
        new Noise(this.engine, { voice, duration: 0.22, gain: gain * this.n('noiseGain'), frequency: 700, pan, time: at });
        new Tone(this.engine, { voice, freq: 160, end: 50, duration: 0.25, gain: gain * this.n('subGain'), type: 'sawtooth', time: at });
    }
}

export class Dash extends SoundEffect {
    static key = 'dash';
    render({ pan, gain, at, voice }) {
        new Noise(this.engine, { voice, duration: 0.28, gain: gain * this.n('noiseGain'), frequency: 1400, time: at });
        new Tone(this.engine, { voice, freq: 150, end: 60, duration: 0.3, gain: gain * this.n('subGain'), time: at });
    }
}
