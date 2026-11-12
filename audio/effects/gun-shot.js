import { SoundEffect } from '../core/effect.js';
import { Tone, Noise } from '../core/primitives.js';

export class GunShot extends SoundEffect {
    static key = 'shot';
    render({ pan, gain, at, voice }) {
        new Noise(this.engine, { voice, duration: this.n('noiseDuration'), gain: gain * this.n('noiseGain'), frequency: this.n('noiseCutoff'), pan, time: at });
        new Noise(this.engine, { voice, duration: this.n('sparkDuration'), gain: gain * this.n('sparkGain'), frequency: this.n('sparkCutoff'), pan, time: at });
        new Tone(this.engine, { voice, freq: this.n('subStart'), end: this.n('subEnd'), duration: this.n('subDuration'), gain: gain * this.n('subGain'), type: 'sine', time: at });
    }
}
