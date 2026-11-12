// Run from a browser console/module harness, not Node's test runner.
import { createAudioEngine, EFFECT_CLASSES } from '../audio/index.js';

function seeded() {
    let state = 123456789;
    return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
}
function check(condition, message) { if (!condition) throw new Error(message); }

async function renderEffect(name, options = {}) {
    const ctx = new OfflineAudioContext(2, 16000, 8000);
    const { engine } = createAudioEngine({ random: seeded() });
    engine.init(ctx);
    const voice = engine.play(name, options);
    check(Boolean(voice), `${name} did not schedule`);
    if (name === 'rotor') for (const source of voice.sources.keys()) source.stop(1);
    const buffer = await ctx.startRendering();
    const channels = [buffer.getChannelData(0), buffer.getChannelData(1)];
    check(channels.every(c => c.every(Number.isFinite)), `${name} contains invalid samples`);
    const energy = channels.map(c => c.reduce((sum,sample) => sum + sample * sample, 0));
    check(energy[0] + energy[1] > 0, `${name} rendered silence`);
    check(engine.effect(name).voiceCount === 0, `${name} voice was not released`);
    check(engine.voices.size === 0, `${name} left live voices`);
    await engine.dispose();
    return { channels, energy };
}

export async function runAudioBrowserChecks() {
    const effects = [];
    for (const Ctor of EFFECT_CLASSES) {
        const result = await renderEffect(Ctor.key);
        effects.push({effect:Ctor.key,energy:result.energy.map(v=>Number(v.toFixed(5)))});
    }
    const a = await renderEffect('explode',{randomize:false});
    const b = await renderEffect('explode',{randomize:false});
    // Separate browser DSP contexts can differ by a few Float32 rounding bits.
    const maxDelta = Math.max(...a.channels.map((c,i)=>c.reduce((max,sample,j)=>Math.max(max,Math.abs(sample-b.channels[i][j])),0)));
    check(maxDelta < 1e-6, `Deterministic PCM mismatch: ${maxDelta}`);
    const varied = await renderEffect('explode',{randomize:true});
    check(a.channels[0].some((v,i)=>v!==varied.channels[0][i]), 'Randomization had no audible waveform effect');
    const right = await renderEffect('shot',{pan:1,spatial:true,randomize:false});
    check(right.energy[0] < right.energy[1] * 1e-8, 'Spatial right-pan leaked left');
    const centered = await renderEffect('shot',{pan:1,spatial:false,randomize:false});
    check(Math.abs(centered.energy[0]-centered.energy[1])<1e-6,'Nonspatial output is not centered');

    const ctx = new AudioContext();
    const { engine } = createAudioEngine();
    engine.init(ctx);
    await ctx.resume();
    engine.configure({volume:0}); // Schedule real audio without test playback being loud.
    const effect = engine.effect('missile');
    const voice = effect.play({at:ctx.currentTime+0.1,randomize:false});
    check(Boolean(voice),'Live context did not start');
    await new Promise(resolve => { const done=voice.onEnd; voice.onEnd=()=>{done();resolve();}; });
    check(effect.voiceCount===0,'Live delayed missile did not release');
    engine.configure({muted:true});
    check(engine.play('shot')===null,'Muted engine allocated a voice');
    await engine.dispose(); await ctx.close();
    return {effects,deterministicPCM:true,maxDelta,randomizedPCM:true,stereo:true,liveDelayedRelease:true,muted:true};
}
