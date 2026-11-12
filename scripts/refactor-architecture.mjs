import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const gamePath = new URL('game.js', root);
const constantsPath = new URL('game/constants.js', root);
const buildPath = new URL('scripts/build.mjs', root);

try {
    await access(constantsPath);
    console.log('game/constants.js already exists; refactor already applied.');
    process.exit(0);
} catch {
    // Continue with the one-time refactor.
}

const source = await readFile(gamePath, 'utf8');
const startMarker = 'const TREAD_MARK_LIFETIME=20';
const endMarker = 'const TANK_TRACK_HALF_WIDTH=16.5,GOLIATH_TRACK_HALF_WIDTH=36;';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker);

if (start === -1 || end === -1) {
    throw new Error('Could not find the expected constants block in game.js');
}

const endExclusive = end + endMarker.length;
const block = source.slice(start, endExclusive);
const requiredNames = [
    'TREAD_MARK_LIFETIME',
    'TREAD_MARK_SPACING',
    'TREAD_MARK_LIMIT',
    'PLAYER_ACCELERATION',
    'PLAYER_DECELERATION',
    'PLAYER_TURN_RATE',
    'PLAYER_TOUCH_TURN_RATE',
    'PLAYER_CANNON_TURN_RATE',
    'PLAYER_BANK_RESPONSE',
    'FLARE_RANGE',
    'FLARE_COOLDOWN',
    'FLARE_DEFLECTION_CHANCE',
    'LOW_HEALTH_ALARM_INTERVAL',
    'MISSILE_ALARM_INTERVAL',
    'ROCKET_RAIL_FORWARD',
    'ROCKET_RAIL_OFFSET',
    'TANK_TRACK_HALF_WIDTH',
    'GOLIATH_TRACK_HALF_WIDTH'
];

for (const name of requiredNames) {
    if (!block.includes(name)) {
        throw new Error(`Expected constant ${name} was not found in the extracted block`);
    }
}

const constants = `// Pure gameplay constants extracted from game.js.\n// This module contains no runtime state and must remain dependency-free.\nexport const TREAD_MARK_LIFETIME = 20;\nexport const TREAD_MARK_SPACING = 14;\nexport const TREAD_MARK_LIMIT = 160;\nexport const PLAYER_ACCELERATION = 3.5;\nexport const PLAYER_DECELERATION = 2.8;\nexport const PLAYER_TURN_RATE = 4;\nexport const PLAYER_TOUCH_TURN_RATE = 5;\nexport const PLAYER_CANNON_TURN_RATE = 16;\nexport const PLAYER_BANK_RESPONSE = 3;\nexport const FLARE_RANGE = 260;\nexport const FLARE_COOLDOWN = 2.2;\nexport const FLARE_DEFLECTION_CHANCE = .32;\nexport const LOW_HEALTH_ALARM_INTERVAL = 1.4;\nexport const MISSILE_ALARM_INTERVAL = 1.2;\nexport const ROCKET_RAIL_FORWARD = 28;\nexport const ROCKET_RAIL_OFFSET = 15;\nexport const TANK_TRACK_HALF_WIDTH = 16.5;\nexport const GOLIATH_TRACK_HALF_WIDTH = 36;\n`;

const importLine = `import {\n  TREAD_MARK_LIFETIME,\n  TREAD_MARK_SPACING,\n  TREAD_MARK_LIMIT,\n  PLAYER_ACCELERATION,\n  PLAYER_DECELERATION,\n  PLAYER_TURN_RATE,\n  PLAYER_TOUCH_TURN_RATE,\n  PLAYER_CANNON_TURN_RATE,\n  PLAYER_BANK_RESPONSE,\n  FLARE_RANGE,\n  FLARE_COOLDOWN,\n  FLARE_DEFLECTION_CHANCE,\n  LOW_HEALTH_ALARM_INTERVAL,\n  MISSILE_ALARM_INTERVAL,\n  ROCKET_RAIL_FORWARD,\n  ROCKET_RAIL_OFFSET,\n  TANK_TRACK_HALF_WIDTH,\n  GOLIATH_TRACK_HALF_WIDTH\n} from './game/constants.js';\n`;

const updatedGame = source
    .replace(block, '')
    .replace(
        "import { languages, setLocale, t } from './i18n.js';\n",
        `import { languages, setLocale, t } from './i18n.js';\n${importLine}`
    );

if (updatedGame === source) {
    throw new Error('Failed to insert the constants import into game.js');
}

const buildSource = await readFile(buildPath, 'utf8');
const oldFiles =
    "const files=['enemy-data.js','level-data.js','weapon-data.js','i18n.js','core.js','audio.js','renderer.js','game.js'];";
const newFiles =
    "const files=['enemy-data.js','level-data.js','weapon-data.js','i18n.js','core.js','audio.js','renderer.js','game/constants.js','game.js'];";

if (!buildSource.includes(oldFiles)) {
    throw new Error('Could not find the expected source-file list in scripts/build.mjs');
}

const updatedBuild = buildSource.replace(oldFiles, newFiles);

await mkdir(new URL('game/', root), { recursive: true });
await writeFile(constantsPath, constants, 'utf8');
await writeFile(gamePath, updatedGame, 'utf8');
await writeFile(buildPath, updatedBuild, 'utf8');

console.log('Extracted gameplay constants into game/constants.js');
console.log('Updated game.js imports');
console.log('Updated scripts/build.mjs bundle order');
