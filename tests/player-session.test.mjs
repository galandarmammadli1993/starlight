import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureCareers, careerAction, applyCareerMatch } from '../src/game/career.mjs';
import { MatchEngine } from '../src/game/engine.mjs';
import { ensureManagerSimulation } from '../src/game/manager-session.mjs';
import { ensurePlayerSimulation, advancePlayerCalendar, getPlayerMatchAttributes, playerMatchOptions, playerDecision, beginPlayerSession, applyPlayerSimulationResult, getPlayerFixture } from '../src/game/player-session.mjs';

function fresh() {
 const save={version:1,profile:{name:'Araz Hero',position:'MID',shirtNumber:10,halfMinutes:5,formation:'4-3-3',kitColor:'mint'},career:{results:[]}};
 const player=ensureCareers(save).player,journey=ensurePlayerSimulation(player,save.profile);
 return {save,profile:save.profile,player,journey};
}
function live(player,profile) {
 const prepared=playerMatchOptions(player,profile);assert.equal(prepared.ok,true);
 assert.equal(beginPlayerSession(player,profile).ok,true);
 const engine=new MatchEngine({...prepared.options,halfMinutes:5});engine.matchId=`player-live-${prepared.fixture.id}`;
 return {engine,prepared};
}
function finish(engine,minutes=90,goals=1,rating=8,score=[2,1]) {
 const stat=engine.managerStats[engine.heroPersistentId];Object.assign(stat,{minutes,goals,assists:1,rating});
 engine.score=[...score];engine.state='FULL_TIME';return engine;
}
function transfer(player,profile) {
 assert.equal(playerDecision(player,profile,'request_transfer').ok,true);
 const offer=player.journey.offers.find(o=>o.status==='pending');assert.ok(offer);
 assert.equal(playerDecision(player,profile,'accept_offer',{offerId:offer.id}).ok,true);return offer;
}

test('player bridge initializes a distinct persistent hero and life without changing the manager',()=>{
 const {save,player,profile,journey}=fresh(),manager=structuredClone(save.careers.manager),ids=journey.players.map(p=>p.id);
 assert.equal(journey.clubId,'sunrise');assert.equal(journey.players.length,176);assert.equal(journey.fixtures.length,56);
 assert.equal(journey.life.events.length,3);assert.equal(journey.life.events.every(e=>e.status==='pending'),true);
 assert.equal(ensurePlayerSimulation(player,profile),journey);assert.deepEqual(journey.players.map(p=>p.id),ids);
 assert.deepEqual(save.careers.manager,manager);assert.equal(player.appearances,0);
});
test('calendar pays salary exactly at the weekly boundary while charging every living day',()=>{
 const {player,journey}=fresh(),money=player.balance;
 assert.equal(advancePlayerCalendar(player,journey,6),6);assert.equal(player.day,7);assert.equal(player.balance,money-120);
 advancePlayerCalendar(player,journey,1);assert.equal(player.day,8);assert.equal(player.balance,money-140+700);
 advancePlayerCalendar(player,journey,0);assert.equal(player.balance,money-140+700);
 assert.equal(player.activityLog.filter(a=>a.kind==='salary').length,1);
});
test('owned lifestyle upkeep is charged once for real elapsed days including a salary crossing',()=>{
 const {player,profile,journey}=fresh();player.balance=5000;
 assert.equal(playerDecision(player,profile,'purchase',{itemId:'pet_cat'}).ok,true);assert.equal(player.day,1);assert.equal(player.balance,4820);
 advancePlayerCalendar(player,journey,7);assert.equal(player.balance,4820+700-140-14);assert.equal(journey.life.upkeepDebt,0);
 const after=player.balance;getPlayerMatchAttributes(player,profile);ensurePlayerSimulation(player,profile);advancePlayerCalendar(player,journey,0);
 assert.equal(player.balance,after);
});
test('unaffordable elapsed upkeep becomes a real debt rather than a negative wallet',()=>{
 const {player,profile,journey}=fresh();player.balance=5000;
 assert.equal(playerDecision(player,profile,'purchase',{itemId:'home_flat'}).ok,true);player.balance=10;
 advancePlayerCalendar(player,journey,1);assert.equal(player.balance,0);assert.equal(journey.life.upkeepDebt,5);
 assert.ok(journey.life.events.some(e=>e.type==='financial_stress'));player.balance=3;
 assert.equal(playerDecision(player,profile,'settle_upkeep').ok,true);assert.equal(player.balance,0);assert.equal(journey.life.upkeepDebt,2);
});
test('legacy personal training now uses the shared player calendar and actual skill values',()=>{
 const {save,player,profile}=fresh(),manager=structuredClone(save.careers.manager);
 assert.equal(playerDecision(player,profile,'train_passing').ok,true);
 assert.equal(player.skills.passing,62);assert.equal(player.energy,67);assert.equal(player.day,2);assert.equal(player.balance,980);
 assert.ok(player.journey.life.coachTrust>62);assert.deepEqual(save.careers.manager,manager);
});
test('exhausted or unaffordable failed activities spend neither day nor money',()=>{
 const {player,profile}=fresh();player.energy=1;const before=JSON.stringify(player);
 assert.equal(playerDecision(player,profile,'train_shooting').ok,false);assert.equal(JSON.stringify(player),before);
 player.energy=80;player.balance=10;const day=player.day;
 assert.equal(playerDecision(player,profile,'family_time').ok,false);assert.equal(player.balance,10);assert.equal(player.day,day);
});
test('life activity costs and living costs share one day without double salary or energy charge',()=>{
 const {player,profile,journey}=fresh(),family=journey.life.familyTrust;
 assert.equal(playerDecision(player,profile,'family_time').ok,true);
 assert.equal(player.day,2);assert.equal(player.balance,950);assert.equal(player.energy,81);assert.equal(journey.life.familyTrust,family+7);
});
test('preparation actions stop on the scheduled match day instead of farming skills forever',()=>{
 const {player,profile,journey}=fresh();for(let i=0;i<3;i++)assert.equal(playerDecision(player,profile,'rest').ok,true);
 assert.equal(player.day,getPlayerFixture(journey).absoluteDay);const money=player.balance,skill=player.skills.passing;
 for(const action of ['rest','train_passing','community','family_time','gym','mindfulness'])assert.equal(playerDecision(player,profile,action).ok,false);
 assert.equal(player.balance,money);assert.equal(player.skills.passing,skill);assert.equal(player.day,4);
});
test('beginning a scheduled fixture advances to match day only once',()=>{
 const {player,profile,journey}=fresh(),fixture=getPlayerFixture(journey),money=player.balance;
 assert.equal(beginPlayerSession(player,profile).ok,true);assert.equal(player.day,fixture.absoluteDay);assert.equal(player.balance,money-60);
 const energy=player.energy;assert.equal(journey.pendingFixtureId,fixture.id);
 assert.equal(beginPlayerSession(player,profile).ok,true);assert.equal(player.balance,money-60);assert.equal(player.energy,energy);assert.equal(player.day,4);
});
test('pending live fixture prevents training, market moves, simulations and position changes',()=>{
 const {player,profile}=fresh();assert.equal(beginPlayerSession(player,profile).ok,true);const day=player.day,money=player.balance;
 for(const action of ['train_passing','rest','family_time','request_transfer','simulate','next_season','active_position'])assert.equal(playerDecision(player,profile,action,{position:'FWD'}).ok,false);
 assert.equal(player.day,day);assert.equal(player.balance,money);
});
test('resolved personal conversation updates mental match attributes and cannot be farmed twice',()=>{
 const {player,profile,journey}=fresh(),event=journey.life.events.find(e=>e.type==='coach_feedback'),before=getPlayerMatchAttributes(player,profile);
 assert.equal(playerDecision(player,profile,'resolve_event',{eventId:event.id,choiceId:'listen'}).ok,true);
 const after=getPlayerMatchAttributes(player,profile);assert.ok(after.trust>before.trust);assert.ok(after.focus>before.focus);
 assert.equal(playerDecision(player,profile,'resolve_event',{eventId:event.id,choiceId:'listen'}).ok,false);
 assert.equal(getPlayerMatchAttributes(player,profile).trust,after.trust);assert.equal(player.day,1);
});
test('hair, boots and skin choices reach the actual next-match hero without changing skill ratings',()=>{
 const {player,profile,journey}=fresh(),skills=structuredClone(player.skills),money=player.balance;
 for(const [field,value] of [['hair','long'],['boots','gold'],['skin',3]])assert.equal(playerDecision(player,profile,'appearance',{field,value}).ok,true);
 const prepared=playerMatchOptions(player,profile);assert.equal(prepared.ok,true);assert.equal(prepared.options.playerAppearance.hair,'long');assert.equal(prepared.options.playerAppearance.boots,'gold');assert.equal(prepared.options.playerAppearance.skin,3);
 const e=new MatchEngine(prepared.options);assert.equal(e.controlledPlayer.persistentId,journey.heroId);assert.equal(e.controlledPlayer.appearance.hair,'long');assert.equal(e.controlledPlayer.appearance.boots,'gold');
 assert.equal(player.balance,money-390);assert.deepEqual(player.skills,skills);assert.equal(player.day,1);
});
test('career normalization preserves club, contract, life assets and resolved decisions',()=>{
 const {save,player,profile,journey}=fresh();playerDecision(player,profile,'purchase',{itemId:'pet_cat'});
 const event=journey.life.events.find(e=>e.type==='coach_feedback');playerDecision(player,profile,'resolve_event',{eventId:event.id,choiceId:'listen'});
 const offer=transfer(player,profile),copy=JSON.parse(JSON.stringify(save)),restored=ensureCareers(copy).player,j=ensurePlayerSimulation(restored,copy.profile);
 assert.equal(j.clubId,offer.clubId);assert.equal(restored.salary,offer.salary);assert.equal(j.contract.salary,offer.salary);
 assert.ok(j.life.possessions.includes('pet_cat'));assert.equal(j.life.events.find(e=>e.id===event.id).status,'resolved');
 assert.equal(j.life.events.filter(e=>e.context.key==='initial-coach').length,1);assert.equal(j.players.find(p=>p.id===j.heroId).clubId,offer.clubId);
});
test('a real accepted transfer changes club, personal salary and signing bonus without advancing the day',()=>{
 const {player,profile,journey}=fresh(),oldClub=journey.clubId,money=player.balance;
 const offer=transfer(player,profile);assert.notEqual(journey.clubId,oldClub);assert.equal(journey.clubId,offer.clubId);
 assert.equal(player.salary,offer.salary);assert.equal(player.balance,money+offer.signingBonus);assert.equal(player.day,1);
 const options=playerMatchOptions(player,profile).options;assert.equal(options.playerUserClubId,offer.clubId);
 assert.equal(options.playerRoster.some(p=>p.id===journey.heroId)||options.playerBench.some(p=>p.id===journey.heroId),true);
});
test('weekly payday after transfer uses the new contract salary exactly once',()=>{
 const {player,profile,journey}=fresh(),offer=transfer(player,profile),money=player.balance;
 advancePlayerCalendar(player,journey,7);assert.equal(player.balance,money+offer.salary-140);
 assert.equal(player.activityLog.filter(a=>a.kind==='salary').length,1);
});
test('earned skill points unlock a new active position and update personal match identity',()=>{
 const {player,profile,journey}=fresh();journey.skillPoints=4;
 assert.equal(playerDecision(player,profile,'unlock_position',{position:'FWD'}).ok,true);assert.equal(journey.skillPoints,1);
 assert.equal(playerDecision(player,profile,'active_position',{position:'FWD'}).ok,true);assert.equal(profile.position,'FWD');
 assert.equal(playerDecision(player,profile,'spend_skill',{skill:'shooting'}).ok,true);assert.equal(player.skills.shooting,62);assert.equal(journey.skillPoints,0);
 const prepared=playerMatchOptions(player,profile),e=new MatchEngine(prepared.options);assert.equal(e.controlledPlayer.naturalRole,'FWD');assert.equal(e.controlledPlayer.name,'Araz Hero');
});
test('fast simulation records actual personal stats, bonus and shared calendar once',()=>{
 const {player,profile,journey}=fresh(),money=player.balance;
 const result=playerDecision(player,profile,'simulate');assert.equal(result.ok,true);const goals=result.context.goals;
 assert.equal(player.appearances,1);assert.equal(player.goals,goals);assert.equal(journey.round,1);assert.equal(journey.fixtures.filter(f=>f.played).length,4);
 assert.equal(player.balance,money+120+goals*40-80);assert.equal(player.day,5);assert.ok(journey.skillPoints>=1);
 const before=JSON.stringify(player),replay={matchId:`player-sim-${result.fixture.id}`,fixtureId:result.fixture.id,state:'FULL_TIME',score:result.context.score,players:[{persistentId:journey.heroId,team:0,minutes:90,goals}]};
 assert.equal(applyPlayerSimulationResult(player,replay,profile).ok,false);assert.equal(JSON.stringify(player),before);
});
test('actual fractional live minutes and personal goals earn one appearance and no duplicate bonus',()=>{
 const {player,profile,journey}=fresh(),{engine}=live(player,profile),money=player.balance;
 finish(engine,37.5,2,8.4);const result=applyPlayerSimulationResult(player,engine,profile);assert.equal(result.ok,true);
 assert.equal(player.appearances,1);assert.equal(player.goals,2);assert.equal(journey.careerStats.minutes,37.5);
 assert.equal(player.balance,money+200-20);assert.equal(journey.skillPoints,2);assert.equal(player.day,5);
 const before=JSON.stringify(player);assert.equal(applyPlayerSimulationResult(player,engine,profile).ok,false);assert.equal(JSON.stringify(player),before);
});
test('watching as an unused bench player awards no appearance, goal, skill point or appearance bonus',()=>{
 const {player,profile,journey}=fresh();player.day=getPlayerFixture(journey).absoluteDay;player.energy=30;
 const {engine,prepared}=live(player,profile);assert.equal(prepared.selection.status,'bench');assert.equal(engine.playerCareerStatus,'bench');
 const money=player.balance;engine.score=[2,0];engine.state='FULL_TIME';
 assert.equal(applyPlayerSimulationResult(player,engine,profile).ok,true);
 assert.equal(player.appearances,0);assert.equal(player.goals,0);assert.equal(journey.careerStats.minutes,0);assert.equal(journey.skillPoints,0);
 assert.equal(player.balance,money-20);assert.equal(journey.history[0].minutes,0);assert.equal(journey.history[0].goals,0);
});
test('omitted player receives the real team result but cannot claim teammate goals or bonuses',()=>{
 const {player,profile,journey}=fresh();player.day=getPlayerFixture(journey).absoluteDay;player.energy=5;
 const {engine,prepared}=live(player,profile);assert.equal(prepared.selection.status,'omitted');assert.equal(engine.playerCareerStatus,'omitted');
 const money=player.balance;engine.score=[3,0];engine.state='FULL_TIME';engine.playerGoals={6:3};
 assert.equal(applyPlayerSimulationResult(player,engine,profile).ok,true);assert.equal(journey.round,1);
 assert.equal(player.appearances,0);assert.equal(player.goals,0);assert.equal(journey.skillPoints,0);assert.equal(player.balance,money-20);
});
test('player actions and personal full time leave an existing manager league untouched',()=>{
 const {save,player,profile}=fresh();ensureManagerSimulation(save.careers.manager);const before=structuredClone(save.careers.manager);
 assert.equal(playerDecision(player,profile,'train_passing').ok,true);const {engine}=live(player,profile);finish(engine,90,1,8);
 assert.equal(applyPlayerSimulationResult(player,engine,profile).ok,true);assert.deepEqual(save.careers.manager,before);
});
test('career action entry point routes an initialized player through calendar-gated personal decisions',()=>{
 const {save}=fresh();assert.equal(careerAction(save,'player','train_shooting').ok,true);
 assert.equal(save.careers.player.skills.shooting,62);assert.equal(save.careers.player.day,2);assert.equal(save.careers.player.journey.life.initialized,true);
 assert.equal(save.careers.manager.record.played,0);assert.equal(save.careers.manager.budget,50000);
});
test('career result entry point stores the real personal fixture and preserves manager records',()=>{
 const {save,player,profile}=fresh(),{engine}=live(player,profile);finish(engine,90,1,8);
 assert.equal(applyCareerMatch(save,engine),true);assert.equal(save.careers.player.journey.round,1);assert.equal(save.careers.player.appearances,1);
 assert.equal(save.careers.player.goals,1);assert.equal(save.careers.manager.record.played,0);assert.equal(applyCareerMatch(save,engine),false);
});


test('pre-match selection predicts scheduled recovery and remains frozen after calendar advancement',()=>{
 const {player,profile,journey}=fresh();player.energy=35;journey.injuryDays=2;
 const before=playerMatchOptions(player,profile);assert.equal(before.ok,true);assert.equal(before.selection.status,'starter');
 assert.equal(beginPlayerSession(player,profile).ok,true);assert.equal(player.day,4);assert.equal(player.energy,59);assert.equal(journey.injuryDays,0);
 const after=playerMatchOptions(player,profile);assert.equal(after.selection.status,before.selection.status);
 const engine=new MatchEngine(after.options);assert.equal(engine.playerCareerStatus,'playing');assert.equal(engine.controlledPlayer.persistentId,journey.heroId);assert.equal(engine.controlledPlayer.stamina,59);
});


test('full season and off-season retain one absolute personal calendar and correct cumulative wages',()=>{
 const {player,profile,journey}=fresh();
 for(let round=0;round<14;round++)assert.equal(playerDecision(player,profile,'simulate').ok,true);
 assert.equal(journey.round,14);assert.equal(player.day,96);assert.equal(player.appearances,14);
 assert.equal(player.balance,1000+13*700-95*20+14*120+player.goals*40);
 const money=player.balance;assert.equal(playerDecision(player,profile,'next_season').ok,true);
 assert.equal(journey.season,2);assert.equal(player.day,110);assert.equal(journey.day,110);
 assert.equal(player.balance,money+2*700-14*20);assert.equal(getPlayerFixture(journey).absoluteDay,113);
 assert.equal(playerDecision(player,profile,'simulate').ok,true);assert.equal(player.day,114);assert.equal(player.appearances,15);assert.equal(journey.round,1);
});

test('fast and live calendars cap pre-match recovery before applying the match energy cost',()=>{
 const p={day:1,energy:85,fitness:70,morale:70,skills:{pace:60,passing:60,shooting:60,defending:60},reputation:10,balance:1000,salary:700,appearances:0,goals:0,results:[],activityLog:[],completedMatchIds:[]};
 const profile={name:'Hero',position:'MID',shirtNumber:10},j=ensurePlayerSimulation(p,profile);
 const result=playerDecision(p,profile,'simulate');assert.equal(result.ok,true);
 const minutes=result.context.minutes;
 assert.equal(p.energy,Math.min(100,100-Math.max(5,24*Math.min(1,minutes/90))+8));
 assert.equal(p.day,5);
});

test('completed season does not allow unbounded days and wages before rolling over',()=>{
 const {player,profile,journey}=fresh();for(let i=0;i<14;i++)assert.equal(playerDecision(player,profile,'simulate').ok,true);
 const day=player.day,balance=player.balance;
 assert.equal(playerDecision(player,profile,'rest').ok,false);assert.equal(player.day,day);assert.equal(player.balance,balance);
 assert.equal(playerDecision(player,profile,'next_season').ok,true);assert.equal(player.day,day+14);
});

test('inherited object names cannot masquerade as personal training commands',()=>{
 const {player,profile}=fresh();const skills={...player.skills},balance=player.balance,day=player.day;
 for(const action of ['__proto__','constructor','toString'])assert.equal(playerDecision(player,profile,action).ok,false);
 assert.deepEqual(player.skills,skills);assert.equal(player.balance,balance);assert.equal(player.day,day);
});

test('old suspended player results preserve lifetime totals and a separate archive without league credit',()=>{
 const {save,player,profile,journey}=fresh();
 const legacy={state:'FULL_TIME',options:{mode:'player'},matchId:'old-resumed-player',score:[3,1],careerPlayer:6,playerGoals:{6:1,9:2}};
 assert.equal(applyCareerMatch(save,legacy),true);
 const updated=save.careers.player;
 assert.equal(updated.journey.careerStats.appearances,updated.appearances);assert.equal(updated.journey.careerStats.goals,1);
 assert.equal(updated.journey.legacyResults[0].id,legacy.matchId);assert.equal(updated.journey.round,0);
 assert.equal(applyCareerMatch(save,legacy),false);assert.equal(updated.journey.legacyResults.length,1);
 const restored=ensureCareers(JSON.parse(JSON.stringify(save))).player;
 assert.equal(restored.journey.legacyResults[0].id,legacy.matchId);assert.equal(restored.journey.careerStats.goals,1);
});
test('previous personal score history survives migration and later official fixtures',()=>{
 const p={day:1,energy:85,fitness:70,morale:70,skills:{pace:60,passing:60,shooting:60,defending:60},reputation:10,balance:1000,salary:700,appearances:2,goals:1,results:[{id:'old-one',score:[2,1],result:'win',date:'2026-11-01'}],activityLog:[],completedMatchIds:['old-one']};
 const profile={name:'Hero',position:'MID',shirtNumber:10};ensurePlayerSimulation(p,profile);
 assert.equal(p.journey.legacyResults.length,1);assert.equal(playerDecision(p,profile,'simulate').ok,true);
 const normalized=ensureCareers({profile,careers:{player:p},career:{results:[]}}).player;
 assert.equal(normalized.journey.legacyResults.length,1);assert.equal(normalized.journey.legacyResults[0].id,'old-one');
});
