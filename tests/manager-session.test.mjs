import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureCareers, careerAction, applyCareerMatch } from '../src/game/career.mjs';
import { MatchEngine } from '../src/game/engine.mjs';
import { getClubPlayers, getPlayer, getNextFixture } from '../src/game/manager-world.mjs';
import { ensureManagerSimulation, syncManagerSummary, managerDecision, managerMatchOptions, applyManagerSimulationResult } from '../src/game/manager-session.mjs';

function fresh() {
  const save={version:1,profile:{name:'Hero'},career:{results:[]}};
  const manager=ensureCareers(save).manager;
  ensureManagerSimulation(manager);syncManagerSummary(manager);
  return {save,manager,world:manager.world};
}
function prepared(manager) {
  const setup=managerMatchOptions(manager);assert.equal(setup.ok,true);
  const engine=new MatchEngine({...setup.options,halfMinutes:5});
  engine.matchId=`live-${setup.fixture.id}`;
  assert.equal(managerDecision(manager,'begin_match',{fixtureId:setup.fixture.id}).ok,true);
  return {engine,fixture:setup.fixture};
}
function finish(engine,score=[2,1]) { engine.score=[...score];engine.state='FULL_TIME';return engine; }
function addEvent(world,type,playerId,choiceIds) {
  const id=`integration-${type}-${++world.psychology.sequence}`;
  world.psychology.events.push({id,type,playerId,title:type,body:'Oyundaxili hadisə',day:world.day,dueDay:world.day,status:'pending',evidence:'confirmed',context:{key:id},choices:choiceIds.map(id=>({id,label:id,preview:id}))});
  return id;
}

test('manager initialization creates one persistent league without changing personal life',()=>{
  const {save,manager,world}=fresh(),personal=structuredClone(save.careers.player),ids=world.players.map(p=>p.id);
  assert.equal(world.clubs.length,8);assert.equal(world.players.length,176);assert.equal(world.fixtures.length,56);
  assert.equal(world.lineup.length,11);assert.equal(world.bench.length,7);
  assert.ok(world.players.every(p=>p.psychMatch&&Number.isFinite(p.psychMatch.focus)));
  assert.equal(ensureManagerSimulation(manager),world);assert.deepEqual(world.players.map(p=>p.id),ids);
  assert.equal(world.psychology.events.filter(e=>e.context?.key?.startsWith('initial-')).length,3);
  assert.deepEqual(save.careers.player,personal);
});
test('career normalization retains individual psychology, group, lineup and resolved dilemmas',()=>{
  const {save,manager,world}=fresh(),id=world.lineup[5],person=getPlayer(world,id);
  person.morale=37;person.psych.focusBoost=-4;person.psych.focusUntilRound=2;person.group='international';
  const event=world.psychology.events.find(e=>e.type==='late_training');
  assert.equal(managerDecision(manager,'resolve_event',{eventId:event.id,choiceId:'listen'}).ok,true);
  const normalized=ensureCareers(JSON.parse(JSON.stringify(save))).manager;
  const restored=ensureManagerSimulation(normalized);
  assert.equal(getPlayer(restored,id).morale,37);assert.equal(getPlayer(restored,id).psych.focusBoost,-4);
  assert.equal(getPlayer(restored,id).group,'international');assert.deepEqual(restored.lineup,world.lineup);
  assert.equal(restored.psychology.events.find(e=>e.id===event.id).status,'resolved');
  assert.equal(restored.psychology.events.filter(e=>e.context?.key==='initial-star').length,1);
});
test('simulation records the real scheduled fixture, finances, stats and manager record once',()=>{
  const {save,manager,world}=fresh(),personal=structuredClone(save.careers.player),fixture=getNextFixture(world);
  const result=managerDecision(manager,'simulate');assert.equal(result.ok,true);
  assert.equal(result.fixture.id,fixture.id);assert.equal(world.round,1);assert.equal(manager.record.played,1);
  assert.equal(manager.results.length,1);assert.deepEqual(manager.completedMatchIds,[`sim-${fixture.id}`]);
  assert.equal(world.fixtures.filter(f=>f.played).length,4);
  assert.ok(getClubPlayers(world).some(p=>p.statistics.minutes===90));
  assert.equal(manager.budget,world.budget);assert.equal(manager.boardConfidence,world.boardConfidence);
  const before=JSON.stringify(manager);
  const replay={matchId:`sim-${fixture.id}`,options:{mode:'manager',managerFixtureId:fixture.id},state:'FULL_TIME',score:result.context.score};
  assert.equal(applyManagerSimulationResult(manager,replay).ok,false);assert.equal(JSON.stringify(manager),before);
  assert.deepEqual(save.careers.player,personal);
});
test('subsequent simulations advance different fixtures and never count a round twice',()=>{
  const {manager,world}=fresh(),ids=[];
  for(let i=0;i<3;i++){const r=managerDecision(manager,'simulate');assert.equal(r.ok,true);ids.push(r.fixture.id);}
  assert.equal(new Set(ids).size,3);assert.equal(manager.record.played,3);assert.equal(world.round,3);
  assert.equal(world.fixtures.filter(f=>f.played).length,12);assert.equal(manager.completedMatchIds.length,3);
});
test('manager actions after initialization spend the persistent club budget and sync the summary',()=>{
  const {manager,world}=fresh(),money=world.budget,oldFatigue=getPlayer(world,world.lineup[0]).fatigue;
  assert.equal(managerDecision(manager,'team_training').ok,true);
  assert.equal(world.budget,money-700);assert.equal(manager.budget,world.budget);
  assert.equal(world.clubs.find(c=>c.id===world.userClubId).budget,world.budget);
  assert.equal(getPlayer(world,world.lineup[0]).fatigue,oldFatigue+8);
  assert.equal(manager.teamFitness,getClubPlayers(world).reduce((s,p)=>s+p.fitness,0)/22);
});
test('psychological board pressure changes the actual review status and displayed confidence',()=>{
  const {manager,world}=fresh();world.boardConfidence=14;world.psychology.boardTrust=14;
  const event=world.psychology.events.find(e=>e.type==='board_relative');
  assert.equal(managerDecision(manager,'resolve_event',{eventId:event.id,choiceId:'refuse'}).ok,true);
  assert.equal(world.boardConfidence,4);assert.equal(world.psychology.boardTrust,4);
  assert.equal(manager.boardConfidence,4);assert.equal(world.managerStatus,'under_review');
});
test('resolved fines enter the same budget used for purchases and cannot be collected twice',()=>{
  const {manager,world}=fresh(),event=world.psychology.events.find(e=>e.type==='late_training');
  const player=getPlayer(world,event.playerId),money=world.budget,fine=Math.round(player.wage*.1);
  assert.equal(managerDecision(manager,'resolve_event',{eventId:event.id,choiceId:'fine'}).ok,true);
  assert.equal(world.budget,money+fine);assert.equal(manager.budget,world.budget);
  assert.equal(world.clubs.find(c=>c.id===world.userClubId).budget,world.budget);
  assert.equal(managerDecision(manager,'resolve_event',{eventId:event.id,choiceId:'fine'}).ok,false);
  assert.equal(world.budget,money+fine);assert.equal(player.psych.disciplineRecord,1);
});
test('low board trust can recover through a consequential board decision',()=>{
  const {manager,world}=fresh();world.boardConfidence=4;world.psychology.boardTrust=4;syncManagerSummary(manager);
  const event=world.psychology.events.find(e=>e.type==='board_relative');
  assert.equal(managerDecision(manager,'resolve_event',{eventId:event.id,choiceId:'pressure'}).ok,true);
  assert.equal(manager.boardConfidence,12);assert.equal(world.managerStatus,'employed');
  assert.ok(world.lineup.includes(event.playerId));
});
test('match preparation carries current named players and psychology into numeric physical slots',()=>{
  const {manager,world}=fresh(),setup=managerMatchOptions(manager),engine=new MatchEngine(setup.options);
  assert.equal(engine.players.length,22);assert.equal(engine.bench.length,7);
  assert.deepEqual(engine.players.filter(p=>p.team===0).map(p=>p.persistentId),world.lineup);
  const p=engine.players[6],source=getPlayer(world,p.persistentId);
  assert.equal(p.name,source.name);assert.equal(p.experience,source.psych.experience);
  assert.deepEqual(p.psychMatch,source.psychMatch);assert.equal(engine.matchMeta.fixtureId,setup.fixture.id);
});
test('pre-match talks affect the players used by the next engine without stacking on repeat',()=>{
  const {manager,world}=fresh(),id=world.lineup[6],before=getPlayer(world,id).psychMatch.focus,fixture=getNextFixture(world);
  const payload={phase:'pre_match',style:'tactical',context:{fixtureId:fixture.id,score:[0,0]}};
  assert.equal(managerDecision(manager,'team_talk',payload).ok,true);
  const after=getPlayer(world,id).psychMatch.focus;assert.ok(after>before);
  const e=new MatchEngine(managerMatchOptions(manager).options);
  assert.equal(e.players.find(p=>p.persistentId===id).psychMatch.focus,after);
  assert.equal(managerDecision(manager,'team_talk',payload).ok,false);
  assert.equal(getPlayer(world,id).psychMatch.focus,after);
});
test('halftime talk applies immediately to physical performance while retaining positions and ledger',()=>{
  const {manager,world}=fresh(),{engine,fixture}=prepared(manager);engine.state='HALF_TIME';
  const p=engine.players[6],id=p.persistentId,prior=engine._attributes(p).focus;
  engine.managerStats[id].minutes=45.5;const position={x:p.x,y:p.y};
  assert.equal(managerDecision(manager,'team_talk',{phase:'half_time',style:'tactical',context:{fixtureId:fixture.id,score:[0,1]}}).ok,true);
  assert.equal(engine.updateManagerMentalState(world.players),true);
  assert.ok(engine._attributes(p).focus>prior);assert.equal(p.psychMatch.focus,getPlayer(world,id).psychMatch.focus);
  assert.deepEqual({x:p.x,y:p.y},position);assert.equal(engine.managerStats[id].minutes,45.5);assert.equal(engine.state,'HALF_TIME');
});
test('an angry talk while winning can lower actual young-player performance',()=>{
  const {manager,world}=fresh(),{engine,fixture}=prepared(manager);
  const p=engine.players.find(p=>p.team===0&&getPlayer(world,p.persistentId).age<=22);assert.ok(p);
  const before=engine._attributes(p).passing;engine.state='HALF_TIME';
  assert.equal(managerDecision(manager,'team_talk',{phase:'half_time',style:'angry',context:{fixtureId:fixture.id,score:[2,0]}}).ok,true);
  engine.updateManagerMentalState(world.players);assert.ok(engine._attributes(p).passing<before);
});
test('a running scheduled match blocks club preparation while allowing a halftime conversation',()=>{
  const {manager,world}=fresh(),{fixture}=prepared(manager),budget=world.budget;
  assert.equal(managerDecision(manager,'team_training').ok,false);assert.equal(world.budget,budget);
  assert.equal(managerDecision(manager,'team_talk',{phase:'half_time',style:'calm',context:{fixtureId:fixture.id}}).ok,true);
});
test('final result stores departed and substitute minutes, goals, cards and official bans by person',()=>{
  const {manager,world}=fresh(),{engine}=prepared(manager);
  const outgoing=engine.players[6].persistentId,incoming=engine.bench.find(p=>p.role==='MID').id;
  engine._trackManagerMinutes(45.5*60/engine.clock.rate);engine.clock.elapsed=45.5*60;engine.state='HALF_TIME';
  assert.equal(engine.substitute(6,incoming,'fatigue'),true);
  engine._trackManagerMinutes(44.5*60/engine.clock.rate);
  engine.managerStats[incoming].goals=1;engine.players[6].yellow=2;engine.players[6].sentOff=true;
  finish(engine);const result=applyManagerSimulationResult(manager,engine);assert.equal(result.ok,true);
  assert.equal(getPlayer(world,outgoing).statistics.minutes,45.5);assert.equal(getPlayer(world,incoming).statistics.minutes,44.5);
  assert.equal(getPlayer(world,outgoing).statistics.appearances,1);assert.equal(getPlayer(world,incoming).statistics.appearances,1);
  assert.equal(getPlayer(world,incoming).statistics.goals,1);assert.equal(getPlayer(world,incoming).statistics.red,1);
  assert.equal(getPlayer(world,incoming).suspension,1);
  assert.ok(world.psychology.events.some(e=>e.type==='red_card'&&e.playerId===incoming));
  assert.equal(result.context.playerMinutes[outgoing],45.5);assert.equal(result.context.playerMinutes[incoming],44.5);
  const restored=ensureManagerSimulation(ensureCareers({careers:{manager}}).manager);
  assert.equal(getPlayer(restored,outgoing).statistics.minutes,45.5);assert.equal(getPlayer(restored,incoming).statistics.minutes,44.5);
});
test('fulltime reaction does not repeat an early substitution already discussed during the match',()=>{
  const {manager,world}=fresh(),{engine,fixture}=prepared(manager),out=engine.players[6],outId=out.persistentId;
  getPlayer(world,outId).psych.ego=95;getPlayer(world,outId).psych.minutesExpected=90;
  engine.clock.elapsed=20*60;engine._trackManagerMinutes(20*60/engine.clock.rate);engine.state='OUT_OF_PLAY';
  const incoming=engine.bench.find(p=>p.role==='MID').id;assert.equal(engine.substitute(6,incoming,'tactical'),true);
  const payload={outgoingId:outId,incomingId:incoming,minute:20,reason:'tactical',style:'private',context:{fixtureId:fixture.id}};
  assert.equal(managerDecision(manager,'substitution',payload).ok,true);
  assert.equal(world.psychology.history.filter(e=>e.type==='substitution').length,1);
  engine._trackManagerMinutes(70*60/engine.clock.rate);finish(engine,[0,0]);
  assert.equal(applyManagerSimulationResult(manager,engine).ok,true);
  assert.equal(world.psychology.history.filter(e=>e.type==='substitution').length,1);
  assert.equal(world.psychology.substitutionKeys.length,1);
});
test('finished fixtures reject a fresh match ID and leave club record and ledger untouched',()=>{
  const {manager,world}=fresh(),{engine}=prepared(manager);engine._trackManagerMinutes(90*60/engine.clock.rate);
  assert.equal(applyManagerSimulationResult(manager,finish(engine)).ok,true);
  const before=JSON.stringify(manager);engine.matchId='another-engine-for-same-fixture';
  assert.equal(applyManagerSimulationResult(manager,engine).ok,false);assert.equal(JSON.stringify(manager),before);
  assert.equal(manager.record.played,1);assert.equal(world.ledger.length,3);
});
test('career entry point records actual manager results and never changes the personal career',()=>{
  const {save,manager}=fresh(),personal=structuredClone(save.careers.player),{engine}=prepared(manager);
  engine._trackManagerMinutes(90*60/engine.clock.rate);finish(engine,[1,0]);
  assert.equal(applyCareerMatch(save,engine),true);assert.equal(save.careers.manager.record.played,1);
  assert.equal(save.careers.manager.world.round,1);assert.deepEqual(save.careers.player,personal);
  assert.equal(applyCareerMatch(save,engine),false);assert.equal(save.careers.manager.record.played,1);
});
test('personal training and personal match history leave the existing club simulation unchanged',()=>{
  const {save}=fresh(),club=structuredClone(save.careers.manager.world);
  assert.equal(careerAction(save,'player','train_passing').ok,true);
  const engine={state:'FULL_TIME',options:{mode:'player'},matchId:'personal-only',score:[1,0],careerPlayer:6,playerGoals:{6:1}};
  assert.equal(applyCareerMatch(save,engine),true);assert.equal(save.careers.player.goals,1);
  assert.equal(save.careers.manager.record.played,0);assert.deepEqual(save.careers.manager.world,club);
});
test('resolved event choices update prepared match mental attributes before kickoff',()=>{
  const {manager,world}=fresh(),id=world.lineup[6],eventId=addEvent(world,'social_backlash',id,['support','ignore']);
  const prior=getPlayer(world,id).confidence;
  assert.equal(managerDecision(manager,'resolve_event',{eventId,choiceId:'support'}).ok,true);
  const e=new MatchEngine(managerMatchOptions(manager).options),p=e.players.find(p=>p.persistentId===id);
  assert.ok(p.confidence>prior);assert.equal(p.confidence,getPlayer(world,id).confidence);
  assert.deepEqual(p.psychMatch,getPlayer(world,id).psychMatch);
});

test('saved coach style controls a speech when no one-off style is selected',()=>{
 const {manager,world}=fresh(),fixture=getNextFixture(world),p=getClubPlayers(world).find(p=>p.age<=22);
 assert.equal(managerDecision(manager,'coach_style',{style:'angry'}).ok,true);const confidence=p.confidence;
 assert.equal(managerDecision(manager,'team_talk',{phase:'pre_match',context:{fixtureId:fixture.id,score:[0,0]}}).ok,true);
 assert.ok(p.confidence<confidence);assert.ok(p.psych.focusBoost<0);
 assert.equal(managerDecision(manager,'team_talk',{phase:'pre_match',context:{fixtureId:fixture.id}}).ok,false);
});
test('new season rebases psychology clocks while retaining relationships and pending commitments',()=>{
 const {manager,world}=fresh();for(let i=0;i<14;i++)assert.equal(managerDecision(manager,'simulate').ok,true);
 const p=getClubPlayers(world).find(p=>p.age<=22),mentor=getClubPlayers(world).find(p=>p.age>=30);
 for(const event of world.psychology.events)event.status='resolved';
 world.psychology.events.push({id:'next-season-investigation',type:'nightlife_confirmed',playerId:p.id,title:'Araşdırma',body:'Nəticə gözlənilir.',day:world.day,dueDay:world.day+2,status:'scheduled',evidence:'confirmed',context:{key:'next-season-investigation'},choices:[]});
 world.psychology.mentorships=[{mentorId:mentor.id,menteeId:p.id,startDay:world.day-7,lastDay:world.day,sessions:3,compatibility:80,status:'active'}];
 world.psychology.lastMeetingDay=world.day;world.psychology.talkKeys.push('meeting-1:meeting');
 p.psych.focusBoost=12;p.psych.focusUntilRound=15;
 p.psych.promises.push({id:'carry-minutes',type:'minutes',target:60,baseline:p.statistics.minutes,dueRound:16,status:'open'});
 const baseline=p.statistics.minutes;
 assert.equal(managerDecision(manager,'next_season').ok,true);
 assert.equal(world.season,2);assert.equal(world.day,1);assert.ok(world.psychology.processedDays.includes(1));
 assert.ok(world.psychology.events.some(e=>e.id.startsWith('psy-2-')));
 assert.equal(p.psych.focusBoost,0);assert.equal(p.psych.focusUntilRound,0);
 assert.equal(p.psych.promises.find(p=>p.id==='carry-minutes').dueRound,2);
 assert.equal(p.psych.promises.find(p=>p.id==='carry-minutes').baseline,baseline);
 assert.equal(world.psychology.mentorships[0].lastDay,1);assert.equal(world.psychology.mentorships[0].sessions,3);
 assert.equal(world.psychology.events.find(e=>e.id==='next-season-investigation').dueDay,3);
 assert.equal(managerDecision(manager,'meeting',{approach:'supportive'}).ok,true);
 assert.equal(managerDecision(manager,'meeting',{approach:'supportive'}).ok,false);
 p.statistics.minutes+=60;
 const sessions=world.psychology.mentorships[0].sessions;
 assert.equal(managerDecision(manager,'simulate').ok,true);
 for(let day=0;day<3;day++)assert.equal(managerDecision(manager,'rest_team').ok,true);
 assert.equal(world.psychology.mentorships[0].sessions,sessions+1);
 assert.equal(managerDecision(manager,'simulate').ok,true);
 assert.equal(p.psych.promises.find(p=>p.id==='carry-minutes').status,'kept');
 assert.equal(world.psychology.events.find(e=>e.id==='next-season-investigation').status,'pending');
});
