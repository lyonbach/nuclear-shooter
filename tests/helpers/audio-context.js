import assert from 'node:assert/strict';

export class MockAudioContext {
    constructor() {
        this.state = 'running'; this.currentTime = 0; this.sampleRate = 8000;
        this.nodes = []; this.sources = []; this.events = [];
        this.destination = this.node('destination');
    }
    param(label, initial = 0) {
        let value = initial;
        const ctx = this;
        const record = (method, next, at, extra) => {
            assert.ok(Number.isFinite(next), `${label}: non-finite value ${next}`);
            assert.ok(Number.isFinite(at) && at >= 0, `${label}: invalid time ${at}`);
            if (method === 'exponential') assert.ok(next > 0);
            ctx.events.push({ label, method, value: next, at, extra }); value = next;
        };
        return {
            get value() { return value; },
            set value(v) { assert.ok(Number.isFinite(v), `${label}: non-finite assignment`); value = v; },
            setValueAtTime: (v,t) => record('set',v,t),
            linearRampToValueAtTime: (v,t) => record('linear',v,t),
            exponentialRampToValueAtTime: (v,t) => record('exponential',v,t),
            setTargetAtTime: (v,t,c) => record('target',v,t,c)
        };
    }
    node(type) {
        const node = { type, connections: [], disconnected: false,
            connect(other) { assert.ok(other, 'Cannot connect to undefined'); this.connections.push(other); return other; },
            disconnect() { this.disconnected = true; this.connections = []; }
        };
        this.nodes.push(node); return node;
    }
    source(type) {
        const node = this.node(type);
        node.onended = null; node.started = false; node.end = Infinity; node.done = false;
        node.start = (at = 0, offset = 0) => {
            assert.equal(node.started, false); assert.ok(Number.isFinite(at) && at >= 0);
            assert.ok(Number.isFinite(offset) && offset >= 0);
            node.started = true; node.startAt = at; node.offset = offset;
        };
        node.stop = (at = this.currentTime) => { assert.ok(Number.isFinite(at)); node.end = at; };
        this.sources.push(node); return node;
    }
    createOscillator() { return Object.assign(this.source('oscillator'), { frequency: this.param('frequency'), type: 'sine' }); }
    createBufferSource() { return Object.assign(this.source('buffer'), { buffer: null, loop: false }); }
    createGain() { return Object.assign(this.node('gain'), { gain: this.param('gain', 1) }); }
    createBiquadFilter() { return Object.assign(this.node('filter'), { frequency: this.param('filterHz'), Q: this.param('Q', 1) }); }
    createStereoPanner() { return Object.assign(this.node('panner'), { pan: this.param('pan') }); }
    createDynamicsCompressor() { return Object.assign(this.node('compressor'), { threshold: this.param('threshold'), ratio: this.param('ratio') }); }
    createMediaElementSource() { return this.node('media'); }
    createBuffer(channels, length, rate) {
        const data = Array.from({length:channels}, () => new Float32Array(length));
        return { duration:length/rate, getChannelData: i => data[i] };
    }
    advanceTo(time) {
        assert.ok(time >= this.currentTime);
        this.currentTime = time;
        for (const node of this.sources) if (!node.done && node.end <= time) {
            node.done = true; node.onended?.();
        }
    }
    async resume() { this.state = 'running'; }
    async close() { this.state = 'closed'; }
}
