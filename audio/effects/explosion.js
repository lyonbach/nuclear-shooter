import { SoundEffect } from '../core/effect.js';
import { Tone, Noise } from '../core/primitives.js';

export class Explosion extends SoundEffect {
    static key = 'explode';
    render({ pan, gain, at, voice }) {
        const pitch = this.n('pitch'), decay = this.n('decay'), crack = this.n('crack');
        const debris = this.chance('debrisChance');

        new Noise(this.engine, { voice, duration: 0.055 * decay, gain: gain * this.n('crackGain'), frequency: 2400 * pitch * crack, pan, time: at });
        new Tone(this.engine, { voice, freq: 82 * pitch, end: 26 * pitch, duration: 0.16 * decay, gain: gain * this.n('bodyGain'), type: 'sine', time: at });
        new Tone(this.engine, { voice, freq: 165 * pitch, end: 72 * pitch, duration: 0.095 * decay, gain: gain * this.n('midGain'), type: 'sine', time: at });
        new Tone(this.engine, { voice, freq: 310 * pitch, end: 130 * pitch, duration: 0.04 * decay, gain: gain * this.n('highGain'), type: 'sine', time: at });
        new Noise(this.engine, { voice, duration: 0.82 * decay, gain: gain * this.n('rumbleGain'), frequency: 1000 * pitch, pan, time: at });
        new Tone(this.engine, { voice, freq: 100 * pitch, end: 22 * pitch, duration: 0.78 * decay, gain: gain * this.n('tailGain'), time: at });
        new Noise(this.engine, { voice, duration: 0.22 * decay, gain: gain * this.n('sparkGain'), frequency: 4200 * pitch * crack, pan, time: at });
        new Noise(this.engine, { voice, duration: 0.09 * decay, gain: gain * this.n('dustGain'), frequency: 6200 * pitch * crack, pan, time: at });
        if (debris) new Noise(this.engine, { voice, duration: 0.055 * decay, gain: gain * this.n('debrisGain'), frequency: 7600 * pitch * crack, pan, time: at });
    }
}
