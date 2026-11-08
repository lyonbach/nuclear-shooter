import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as core from '../core.js';

// Run the actual game module against a small browser adapter. Rendering and
// sound are replaced; combat, input, progression, and persistence are unchanged.
function createGame() {
  const elements=new Map(),storage=new Map(),windowEvents=new Map();
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
  const document={hidden:false,fullscreenEnabled:false,getElementById:id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);},querySelectorAll:()=>[],createElement:()=>new Element(),addEventListener(){}};
  const window={addEventListener:(event,fn)=>windowEvents.set(event,fn)};
  const localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
  class Audio{async init(){} configure(){} setActive(){} play(){} update(){}}
  class Renderer{resize(){} draw(){}}
  const source=readFileSync(new URL('../game.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
  const factory=new Function('document','window','localStorage','matchMedia','ResizeObserver','requestAnimationFrame','SoundEngine','Renderer',...Object.keys(core),`${source}\nreturn {g,keys,start,pause,resume,frame,update,launchRocket,dash,hitEnemy,damagePlayer,showUpgrades,selectUpgrade,nextWave,movement,getChoices:()=>choices,getUpgrades:()=>upgrades};`);
  const game=factory(document,window,localStorage,()=>({matches:false}),class{observe(){}},()=>{},Audio,Renderer,...Object.values(core));
  return{...game,elements,storage,windowEvents};
}
function enemy(overrides={}){return{x:600,y:300,type:'tank',health:4,maxHealth:4,speed:0,points:110,radius:25,angle:0,turret:0,cooldown:10,charge:0,hit:0,seed:0,...overrides};}

test('new sortie resets combat, unlocks controls, and schedules wave one',async()=>{
  const game=createGame();await game.start();
  assert.equal(game.g.state,'playing');assert.equal(game.g.wave,1);assert.equal(game.g.spawnRemaining,6);
  assert.equal(game.g.player.health,100);assert.equal(game.g.player.rockets,3);
  game.keys.add('KeyD');const x=game.g.player.x;
  for(let i=0;i<30;i++)game.update(1/60);
  assert.ok(game.g.player.x>x+80);
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
  assert.equal(p.vx,850);assert.ok(p.invulnerable>0);assert.ok(p.dashCooldown>0);
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
