import { createState } from './game/state.js';
import { createInput } from './game/input.js';
import { createEntities } from './game/entities.js';
import { createCombat } from './game/combat.js';
import { createWaves } from './game/waves.js';
import { createUpgrades } from './game/upgrades.js';
import { createLoop } from './game/loop.js';

const runtime = createState();
Object.assign(runtime, createEntities(runtime));
Object.assign(runtime, createWaves(runtime));
Object.assign(runtime, createLoop(runtime));
Object.assign(runtime, createCombat(runtime));
Object.assign(runtime, createUpgrades(runtime));
Object.assign(runtime, createInput(runtime));
runtime.initialize();
