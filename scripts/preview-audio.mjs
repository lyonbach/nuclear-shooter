// Package the audio test page without the game, music assets, or preview shims.
import { cp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const out = resolve(process.argv[2] || resolve(root, '../audio-preview'));
if (out === root) throw new Error('Preview output must not overwrite the source folder');
await mkdir(out, { recursive: true });
await cp(resolve(root, 'audio-test.html'), resolve(out, 'index.html'));
for (const name of ['audio-test.css', 'audio-test.js', 'audio', 'core.js', 'enemy-data.js', 'level-data.js', 'weapon-data.js']) {
    await cp(resolve(root, name), resolve(out, name), { recursive: true });
}
console.log(`Audio test preview ready: ${out}`);
