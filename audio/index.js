import { AudioEngine } from './core/engine.js';
import { SOUND_DATA } from './sound-data.js';
import { GunShot } from './effects/gun-shot.js';
import { Explosion } from './effects/explosion.js';
import { EnemyShot, AAShot, Flare } from './effects/enemy-shots.js';
import { Hit, Damage, Dash } from './effects/impacts.js';
import { Rocket, Missile } from './effects/rocket.js';
import { Arpeggio, WaveFanfare, UpgradeChime, LowHealthAlarm, MissileWarning, Alert, UiBlip } from './effects/ui.js';
import { Rotor } from './effects/rotor.js';
import { ProceduralScore } from './music/index.js';

export { AudioEngine } from './core/engine.js';
export { SoundEffect, LoopingSound } from './core/effect.js';
export { Tone, Noise, AudioVoice } from './core/primitives.js';
export { GunShot, Explosion, EnemyShot, AAShot, Flare, Hit, Damage, Dash, Rocket, Missile, Rotor, Arpeggio, WaveFanfare, UpgradeChime, LowHealthAlarm, MissileWarning, Alert, UiBlip };

export const EFFECT_CLASSES = [GunShot, EnemyShot, AAShot, Hit, Explosion, Rocket, Missile, Flare, Dash,
    Damage, LowHealthAlarm, MissileWarning, Arpeggio, WaveFanfare, UpgradeChime, Alert, UiBlip, Rotor];

export function createAudioEngine({ data = SOUND_DATA, random = Math.random } = {}) {
    const engine = new AudioEngine({ random });
    for (const Ctor of EFFECT_CLASSES) engine.register(Ctor.key, new Ctor(engine, data[Ctor.key]));
    return { engine, rotor: engine.effect('rotor'), score: new ProceduralScore(engine) };
}
