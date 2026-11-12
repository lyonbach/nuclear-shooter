import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createAudioEngine, EFFECT_CLASSES, GunShot, SoundEffect, AudioEngine } from '../audio/index.js';
import { SOUND_DATA } from '../audio/sound-data.js';
import { SoundEngine } from '../audio.js';
import { MusicPlayer } from '../audio/music/player.js';
import { parseSounds } from '../scripts/build-sounds.mjs';
import { MockAudioContext } from './helpers/audio-context.js';

function setup(options = {}) {
    const system = createAudioEngine(options);
    const ctx = new MockAudioContext();
    system.engine.init(ctx);
    return { ...system, ctx };
}

test('all CSV effects have a registered class and default randomization', () => {
    const { engine } = setup();
    assert.deepEqual([...engine.effects.keys()].sort(), Object.keys(SOUND_DATA).sort());
    for (const [key,effect] of engine.effects) {
        assert.equal(effect.randomize, true);
        assert.equal(effect.spatial, SOUND_DATA[key].spatial);
        assert.equal(effect.maxVoices, SOUND_DATA[key].maxVoices);
    }
});

for (const Ctor of EFFECT_CLASSES) test(`${Ctor.key}: valid schedules, sources end and nodes disconnect`, () => {
    // Zero RNG forces rare heavy/debris branches, not just their common variants.
    const { engine, ctx } = setup({ random: () => 0 });
    const first = ctx.nodes.length;
    const effect = engine.effect(Ctor.key), voice = effect.play();
    assert.ok(voice && voice.sources.size);
    assert.equal(effect.voiceCount, 1);
    if (Ctor.key === 'rotor') effect.stop();
    else ctx.advanceTo(5);
    assert.equal(effect.voiceCount, 0);
    assert.equal(engine.voices.size, 0);
    assert.ok(ctx.nodes.slice(first).every(node => node.disconnected));
});

test('settings are isolated between classes, direct constructors and engines', () => {
    const a = setup(), b = setup({data:{shot:{maxVoices:1,noiseGain:{value:0.5,spread:0}}}});
    a.engine.effect('shot').params.noiseGain.value = 0.9;
    const direct = new GunShot(a.engine);
    assert.equal(direct.params.noiseGain.value, 0.24);
    assert.equal(b.engine.effect('shot').params.noiseGain.value, 0.5);
    assert.equal(b.engine.effect('shot').maxVoices, 1);
    assert.equal(a.engine.effect('shot').maxVoices, 8);
    assert.equal(a.engine.effect('enemy').params.noiseGain.value, 0.07);
    assert.equal(SOUND_DATA.shot.noiseGain.value, 0.24);
});

test('voice caps count playbacks, retain all layers, and recover on natural end', () => {
    const { engine, ctx } = setup();
    const effect = engine.effect('explode');
    effect.play(); effect.play();
    const count = ctx.sources.length;
    assert.equal(effect.play(), null);
    assert.equal(ctx.sources.length, count);
    ctx.advanceTo(0.3); // Short cracks ended, long rumble still alive.
    assert.equal(effect.voiceCount, 2);
    assert.equal(effect.play(), null);
    ctx.advanceTo(2);
    assert.equal(effect.voiceCount, 0);
    assert.ok(effect.play());
});

test('future scheduling and ignition tails retain the voice until their final source ends', () => {
    const { engine, ctx } = setup();
    const effect = engine.effect('missile');
    const voice = effect.play({at:10,randomize:false});
    ctx.advanceTo(10.25);
    assert.equal(effect.voiceCount, 1);
    assert.ok([...voice.sources.keys()].some(source => source.startAt === 10.3));
    ctx.advanceTo(11.4);
    assert.equal(effect.voiceCount, 1);
    ctx.advanceTo(12);
    assert.equal(effect.voiceCount, 0);
});

test('stop cancels future sources and releases capacity immediately', () => {
    const { engine, ctx } = setup();
    const effect = engine.effect('rocket'), voice = effect.play({at:10});
    voice.stop(); voice.stop();
    assert.equal(effect.voiceCount, 0);
    assert.ok(ctx.sources.every(source => source.end === 0 && source.onended === null));
    assert.ok(effect.play());
});

test('failed render releases partially built nodes and capacity', () => {
    const { engine } = setup();
    class Broken extends SoundEffect { render() { throw new Error('intentional'); } }
    const effect = new Broken(engine);
    assert.throws(() => effect.play(), /intentional/);
    assert.equal(effect.voiceCount, 0);
    assert.equal(engine.voices.size, 0);
});

test('randomization ranges, per-play override and correlated parameter sampling', () => {
    const { engine } = setup({random:()=>0});
    const effect = engine.effect('explode');
    assert.equal(effect.n('pitch'), 0.84);
    engine.random = () => 1;
    assert.equal(effect.n('pitch'), 1.16);
    const voice = effect.play({randomize:false});
    assert.ok([...voice.sources.keys()].filter(s=>s.type==='buffer').every(s=>s.offset === 0));
    assert.equal(effect.randomize, true);
    effect.randomize = false;
    assert.equal(effect.n('pitch'), 1);
    assert.equal(effect.chance('debrisChance'), false);
});

test('all layers share one spatial output; nonspatial ignores pan and position', () => {
    const { engine } = setup();
    engine.setListener({x:100,y:100,panDistance:100,maxDistance:200});
    const spatial = engine.play('shot',{position:{x:0,y:100}});
    assert.equal(spatial.panner.pan.value, -1);
    assert.equal(spatial.output.gain.value, 0.5);
    for (const nodes of spatial.sources.values()) assert.ok(nodes.at(-1).connections.includes(spatial.output));
    const centered = engine.play('shot',{pan:1,position:{x:0,y:100},spatial:false});
    assert.equal(centered.panner.pan.value, 0);
    assert.equal(centered.output.gain.value, 1);
    assert.equal(engine.play('ui',{pan:1}).panner.pan.value, 0);
    assert.equal(engine.play('ui',{pan:5,spatial:true}).panner.pan.value, 1);
});

test('no StereoPanner support degrades to mono without throwing', () => {
    const ctx = new MockAudioContext(); ctx.createStereoPanner = undefined;
    const { engine } = createAudioEngine(); engine.init(ctx);
    assert.ok(engine.play('shot',{pan:1}));
});

test('unavailable, suspended and muted audio do not allocate voices', async () => {
    const engine = new AudioEngine(); engine.init();
    assert.equal(engine.ctx, null);
    const s = setup(); s.ctx.state = 'suspended';
    assert.equal(s.engine.play('shot'), null);
    await s.engine.resume(); s.engine.configure({muted:true});
    assert.equal(s.engine.play('shot'), null);
    assert.equal(s.engine.voices.size, 0);
});

test('master volume does not overwrite music and rotor bus levels', () => {
    const { engine } = setup();
    engine.configure({volume:0.4,music:true});
    assert.equal(engine.master.gain.value, 0.4);
    assert.equal(engine.bus('music').gain.value, 0.25);
    assert.equal(engine.bus('fx').gain.value, 1);
    assert.equal(engine.bus('rotor').gain.value, 0);
    engine.configure({muted:true,music:false});
    assert.equal(engine.master.gain.value, 0);
    assert.equal(engine.bus('music').gain.value, 0);
});

test('rotor is idempotent, reacts to upgrades, stops, and restarts with fresh sources', () => {
    const { engine, rotor, ctx } = setup();
    rotor.start(); rotor.start();
    assert.equal(ctx.sources.length, 3);
    rotor.update({speed:1,rotorUpgrade:2});
    assert.equal(rotor.bladePulse.frequency.value, 18 * 1.12 ** 2);
    rotor.stop(); assert.equal(rotor.running, false);
    assert.equal(engine.voices.size, 0);
    rotor.start(); assert.equal(ctx.sources.length, 6);
    assert.equal(rotor.voiceCount, 1);
});

test('facade preserves numeric calls and settings-driven rotor/music state', async () => {
    const settings={volume:0.6,muted:false,music:true};
    const sound = new SoundEngine(settings,{AudioClass:null});
    sound.engine.init(new MockAudioContext());
    await sound.init();
    assert.equal(sound.play('shot',0.5,0.2).panner.pan.value,0.5);
    sound.setActive(true); assert.equal(sound.rotor.running,true);
    settings.muted=true; sound.configure();
    assert.equal(sound.rotor.running,false);
    assert.equal(sound.play('shot'),null);
    settings.muted=false; sound.configure();
    assert.equal(sound.rotor.running,true);
    sound.setMusicScene('boss'); sound.update();
    assert.equal(sound.score.step,1);
    sound.setActive(false); assert.equal(sound.rotor.running,false);
    await sound.dispose(); assert.equal(sound.ctx,null);
});

test('MP3 scenes play, crossfade and dispose independently of effects', async () => {
    class FakeAudio { play(){this.paused=false;return Promise.resolve();} pause(){this.paused=true;} }
    const { engine } = setup();
    const player = new MusicPlayer(engine,{AudioClass:FakeAudio});
    player.play(); await Promise.resolve();
    const menu=player.current;
    assert.equal(menu.status,'ready');
    player.setScene('waves'); await Promise.resolve();
    assert.equal(player.current.scene,'waves');
    assert.equal(menu.gain.gain.value,0);
    player.dispose();
    assert.equal(menu.audio.paused,true);
    assert.equal(menu.source.disconnected,true);
    assert.equal(player.timers.size,0);
});

test('failed MP3 clears active track, allowing procedural score fallback', async () => {
    class FailedAudio { play(){return Promise.reject(new Error('missing'));} pause(){} }
    const { engine,score,ctx }=setup();
    const player=new MusicPlayer(engine,{AudioClass:FailedAudio});
    player.play(); await new Promise(resolve=>setImmediate(resolve));
    assert.equal(player.current,null);
    score.update(0,true,'menu',player.current);
    assert.ok(ctx.sources.length>0);
    player.dispose();
});

test('dispose during pending music load ignores late promises', async () => {
    let resolve;
    class PendingAudio { play(){return new Promise(r=>{resolve=r;});} pause(){this.paused=true;} }
    const { engine } = setup();
    const player = new MusicPlayer(engine,{AudioClass:PendingAudio});
    player.play(); const track=player.current; player.dispose(); resolve(); await Promise.resolve();
    assert.equal(player.current,null); assert.equal(track.audio.paused,true);
    assert.equal(track.gain.gain.value,0);
});

test('CSV round trip matches checked-in generated data', async () => {
    const text=await readFile(new URL('../sounds.csv',import.meta.url),'utf8');
    assert.deepEqual(parseSounds(text),SOUND_DATA);
});

test('CSV rejects duplicates, missing values/effects/parameters and conflicting metadata', async () => {
    const text=await readFile(new URL('../sounds.csv',import.meta.url),'utf8');
    const first=text.split('\n')[1];
    const invalid=[
        text+first+'\n',
        text.replace('shot,noiseDuration,0.09','shot,noiseDuration,'),
        text.replace('shot,noiseDuration,0.09,0,true,8','shot,noiseDuration,0.09,1,true,8'),
        text.replace('true,8','yes,8'),
        text.replace('true,8','true,0'),
        text.replace('shot,noiseGain,0.24,0,,,gain','shot,noiseGain,0.24,0,false,7,gain'),
        text.replace(/^ui,.*\n/m,''),
        text.replace(/^hit,ringGain,.*\n/m,''),
        text.replace('0.45,0,true,2','1.5,0,true,2')
    ];
    for(const value of invalid) assert.throws(()=>parseSounds(value));
});
