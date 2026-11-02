import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchEngine } from '../src/game/engine.mjs';

const roles=['GK','DEF','DEF','DEF','DEF','MID','MID','MID','FWD','FWD','FWD'];
function roster(prefix){return roles.map((role,i)=>({id:`${prefix}-${i}`,name:`${prefix} Player ${i}`,number:i+1,role,age:i===8?19:25+i%8,
 attributes:{pace:67+i,passing:65+i,shooting:61+i,defending:72-i},fitness:88,fatigue:8,morale:72,confidence:70,trust:74,experience:65,
 psych:{ego:50,professionalism:75,loyalty:70,leadership:60,influence:50},group:i<5?'veterans':'youngsters'}));}
function options(){return {mode:'manager',halfMinutes:5,managerFixtureId:'season1-round0-baku-coast',managerWorldSeason:1,managerUserClubId:'baku',
 managerRoster:roster('baku'),opponentRoster:roster('coast'),managerBench:['GK','DEF','DEF','MID','MID','FWD','FWD'].map((role,i)=>({...roster('bench')[i],role,id:`baku-bench-${i}`,number:12+i,name:`Reserve ${i}`}))};}
function match(extra={}){return new MatchEngine({...options(),...extra});}
function live(e){e.state='IN_PLAY';e.restart=null;e.restartOrigin=null;e.pendingRestart=null;for(const p of e.players){p.vx=p.vy=0;p.x=p.team===0?10:95;p.y=4+p.number*4;p.timer=20;}Object.assign(e.ball,{x:52.5,y:34,z:.11,vx:0,vy:0,vz:0,owner:null,lastTouch:{team:0,playerId:6}});return e;}
function own(e,id,x,y){const p=e.players[id];p.x=x;p.y=y;Object.assign(e.ball,{x:x+.4*e.directions[p.team],y,z:.11,vx:0,vy:0,vz:0,owner:id,lastTouch:{team:p.team,playerId:id}});return p;}
function advance(e,seconds,input={}){for(let i=0;i<seconds*60;i++)e.step(1/60,input);}

test('manager match uses the actual persistent home and opponent identities',()=>{
 const e=match();assert.equal(e.players.length,22);assert.equal(e.players[6].name,'baku Player 6');assert.equal(e.players[6].persistentId,'baku-6');assert.equal(e.players[17].persistentId,'coast-6');assert.deepEqual(e.players.map(p=>p.id),Array.from({length:22},(_,i)=>i));
});
test('roster and attributes are copied without mutating career source objects',()=>{
 const opt=options(),e=new MatchEngine(opt);e.players[6].attributes.passing=5;e.players[6].psych.ego=0;e.bench[0].name='Changed';assert.equal(opt.managerRoster[6].attributes.passing,71);assert.equal(opt.managerRoster[6].psych.ego,50);assert.equal(opt.managerBench[0].name,'Reserve 0');
});
test('bench players have persistent identities but are never extra active bodies',()=>{
 const e=match();assert.equal(e.bench.length,7);assert.equal(e.players.length,22);assert.ok(e.bench.every(p=>!e.players.some(active=>active.persistentId===p.id)));
});
test('starting fitness reflects fatigue instead of resetting everybody to full energy',()=>{
 const opt=options();opt.managerRoster[6].fitness=60;opt.managerRoster[6].fatigue=40;const e=new MatchEngine(opt);assert.equal(e.players[6].stamina,42);assert.ok(e.players[5].stamina>e.players[6].stamina);
});
test('manager substitution introduces a different real bench player into the existing physical slot',()=>{
 const e=match(),ball=e.ball,out=e.players[6].persistentId;assert.equal(e.substitute(6,'baku-bench-3','fatigue'),true);assert.equal(e.players[6].persistentId,'baku-bench-3');assert.equal(e.players[6].name,'Reserve 3');assert.equal(e.players[6].number,15);assert.equal(e.players[6].id,6);assert.equal(e.players.length,22);assert.equal(e.ball,ball);assert.equal(e.bench.length,6);assert.deepEqual(e.departedPersistentIds,[out]);
});
test('substitution ledger names both people and records actual football minute and reason',()=>{
 const e=match();e.clock.elapsed=21*60;assert.ok(e.substitute(6,'baku-bench-3','fitness'));const event=e.substitutionEvents[0];assert.equal(event.minute,21);assert.equal(event.outId,'baku-6');assert.equal(event.inId,'baku-bench-3');assert.equal(event.reason,'fitness');assert.equal(e.managerMatchReport.substitutions[0].minute,21);
});
test('manager cannot replace players while active play is merely paused',()=>{
 const e=live(match());e.pause();assert.equal(e.substitute(6,'baku-bench-3'),false);assert.equal(e.substitutions,0);assert.equal(e.bench.length,7);
});
test('legal half-time is a substitution opportunity',()=>{const e=match();e.state='HALF_TIME';assert.equal(e.substitute(6,'baku-bench-3'),true);});
test('missing bench identity is rejected without changing the match or budget data',()=>{
 const e=match(),before=structuredClone(e.players[6]);assert.equal(e.substitute(6,'not-a-person'),false);assert.deepEqual(e.players[6],before);assert.equal(e.substitutions,0);
});
for(const field of ['injuryDays','suspension','suspendedMatches'])test(`bench selection excludes ${field}`,()=>{
 const e=match();e.bench[3][field]=1;assert.equal(e.substitute(6,'baku-bench-3'),false);
});
test('dismissed players cannot be replaced to restore an illegal extra active player',()=>{
 const e=match();e.players[6].sentOff=true;assert.equal(e.substitute(6,'baku-bench-3'),false);assert.equal(e.players.filter(p=>p.team===0&&!p.sentOff).length,10);
});
test('a withdrawn player cannot return while an incoming player may be withdrawn using another substitution',()=>{
 const e=match();assert.ok(e.substitute(6,'baku-bench-3'));e.bench.push({...roster('baku')[6]});assert.equal(e.substitute(5,'baku-6'),false);assert.equal(e.substitute(6,'baku-bench-4'),true);assert.equal(e.substitutions,2);assert.ok(e.departedPersistentIds.includes('baku-bench-3'));
});
test('five player changes remain the match limit',()=>{
 const e=match();for(const [slot,bench]of [[1,1],[2,2],[5,3],[6,4],[8,5]])assert.equal(e.substitute(slot,`baku-bench-${bench}`),true);assert.equal(e.substitute(9,'baku-bench-6'),false);assert.equal(e.substitutions,5);
});
test('automatic incoming choice prefers an eligible player of the outgoing natural role',()=>{
 const e=match();assert.equal(e.substitute(6),true);assert.equal(e.players[6].naturalRole,'MID');assert.equal(e.players[6].persistentId,'baku-bench-3');
});
test('manager report keeps fixture identity and user-versus-opponent score ordering',()=>{
 const e=match();e.score=[2,1];const report=e.managerMatchReport;assert.equal(report.fixtureId,'season1-round0-baku-coast');assert.equal(report.season,1);assert.equal(report.userClubId,'baku');assert.deepEqual(report.score,[2,1]);assert.equal(report.completed,false);
});
test('manager report counts football minutes rather than wall-clock seconds',()=>{
 const e=live(match());advance(e,1);const stat=e.managerMatchReport.players.find(p=>p.persistentId==='baku-6');assert.ok(Math.abs(e.managerStats['baku-6'].minutes-.15)<1e-9);assert.equal(stat.minutes,.2);
});
test('outgoing minutes stop accumulating while the substitute earns their own minutes',()=>{
 const e=live(match());advance(e,2);e._setupRestart({type:'THROW_IN',team:0,x:40,y:0});e.substitute(6,'baku-bench-3');const before=e.managerStats['baku-6'].minutes;e.continueMatch();advance(e,2);assert.equal(e.managerStats['baku-6'].minutes,before);assert.ok(e.managerStats['baku-bench-3'].minutes>0);assert.ok(e.managerMatchReport.players.some(p=>p.persistentId==='baku-6'));assert.ok(e.managerMatchReport.players.some(p=>p.persistentId==='baku-bench-3'));
});
test('goal credit follows the actual incoming person rather than the physical shirt slot',()=>{
 const e=match();e.substitute(8,'baku-bench-5');e.state='IN_PLAY';e.restart=null;e.ball.lastTouch={team:0,playerId:8};e._stop({type:'GOAL',team:0});assert.equal(e.managerStats['baku-bench-5'].goals,1);assert.equal(e.managerStats['baku-8'].goals,0);
});
test('open-play own goals do not add personal scorer goals',()=>{
 const e=live(match());e.ball.lastTouch={team:1,playerId:17};e._stop({type:'GOAL',team:0});assert.equal(e.managerStats['coast-6'].goals,0);assert.ok(e.managerMatchReport.players.every(p=>p.goals===0));
});
test('passes and shots are attributed to individual persistent identities',()=>{
 const e=live(match()),p=own(e,6,45,34);e._kick(p,'pass',.6,{x:55,y:42});assert.equal(e.managerStats['baku-6'].passes,1);own(e,6,70,20);e._kick(p,'shoot',.6);assert.equal(e.managerStats['baku-6'].shots,1);
});
test('actual teammate reception credits a completed individual pass',()=>{
 const e=live(match());e.ball.lastTouch={team:0,playerId:6};e._receive(e.players[8]);assert.equal(e.managerStats['baku-6'].completedPasses,1);
});
test('a recent completed pass can earn an assist on the actual scorer',()=>{
 const e=live(match());e.ball.lastTouch={team:0,playerId:6};e._receive(e.players[8]);e.ball.lastTouch={team:0,playerId:8};e._stop({type:'GOAL',team:0});assert.equal(e.managerStats['baku-6'].assists,1);assert.equal(e.managerStats['baku-8'].goals,1);
});
test('restart boundaries clear stale assists so an unrelated later goal does not invent an assist',()=>{
 const e=live(match());e.ball.lastTouch={team:0,playerId:6};e._receive(e.players[8]);e._setupRestart({type:'DIRECT_FREE_KICK',team:0,x:90,y:34});e.state='IN_PLAY';e.ball.lastTouch={team:0,playerId:8};e._stop({type:'GOAL',team:0});assert.equal(e.managerStats['baku-6'].assists,0);
});
test('mental-state updates modify current people without resetting positions or minutes',()=>{
 const e=live(match());advance(e,1);const p=e.players[6],before={x:p.x,y:p.y,id:p.persistentId,minutes:e.managerStats[p.persistentId].minutes};assert.ok(e.updateManagerMentalState([{id:p.persistentId,morale:25,confidence:30,trust:20,psych:{professionalism:15}}]));assert.equal(p.morale,25);assert.equal(p.psych.professionalism,15);assert.equal(p.x,before.x);assert.equal(p.y,before.y);assert.equal(p.persistentId,before.id);assert.equal(e.managerStats[p.persistentId].minutes,before.minutes);
});
test('mental-state talk cannot overwrite opponent confidence',()=>{
 const e=match(),before=e.players[17].confidence;e.updateManagerMentalState([{id:e.players[17].persistentId,confidence:0}]);assert.equal(e.players[17].confidence,before);
});
test('a reserve receives the current talk effect when entering after the interval',()=>{
 const e=match(),id='baku-bench-3';e.state='HALF_TIME';assert.equal(e.updateManagerMentalState([{id,morale:92,confidence:88,trust:90,psych:{experience:42},psychMatch:{focus:89,cooperation:88,discipline:85}}]),true);assert.equal(e.substitute(6,id),true);assert.equal(e.players[6].morale,92);assert.equal(e.players[6].confidence,88);assert.equal(e.players[6].experience,42);assert.equal(e._attributes(e.players[6]).focus,89);
});
test('non-manager personal career does not accept coach mental-state overrides',()=>{const e=new MatchEngine({mode:'player'});assert.equal(e.updateManagerMentalState([{id:'x',morale:0}]),false);});
test('low and high morale produce different actual movement under identical conditions',()=>{
 const low=live(match()),high=live(match());for(const e of [low,high])e.ball.lastTouch={team:1,playerId:17};for(const p of low.players.filter(p=>p.team===0))p.morale=0;for(const p of high.players.filter(p=>p.team===0))p.morale=100;advance(low,.2);advance(high,.2);assert.notEqual(low.players[6].x,high.players[6].x);
});
test('confidence and manager trust influence a player passing ability in the real engine',()=>{
 const e=match(),p=e.players[6];p.morale=50;p.confidence=5;p.trust=5;const low=e._attributes(p).passing;p.confidence=95;p.trust=95;assert.ok(e._attributes(p).passing>low+5);
});
test('experience and professionalism influence discipline independently of raw football ability',()=>{
 const e=match(),p=e.players[6];p.experience=5;p.psych.professionalism=5;p.trust=30;const low=e._attributes(p).discipline;p.experience=95;p.psych.professionalism=95;assert.ok(e._attributes(p).discipline>low+30);
});
test('a real late reckless AI challenge creates a card and proper restart',()=>{
 const e=live(match()),def=e.players[6],attacker=own(e,17,51.6,34);def.x=50;def.y=34;def.vx=7;def.experience=5;def.trust=10;def.psych.professionalism=5;e.ball.x=52;e._defendAI(1/60);assert.equal(def.yellow,1);assert.equal(e.state,'OUT_OF_PLAY');assert.equal(e.pendingRestart.type,'DIRECT_FREE_KICK');assert.equal(e.eventLog[1]?.type==='FOUL'||e.eventLog[0]?.type==='FOUL',true);const foul=e.eventLog.find(x=>x.type==='FOUL');assert.equal(foul.persistentId,'baku-6');
});
test('withdrawing a just-booked player preserves the latest card and fitness without another physics step',()=>{
 const e=live(match()),def=e.players[6],outId=def.persistentId;own(e,17,51.6,34);def.x=50;def.y=34;def.vx=7;def.experience=5;def.trust=10;def.psych.professionalism=5;def.stamina=67.2;e.ball.x=52;e._defendAI(1/60);assert.equal(def.yellow,1);assert.equal(e.managerStats[outId].yellow,0);assert.equal(e.substitute(6,'baku-bench-3','tactical'),true);const outgoing=e.managerMatchReport.players.find(p=>p.persistentId===outId);assert.equal(outgoing.yellow,1);assert.equal(outgoing.red,false);assert.equal(outgoing.fitness,67.2);assert.equal(e.substitutionEvents[0].outFitness,67.2);assert.equal(e.players[6].yellow,0);
});
test('excessive actual AI contact can dismiss a player and is reported under their persistent identity',()=>{
 const e=live(match()),def=e.players[6];own(e,17,51.6,34);def.x=50;def.y=34;def.vx=12;def.experience=5;def.trust=10;def.psych.professionalism=5;e.ball.x=52;e._defendAI(1/60);assert.equal(def.sentOff,true);assert.equal(e.managerMatchReport.players.find(p=>p.persistentId==='baku-6').red,true);
});
test('well-timed AI ball contact remains clean instead of manufacturing random fouls',()=>{
 const e=live(match()),def=e.players[6];own(e,17,50.8,34);def.x=50;def.y=34;def.vx=0;e.ball.x=50.6;e._defendAI(1/60);assert.equal(e.state,'IN_PLAY');assert.equal(def.yellow,0);assert.equal(e.ball.lastTouch.team,0);
});
test('a contact offence in the defenders penalty area becomes a penalty',()=>{
 const e=live(match()),def=e.players[2];own(e,20,11.6,34);def.x=10;def.y=34;def.vx=7;def.experience=5;def.trust=5;def.psych.professionalism=5;e.ball.x=12;e._defendAI(1/60);assert.equal(e.pendingRestart.type,'PENALTY');assert.equal(e.pendingRestart.team,1);
});
test('home wide tactics cannot change an opponents fullback target trajectory',()=>{
 const a=live(match()),b=live(match());for(const e of [a,b]){own(e,19,70,8);e.players[12].x=80;e.players[12].y=8;}b.setTactic('wide');a._movePlayers(.1);b._movePlayers(.1);assert.equal(a.players[12].vx,b.players[12].vx);assert.equal(a.players[12].vy,b.players[12].vy);
});
test('hard peripheral shots can be parried as a free ball rather than becoming guaranteed catches',()=>{
 const e=live(match()),keeper=e.players[0];keeper.x=3;keeper.y=34;Object.assign(e.ball,{x:4.2,y:34,z:1,vx:-38,vy:0,vz:0,owner:null,lastTouch:{team:1,playerId:20}});e._touches();assert.equal(e.ball.owner,null);assert.equal(e.ball.lastTouch.playerId,0);assert.equal(e.ball.vx>0,true);assert.equal(e.eventLog[0].outcome,'parry');
});
test('controllable central shots still allow genuine goalkeeper catches',()=>{
 const e=live(match()),keeper=e.players[0];keeper.x=3;keeper.y=34;Object.assign(e.ball,{x:3.5,y:34,z:1,vx:-6,vy:0,vz:0,owner:null,lastTouch:{team:1,playerId:20}});e._touches();assert.equal(e.ball.owner,0);assert.equal(e.keeperHold,0);assert.equal(e.eventLog[0].outcome,'catch');
});
test('manager report marks complete only at the final whistle',()=>{
 const e=match();e.state='HALF_TIME';assert.equal(e.managerMatchReport.completed,false);e.state='FULL_TIME';assert.equal(e.managerMatchReport.completed,true);
});
test('report snapshots cannot mutate the live ledger or substitution history',()=>{
 const e=match();e.substitute(6,'baku-bench-3');const report=e.managerMatchReport;report.players[0].name='Tampered';report.substitutions[0].reason='Tampered';report.score[0]=99;assert.notEqual(e.managerMatchReport.players[0].name,'Tampered');assert.notEqual(e.substitutionEvents[0].reason,'Tampered');assert.equal(e.score[0],0);
});
test('legacy quick matches retain their existing substitution behavior and no fake manager report',()=>{const e=new MatchEngine();assert.equal(e.substitute(6),true);assert.equal(e.players[6].name,'Academy 1');assert.equal(e.managerMatchReport,null);});
