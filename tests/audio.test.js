import test from 'node:test';
import assert from 'node:assert/strict';
import { SoundEngine } from '../audio.js';

test('fallback scores produce finite notes throughout each repeating phrase',()=>{
  const sound=new SoundEngine({music:true,muted:false,volume:1});
  sound.ctx={state:'running',currentTime:0};
  const notes=[];
  sound.tone=(frequency,end)=>notes.push([frequency,end]);
  for(const scene of ['menu','waves','boss']){
    sound.musicScene=scene;sound.step=0;sound.nextBeat=0;
    for(let i=0;i<32;i++){sound.ctx.currentTime=i+1;sound.update();}
  }
  assert.ok(notes.length>0);
  assert.ok(notes.every(([frequency,end])=>Number.isFinite(frequency)&&Number.isFinite(end)));
});
