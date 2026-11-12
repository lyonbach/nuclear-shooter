import { SoundEffect } from '../core/effect.js';
import { Tone, Noise } from '../core/primitives.js';

// Player gunfire uses 'shot'; these cover the three enemy variants that
// 'play' used to branch on: 'enemy', 'aa' and 'flare'.
export class EnemyShot extends SoundEffect {
    static key = 'enemy';
    render({ pan, gain, at, voice }) {
        new Noise(this.engine, { voice, duration: this.n('noiseDuration'), gain: gain * this.n('noiseGain'), frequency: this.n('noiseCutoff'), pan, time: at });
        new Tone(this.engine, { voice, freq: this.n('subStart'), end: this.n('subEnd'), duration: this.n('subDuration'), gain: gain * this.n('subGain'), type: 'sawtooth', time: at });
    }
}

export class AAShot extends SoundEffect {
    static key = 'aa';
    render({ pan, gain, at, voice }) {
        new Noise(this.engine, { voice, duration: this.n('noiseDuration'), gain: gain * this.n('noiseGain'), frequency: this.n('noiseCutoff'), pan, time: at });
        new Tone(this.engine, { voice, freq: this.n('subStart'), end: this.n('subEnd'), duration: this.n('subDuration'), gain: gain * this.n('subGain'), type: 'sine', time: at });
    }
}

export class Flare extends SoundEffect {
    static key = 'flare';
    render({ pan, gain, at, voice }) {
        const pitch = this.n('pitch');
        new Noise(this.engine, { voice, duration: 0.025, gain: gain * this.n('snapGain'), frequency: 4000 * pitch, pan, time: at });
        new Tone(this.engine, { voice, freq: 110 * pitch, end: 42 * pitch, duration: 0.045, gain: gain * this.n('snapSubGain'), type: 'sine', time: at });
        new Noise(this.engine, { voice, duration: 0.24, gain: gain * this.n('whooshGain'), frequency: 1600 * pitch, pan, time: at });
        new Noise(this.engine, { voice, duration: 0.18, gain: gain * this.n('tailGain'), frequency: 650 * pitch, pan, time: at });
    }
}
