import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchEngine } from '../src/game/engine.mjs';
import { createHuman, updateHuman } from '../src/game/human-model.mjs';
import { MeshStandardMaterial } from 'three';

const roles=['GK','DEF','DEF','DEF','DEF','MID','MID','MID','FWD','FWD','FWD'];
function person(id,role,index=0){return {id,name:`Person ${id}`,role,number:index+1,age:22,attributes:{pace:72,passing:73,shooting:74,defending:65},fitness:88,energy:83,fatigue:5,morale:72,confidence:69,trust:66,psych:{professionalism:70,experience:36},psychMatch:{focus:72,cooperation:73,discipline:77},appearance:{hair:'short',beard:'none',boots:'black',skin:1}};}
function options(selection='starter'){
 const playerRoster=roles.map((r,i)=>person(`home-${i}`,r,i));
 const hero=person('player-hero','FWD',8);hero.name='Araz Hero';
 const playerBench=['GK','DEF','DEF','MID','MID','FWD','FWD'].map((r,i)=>person(`reserve-${i}`,r,i+11));
 if(selection==='starter')playerRoster[8]=hero;
 if(selection==='bench')playerBench[5]=hero;
 return {mode:'player',position:'FWD',halfMinutes:5,playerRoster,playerBench,opponentRoster:roles.map((r,i)=>person(`away-${i}`,r,i)),playerHeroId:'player-hero',playerFixtureId:'player-s1-r1',playerUserClubId:'home',playerWorldSeason:1,playerSelection:selection,playerEntryMinute:65,playerExitMinute:null,playerAttributes:{pace:71,passing:72,shooting:73,defending:64,energy:79,fitness:84,morale:75,confidence:73,trust:68,stress:18,focus:78,cooperation:75,discipline:82}};
}
function match(selection='starter',extra={}){return new MatchEngine({...options(selection),...extra});}
function minute(e,value){e.clock.half=value>=45?2:1;e.clock.elapsed=(value>=45?value-45:value)*60;}
function live(e){e.state='IN_PLAY';e.restart=null;e.pendingRestart=null;e.restartOrigin=null;e.offside=null;for(const p of e.players){p.x=p.team===0?10:95;p.y=3+p.number*3;p.vx=p.vy=0;p.timer=20;}Object.assign(e.ball,{x:52.5,y:34,z:.11,vx:0,vy:0,vz:0,owner:null,lastTouch:{team:0,playerId:6}});return e;}
function stoppage(e){e._setupRestart({type:'THROW_IN',team:0,x:40,y:0});}
function own(e,p,x=70,y=25){p.x=x;p.y=y;Object.assign(e.ball,{x:x+.4,y,z:.11,vx:0,vy:0,vz:0,owner:p.id,lastTouch:{team:p.team,playerId:p.id}});}

test('persistent player career controls only its actual named hero',()=>{
 const e=match();assert.equal(e.hasPlayerCareerRoster,true);assert.equal(e.hasPersistentRoster,true);assert.equal(e.controlled,8);assert.equal(e.careerPlayer,8);assert.equal(e.controlledPlayer.persistentId,'player-hero');assert.equal(e.controlledPlayer.name,'Araz Hero');assert.equal(e.playerCareerActive,true);assert.equal(e.playerCareerStatus,'playing');assert.equal(e.players.length,22);assert.equal(e.bench.length,7);
});
test('career roster copies people without mutating source objects',()=>{
 const o=options(),e=new MatchEngine(o);e.players[8].attributes.passing=0;e.bench[0].name='Changed';assert.equal(o.playerRoster[8].attributes.passing,73);assert.equal(o.playerBench[0].name,'Person reserve-0');
});
test('actual hero energy and life mentality reach the physical match',()=>{
 const e=match(),p=e.controlledPlayer;assert.equal(p.stamina,79);assert.equal(e._attributes(p).focus,78);assert.equal(p.confidence,73);assert.equal(p.psych.stress,18);assert.equal(e.managerStats['player-hero'].fitness,79);
});
test('bench selection never turns another player into the user',()=>{
 const e=live(match('bench'));assert.equal(e.careerPlayer,-1);assert.equal(e.controlled,-1);assert.equal(e.controlledPlayer,undefined);assert.equal(e.playerCareerStatus,'bench');assert.equal(e.playerCareerActive,false);assert.ok(e.players.every(p=>p.persistentId!=='player-hero'));
});
for(const action of ['pass','shoot','through','cross','switch','tackle','call','skill','clear'])test(`absent hero cannot use ${action} on behalf of a teammate`,()=>{
 const e=live(match('bench'));own(e,e.players[8]);const ball=structuredClone(e.ball);assert.equal(e.action(action),false);assert.deepEqual(e.ball,ball);assert.equal(e.selectTarget(9),false);
});
test('bench input cannot move the teammate occupying the future hero slot',()=>{
 const a=live(match('bench')),b=live(match('bench'));a.step(.2,{x:1,y:1,sprint:true});b.step(.2,{});assert.equal(a.players[8].x,b.players[8].x);assert.equal(a.players[8].y,b.players[8].y);
});
test('bench and omitted reports contain zero actual minutes without extra bodies',()=>{
 for(const status of ['bench','omitted']){const e=live(match(status));e._trackManagerMinutes(2);assert.equal(e.playerMatchReport.hero.minutes,0);assert.equal(e.playerMatchReport.hero.goals,0);assert.equal(e.players.length,22);assert.equal(e.managerMatchReport,null);assert.equal(e.playerMatchReport.status,status);}
});
test('coach does not enter a reserve before the promised opportunity',()=>{
 const e=match('bench');minute(e,60);stoppage(e);e.step(1/60);assert.equal(e.playerCareerStatus,'bench');assert.equal(e.substitutions,0);
});
test('coach queues entry during play and makes a real substitution at the next stoppage',()=>{
 const e=live(match('bench'));minute(e,65);e.step(1/60);assert.equal(e.playerCareerStatus,'bench');assert.equal(e.substitutions,0);stoppage(e);e.step(1/60);assert.equal(e.playerCareerStatus,'playing');assert.equal(e.controlledPlayer.persistentId,'player-hero');assert.ok(e.careerPlayer>=1&&e.careerPlayer<=10);assert.equal(e.substitutions,1);assert.equal(e.bench.length,6);assert.equal(e.players.length,22);assert.equal(e.substitutionEvents[0].inId,'player-hero');assert.ok(e.departedPersistentIds.includes(e.substitutionEvents[0].outId));
});
test('coach entry is deferred while the match is paused',()=>{
 const e=match('bench');minute(e,65);stoppage(e);e.pause();e.step(1);assert.equal(e.playerCareerStatus,'bench');e.resume();e.step(1/60);assert.equal(e.playerCareerStatus,'playing');
});
test('a planned halftime opportunity uses the legal interval and preserves the score',()=>{
 const e=match('bench',{playerEntryMinute:45});e.clock.elapsed=2700;e.clock.halfEnded=true;e.score=[1,0];e._endPeriod('HALF_TIME');assert.equal(e.playerCareerStatus,'playing');assert.equal(e.substitutions,1);assert.deepEqual(e.score,[1,0]);assert.equal(e.state,'HALF_TIME');
});
test('entered hero earns its own minutes and movement while the departed player stops accumulating',()=>{
 const e=match('bench');minute(e,65);stoppage(e);e.step(1/60);const out=e.substitutionEvents[0].outId,before=e.managerStats[out].minutes;live(e);const p=e.controlledPlayer,x=p.x;e.step(.8,{x:1});assert.ok(p.x>x);assert.ok(e.playerMatchReport.hero.minutes>0);assert.equal(e.managerStats[out].minutes,before);
});
test('planned withdrawal obeys a stoppage and leaves the user watching their own career',()=>{
 const e=live(match('starter',{playerExitMinute:65}));minute(e,65);e.step(1/60);assert.equal(e.playerCareerStatus,'playing');stoppage(e);e.step(1/60);assert.equal(e.playerCareerStatus,'substituted');assert.equal(e.playerCoachSubstitutionReason,'fitness');assert.equal(e.controlled,-1);assert.equal(e.careerPlayer,-1);assert.equal(e.playerMatchReport.status,'substituted');assert.ok(e.playerMatchReport.players.some(p=>p.persistentId==='player-hero'));assert.ok(e.players.every(p=>p.persistentId!=='player-hero'));assert.equal(e.action('shoot'),false);
});
test('severely tired hero can be protected by the coach after the 55th minute',()=>{
 const e=match();minute(e,70);e.controlledPlayer.stamina=20;stoppage(e);e.step(1/60);assert.equal(e.playerCareerStatus,'substituted');assert.equal(e.playerMatchReport.hero.fitness,20);
});
test('fatigue alone does not remove the hero before the coaching threshold',()=>{
 const e=match();minute(e,30);e.controlledPlayer.stamina=20;stoppage(e);e.step(1/60);assert.equal(e.playerCareerStatus,'playing');
});
test('red card ends personal control without illegally restoring an eleventh player',()=>{
 const e=live(match()),hero=e.controlledPlayer;minute(e,55);hero.sentOff=true;e.step(1/60);assert.equal(e.playerCareerStatus,'sent_off');assert.equal(e.controlled,-1);assert.equal(e.substitutions,0);assert.equal(e.players.filter(p=>p.team===0&&!p.sentOff).length,10);assert.equal(e.playerMatchReport.hero.red,true);assert.equal(e.action('pass'),false);
});
test('player cannot make manager substitutions or alter team tactics',()=>{
 const e=match();stoppage(e);assert.equal(e.substitute(2,'reserve-1'),false);assert.equal(e.setFormation('3-5-2'),false);assert.equal(e.setTactic('press'),false);
});
test('report fixture metadata follows the player club and user-versus-opponent score',()=>{
 const e=match();e.score=[1,2];const r=e.playerMatchReport;assert.equal(r.fixtureId,'player-s1-r1');assert.equal(r.userClubId,'home');assert.equal(r.season,1);assert.equal(r.heroId,'player-hero');assert.deepEqual(r.score,[1,2]);assert.equal(r.completed,false);e.state='FULL_TIME';assert.equal(e.playerMatchReport.completed,true);
});
test('hero passes and completed receptions produce an individual ledger',()=>{
 const e=live(match()),p=e.controlledPlayer;own(e,p);assert.equal(e.action('pass',.6,{x:78,y:30}),true);e.ball.lastTouch={team:0,playerId:p.id};e._receive(e.players[9]);assert.equal(e.playerMatchReport.hero.passes,1);assert.equal(e.playerMatchReport.hero.completedPasses,1);
});
test('a hero completed pass followed by a teammate shot creates an actual key pass',()=>{
 const e=live(match()),p=e.controlledPlayer;e.ball.lastTouch={team:0,playerId:p.id};e._receive(e.players[9]);e._kick(e.players[9],'shoot',.7);assert.equal(e.playerMatchReport.hero.keyPasses,1);
});
test('real personal goals and assists are credited to the hero identity',()=>{
 const e=live(match()),p=e.controlledPlayer;e.ball.lastTouch={team:0,playerId:p.id};e._receive(e.players[9]);e.ball.lastTouch={team:0,playerId:9};e._stop({type:'GOAL',team:0});assert.equal(e.playerMatchReport.hero.assists,1);e.state='IN_PLAY';e.ball.lastTouch={team:0,playerId:p.id};e._stop({type:'GOAL',team:0});assert.equal(e.playerMatchReport.hero.goals,1);
});
test('withdrawal preserves the latest card, fitness and football minutes',()=>{
 const e=match('starter',{playerExitMinute:65}),hero=e.controlledPlayer;e.managerStats['player-hero'].minutes=65.25;hero.yellow=1;hero.stamina=33;minute(e,66);stoppage(e);e.step(1/60);const stat=e.playerMatchReport.hero;assert.equal(stat.minutes,65.3);assert.equal(stat.yellow,1);assert.equal(stat.fitness,33);
});
test('public report copies cannot rewrite the live hero record',()=>{
 const e=match(),r=e.playerMatchReport;r.hero.goals=100;r.players.find(p=>p.persistentId==='player-hero').minutes=100;r.score[0]=9;assert.equal(e.playerMatchReport.hero.goals,0);assert.equal(e.playerMatchReport.hero.minutes,0);assert.equal(e.score[0],0);
});
test('aimed shot changes actual travel direction without creating another ball',()=>{
 const e=live(match()),p=e.controlledPlayer,ball=e.ball;own(e,p,70,34);assert.equal(e.action('shoot',.8,{x:106,y:36}),true);assert.ok(e.ball.vx>0);assert.ok(e.ball.vy>0);assert.equal(e.ball,ball);assert.equal(e.playerMatchReport.hero.shots,1);
});
test('contact-point spin curves the same airborne ball in the actual physics',()=>{
 const a=live(match()),b=live(match());for(const e of [a,b])own(e,e.controlledPlayer,65,34);a.action('shoot',.8,{x:106,y:34,spin:0});b.action('shoot',.8,{x:106,y:34,spin:1});for(let i=0;i<15;i++){a._moveBall(1/60);b._moveBall(1/60);}assert.ok(b.ball.y>a.ball.y+.2);assert.ok(b.ball.spin>0&&b.ball.spin<1);
});
test('contact height changes actual shot loft and invalid aim is rejected',()=>{
 const a=live(match()),b=live(match());for(const e of [a,b])own(e,e.controlledPlayer,65,34);a.action('shoot',.6,{x:106,y:34,contactY:-1});b.action('shoot',.6,{x:106,y:34,contactY:1});assert.ok(a.ball.vz>b.ball.vz);const before=structuredClone(a.ball);assert.equal(a.action('shoot',.5,{x:NaN,y:34}),false);assert.deepEqual(a.ball,before);
});
test('a controlled reception and a new restart both clear stale spin',()=>{
 const e=match();e.ball.spin=1;e._receive(e.players[6]);assert.equal(e.ball.spin,0);e.ball.spin=-1;stoppage(e);assert.equal(e.ball.spin,0);
});

test('career cosmetics change actual human meshes without replacing the person or ball',()=>{
 const e=match('starter',{playerAppearance:{hair:'shaved',beard:'short',boots:'red',skin:3}}),p=e.controlledPlayer;
 const model=createHuman(p,{shirt:'#9dce76',shorts:'#243d2e',trim:'#daeacb'});
 assert.equal(model.hair.visible,false);assert.equal(model.beard.visible,true);assert.equal(model.boots[0].material.color.getHexString(),'cd433e');assert.equal(model.head.material.color.getHexString(),'734b37');
 p.appearance={hair:'long',beard:'none',boots:'gold',skin:0};updateHuman(model,p,1,e);
 assert.equal(model.hair.visible,true);assert.equal(model.hair.scale.y,1.08);assert.equal(model.beard.visible,false);assert.equal(model.boots[1].material.color.getHexString(),'d0ac4d');assert.equal(model.head.material.color.getHexString(),'c98e62');assert.equal(p.persistentId,'player-hero');
});
test('one player cosmetic update does not repaint another player with shared cached materials',()=>{
 const e=match(),cache=new Map(),material=color=>{if(!cache.has(color))cache.set(color,new MeshStandardMaterial({color}));return cache.get(color);};
 const kit={shirt:'#9dce76',shorts:'#243d2e',trim:'#daeacb'},a=createHuman(e.players[8],kit,{material}),b=createHuman(e.players[9],kit,{material});
 const old=b.boots[0].material.color.getHexString();e.players[8].appearance.boots='red';updateHuman(a,e.players[8],0,e);assert.equal(a.boots[0].material.color.getHexString(),'cd433e');assert.equal(b.boots[0].material.color.getHexString(),old);
});

test('player club and opponent names also reach the actual match event feed',()=>{
 const e=live(match('starter',{playerClubName:'Forest Sporting',playerOpponentName:'Highland FC'}));e.ball.lastTouch={team:0,playerId:e.controlled};e._stop({type:'GOAL',team:0});assert.match(e.eventLog[0].message,/Forest Sporting/);e._setupRestart({type:'THROW_IN',team:1,x:60,y:0});assert.match(e.notification,/Highland FC/);
});

test('coach can respond to sustained ineffective passing when the team is losing',()=>{
 const e=live(match()),hero=e.controlledPlayer;e.managerStats['player-hero'].minutes=65;e.score=[0,1];minute(e,72);
 for(let i=0;i<6;i++){own(e,hero,50,25);e.action('pass',.6,{x:75,y:15});}
 assert.equal(e.playerMatchReport.hero.passes,6);assert.equal(e.playerMatchReport.hero.completedPasses,0);
 stoppage(e);e.step(1/60);assert.equal(e.playerCareerStatus,'substituted');assert.equal(e.playerCoachSubstitutionReason,'performance');
});
test('the same incomplete passes do not manufacture a performance withdrawal while the team is winning',()=>{
 const e=match(),hero=e.controlledPlayer;e.managerStats['player-hero'].minutes=65;e.managerStats['player-hero'].passes=6;e.score=[2,0];minute(e,72);stoppage(e);e.step(1/60);assert.equal(e.playerCareerStatus,'playing');
});
