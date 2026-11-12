import { SoundEffect } from '../core/effect.js';
import { Tone, Noise } from '../core/primitives.js';

export class Arpeggio extends SoundEffect {
    static key = 'pickup';
    render({ gain, at, voice }) {
        for (const [i, f] of [440, 554, 659].entries()) {
            new Tone(this.engine, { voice, freq: f, end: f, duration: 0.3, gain: gain * this.n('noteGain'), type: 'sine', time: at + i * 0.08 });
        }
    }
}

export class WaveFanfare extends SoundEffect {
    static key = 'wave';
    render({ gain, at, voice }) {
        for (const [i, f] of [330, 440, 660].entries()) {
            new Tone(this.engine, { voice, freq: f, end: f, duration: 0.2, gain: gain * this.n('noteGain'), type: 'triangle', time: at + i * 0.13 });
        }
    }
}

export class UpgradeChime extends Arpeggio {
    static key = 'upgrade';
}

export class LowHealthAlarm extends SoundEffect {
    static key = 'lowHealth';
    render({ gain, at, voice }) {
        for (const offset of [0, 0.62]) {
            new Noise(this.engine, { voice, duration: 0.42, gain: gain * this.n('noiseGain'), frequency: 2400, time: at + offset });
            new Tone(this.engine, { voice, freq: 240, end: 110, duration: 0.42, gain: gain * this.n('sawGain'), type: 'sawtooth', time: at + offset });
            new Tone(this.engine, { voice, freq: 420, end: 190, duration: 0.35, gain: gain * this.n('squareGain'), type: 'square', time: at + offset });
        }
    }
}

export class MissileWarning extends SoundEffect {
    static key = 'missileAlert';
    render({ gain, at, voice }) {
        for (const offset of [0, 0.1, 0.2]) {
            new Tone(this.engine, { voice, freq: 980, end: 820, duration: 0.05, gain: gain * this.n('toneGain'), type: 'sine', time: at + offset });
        }
    }
}

export class Alert extends SoundEffect {
    static key = 'alert';
    render({ gain, at, voice }) {
        new Tone(this.engine, { voice, freq: 440, end: 330, duration: 0.25, gain: gain * this.n('toneGain'), type: 'square', time: at });
    }
}

export class UiBlip extends SoundEffect {
    static key = 'ui';
    render({ gain, at, voice }) {
        new Tone(this.engine, { voice, freq: 700, end: 1000, duration: 0.08, gain: gain * this.n('toneGain'), time: at });
    }
}
