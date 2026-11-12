import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseSounds } from '../audio/sound-csv.js';
export { SOUND_PARAMETERS, parseSounds } from '../audio/sound-csv.js';

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
