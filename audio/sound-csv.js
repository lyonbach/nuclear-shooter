// Shared by the browser editor and Node build: one CSV format and validation path.
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

export function validateParameter(name, { value, spread, unit }) {
    if (!Number.isFinite(value) || value < 0) return 'Value must be a nonnegative finite number';
    if (!Number.isFinite(spread) || spread < 0 || spread >= 1) return 'Variation must be at least 0% and less than 100%';
    if (!['gain', 'hertz', 'duration', 'ratio'].includes(unit)) return 'Invalid unit';
    if (['hertz', 'duration'].includes(unit) && value <= 0) return 'Frequency and duration must be positive';
    if (name.endsWith('Chance') && (value > 1 || spread !== 0)) return 'Chance must be between 0 and 1, with zero variation';
    return '';
}

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
        if (!raw) fail('Value must be a nonnegative finite number');
        const error = validateParameter(param, { value, spread, unit });
        if (error) fail(error);
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

export function serializeSounds(data) {
    const rows = ['effect,param,value,spread,spatial,maxVoices,unit'];
    for (const [effect, config] of Object.entries(data)) {
        const { spatial, maxVoices, ...params } = config;
        if (typeof spatial !== 'boolean') throw new Error(`Invalid spatial setting for ${effect}`);
        if (!Number.isInteger(maxVoices) || maxVoices < 1 || maxVoices > 128) throw new Error(`Invalid voice limit for ${effect}`);
        let first = true;
        for (const [name, param] of Object.entries(params)) {
            const error = validateParameter(name, param);
            if (error) throw new Error(`${effect}.${name}: ${error}`);
            rows.push([effect, name, param.value, param.spread, first ? spatial : '', first ? maxVoices : '', param.unit].join(','));
            first = false;
        }
    }
    const text = `${rows.join('\n')}\n`;
    parseSounds(text); // Refuse incomplete/unknown schema, even for callers outside the editor.
    return text;
}
