import test from 'node:test';
import assert from 'node:assert/strict';
import { segmentHitsCircle, wavePlan, enemyType, turn, seededRandom, mapForWave } from '../core.js';

test('fast projectiles hit a target crossed between frames',()=>{
  assert.equal(segmentHitsCircle(0,0,100,0,50,0,4),true);
  assert.equal(segmentHitsCircle(0,0,100,0,50,9,4),false);
  assert.equal(segmentHitsCircle(0,0,100,0,105,0,6),true);
  assert.equal(segmentHitsCircle(0,0,0,0,0,0,2),true);
  assert.equal(segmentHitsCircle(0,0,0,0,10,0,2),false);
});
test('wave scaling has a boss every fifth wave and bounded spawn timing',()=>{
  for(let wave=1;wave<=200;wave++){
    const plan=wavePlan(wave);
    assert.equal(plan.boss,wave%5===0);
    assert.ok(plan.count>0&&Number.isInteger(plan.count));
    assert.ok(plan.interval>=.4&&plan.health>=1);
  }
  assert.ok(wavePlan(3,'easy').count<wavePlan(3,'normal').count);
  assert.ok(wavePlan(3,'hard').damage>wavePlan(3,'normal').damage);
});
test('enemy variety unlocks gradually and predictably',()=>{
  assert.equal(enemyType(1,4),'tank');
  assert.equal(enemyType(2,2),'drone');
  assert.equal(enemyType(3,4),'artillery');
});
test('aim rotation takes the short route across the angle boundary',()=>{
  const value=turn(Math.PI-.1,-Math.PI+.1,.5);
  assert.ok(Math.abs(value-Math.PI)<.00001);
  assert.equal(turn(0,1,8),1);
});
test('terrain seeds reproduce the same map with values in range',()=>{
  const a=seededRandom(73),b=seededRandom(73);
  for(let i=0;i<100;i++){const value=a();assert.equal(value,b());assert.ok(value>=0&&value<1);}
});
test('waves rotate through three distinct deterministic sectors',()=>{
  assert.equal(new Set([1,2,3].map(w=>mapForWave(w).seed)).size,3);
  assert.equal(mapForWave(4),mapForWave(1));
  assert.equal(mapForWave(5),mapForWave(2));
});
