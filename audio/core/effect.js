import { AudioVoice } from './primitives.js';
import { SOUND_DATA } from '../sound-data.js';

export class SoundEffect {
    static key = null;
    constructor(engine, options = {}) {
        this.engine = engine;
        const data = { ...SOUND_DATA[this.constructor.key], ...options };
        const { spatial = false, maxVoices = 8, randomize = true, ...params } = data;
        this.spatial = spatial;
        this.maxVoices = maxVoices;
        this.randomize = randomize;
        this.params = Object.fromEntries(Object.entries(params).map(([key, value]) => [key, { ...value }]));
        this.voices = new Set();
    }
    get voiceCount() { return this.voices.size; }

    play({ pan = 0, gain = 1, at, position, spatial = this.spatial, randomize = this.randomize } = {}) {
        const { engine } = this;
        if (!engine.canSchedule || engine.muted || this.voiceCount >= this.maxVoices) return null;
        if (![pan, gain, at ?? engine.ctx.currentTime].every(Number.isFinite) || gain < 0)
            throw new RangeError('Invalid playback options');
        const placement = spatial && position ? engine.spatialize(position) : { pan: spatial ? pan : 0, gain: 1 };
        const voice = new AudioVoice(engine, {
            pan: placement.pan, gain: placement.gain, randomize,
            onEnd: () => this.voices.delete(voice)
        });
        this.voices.add(voice);
        this.sampleCache = new Map();
        this.playRandomize = randomize;
        try {
            this.render({ pan: placement.pan, gain, at: Math.max(engine.ctx.currentTime, at ?? engine.ctx.currentTime), voice });
            voice.seal();
            return voice;
        } catch (error) { voice.stop(); throw error; }
        finally { this.sampleCache = null; this.playRandomize = undefined; }
    }

    n(key) {
        if (this.sampleCache?.has(key)) return this.sampleCache.get(key);
        const result = this.engine.jitter(this.params[key], this.playRandomize ?? this.randomize);
        this.sampleCache?.set(key, result);
        return result;
    }
    s(key) { return this.n(key); }
    chance(key) { return (this.playRandomize ?? this.randomize) ? this.engine.random() < this.n(key) : false; }
    stop() { for (const voice of [...this.voices]) voice.stop(); }
    render() { throw new Error(`${this.constructor.name} must implement render()`); }
}

export class LoopingSound extends SoundEffect {
    get running() { return this.voiceCount > 0; }
    start(options = {}) { return this.running ? [...this.voices][0] : this.play(options); }
    update() {}
}
