import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as core from '../core.js';
import * as i18n from '../i18n.js';

// Run the actual game module against a small browser adapter. Rendering and
// sound are replaced; combat, input, progression, and persistence are unchanged.
function createGame(reducedMotion=false) {
  const elements=new Map(),storage=new Map(),windowEvents=new Map(),documentEvents=new Map();
  class Element {
    constructor(){this.hidden=false;this.style={};this.dataset={};this.children=[];this.value=60;this.checked=true;this.listeners={};this.classList={add(){},remove(){},toggle(){}};}
    addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
    setAttribute(name,value){this[name]=value;}
    getBoundingClientRect(){return{left:0,top:0,width:1200,height:675};}
    focus(){} setPointerCapture(){} closest(){return null;}
    replaceChildren(){this.children=[];} append(child){this.children.push(child);}
    get firstElementChild(){return this.children[0];}
    showModal(){this.open=true;} close(){this.open=false;}
  }
  const document={hidden:false,fullscreenEnabled:false,documentElement:{},getElementById:id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);},querySelectorAll:()=>[],createElement:()=>new Element(),addEventListener:(event,fn)=>documentEvents.set(event,fn)};
  const window={addEventListener:(event,fn)=>windowEvents.set(event,fn)};
  const localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
  class Audio{constructor(){this.scene='menu';this.initializations=0;}async init(){this.initializations++;} configure(){} setActive(){} setMusicScene(scene){this.scene=scene;} play(){} update(){}}
  class Renderer{
    resize(world,rect){this.world=world;this.rect=rect;}
    setCamera(camera){this.camera=camera;}
    screenToWorld(x,y){return{x:this.camera.x+x*this.world.width/this.camera.zoom,y:this.camera.y+y*this.world.height/this.camera.zoom};}
    setMap(){} draw(){}
  }
  const source=readFileSync(new URL('../game.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
  const factory=new Function('document','window','localStorage','matchMedia','ResizeObserver','requestAnimationFrame','SoundEngine','Renderer',...Object.keys(core),...Object.keys(i18n),`${source}\nreturn {g,keys,settings,start,pause,resume,frame,update,updateEffects,spawnEnemy,fireEnemy,launchRocket,dash,hitEnemy,damagePlayer,showUpgrades,selectUpgrade,nextWave,movement,pointerPosition,sound,getChoices:()=>choices,getUpgrades:()=>upgrades};`);
  const game=factory(document,window,localStorage,query=>({matches:reducedMotion&&query.includes('prefers-reduced-motion')}),class{observe(){}},()=>{},Audio,Renderer,...Object.values(core),...Object.values(i18n));
  return{...game,elements,storage,windowEvents,documentEvents,sound:game.sound};
}
function enemy(overrides={}){return{x:600,y:300,type:'tank',health:4,maxHealth:4,speed:0,points:110,radius:25,angle:0,turret:0,cooldown:10,charge:0,hit:0,seed:0,...overrides};}

test('kamikazes use quarter scale and double drone speed and explode for four shots',async()=>{
  const game=createGame();await game.start();
  game.spawnEnemy('drone');game.spawnEnemy('kamikaze');
  const drone=game.g.enemies[0],kamikaze=game.g.enemies[1],p=game.g.player;
  assert.equal(core.ENEMIES.kamikaze.scale,core.ENEMIES.drone.scale/4);
  assert.equal(kamikaze.radius,drone.radius/4);
  assert.equal(kamikaze.speed,drone.speed*2);
  kamikaze.x=p.x+20;kamikaze.y=p.y;
  game.hitEnemy(kamikaze,kamikaze.health);
  assert.equal(p.health,100-4*core.ENEMIES.tank.projectileDamage);
  game.hitEnemy(kamikaze,1);assert.equal(p.health,56);
});
test('kamikazes detonate on contact but do not damage from outside the blast',async()=>{
  const game=createGame();await game.start();const p=game.g.player;
  game.spawnEnemy('kamikaze');
  const kamikaze=game.g.enemies[0];kamikaze.x=p.x+20;kamikaze.y=p.y;kamikaze.speed=0;
  game.update(.01);assert.equal(p.health,56);assert.equal(game.g.enemies.length,0);
  p.invulnerable=0;game.spawnEnemy('kamikaze');
  const distant=game.g.enemies[0];distant.x=p.x+core.ENEMIES.kamikaze.explosionRadius+30;distant.y=p.y;
  game.hitEnemy(distant,distant.health);assert.equal(p.health,56);
});
test('AA fires nine marked delayed explosions that persist after its destruction',async()=>{
  const game=createGame();await game.start();const p=game.g.player;
  game.spawnEnemy('aa');const aa=game.g.enemies[0];
  for(let i=0;i<9;i++)game.fireEnemy(aa);
  assert.equal(game.g.warnings.length,9);assert.equal(aa.burstRemaining,0);
  assert.equal(game.g.warnings[0].x,p.x);assert.equal(game.g.warnings[0].y,p.y);
  game.hitEnemy(aa,aa.health);game.g.spawnRemaining=0;
  game.update(core.ENEMIES.aa.warningDelay-.01);
  assert.equal(p.health,100);assert.equal(game.g.warnings.length,9);assert.equal(game.g.waveWait,-1);
  game.update(.02);assert.equal(p.health,100-core.ENEMIES.aa.projectileDamage);
  assert.equal(game.g.warnings.length,0);
});
test('AA automatically spaces one nine-shot burst and pause freezes warnings',async()=>{
  const game=createGame();await game.start();game.spawnEnemy('aa');
  const aa=game.g.enemies[0],p=game.g.player;
  aa.x=p.x+300;aa.y=p.y;aa.speed=0;aa.cooldown=0;game.g.spawnRemaining=0;
  for(let i=0;i<90;i++)game.update(.02);
  assert.equal(game.g.warnings.length,9);assert.equal(aa.burstRemaining,0);
  assert.ok(aa.cooldown>core.ENEMIES.aa.burstInterval);
  const life=game.g.warnings[0].life;
  game.pause();game.frame(1000);game.frame(5000);
  assert.equal(game.g.warnings[0].life,life);
  game.resume();await game.start();
  assert.equal(game.g.warnings.length,0);
});
test('rocket semi homing rockets fire faster on harder difficulty',async()=>{
  const game=createGame();await game.start();game.spawnEnemy('rocketSemi');
  const semi=game.g.enemies[0],delays=[];
  const random=Math.random;Math.random=()=>0;
  try{for(const difficulty of ['easy','normal','hard']){game.settings.difficulty=difficulty;game.fireEnemy(semi);delays.push(semi.cooldown);}}
  finally{Math.random=random;}
  assert.ok(delays[0]>delays[1]&&delays[1]>delays[2]);
  const rocket=game.g.bullets[0];assert.equal(rocket.kind,'enemyRocket');assert.equal(rocket.damage,core.ENEMIES.rocketSemi.projectileDamage);
  rocket.x=game.g.player.x-300;rocket.y=game.g.player.y-100;rocket.vx=100;rocket.vy=0;
  game.g.bullets=[rocket];game.update(.1);
  assert.ok(rocket.vy>0);assert.ok(Math.hypot(rocket.vx,rocket.vy)>100);
});

test('new sortie resets combat, unlocks controls, and schedules wave one',async()=>{
  const game=createGame();await game.start();
  assert.equal(game.g.state,'playing');assert.equal(game.g.wave,1);assert.equal(game.g.spawnRemaining,6);
  assert.equal(game.g.player.health,100);assert.equal(game.g.player.rockets,3);
  game.keys.add('KeyD');const screenRight=game.g.player.x-game.g.player.y;
  for(let i=0;i<30;i++)game.update(1/60);
  assert.ok(game.g.player.x-game.g.player.y>screenRight+80);
});
test('movement controls follow screen directions on the isometric ground plane',()=>{
  const game=createGame();game.keys.add('KeyD');
  const movement=game.movement();
  assert.ok(Math.abs(movement.x-Math.SQRT1_2)<1e-12);
  assert.ok(Math.abs(movement.y+Math.SQRT1_2)<1e-12);
});
test('pause clears held inputs and the animation loop stops simulation',async()=>{
  const game=createGame();await game.start();game.keys.add('KeyW');game.g.pointer.down=true;game.pause();
  const {x,y}=game.g.player,time=game.g.time;
  game.frame(1000);game.frame(2000);
  assert.equal(game.keys.size,0);assert.equal(game.g.pointer.down,false);
  assert.deepEqual([game.g.player.x,game.g.player.y,game.g.time],[x,y,time]);
  await game.resume();assert.equal(game.g.state,'playing');
});
test('swept bullets destroy targets crossed entirely in a single frame',async()=>{
  const game=createGame();await game.start();game.g.enemies=[enemy({x:200,y:300,health:1})];
  game.g.bullets=[{x:120,y:300,vx:10000,vy:0,life:1,friendly:true,kind:'gun',damage:1}];
  game.update(.02);assert.equal(game.g.enemies.length,0);assert.equal(game.g.kills,1);assert.equal(game.g.score,110);
  assert.equal(game.g.bullets.length,0);
});
test('helicopter banks smoothly toward its movement direction',async()=>{
  const game=createGame();await game.start();game.g.spawnRemaining=100;game.keys.add('KeyD');
  for(let i=0;i<30;i++)game.update(1/60);
  assert.ok(Math.hypot(game.g.player.bank,game.g.player.pitch)>0.15);
  game.keys.delete('KeyD');
  for(let i=0;i<240;i++)game.update(1/60);
  assert.ok(Math.hypot(game.g.player.bank,game.g.player.pitch)<0.001);
});
test('tank tracks advance only while the tank moves and freeze when paused',async()=>{
  const game=createGame();await game.start();game.g.spawnRemaining=100;
  const p=game.g.player,tank=enemy({x:p.x+400,y:p.y,speed:40,angle:Math.PI});
  game.g.enemies=[tank];game.update(.05);
  const movingPhase=tank.trackPhase;
  assert.ok(Math.abs(movingPhase)>1);
  game.pause();game.frame(1000);game.frame(2000);assert.equal(tank.trackPhase,movingPhase);
  await game.resume();tank.x=p.x+150;tank.y=p.y;game.update(.05);
  assert.equal(tank.trackPhase,movingPhase);
});
test('armored vehicle wrecks emit lingering black smoke',async()=>{
  const game=createGame();await game.start();game.g.enemies=[enemy()];
  game.hitEnemy(game.g.enemies[0],100);
  assert.equal(game.g.wreckSmoke.length,1);
  game.updateEffects(.1);
  assert.ok(game.g.particles.some(p=>p.persistent&&p.smoke&&p.color==='#111812b8'));
  game.updateEffects(7.9);
  assert.equal(game.g.wreckSmoke.length,0);
});
test('rockets consume ammunition, deal area damage, and replenish over time',async()=>{
  const game=createGame();await game.start();const p=game.g.player;
  p.x=300;p.y=300;game.g.pointer.x=450;game.g.pointer.y=300;
  game.g.enemies=[enemy({x:450,y:300}),enemy({x:480,y:320})];
  game.launchRocket();assert.equal(p.rockets,2);
  for(let i=0;i<30;i++)game.update(1/60);
  assert.equal(game.g.kills,2);
  // Keep an enemy alive so the next-wave screen does not interrupt reloading.
  game.g.enemies=[enemy({x:1200,y:600,cooldown:100})];game.g.spawnRemaining=0;
  for(let i=0;i<420;i++)game.update(1/60);
  assert.equal(p.rockets,3);
});
test('dash grants brief protection and cannot be spammed',async()=>{
  const game=createGame();await game.start();game.keys.add('KeyD');game.dash();const p=game.g.player;
  assert.ok(Math.abs(Math.hypot(p.vx,p.vy)-850)<1e-8);assert.ok(p.vx>0&&p.vy<0);assert.ok(p.invulnerable>0);assert.ok(p.dashCooldown>0);
  game.damagePlayer(50);assert.equal(p.health,100);
  p.vx=123;game.dash();assert.equal(p.vx,123);
});
test('wave clear offers upgrades, clears hostile shells, and resumes next wave',async()=>{
  const game=createGame();await game.start();game.g.spawnRemaining=0;game.g.bullets=[{x:10,y:10,vx:0,vy:0,life:6,friendly:false}];
  for(let i=0;i<100&&game.g.state==='playing';i++)game.update(1/60);
  assert.equal(game.g.state,'upgrade');assert.equal(game.g.bullets.length,0);assert.equal(game.getChoices().length,3);
  const choice=game.getChoices()[0];game.selectUpgrade(choice.id);
  assert.equal(game.g.state,'playing');assert.equal(game.g.wave,2);assert.equal(game.getUpgrades()[choice.id],1);
});
test('wave five spawns a boss and destruction saves the record before restart',async()=>{
  const game=createGame();await game.start();for(let i=0;i<4;i++)game.nextWave();
  assert.ok(game.g.enemies.some(e=>e.type==='boss'));game.g.score=1234;game.g.player.invulnerable=0;game.damagePlayer(200);
  assert.equal(game.g.state,'over');assert.equal(JSON.parse(game.storage.get('blackout.best')),1234);
  await game.start();assert.equal(game.g.score,0);assert.equal(game.g.player.health,100);assert.equal(game.g.best,1234);assert.equal(game.g.enemies.length,0);
});
test('music follows menu, wave, and boss transitions',async()=>{
  const game=createGame();assert.equal(game.sound.scene,'menu');
  await game.start();assert.equal(game.sound.scene,'waves');
  for(let i=0;i<4;i++)game.nextWave();
  assert.equal(game.sound.scene,'boss');
  game.hitEnemy(game.g.enemies.find(e=>e.type==='boss'),100000);
  assert.equal(game.sound.scene,'waves');
  game.g.player.invulnerable=0;game.damagePlayer(1000);
  assert.equal(game.sound.scene,'menu');
});
test('first main-menu interaction initializes its soundtrack',async()=>{
  const game=createGame();
  game.documentEvents.get('pointerdown')();
  await Promise.resolve();
  assert.equal(game.sound.initializations,1);
});
test('language selection persists and updates status text',async()=>{
  const game=createGame(),language=game.elements.get('language');
  assert.equal(game.settings.language,'en');
  await game.start();
  language.value='de';
  language.listeners.change[0]({target:language});
  assert.equal(game.settings.language,'de');
  assert.equal(JSON.parse(game.storage.get('blackout.settings')).language,'de');
  assert.equal(game.elements.get('feed-status').textContent,'AKTIV');
});
test('helicopter coasts after release and eventually stops without crossing the boundary',async()=>{
  const game=createGame();await game.start();game.g.spawnRemaining=100;
  game.keys.add('KeyD');for(let i=0;i<60;i++)game.update(1/60);
  game.keys.delete('KeyD');const p=game.g.player,x=p.x,initial=p.vx;
  game.update(1/60);assert.ok(p.vx>0&&p.vx<initial);
  for(let i=0;i<180;i++)game.update(1/60);
  assert.ok(p.x>x+50);assert.ok(p.vx<.1);
  p.x=game.g.world.width-34;p.vx=100;game.update(1/60);assert.equal(p.vx,0);
});
test('gun overheats, locks while cooling, and fires again after three seconds',async()=>{
  const game=createGame();await game.start();game.g.spawnRemaining=100;
  const p=game.g.player;game.keys.add('Space');
  for(let i=0;i<300&&!p.overheated;i++)game.update(1/60);
  assert.equal(p.overheated,true);assert.equal(p.heat,1);
  game.g.bullets=[];for(let i=0;i<120;i++)game.update(1/60);
  assert.equal(p.overheated,true);assert.equal(game.g.bullets.filter(b=>b.kind==='gun').length,0);
  for(let i=0;i<65;i++)game.update(1/60);
  assert.equal(p.overheated,false);assert.ok(p.heat>0);assert.ok(game.g.bullets.some(b=>b.kind==='gun'));
});
test('gun cools when fire is released before overheating and pause freezes heat',async()=>{
  const game=createGame();await game.start();game.g.spawnRemaining=100;
  game.keys.add('Space');for(let i=0;i<30;i++)game.update(1/60);
  const p=game.g.player,heat=p.heat;assert.ok(heat>0&&heat<1);
  game.keys.delete('Space');for(let i=0;i<30;i++)game.update(1/60);
  assert.ok(p.heat<heat);const cooling=p.heat;
  game.pause();game.frame(1000);game.frame(2000);assert.equal(p.heat,cooling);
});
test('rockets accelerate with and without a target and keep their heading',async()=>{
  const game=createGame();await game.start();game.g.spawnRemaining=100;
  const p=game.g.player;p.angle=0;game.launchRocket();
  const rocket=game.g.bullets[0],initial=Math.hypot(rocket.vx,rocket.vy);
  game.update(.1);assert.equal(initial,100);assert.equal(Math.hypot(rocket.vx,rocket.vy),340);assert.equal(rocket.vy,0);
  for(let i=0;i<10;i++)game.update(.05);
  assert.ok(Math.abs(Math.hypot(rocket.vx,rocket.vy)-820)<1e-8);
});
test('camera follows the player while pointer screen coordinates remain aligned',async()=>{
  const game=createGame();await game.start();game.g.spawnRemaining=100;
  game.pointerPosition({clientX:900,clientY:300});const camera=game.g.camera,old=camera.x;
  game.keys.add('KeyD');for(let i=0;i<120;i++)game.update(1/60);
  assert.ok(camera.x>old);
  assert.ok(Math.abs((game.g.pointer.x-camera.x)*camera.zoom-game.g.pointer.screenX*game.g.world.width)<1e-8);
  assert.ok(Math.abs((game.g.pointer.y-camera.y)*camera.zoom-game.g.pointer.screenY*game.g.world.height)<1e-8);
});
test('reduced motion disables camera tracking and zoom',async()=>{
  const game=createGame(true);await game.start();game.g.spawnRemaining=100;
  game.keys.add('KeyD');for(let i=0;i<60;i++)game.update(1/60);
  assert.deepEqual(game.g.camera,{x:0,y:0,zoom:1});
});
test('next wave changes sector and clears decals from the previous map',async()=>{
  const game=createGame();await game.start();const first=game.g.map;
  game.g.decals.push({x:100,y:100});game.nextWave();
  assert.notEqual(game.g.map,first);assert.equal(game.g.map,core.mapForWave(2));
  assert.equal(game.g.decals.length,0);assert.equal(game.elements.get('sector-name').textContent,game.g.map.name);
});
