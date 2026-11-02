import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceSimulation } from '../src/game/game-loop.mjs';
import { MatchClock } from '../src/game/rules.mjs';
function simulation(){return {state:'IN_PLAY',clock:new MatchClock(12),physical:0,step(dt){this.physical+=dt;this.clock.tick(dt);},pause(){this.state='PAUSED';}};}
for(const fps of [2,5,15,30,60])test(`client clock and physics retain real time at ${fps} FPS`,()=>{
  const e=simulation();for(let i=0;i<fps*2;i++)advanceSimulation(e,1/fps);
  assert.ok(Math.abs(e.clock.elapsed-7.5)<1e-8);assert.ok(Math.abs(e.physical-2)<1e-8);
});
test('optional manager speed advances both clock and physics by the same multiplier',()=>{const e=simulation();advanceSimulation(e,.5,{},8);assert.ok(Math.abs(e.clock.elapsed-15)<1e-8);assert.ok(Math.abs(e.physical-4)<1e-8);});
test('large visible-page interruption pauses explicitly instead of silently discarding seconds',()=>{const e=simulation();advanceSimulation(e,8);assert.equal(e.state,'PAUSED');assert.equal(e.clock.elapsed,0);});
test('paused and ended periods cannot gain duplicate simulation time',()=>{for(const state of ['PAUSED','HALF_TIME','FULL_TIME']){const e=simulation();e.state=state;advanceSimulation(e,1,{},4);assert.equal(e.physical,0);}});
for(const state of ['HALF_TIME','FULL_TIME','PAUSED'])test(`long page lag leaves ${state} and its clock untouched`,()=>{
  const e=simulation();e.state=state;e.clock.elapsed=123;let pauseCalls=0;e.pause=()=>{pauseCalls++;e.state='PAUSED';};
  assert.equal(advanceSimulation(e,8,{},8),0);assert.equal(e.state,state);assert.equal(e.clock.elapsed,123);assert.equal(e.physical,0);assert.equal(pauseCalls,0);
});
