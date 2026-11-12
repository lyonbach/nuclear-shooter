import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeFile, mkdir } from 'node:fs/promises';
import { SOUND_DATA } from '../audio/sound-data.js';
import { parseSounds, serializeSounds, validateParameter } from '../audio/sound-csv.js';
import { buildSounds } from '../scripts/build-sounds.mjs';

test('unmodified editor export preserves the full CSV exactly', async () => {
    const original = await readFile(new URL('../sounds.csv', import.meta.url), 'utf8');
    assert.equal(serializeSounds(SOUND_DATA), original);
});

test('multi-effect edits round trip with units and metadata intact', () => {
    const data = structuredClone(SOUND_DATA);
    data.shot.noiseDuration.value = 0.17;
    data.shot.noiseDuration.spread = 0.23;
    data.shot.spatial = false;
    data.shot.maxVoices = 128;
    data.explode.debrisChance.value = 0.25;
    data.rotor.bladePulseHz.value = 31;
    const csv = serializeSounds(data), parsed = parseSounds(csv);
    assert.deepEqual(parsed, data);
    assert.equal(Object.keys(parsed).length, 18);
    assert.equal(csv.split('\n')[1], 'shot,noiseDuration,0.17,0.23,false,128,duration');
    assert.match(csv, /shot,noiseGain,0.24,0,,,gain/);
    assert.equal(SOUND_DATA.shot.noiseDuration.value, 0.09);
});

test('parameter validator rejects unsafe values and invalid chance distributions', () => {
    for (const value of [-1, Infinity, NaN]) assert.ok(validateParameter('noiseGain', {value, spread:0, unit:'gain'}));
    for (const unit of ['duration','hertz']) assert.ok(validateParameter('test', {value:0, spread:0, unit}));
    for (const spread of [-0.01, 1, Infinity, NaN]) assert.ok(validateParameter('pitch', {value:1, spread, unit:'ratio'}));
    assert.ok(validateParameter('heavyChance', {value:1.1, spread:0, unit:'ratio'}));
    assert.ok(validateParameter('heavyChance', {value:0.5, spread:0.1, unit:'ratio'}));
    assert.equal(validateParameter('heavyChance', {value:1, spread:0, unit:'ratio'}), '');
    assert.equal(validateParameter('noiseGain', {value:0, spread:0.99, unit:'gain'}), '');
});

test('serializer rejects incomplete and invalid data instead of producing broken CSV', () => {
    const edits = [
        d => { delete d.ui; },
        d => { delete d.shot.noiseGain; },
        d => { d.shot.noiseGain.value = NaN; },
        d => { d.shot.noiseGain.unit = 'watts'; },
        d => { d.shot.noiseGain.spread = 1; },
        d => { d.shot.spatial = 'false'; },
        d => { d.shot.maxVoices = 129; },
        d => { d.shot.maxVoices = 1.5; },
        d => { d.shot.unknown = {value:1,spread:0,unit:'gain'}; }
    ];
    for (const edit of edits) {
        const data = structuredClone(SOUND_DATA); edit(data);
        assert.throws(() => serializeSounds(data));
    }
});

test('exported edits are consumable by the actual sound-data build', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'audio-csv-'));
    try {
        const data = structuredClone(SOUND_DATA);
        data.shot.noiseGain.value = 0.123;
        await mkdir(join(dir,'audio'));
        await writeFile(join(dir,'sounds.csv'), serializeSounds(data));
        const result = await buildSounds(pathToFileURL(`${dir}/`));
        assert.equal(result.shot.noiseGain.value, 0.123);
        const generated = await readFile(join(dir,'audio/sound-data.js'),'utf8');
        assert.match(generated, /"value": 0.123/);
    } finally { await rm(dir, {recursive:true, force:true}); }
});
