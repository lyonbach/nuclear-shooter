import { createState } from './game/state.js';
import { createInput } from './game/input.js';
import { createEntities } from './game/entities.js';
import { createCombat } from './game/combat.js';
import { createWaves } from './game/waves.js';
import { createUpgrades } from './game/upgrades.js';
import { createLoop } from './game/loop.js';

const runtime=createState();
Object.assign(runtime, createEntities(runtime));
Object.assign(runtime, createWaves(runtime));
Object.assign(runtime, createLoop(runtime));
Object.assign(runtime, createCombat(runtime));
Object.assign(runtime, createUpgrades(runtime));
Object.assign(runtime, createInput(runtime));
runtime.initialize();

// Read-only QA state, opt-in so normal play exposes no debugging interface.
if(typeof location!=='undefined'&&new URLSearchParams(location.search).has('debug')){
  window.render_game_to_text=()=>JSON.stringify({
    coordinates:'world units; origin top-left; x right; y down',
    state:runtime.g.state,wave:runtime.g.wave,score:runtime.g.score,
    player:{x:runtime.g.player.x,y:runtime.g.player.y,health:runtime.g.player.health,
      rockets:runtime.g.player.rockets,heat:runtime.g.player.heat,dashCooldown:runtime.g.player.dashCooldown},
    enemies:runtime.g.enemies.map(({x,y,type,health})=>({x,y,type,health})),
    bullets:runtime.g.bullets.length,
    audio:{state:runtime.sound.ctx?.state,muted:runtime.settings.muted,music:runtime.settings.music,
      track:runtime.sound.musicTrack?.scene,trackStatus:runtime.sound.musicTrack?.status,
      rotor:runtime.sound.rotor.running,
      voices:Object.fromEntries([...runtime.sound.engine.effects].map(([key,effect])=>[key,effect.voiceCount]))}
  });
}
