// Fallback procedural score, moved out of the effects code.
// MP3 tracks continue to be handled by the existing music-track loader.
import { Tone } from '../core/primitives.js';

const SCORES = {
    menu: { tempo: 0.72, notes: [55, 65.41, 73.42, 49, 55, 82.41, 65.41, 49], type: 'sine' },
    waves: { tempo: 0.32, notes: [55, 55, 82.41, 65.41, 55, 73.42, 65.41, 49], type: 'triangle' },
    boss: { tempo: 0.24, notes: [49, 49, 73.42, 55, 46.25, 55, 65.41, 46.25], type: 'sawtooth' },
};

export class ProceduralScore {
    constructor(engine) { this.engine = engine; this.step = 0; this.nextBeat = 0; }

    setScene(scene) { this.scene = scene; this.step = 0; this.nextBeat = 0; }

    update(t, enabled, scene, trackActive) {
        const engine = this.engine;
        if (!engine.ctx || !enabled || trackActive || t < this.nextBeat) return;
        const score = SCORES[scene] || SCORES.menu;
        const beat = this.step % 16;
        const root = score.notes[Math.floor(this.step / 4) % score.notes.length];

        if (beat % 4 === 0) new Tone(engine, { freq: root, end: root * 0.98, duration: score.tempo * 1.8, gain: scene === 'boss' ? 0.22 : 0.16, type: score.type, bus: 'music', time: t });
        if (beat % 2 === 0) {
            const melody = root * ([1, 1.5, 2, 1.5][Math.floor(beat / 2)]);
            new Tone(engine, { freq: melody, end: melody, duration: score.tempo * 0.8, gain: scene === 'menu' ? 0.035 : 0.07, type: 'triangle', bus: 'music', time: t });
        }
        if (beat === 0 && scene !== 'menu') new Tone(engine, { freq: scene === 'boss' ? 38 : 45, end: 28, duration: 0.16, gain: 0.22, type: 'sine', bus: 'music', time: t });
        this.step++; this.nextBeat = t + score.tempo;
    }
}
