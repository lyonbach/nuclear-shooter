import { createAudioEngine } from './audio/index.js';
import { MusicPlayer } from './audio/music/player.js';

// Compatibility facade: the game can keep sound.play(name, pan, gain).
export class SoundEngine {
    constructor(settings, options = {}) {
        this.settings = settings;
        Object.assign(this, createAudioEngine(options));
        this.musicPlayer = new MusicPlayer(this.engine, options);
        this.active = false;
        this.musicScene = 'menu';
    }
    get ctx() { return this.engine.ctx; }
    get musicTrack() { return this.musicPlayer.current; }

    async init() {
        try {
            this.engine.init();
            if (!this.ctx) return;
            await this.engine.resume();
            this.configure();
            this.musicPlayer.play();
            if (this.active && !this.settings.muted) this.rotor.start();
        } catch (error) {
            // Audio must not prevent a sortie starting.
            console.warn('Audio unavailable; continuing without sound.', error);
        }
    }

    configure() {
        this.engine.configure(this.settings);
        if (!this.active || this.settings.muted) this.rotor.stop();
        else if (this.ctx?.state === 'running') this.rotor.start();
    }
    setActive(active) {
        this.active = Boolean(active);
        if (this.active && !this.settings.muted) this.rotor.start();
        else this.rotor.stop();
    }
    setMusicScene(scene) {
        if (scene === this.musicScene) return;
        this.musicScene = scene;
        this.score.setScene(scene);
        this.musicPlayer.setScene(scene);
    }
    play(name, panOrOptions = 0, gain = 1) {
        if (this.settings.muted) return null;
        return this.engine.play(name, typeof panOrOptions === 'object' && panOrOptions !== null
            ? panOrOptions : { pan: panOrOptions, gain });
    }
    setListener(options) { this.engine.setListener(options); }
    update(speed = 0, rotorUpgrade = 0) {
        if (this.ctx?.state !== 'running') return;
        this.rotor.update({ speed, rotorUpgrade });
        this.score.update(this.ctx.currentTime, this.settings.music && !this.settings.muted, this.musicScene, this.musicTrack);
    }
    async dispose() { this.musicPlayer.dispose(); await this.engine.dispose(); }
}
