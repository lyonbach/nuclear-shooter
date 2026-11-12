const MUSIC_PATHS = {
    menu: 'sound/Blackout Protocol - Main Menu.mp3',
    waves: 'sound/Blackout Protocol - Enemy Waves.mp3',
    boss: 'sound/Blackout Protocol - Goliath On The Run.mp3'
};

// Local MP3 playback, separate from effects and procedural fallback.
export class MusicPlayer {
    constructor(engine, { AudioClass = globalThis.Audio } = {}) {
        this.engine = engine; this.AudioClass = AudioClass;
        this.scene = 'menu'; this.current = null; this.tracks = new Map();
        this.timers = new Set(); this.disposed = false;
    }
    fadeOut(track) {
        if (!track) return;
        track.gain.gain.setTargetAtTime(0, this.engine.ctx.currentTime, 0.08);
        const timer = setTimeout(() => {
            this.timers.delete(timer);
            if (this.current !== track) track.audio.pause();
        }, 350);
        this.timers.add(timer);
    }
    setScene(scene) {
        if (scene === this.scene) return;
        this.scene = scene;
        this.fadeOut(this.current);
        this.current = null;
        this.play();
    }
    play() {
        const ctx = this.engine.ctx;
        if (!ctx || this.disposed || !this.AudioClass || !MUSIC_PATHS[this.scene]) return;
        if (this.current?.scene === this.scene) return;
        let track = this.tracks.get(this.scene);
        if (track?.status === 'failed') return;
        try {
            if (!track) {
                const audio = new this.AudioClass(MUSIC_PATHS[this.scene]);
                // HTTP preview assets may redirect across origins; file:// tracks
                // must retain the game's original non-CORS media loading.
                if (globalThis.location?.protocol !== 'file:') audio.crossOrigin = 'anonymous';
                audio.loop = true; audio.preload = 'auto';
                const source = ctx.createMediaElementSource(audio), gain = ctx.createGain();
                gain.gain.value = 0; source.connect(gain); gain.connect(this.engine.bus('music'));
                track = { audio, source, gain, scene: this.scene, status: 'loading', attempt: 0 };
                this.tracks.set(this.scene, track);
            }
            this.current = track;
            const attempt = ++track.attempt;
            try { track.audio.currentTime = 0; } catch { /* Metadata may be pending. */ }
            Promise.resolve(track.audio.play()).then(() => {
                if (this.disposed || attempt !== track.attempt) return;
                track.status = 'ready';
                if (this.current !== track) { track.audio.pause(); return; }
                track.gain.gain.setTargetAtTime(1, ctx.currentTime, 0.35);
            }).catch(error => {
                if (this.disposed || attempt !== track.attempt) return;
                track.status = error?.name === 'AbortError' ? 'ready' : 'failed';
                if (this.current === track) this.current = null;
                track.audio.pause();
                if (track.status === 'failed') console.warn(`Could not play music for ${track.scene}; using synthesized music.`);
            });
        } catch {
            if (track) { track.status = 'failed'; track.audio.pause(); }
            this.current = null;
        }
    }
    dispose() {
        this.disposed = true;
        for (const timer of this.timers) clearTimeout(timer);
        this.timers.clear();
        for (const track of this.tracks.values()) {
            track.audio.pause(); track.source.disconnect(); track.gain.disconnect();
        }
        this.tracks.clear(); this.current = null;
    }
}
