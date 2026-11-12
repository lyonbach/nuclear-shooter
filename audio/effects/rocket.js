import { SoundEffect } from '../core/effect.js';
import { Tone, Noise } from '../core/primitives.js';
import { ROCKET_IGNITION_DELAY } from '../../core.js';

export class Rocket extends SoundEffect {
    static key = 'rocket';
    render({ pan, gain, at, voice }) {
        const whooshAt = at + ROCKET_IGNITION_DELAY;
        const pitch = this.n('pitch'), duration = this.n('decay');
        new Noise(this.engine, { voice, duration: 0.06, gain: gain * this.n('snapGain'), frequency: 4200 * pitch, pan, time: at });
        new Tone(this.engine, { voice, freq: 125 * pitch, end: 45 * pitch, duration: 0.08, gain: gain * this.n('snapSubGain'), type: 'sine', time: at });
        new Noise(this.engine, { voice, duration: 1.05 * duration, gain: gain * this.n('whooshGain'), frequency: 1700 * pitch, pan, time: whooshAt });
        new Noise(this.engine, { voice, duration: 0.9 * duration, gain: gain * this.n('whooshTailGain'), frequency: 650 * pitch, pan, time: whooshAt });
    }
}

export class Missile extends SoundEffect {
    static key = 'missile';
    render({ pan, gain, at, voice }) {
        const whooshAt = at + ROCKET_IGNITION_DELAY;
        const pitch = this.n('pitch'), duration = this.n('decay');
        new Noise(this.engine, { voice, duration: 0.05, gain: gain * this.n('snapGain'), frequency: 4000 * pitch, pan, time: at });
        new Tone(this.engine, { voice, freq: 115 * pitch, end: 40 * pitch, duration: 0.07, gain: gain * this.n('snapSubGain'), type: 'sine', time: at });
        new Noise(this.engine, { voice, duration: 1.15 * duration, gain: gain * this.n('whooshGain'), frequency: 1500 * pitch, pan, time: whooshAt });
        new Noise(this.engine, { voice, duration: 0.95 * duration, gain: gain * this.n('whooshTailGain'), frequency: 650 * pitch, pan, time: whooshAt });
    }
}
