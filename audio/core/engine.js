// One context and shared buffers per game. Volume belongs on master, not every bus.
export class AudioEngine {
    constructor({ random = Math.random } = {}) {
        this.ctx = null;
        this.random = random;
        this.buses = new Map();
        this.effects = new Map();
        this.voices = new Set();
        this.muted = false;
        this.volume = 1;
        this.listener = { x: 0, y: 0, panDistance: 500, maxDistance: Infinity };
    }

    init(context = null) {
        if (this.ctx) return this;
        const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!context && !Context) return this;
        this.ctx = context || new Context();
        this.ownsContext = !context;
        this.master = this.ctx.createGain();
        this.limiter = this.ctx.createDynamicsCompressor();
        this.limiter.threshold.value = -16;
        this.limiter.ratio.value = 8;
        this.master.connect(this.limiter);
        this.limiter.connect(this.ctx.destination);
        for (const name of ['fx', 'music', 'ui', 'rotor']) {
            const bus = this.ctx.createGain();
            bus.connect(name === 'rotor' ? this.bus('fx') : this.master);
            this.buses.set(name, bus);
        }
        this.bus('music').gain.value = 0.25;
        this.bus('rotor').gain.value = 0;
        this.noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
        const samples = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = this.random() * 2 - 1;
        this.configure();
        return this;
    }

    bus(name) { return this.buses.get(name); }
    get canSchedule() { return this.ctx && (this.ctx.state === 'running' || (this.ctx.state === 'suspended' && typeof this.ctx.startRendering === 'function')); }
    register(name, effect) { this.effects.set(name, effect); return effect; }
    effect(name) { return this.effects.get(name); }
    play(name, options = {}) { return this.effect(name)?.play(options) ?? null; }

    configure({ muted = this.muted, volume = this.volume, music = true } = {}) {
        this.muted = Boolean(muted);
        this.volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 1;
        if (!this.ctx) return;
        this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.03);
        this.bus('music').gain.setTargetAtTime(music ? 0.25 : 0, this.ctx.currentTime, 0.1);
    }

    jitter(param, enabled = true) {
        if (!param || !Number.isFinite(param.value)) throw new TypeError('Missing or invalid sound parameter');
        return param.value * (1 + (enabled && param.spread ? (this.random() * 2 - 1) * param.spread : 0));
    }

    setListener(options = {}) {
        const next = { ...this.listener, ...options };
        if (![next.x, next.y, next.panDistance].every(Number.isFinite) || next.panDistance <= 0 ||
            !(next.maxDistance > 0)) throw new RangeError('Invalid audio listener');
        this.listener = next;
    }

    spatialize(position) {
        if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) throw new TypeError('Position needs finite x and y');
        const { x, y, panDistance, maxDistance } = this.listener;
        return {
            pan: Math.max(-1, Math.min(1, (position.x - x) / panDistance)),
            gain: Math.max(0, 1 - Math.hypot(position.x - x, position.y - y) / maxDistance)
        };
    }

    async resume() { if (this.ctx?.state === 'suspended') await this.ctx.resume(); }

    async dispose() {
        for (const effect of this.effects.values()) effect.stop();
        for (const voice of [...this.voices]) voice.stop();
        for (const bus of this.buses.values()) bus.disconnect();
        this.master?.disconnect();
        this.limiter?.disconnect();
        if (this.ownsContext && this.ctx?.state !== 'closed') await this.ctx?.close();
        this.buses.clear();
        this.ctx = null;
        this.noiseBuffer = null;
    }
}
