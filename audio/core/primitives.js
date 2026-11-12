// A voice owns every layer, including future sources. No wall-clock timers.
export class AudioVoice {
    constructor(engine, { pan = 0, gain = 1, bus = 'fx', randomize = true, onEnd = () => {} } = {}) {
        this.engine = engine;
        this.randomize = randomize;
        this.onEnd = onEnd;
        this.sources = new Map();
        this.nodes = new Set();
        this.sealed = false;
        this.ended = false;
        this.output = engine.ctx.createGain();
        this.output.gain.value = gain;
        this.nodes.add(this.output);
        const destination = typeof bus === 'string' ? engine.bus(bus) : bus;
        if (engine.ctx.createStereoPanner) {
            this.panner = engine.ctx.createStereoPanner();
            this.panner.pan.value = Math.max(-1, Math.min(1, pan));
            this.nodes.add(this.panner);
            this.output.connect(this.panner);
            this.panner.connect(destination);
        } else this.output.connect(destination);
        engine.voices.add(this);
    }

    track(source, nodes) {
        for (const node of nodes) this.nodes.add(node);
        this.sources.set(source, nodes);
        source.onended = () => {
            if (!this.sources.has(source)) return;
            this.sources.delete(source);
            source.onended = null;
            for (const node of nodes) { node.disconnect(); this.nodes.delete(node); }
            if (this.sealed && !this.sources.size) this.finish();
        };
    }

    seal() { this.sealed = true; if (!this.sources.size) this.finish(); }

    finish() {
        if (this.ended) return;
        this.ended = true;
        for (const node of this.nodes) node.disconnect();
        this.nodes.clear();
        this.engine.voices.delete(this);
        this.onEnd();
    }

    stop() {
        if (this.ended) return;
        for (const source of this.sources.keys()) {
            source.onended = null;
            try { source.stop(); } catch { /* Already ended. */ }
        }
        this.sources.clear();
        this.finish();
    }
}

export class Tone {
    constructor(engine, { freq, end, duration, gain = 0.1, type = 'sine', bus = 'fx', time, pan = 0, voice } = {}) {
        if (![freq, end, duration, gain].every(Number.isFinite) || freq <= 0 || end <= 0 || duration <= 0 || gain < 0)
            throw new RangeError('Invalid tone');
        const owned = !voice;
        this.voice = voice || new AudioVoice(engine, { pan, bus });
        const ctx = engine.ctx, at = time ?? ctx.currentTime;
        const osc = ctx.createOscillator(), envelope = ctx.createGain();
        this.voice.track(osc, [osc, envelope]);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, at);
        osc.frequency.exponentialRampToValueAtTime(Math.max(10, end), at + duration);
        envelope.gain.setValueAtTime(0, at);
        envelope.gain.linearRampToValueAtTime(gain, at + Math.min(0.006, duration / 2));
        envelope.gain.exponentialRampToValueAtTime(0.001, at + duration);
        osc.connect(envelope); envelope.connect(this.voice.output);
        osc.start(at); osc.stop(at + duration + 0.03);
        if (owned) this.voice.seal();
    }
    dispose() { this.voice?.stop(); }
}

export class Noise {
    constructor(engine, { duration, gain = 0.1, frequency = 1000, bus = 'fx', time, pan = 0, voice } = {}) {
        if (![duration, gain, frequency].every(Number.isFinite) || duration <= 0 || gain < 0 || frequency <= 0)
            throw new RangeError('Invalid noise');
        const owned = !voice;
        this.voice = voice || new AudioVoice(engine, { pan, bus });
        const ctx = engine.ctx, at = time ?? ctx.currentTime;
        const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), envelope = ctx.createGain();
        this.voice.track(source, [source, filter, envelope]);
        source.buffer = engine.noiseBuffer;
        source.loop = true; // A randomized tail must never run past the shared buffer.
        filter.type = 'lowpass'; filter.frequency.value = frequency;
        envelope.gain.setValueAtTime(gain, at);
        envelope.gain.exponentialRampToValueAtTime(0.001, at + duration);
        source.connect(filter); filter.connect(envelope); envelope.connect(this.voice.output);
        source.start(at, this.voice.randomize ? engine.random() : 0);
        source.stop(at + duration);
        if (owned) this.voice.seal();
    }
    dispose() { this.voice?.stop(); }
}
