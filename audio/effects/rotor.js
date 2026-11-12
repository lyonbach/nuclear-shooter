import { LoopingSound } from '../core/effect.js';

export class Rotor extends LoopingSound {
    static key = 'rotor';
    get spinning() { return this.running; }

    render({ voice, at, gain }) {
        const ctx = this.engine.ctx;
        voice.output.gain.value *= gain;
        this.engine.bus('rotor').gain.setTargetAtTime(0.26, at, 0.2);
        // The lifecycle is shared with one-shots; these sources end on stop().
        const noise = ctx.createBufferSource(), pulse = ctx.createOscillator(), motor = ctx.createOscillator();
        const filter = ctx.createBiquadFilter(), body = ctx.createGain();
        const pulseGain = ctx.createGain(), air = ctx.createBiquadFilter(), airGain = ctx.createGain();
        const airPulse = ctx.createGain(), motorGain = ctx.createGain();
        voice.output.disconnect();
        voice.output.connect(voice.panner || this.engine.bus('rotor'));
        if (voice.panner) { voice.panner.disconnect(); voice.panner.connect(this.engine.bus('rotor')); }
        noise.buffer = this.engine.noiseBuffer; noise.loop = true;
        filter.type = 'lowpass'; filter.frequency.value = this.n('noiseCutoff');
        body.gain.value = this.n('bodyGain');
        pulse.type = 'square'; this.basePulse = this.n('bladePulseHz'); pulse.frequency.value = this.basePulse;
        pulseGain.gain.value = this.n('pulseGain');
        air.type = 'bandpass'; this.baseAir = this.n('bladeAirHz'); air.frequency.value = this.baseAir;
        air.Q.value = this.n('airQ'); airGain.gain.value = this.n('airGain'); airPulse.gain.value = this.n('airPulseGain');
        motor.type = 'triangle'; motor.frequency.value = this.n('motorHz'); motorGain.gain.value = this.n('motorGain');
        voice.track(noise, [noise, filter, body, air, airGain]);
        voice.track(pulse, [pulse, pulseGain, airPulse]);
        voice.track(motor, [motor, motorGain]);
        noise.connect(filter); filter.connect(body); body.connect(voice.output);
        noise.connect(air); air.connect(airGain); airGain.connect(voice.output);
        pulse.connect(pulseGain); pulseGain.connect(body.gain);
        pulse.connect(airPulse); airPulse.connect(airGain.gain);
        motor.connect(motorGain); motorGain.connect(voice.output);
        noise.start(at, voice.randomize ? this.engine.random() : 0); pulse.start(at); motor.start(at);
        this.bladePulse = pulse; this.bladeAir = air;
    }

    stop() {
        super.stop();
        this.bladePulse = null; this.bladeAir = null;
        if (this.engine.ctx) this.engine.bus('rotor').gain.setTargetAtTime(0, this.engine.ctx.currentTime, 0.03);
    }

    update({ speed = 0, rotorUpgrade = 0 } = {}) {
        if (!this.running || !this.engine.ctx) return;
        const t = this.engine.ctx.currentTime;
        this.bladePulse.frequency.setTargetAtTime(this.basePulse * Math.pow(1.12, rotorUpgrade), t, 0.06);
        this.bladeAir.frequency.setTargetAtTime(this.baseAir * Math.pow(1.13, rotorUpgrade), t, 0.08);
        this.engine.bus('rotor').gain.setTargetAtTime(0.24 + Math.sin(t * 42) * 0.045 + speed * 0.045, t, 0.015);
    }
}
