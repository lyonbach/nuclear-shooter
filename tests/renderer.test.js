import test from 'node:test';
import assert from 'node:assert/strict';
import { Renderer } from '../renderer.js';

function context() {
  const calls=[];
  const c=new Proxy({calls,fillStyle:''},{
    get(target,key) {
      if(key in target)return target[key];
      return (...args)=>calls.push({name:key,args,fillStyle:target.fillStyle});
    }
  });
  return c;
}

test('helicopter movement changes the rendered pose',()=>{
  const renderer=new Renderer({getContext:()=>context()},{});
  const stationary=context(),moving=context();
  const player={x:100,y:100,angle:0,bank:0,pitch:0};
  renderer.helicopter(stationary,player,0);
  renderer.helicopter(moving,{...player,bank:.3,pitch:.2},0);
  const pose=c=>c.calls.filter(call=>['translate','scale'].includes(call.name));
  assert.notDeepEqual(pose(stationary),pose(moving));
  assert.ok(moving.calls.some(call=>call.name==='translate'&&call.args[0]===6&&call.args[1]===9));
  assert.ok(moving.calls.some(call=>call.name==='scale'&&call.args[1]<.9));
});

test('helicopter uses a projected hull silhouette and rotor blade shadow',()=>{
  const renderer=new Renderer({getContext:()=>context()},{});
  const c=context();
  renderer.helicopter(c,{x:100,y:100,angle:0,bank:0,pitch:0},0);
  assert.equal(c.calls.filter(call=>call.name==='fill'&&call.fillStyle==='#0b170c4d').length,2);
  assert.ok(c.calls.some(call=>call.name==='fillRect'&&call.fillStyle==='#0b170c24'&&call.args[0]===-48&&call.args[2]===96));
});

test('cannon is half-sized and fires from its barrel tip',()=>{
  const renderer=new Renderer({getContext:()=>context()},{});
  const c=context();
  renderer.helicopter(c,{x:100,y:100,angle:0,cannonAngle:Math.PI/2,bank:0,pitch:0,muzzle:1},0);
  assert.ok(c.calls.some(call=>call.name==='translate'&&call.args[0]===20&&call.args[1]===0));
  assert.ok(c.calls.some(call=>call.name==='scale'&&call.args[0]===.5&&call.args[1]===.5));
  assert.ok(c.calls.some(call=>call.name==='fill'&&call.fillStyle==='#fff2a8'));
});

test('helicopter strobe lights flash once every two seconds',()=>{
  const renderer=new Renderer({getContext:()=>context()},{});
  const flashing=context(),dark=context(),player={x:100,y:100,angle:0,bank:0,pitch:0};
  renderer.helicopter(flashing,player,0);
  renderer.helicopter(dark,player,1);
  const hasStrobes=c=>c.calls.some(call=>call.name==='fill'&&['#ffffff','#ff5d52'].includes(call.fillStyle));
  assert.equal(hasStrobes(flashing),true);
  assert.equal(hasStrobes(dark),false);
});

test('helicopter tail strobe flashes once every 1.5 seconds',()=>{
  const renderer=new Renderer({getContext:()=>context()},{});
  const flashing=context(),dark=context(),player={x:100,y:100,angle:0,bank:0,pitch:0};
  renderer.helicopter(flashing,player,1.5);
  renderer.helicopter(dark,player,1);
  const hasTailStrobe=c=>c.calls.some(call=>call.name==='fill'&&call.fillStyle==='#ffb35c');
  assert.equal(hasTailStrobe(flashing),true);
  assert.equal(hasTailStrobe(dark),false);
});

test('tail rotor is rendered edge-on',()=>{
  const renderer=new Renderer({getContext:()=>context()},{});
  const c=context();
  renderer.helicopter(c,{x:100,y:100,angle:0,bank:0,pitch:0},0);
  assert.ok(c.calls.some(call=>call.name==='ellipse'&&call.args[0]===0&&call.args[1]===0&&call.args[2]===15&&call.args[3]===2&&call.fillStyle==='#d8dfb699'));
  assert.equal(c.calls.some(call=>call.name==='fillRect'&&call.args[0]===-12&&call.args[1]===-1&&call.args[2]===24&&call.args[3]===2),false);
});

test('tail rotor blur cycles as it spins',()=>{
  const renderer=new Renderer({getContext:()=>context()},{});
  const still=context(),spinning=context(),player={x:100,y:100,angle:0,bank:0,pitch:0};
  renderer.helicopter(still,player,0);
  renderer.helicopter(spinning,player,.04);
  const blur=c=>c.calls.find(call=>call.name==='ellipse'&&call.fillStyle==='#d8dfb699').args;
  assert.notDeepEqual(blur(still),blur(spinning));
});

test('tank tread marks visibly shift with track phase',()=>{
  const renderer=new Renderer({getContext:()=>context()},{});
  const stationary=context(),moving=context();
  const enemy={x:0,y:0,angle:0,type:'tank',health:4,maxHealth:4};
  renderer.enemy(stationary,enemy,0);
  renderer.enemy(moving,{...enemy,trackPhase:2},0);
  const treads=c=>c.calls.filter(call=>call.name==='fillRect'&&call.fillStyle==='#a1a582').map(call=>call.args);
  assert.ok(treads(stationary).length>4);
  assert.notDeepEqual(treads(stationary),treads(moving));
  for(const [x,,width] of treads(moving))assert.ok(x>=-23&&x+width<=20);
});

test('kamikaze drone is rendered at quarter scale',()=>{
  const renderer=new Renderer({getContext:()=>context()},{});
  const c=context();
  renderer.enemy(c,{x:0,y:0,angle:0,type:'kamikaze',health:1,maxHealth:1},0);
  assert.ok(c.calls.some(call=>call.name==='scale'&&call.args[0]===.55&&call.args[1]===.55));
});
