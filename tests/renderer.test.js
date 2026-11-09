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

test('scene is rendered at low resolution and scaled without smoothing at desktop and mobile sizes',()=>{
  const previousDocument=globalThis.document,previousWindow=globalThis.window;
  const display=context(),canvas={getContext:()=>display};
  globalThis.document={createElement:()=>({getContext:()=>context()})};
  globalThis.window={devicePixelRatio:2};
  try{
    for(const [rect,effects] of [[{width:1200,height:675},true],[{width:360,height:480},false]]){
      const renderer=new Renderer(canvas,{effects,shake:false});
      renderer.setMap=()=>{};
      const world={width:1200,height:1200*rect.height/rect.width};
      renderer.resize(world,rect,{});
      assert.equal(renderer.scene.width,Math.max(256,Math.round(rect.width/3)));
      const g={world,camera:{x:0,y:0,zoom:1},visualTime:0,shake:0,state:'paused',decals:[],pickups:[],enemies:[],bullets:[],particles:[],explosions:[],floaters:[],player:{health:0}};
      renderer.draw(g,0);
      assert.equal(display.imageSmoothingEnabled,false);
      assert.deepEqual(display.calls.at(-1),{name:'drawImage',args:[renderer.scene,0,0,canvas.width,canvas.height],fillStyle:''});
    }
  }finally{
    if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;
    if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
  }
});
