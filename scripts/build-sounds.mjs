import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const shotParams = 'noiseDuration noiseGain noiseCutoff subStart subEnd subDuration subGain';
export const SOUND_PARAMETERS = {
    shot: `${shotParams} sparkDuration sparkGain sparkCutoff`,
    enemy: shotParams, aa: shotParams,
    hit: 'heavyChance pitch decay snapGain bodyGain thudGain subGain ringGain heavyGain heavySubGain heavyRingGain',
    explode: 'debrisChance pitch decay crack bodyGain midGain highGain rumbleGain tailGain sparkGain dustGain debrisGain crackGain',
    rocket: 'snapGain pitch decay snapSubGain whooshGain whooshTailGain',
    missile: 'snapGain pitch decay snapSubGain whooshGain whooshTailGain',
    flare: 'snapGain pitch snapSubGain whooshGain tailGain',
    dash: 'noiseGain subGain', damage: 'noiseGain subGain',
    lowHealth: 'noiseGain sawGain squareGain',
    missileAlert: 'toneGain', pickup: 'noteGain', upgrade: 'noteGain',
    wave: 'noteGain', alert: 'toneGain', ui: 'toneGain',
    rotor: 'bladePulseHz bladeAirHz noiseCutoff bodyGain pulseGain airQ airGain airPulseGain motorHz motorGain'
};

export function parseSounds(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.shift() !== 'effect,param,value,spread,spatial,maxVoices,unit') throw new Error('Invalid sounds.csv header');
    const data = {};
    for (const [i, line] of lines.entries()) {
        const cells = line.split(',').map(cell => cell.trim());
        const fail = message => { throw new Error(`sounds.csv:${i + 2}: ${message}`); };
        if (cells.length !== 7) fail('Expected 7 columns');
        const [effect, param, raw, spreadRaw, spatialRaw, voicesRaw, unit] = cells;
        if (!Object.hasOwn(SOUND_PARAMETERS, effect)) fail(`Unknown effect ${effect}`);
        if (!SOUND_PARAMETERS[effect].split(' ').includes(param)) fail(`Unknown parameter ${effect}.${param}`);
        const value = Number(raw), spread = Number(spreadRaw || 0), maxVoices = Number(voicesRaw);
        if (!raw || !Number.isFinite(value) || value < 0) fail('Value must be a nonnegative finite number');
        if (!Number.isFinite(spread) || spread < 0 || spread >= 1) fail('Spread must be in [0, 1)');
        if (!['gain', 'hertz', 'duration', 'ratio'].includes(unit)) fail('Invalid unit');
        if (['hertz', 'duration'].includes(unit) && value <= 0) fail('Frequency and duration must be positive');
        if (param.endsWith('Chance') && (value > 1 || spread !== 0)) fail('Chance must be in [0, 1] with spread 0');
        if (spatialRaw && !['true', 'false'].includes(spatialRaw)) fail('Spatial must be true or false');
        if (voicesRaw && (!Number.isInteger(maxVoices) || maxVoices < 1 || maxVoices > 128)) fail('maxVoices must be an integer in [1, 128]');
        if (!data[effect]) {
            if (!spatialRaw || !voicesRaw) fail(`First row of ${effect} requires spatial and maxVoices`);
            data[effect] = { spatial: spatialRaw === 'true', maxVoices };
        } else {
            if (spatialRaw && (spatialRaw === 'true') !== data[effect].spatial) fail('Conflicting spatial setting');
            if (voicesRaw && maxVoices !== data[effect].maxVoices) fail('Conflicting maxVoices setting');
        }
        if (Object.hasOwn(data[effect], param)) fail(`Duplicate ${effect}.${param}`);
        data[effect][param] = { value, spread, unit };
    }
    for (const [effect, params] of Object.entries(SOUND_PARAMETERS)) {
        if (!data[effect]) throw new Error(`Missing effect ${effect}`);
        for (const param of params.split(' ')) {
            if (!data[effect][param]) throw new Error(`Missing ${effect}.${param}`);
        }
    }
    return data;
}

export async function buildSounds(root = new URL('../', import.meta.url)) {
    const data = parseSounds(await readFile(new URL('sounds.csv', root), 'utf8'));
    await writeFile(new URL('audio/sound-data.js', root),
        `// Generated from sounds.csv by scripts/build-sounds.mjs. Do not edit.\nexport const SOUND_DATA = ${JSON.stringify(data, null, 2)};\n`);
    return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const data = await buildSounds();
    console.log(`Built sound data for ${Object.keys(data).length} effects`);
}
