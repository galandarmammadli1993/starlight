import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchEngine } from '../src/game/engine.mjs';
import { FIELD } from '../src/game/rules.mjs';
const r=FIELD.ballRadius;
function field(options={}){
  const e=new MatchEngine(options);e.state='IN_PLAY';e.restart=null;e.restartOrigin=null;
  for(const p of e.players){p.x=p.team===0?15:90;p.y=3+p.number*5;p.vx=p.vy=0;}
  e.ball={x:52.5,y:34,z:r,vx:0,vy:0,vz:0,owner:null,lastTouch:{team:0,playerId:6}};
  return e;
}
function possess(e,id,x,y){const p=e.players[id];p.x=x;p.y=y;e.controlled=id;e.ball={x:x+.25*e.directions[p.team],y,z:r,vx:0,vy:0,vz:0,owner:id,lastTouch:{team:p.team,playerId:id}};return p;}
function advance(e,seconds,input={}){for(let i=0;i<Math.round(seconds*60);i++)e.step(1/60,input);}

test('creates 22 distinct players in legal kick-off halves and center restart',()=>{
  const e=new MatchEngine();assert.equal(e.players.length,22);assert.equal(new Set(e.players.map(p=>p.id)).size,22);assert.equal(e.players.filter(p=>p.role==='GK').length,2);
  assert.equal(e.state,'KICK_OFF_SETUP');assert.equal(e.ball.x,52.5);
  for(const p of e.players){if(p.id===e.restart.takerId)continue;assert.ok(p.team===0?p.x<=52.5:p.x>=52.5);}
  e.continueMatch();assert.equal(e.state,'IN_PLAY');assert.ok(Math.hypot(e.ball.vx,e.ball.vy)>0);
});
for(const [label,y,vy] of [['upper',.05,-20],['lower',67.95,20]])test(`${label} touchline allows whole-ball exit, one event, then a legal throw-in`,()=>{
  const e=field();e.ball={...e.ball,x:45,y,vy};e.step(1/60);assert.ok(e.ball.y<-.11||e.ball.y>68.11);assert.equal(e.state,'OUT_OF_PLAY');assert.equal(e.pendingRestart.type,'THROW_IN');assert.equal(e.pendingRestart.team,1);
  advance(e,1);assert.equal(e.state,'THROW_IN_SETUP');assert.equal(e.ball.x,45);assert.ok([0,68].includes(e.ball.y));assert.equal(e.eventLog.filter(e=>e.type==='THROW_IN').length,1);
  advance(e,2);assert.equal(e.state,'IN_PLAY');assert.ok(e.ball.z>r);
});
test('attacker last touch beyond goal line yields goal kick, not center teleport',()=>{
  const e=field();e.ball={...e.ball,x:104.9,y:14,vx:32};e.step(1/60);assert.equal(e.pendingRestart.type,'GOAL_KICK');advance(e,1);assert.equal(e.state,'GOAL_KICK_SETUP');assert.equal(e.ball.x,99.5);assert.equal(e.ball.y,34);
});
test('defensive deflection beyond goal line yields corner',()=>{
  const e=field();e.ball={...e.ball,x:104.9,y:19,vx:32,lastTouch:{team:1,playerId:12}};e.step(1/60);assert.equal(e.pendingRestart.type,'CORNER_KICK');assert.equal(e.pendingRestart.team,0);advance(e,1);assert.equal(e.state,'CORNER_KICK_SETUP');assert.equal(e.ball.x,105);assert.equal(e.ball.y,0);assert.equal(e.action('cross'),true);assert.equal(e.state,'IN_PLAY');assert.ok(e.ball.vz>0);
});
test('partial boundary overlap remains in play without any artificial clamp',()=>{
  const e=field();e.ball={...e.ball,x:50,y:-.04,vy:0};e.step(1/60);assert.equal(e.state,'IN_PLAY');assert.equal(e.ball.y,-.04);
});
test('a high airborne boundary exit remains a throw-in',()=>{
  const e=field();e.ball={...e.ball,x:60,y:67.9,z:8,vy:40};e.step(1/60);assert.equal(e.pendingRestart.type,'THROW_IN');assert.ok(e.lastBoundary.crossing.z>7);
});
test('fast shots produce exactly one goal then legal opposing kick-off',()=>{
  const e=field();e.ball={...e.ball,x:104.8,y:34,z:1,vx:70};e.step(1/60);assert.equal(e.state,'GOAL_CELEBRATION');assert.deepEqual(e.score,[1,0]);advance(e,3);assert.equal(e.state,'KICK_OFF_SETUP');assert.equal(e.restart.team,1);assert.deepEqual(e.score,[1,0]);for(const p of e.players)if(p.id!==e.restart.takerId)assert.ok(p.team===0?p.x<=52.5:p.x>=52.5);
});
test('own goal physically crossing own goal line credits opponents',()=>{
  const e=field();e.ball={...e.ball,x:.2,y:34,z:1,vx:-40,lastTouch:{team:0,playerId:3}};e.step(1/60);assert.deepEqual(e.score,[0,1]);
});
test('shot above the crossbar is a goal kick, not a goal',()=>{
  const e=field();e.ball={...e.ball,x:104.9,y:34,z:4,vx:45};e.step(1/60);assert.deepEqual(e.score,[0,0]);assert.equal(e.pendingRestart.type,'GOAL_KICK');
});
for(const [wing,y]of [['left',7],['right',61]])test(`a ${wing}-wing cross is an independent lofted ball toward the penalty area`,()=>{
  const e=field();possess(e,8,86,y);const target=e.players[9];target.x=94;target.y=34;e.selectTarget(target.id);assert.equal(e.action('cross',.7),true);assert.equal(e.ball.owner,null);assert.ok(e.ball.vx>0);assert.ok(y<34?e.ball.vy>0:e.ball.vy<0);assert.ok(e.ball.vz>5);const start={...e.ball};e.step(1/60);assert.notEqual(e.ball.x,start.x);assert.ok(e.ball.z>r);
});
test('selected receiver determines pass direction instead of snapping to closest teammate',()=>{
  const e=field();possess(e,6,45,34);e.players[5].x=46;e.players[5].y=34;e.players[8].x=62;e.players[8].y=12;e.selectTarget(8);assert.equal(e.action('pass'),true);assert.ok(e.ball.vx>0);assert.ok(e.ball.vy<0);assert.equal(e.ball.owner,null);assert.notEqual(e.ball.x,e.players[8].x);assert.equal(e.stats.passes[0],1);
});
test('one-two return pass targets the original runner across physical space',()=>{
  const e=field();possess(e,6,45,34);e.players[8].x=55;e.players[8].y=42;e.selectTarget(8);assert.equal(e.action('oneTwo'),true);assert.equal(e.oneTwoRunner,6);
  possess(e,8,55,42);e.selectedTarget=null;assert.equal(e.action('pass'),true);assert.ok(e.ball.vx<0);assert.ok(e.ball.vy<0);assert.equal(e.ball.owner,null);assert.equal(e.oneTwoRunner,null);
});
test('wide-angle shot has velocity toward goal, independent outcome and no guaranteed score',()=>{
  const e=field();possess(e,8,86,7);assert.equal(e.action('shoot',.65),true);assert.ok(e.ball.vx>0);assert.ok(e.ball.vy>0);assert.deepEqual(e.score,[0,0]);assert.equal(e.stats.shots[0],1);
});
test('clearance creates a long high ball',()=>{const e=field();possess(e,2,22,17);assert.equal(e.action('clear'),true);assert.ok(e.ball.vx>20);assert.ok(e.ball.vz>5);});
test('player movement reaches both wings and does not use a central corridor constraint',()=>{
  for(const direction of [-1,1]){const e=field({mode:'player'});const p=possess(e,6,40,34);e.ball.owner=null;e.ball.x=80;e.ball.y=34;advance(e,3,{x:0,y:direction,sprint:true});assert.ok(direction===-1?p.y<12:p.y>54);}
});
test('goalkeeper catches opponent shot and can distribute through physical space',()=>{
  const e=field();const keeper=e.players[0];keeper.x=3;keeper.y=34;e.ball={...e.ball,x:3.5,y:34,z:1,vx:-3,lastTouch:{team:1,playerId:20}};e.step(1/60);assert.equal(e.ball.owner,keeper.id);assert.equal(e.keeperHold,keeper.id);e.controlled=keeper.id;assert.equal(e.action('pass'),true);assert.equal(e.ball.owner,null);assert.equal(e.keeperHold,null);assert.ok(Math.hypot(e.ball.vx,e.ball.vy)>0);
});
test('goalkeeper does not handle a deliberate teammate kick',()=>{
  const e=field();const keeper=e.players[0];keeper.x=3;keeper.y=34;e.ball={...e.ball,x:3.5,y:34,z:r,vx:-3,lastTouch:{team:0,playerId:2}};e.step(1/60);assert.notEqual(e.keeperHold,keeper.id);
});
test('opposing keeper may not hold the ball for over eight seconds',()=>{
  const e=field();const keeper=e.players[0];keeper.x=3;keeper.y=34;e.ball={...e.ball,x:3.5,y:34,z:1,vx:-3,lastTouch:{team:1,playerId:20}};e.step(1/60);e.controlled=keeper.id;e.keeperTime=8;e.step(1/60);assert.equal(e.pendingRestart.type,'CORNER_KICK');assert.equal(e.pendingRestart.team,1);
});
test('clean contact tackle wins a physical ball without a random foul',()=>{
  const e=field();const p=e.players[6],attacker=e.players[17];p.x=50;p.y=34;attacker.x=50.8;attacker.y=34;e.controlled=p.id;e.ball={...e.ball,x:50.6,y:34,owner:attacker.id,lastTouch:{team:1,playerId:attacker.id}};assert.equal(e.action('tackle'),true);assert.equal(e.ball.owner,null);assert.equal(e.ball.lastTouch.team,0);assert.equal(e.state,'IN_PLAY');
});
test('reckless actual contact creates yellow, direct free kick and legal restart',()=>{
  const e=field();const p=e.players[6],attacker=e.players[17];p.x=50;p.y=34;p.vx=7;attacker.x=51.6;attacker.y=34;e.controlled=p.id;e.ball={...e.ball,x:52,y:34,owner:attacker.id,lastTouch:{team:1,playerId:attacker.id}};assert.equal(e.action('tackle'),true);assert.equal(p.yellow,1);assert.equal(e.pendingRestart.type,'DIRECT_FREE_KICK');advance(e,1);assert.equal(e.state,'FREE_KICK_SETUP');
});
test('second reckless yellow dismisses the player permanently',()=>{
  const e=field();const p=e.players[6],attacker=e.players[17];p.yellow=1;p.x=50;p.y=34;p.vx=7;attacker.x=51.6;attacker.y=34;e.controlled=p.id;e.ball={...e.ball,x:52,y:34,owner:attacker.id,lastTouch:{team:1,playerId:attacker.id}};e.action('tackle');assert.equal(p.sentOff,true);e._setupRestart({type:'KICK_OFF',team:0,x:52.5,y:34});e.continueMatch();e.step(1/60);assert.equal(p.sentOff,true);assert.ok(p.x<0);
});
test('contact inside own penalty area awards an opposing penalty at the spot',()=>{
  const e=field();const p=e.players[2],attacker=e.players[20];p.x=10;p.y=34;attacker.x=11.6;attacker.y=34;e.controlled=p.id;e.ball={...e.ball,x:12.1,y:34,owner:attacker.id,lastTouch:{team:1,playerId:attacker.id}};e.action('tackle');assert.equal(e.pendingRestart.type,'PENALTY');assert.equal(e.pendingRestart.x,11);assert.equal(e.pendingRestart.team,1);
});
test('formation has wide roles and only one outfield chaser for loose balls',()=>{
  const e=field();e.setFormation('4-3-3');assert.equal(e.players.filter(p=>p.team===0&&p.role==='DEF').length,4);assert.equal(e.players.filter(p=>p.team===0&&p.role==='FWD').length,3);assert.ok(e.players.some(p=>p.homeY===8&&p.role==='FWD'));assert.ok(e.players.some(p=>p.homeY===60&&p.role==='FWD'));advance(e,.3);assert.ok(new Set(e.players.filter(p=>p.team===0).map(p=>Math.round(p.y/8))).size>=5);
});
test('all supported formations materially update player home positions',()=>{
  const e=field();for(const formation of ['4-4-2','4-2-3-1','3-5-2']){assert.equal(e.setFormation(formation),true);assert.equal(e.formation,formation);}assert.equal(e.players.filter(p=>p.team===0&&p.role==='DEF').length,3);assert.equal(e.setFormation('1-1-1'),false);
});
test('player career locks control to the selected position; remaining players are AI',()=>{
  const e=new MatchEngine({mode:'player',position:'DEF'});assert.equal(e.controlledPlayer.role,'DEF');const id=e.controlled;assert.equal(e.action('switch'),false);e.continueMatch();advance(e,2);assert.equal(e.controlled,id);assert.ok(e.players.filter(p=>p.id!==id&&Math.hypot(p.vx,p.vy)>.1).length>5);
});
test('manager mode uses same clock/rules while AI takes kickoff',()=>{const e=new MatchEngine({mode:'manager'});advance(e,2);assert.equal(e.state,'IN_PLAY');assert.ok(e.clock.elapsed>0);assert.ok(e.ball.x!==52.5||e.ball.y!==34);});
test('half ends once, halftime freezes clock, and second half switches every team direction',()=>{
  const e=field();e.clock.elapsed=2699.99;e.step(.1);assert.equal(e.state,'HALF_TIME');const elapsed=e.clock.elapsed;e.step(50);assert.equal(e.clock.elapsed,elapsed);e.continueMatch();assert.equal(e.clock.half,2);assert.deepEqual(e.directions,[-1,1]);assert.equal(e.state,'KICK_OFF_SETUP');assert.equal(e.restart.team,1);
});
test('second half finishes with full-time and no new simulation after end',()=>{const e=field();e.clock.half=2;e.clock.elapsed=2699.9;e.step(.1);assert.equal(e.state,'FULL_TIME');const elapsed=e.clock.elapsed;e.step(5);assert.equal(e.clock.elapsed,elapsed);});
test('pause/resume is one authoritative simulation, no elapsed time or movement while paused',()=>{
  const e=field();possess(e,6,40,34);e.pause();const x=e.players[6].x;e.step(3,{x:1});assert.equal(e.clock.elapsed,0);assert.equal(e.players[6].x,x);e.pause();e.resume();assert.equal(e.state,'IN_PLAY');e.step(.1,{x:1});assert.ok(e.clock.elapsed>0);assert.ok(e.players[6].x>x);
});
test('clock speed is consistent at 30, 60 and 144 FPS and honors chosen duration',()=>{
  const values=[];for(const fps of [30,60,144]){const e=field();for(let i=0;i<fps*2;i++)e.step(1/fps);values.push(e.clock.elapsed);}for(const value of values)assert.ok(Math.abs(value-7.5)<1e-8);
  const e=field({halfMinutes:45});e.step(1);assert.equal(e.clock.elapsed,1);
});
test('manual restart resumes rather than leaving a frozen setup',()=>{
  const e=field();for(const type of ['THROW_IN','CORNER_KICK','GOAL_KICK','DIRECT_FREE_KICK','INDIRECT_FREE_KICK','PENALTY']){e._setupRestart({type,team:0,x:type==='GOAL_KICK'?5.5:40,y:type==='THROW_IN'?0:34});assert.notEqual(e.state,'IN_PLAY');assert.equal(e.action('pass'),true);assert.equal(e.state,'IN_PLAY');assert.ok(Math.hypot(e.ball.vx,e.ball.vy)>0);}
});
test('throw-in cannot score directly and remains a physical overhead trajectory',()=>{
  const e=field();e._setupRestart({type:'THROW_IN',team:0,x:90,y:0});e.action('cross',.8,{x:100,y:34});assert.ok(e.ball.z>1.8);assert.ok(e.ball.vz>0);assert.equal(e.restartOrigin.type,'THROW_IN');assert.equal(e.offside.candidates.length,0);
});
test('unfair throw delay requires initial judgement then five-second countdown',()=>{
  const e=field();e._setupRestart({type:'THROW_IN',team:0,x:40,y:0});advance(e,5);assert.equal(e.delayWarned,false);advance(e,10.2);assert.equal(e.delayWarned,true);assert.equal(e.restart.team,0);advance(e,5);assert.equal(e.restart.team,1);assert.equal(e.restart.type,'THROW_IN');
});
test('substitutions are limited to five and require a stoppage',()=>{
  const e=field();assert.equal(e.substitute(1),false);e._setupRestart({type:'THROW_IN',team:0,x:40,y:0});for(let id=1;id<=5;id++)assert.equal(e.substitute(id),true);assert.equal(e.substitute(6),false);assert.equal(e.substitutions,5);
});
test('long AI simulation reaches valid states without NaNs or permanent boundary trapping',()=>{
  const e=new MatchEngine({mode:'manager',halfMinutes:5});advance(e,45);assert.ok(!['PRE_MATCH','PAUSED','FULL_TIME'].includes(e.state));for(const p of e.players)assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(Number.isFinite(e.ball.x)&&Number.isFinite(e.ball.z));assert.ok(e.eventLog.length>2);assert.ok(e.clock.elapsed>390);
});

test('offside snapshot at pass waits for active receiving involvement',()=>{
  const e=field();possess(e,6,80,34);e.players[8].x=96;e.players[8].y=34;e.selectTarget(8);e.action('pass');assert.ok(e.offside.candidates.includes(8));assert.equal(e.state,'IN_PLAY');assert.equal(e.stats.offsides[0],0);
  e.ball.x=96.1;e.ball.y=34;e.ball.vx=e.ball.vy=0;e.ball.z=r;e.kickCooldown=0;e.step(1/60);assert.equal(e.state,'OUT_OF_PLAY');assert.equal(e.pendingRestart.type,'INDIRECT_FREE_KICK');assert.equal(e.pendingRestart.team,1);assert.equal(e.stats.offsides[0],1);
});
test('a player level with the second-last opponent is not wrongly penalized',()=>{
  const e=field();possess(e,6,80,34);e.players[8].x=90;e.players[8].y=34;e.selectTarget(8);e.action('pass');assert.ok(!e.offside.candidates.includes(8));
});
test('deliberately controlling an opponent pass clears prior offside candidates',()=>{
  const e=field();e.offside={team:0,line:90,candidates:[8]};const p=e.players[16];p.x=60;p.y=34;e.ball={...e.ball,x:60.1,y:34,vx:0,vy:0,lastTouch:{team:0,playerId:6}};e.step(1/60);assert.equal(e.ball.owner,16);assert.equal(e.offside,null);
});
test('a save retains the previous offside snapshot rather than treating it as deliberate play',()=>{
  const e=field();e.offside={team:0,line:90,candidates:[8]};const gk=e.players[11];gk.x=102;gk.y=34;e.ball={...e.ball,x:101.5,y:34,z:1,lastTouch:{team:0,playerId:6}};e.step(1/60);assert.equal(e.keeperHold,11);assert.deepEqual(e.offside.candidates,[8]);
});
test('a restart taker cannot touch the ball again before a different player does',()=>{
  const e=field();e._setupRestart({type:'GOAL_KICK',team:0,x:5.5,y:34});const taker=e.restart.takerId;e.action('pass');e.kickCooldown=0;e.ball.x=e.players[taker].x+.1;e.ball.y=e.players[taker].y;e.ball.z=r;e.ball.vx=e.ball.vy=0;e.step(1/60);assert.equal(e.state,'OUT_OF_PLAY');assert.equal(e.pendingRestart.type,'INDIRECT_FREE_KICK');assert.equal(e.pendingRestart.team,1);
});
test('pause preserves a referee delay countdown so resuming cannot restart its timer',()=>{
  const e=field();e._setupRestart({type:'THROW_IN',team:0,x:40,y:0});advance(e,17);assert.equal(e.delayWarned,true);const age=e.stateAge;e.pause();e.step(100);e.resume();assert.ok(Math.abs(e.stateAge-age)<1e-9);advance(e,3.2);assert.equal(e.restart.team,1);
});
test('four real minutes of autonomous play creates passes and shots in both attacking thirds',()=>{
  const e=new MatchEngine({mode:'manager',halfMinutes:5});let low=105,high=0;
  for(let i=0;i<240*60;i++){e.step(1/60);if(e.ball.owner!==null){low=Math.min(low,e.ball.x);high=Math.max(high,e.ball.x);}}
  assert.ok(e.stats.passes[0]+e.stats.passes[1]>20);assert.ok(e.stats.shots[0]+e.stats.shots[1]>0);assert.ok(low<30&&high>75);assert.equal(e.state,'IN_PLAY');assert.equal(e.clock.display,'36:00');assert.ok(e.players.every(p=>!p.sentOff));
});

test('two teammates actually receive both legs of a one-two without ball teleportation',()=>{
  const e=field();for(const p of e.players){p.x=p.team?100:10;p.y=3+p.number*5;}
  possess(e,6,45,34);e.players[8].x=55;e.players[8].y=42;e.selectTarget(8);e.action('oneTwo');
  let firstArrival=false;for(let i=0;i<180;i++){e.step(1/60);if(e.ball.owner===8){firstArrival=true;break;}}
  assert.equal(firstArrival,true);assert.equal(e.controlled,8);assert.equal(e.stats.completed[0],1);e.action('pass');assert.equal(e.ball.owner,null);
  let returnArrival=false;for(let i=0;i<180;i++){e.step(1/60);if(e.ball.owner===6){returnArrival=true;break;}}
  assert.equal(returnArrival,true);assert.equal(e.stats.completed[0],2);assert.equal(e.controlled,6);
});
test('a physical defender block can send a shot across the goal line for a corner',()=>{
  const e=field();const defender=e.players[12];defender.x=104.4;defender.y=39;e.ball={...e.ball,x:103.6,y:39,z:r,vx:30,lastTouch:{team:0,playerId:8}};
  e.step(1/60);assert.equal(e.ball.lastTouch.team,1);assert.equal(e.eventLog[0].type,'BLOCK');advance(e,.5);assert.equal(e.state,'OUT_OF_PLAY');assert.equal(e.pendingRestart.type,'CORNER_KICK');assert.equal(e.pendingRestart.team,0);
});
test('a defender deflection preserves an attacker offside eligibility snapshot',()=>{
  const e=field();const defender=e.players[12];defender.x=60.4;defender.y=39;e.offside={team:0,line:90,candidates:[8]};e.ball={...e.ball,x:59.6,y:39,z:r,vx:30,lastTouch:{team:0,playerId:6}};
  e.step(1/60);assert.equal(e.eventLog[0].type,'BLOCK');assert.equal(e.ball.lastTouch.team,1);assert.deepEqual(e.offside.candidates,[8]);
});
test('a teammate header after a throw ends both direct-goal restriction and restart offside exemption',()=>{
  const e=field();const attacker=e.players[8];attacker.x=98;attacker.y=34;e.restartOrigin={type:'THROW_IN',team:0,untouched:true};e.offside={team:0,line:90,candidates:[]};e.ball={...e.ball,x:98.1,y:34,z:2,vx:0,lastTouch:{team:0,playerId:5}};
  e.step(1/60);assert.equal(e.ball.lastTouch.playerId,8);assert.equal(e.restartOrigin,null);assert.equal(e.offside.source,'OPEN_PLAY');
  e.ball.x=104.9;e.ball.y=34;e.ball.z=1;e.ball.vx=40;e.ball.vy=e.ball.vz=0;e.step(1/60);assert.deepEqual(e.score,[1,0]);
});
test('home formation changes leave the opponent formation untouched',()=>{
  const e=new MatchEngine();const away=e.players.filter(p=>p.team===1).map(p=>[p.role,p.homeX,p.homeY]);e.setFormation('3-5-2');assert.deepEqual(e.players.filter(p=>p.team===1).map(p=>[p.role,p.homeX,p.homeY]),away);assert.equal(e.players.filter(p=>p.team===0&&p.role==='DEF').length,3);
});
test('press tactic sends a second midfielder toward the ball with a different actual trajectory',()=>{
  const balanced=field({mode:'manager'}),press=field({mode:'manager'});
  for(const e of [balanced,press]){const owner=e.players[17];owner.x=58;owner.y=34;e.ball={...e.ball,x:58.2,y:34,owner:17,lastTouch:{team:1,playerId:17}};e.players[6].x=45;e.players[6].y=30;e.players[5].x=48;e.players[5].y=40;}
  press.setTactic('press');advance(balanced,.15);advance(press,.15);assert.notEqual(press.players[6].vx,balanced.players[6].vx);assert.ok(press.players[6].vx>balanced.players[6].vx);
});
test('penalty setup places the goalkeeper on goal line and all other players legally behind the spot',()=>{
  const e=field();e._setupRestart({type:'PENALTY',team:0,x:94,y:34});const keeper=e.players[11];assert.equal(keeper.x,105);assert.equal(keeper.y,34);
  for(const p of e.players){if(p.id===e.restart.takerId||p.id===keeper.id)continue;assert.ok(p.x<94);assert.ok(Math.hypot(p.x-94,p.y-34)>=9.15);assert.ok(p.x<88.5||Math.abs(p.y-34)>20.16);}
});
test('defending a penalty allows manual goalkeeper lateral movement on the line',()=>{
  const e=field();e._setupRestart({type:'PENALTY',team:1,x:11,y:34});assert.equal(e.controlled,0);advance(e,.5,{y:1});assert.equal(e.players[0].x,0);assert.ok(e.players[0].y>35);assert.equal(e.state,'PENALTY_SETUP');
});

test('player career preserves chosen role and customized identity through formation changes',()=>{
  for(const position of ['DEF','MID','FWD']){
    const e=new MatchEngine({mode:'player',position,formation:'4-3-3'});const id=e.controlled;const player=e.players[id];player.name='Araz';player.number=77;
    for(const formation of ['4-4-2','4-2-3-1','3-5-2']){e.setFormation(formation);assert.equal(e.controlled,id);assert.equal(e.careerPlayer,id);assert.equal(player.role,position);assert.equal(player.name,'Araz');assert.equal(player.number,77);}
  }
});
test('pausing active play does not manufacture a substitution stoppage',()=>{
  const e=field();e.pause();assert.equal(e.substitute(1),false);e.resume();e._setupRestart({type:'THROW_IN',team:0,x:40,y:0});e.pause();assert.equal(e.substitute(1),true);assert.equal(e.substitutions,1);
});

test('a half-ending whistle is deferred until an awarded penalty is completed',()=>{
  const e=field();e._setupRestart({type:'PENALTY',team:0,x:94,y:34});e.clock.elapsed=2759.99;e.clock.addedSeconds=60;e.step(.1);assert.equal(e.state,'PENALTY_SETUP');assert.equal(e.deferredClockEvent,'HALF_TIME');e.action('shoot');assert.equal(e.state,'IN_PLAY');
  e.ball.x=104.9;e.ball.y=34;e.ball.z=1;e.ball.vx=40;e.ball.vy=e.ball.vz=0;e.step(1/60);assert.equal(e.state,'HALF_TIME');assert.deepEqual(e.score,[1,0]);assert.equal(e.deferredClockEvent,null);
});
