import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
async function check(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) await check(path);
        else if (/\.(m?js)$/.test(entry.name)) {
            const result = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' });
            if (result.status !== 0) process.exit(result.status || 1);
        }
    }
}
await check(root);
console.log('All JavaScript syntax checks passed');
