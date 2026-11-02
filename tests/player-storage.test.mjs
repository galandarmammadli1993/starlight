import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchEngine } from '../src/game/engine.mjs';
import { createPlayerJourney, preparePlayerMatch, beginPlayerFixture, playerWorldAction, getPlayerFixture } from '../src/game/player-world.mjs';
import { ensurePlayerLife, playerLifeAction, resolvePlayerEvent } from '../src/game/player-life.mjs';
import { captureMatch, restoreMatch, loadSave, saveData, exportSave, importSave, SAVE_KEY, SAVE_BACKUP_KEY, recordResult } from '../src/game/storage.mjs';

const roles=['GK','DEF','DEF','DEF','DEF','MID','MID','MID','FWD','FWD','FWD'];
function person(id,role='MID',number=8){return {id,persistentId:id,name:`Futbolçu ${id}`,number,role,age:21,
 attributes:{pace:72,passing:68,shooting:64,defending:61},fitness:88,fatigue:6,morale:72,confidence:74,trust:65,
 psych:{professionalism:72,stress:25,experience:20},psychMatch:{focus:76,cooperation:67,discipline:71},
 appearance:{hair:'short',beard:'none',boots:'white'},clubId:id.startsWith('away')?'coast':'baku'};}
function fixture(selection='starter'){
 const own=roles.map((role,i)=>person(i===6&&selection==='starter'?'player-hero':`home-${i}`,role,i+1));
 const away=roles.map((role,i)=>person(`away-${i}`,role,i+1));
 const bench=Array.from({length:7},(_,i)=>person(i===3&&selection==='bench'?'player-hero':`reserve-${i}`,i<2?'DEF':i<5?'MID':'FWD',12+i));
 const options={mode:'player',halfMinutes:5,position:'MID',playerFixtureId:'p-s1-r1-baku-coast',playerHeroId:'player-hero',
  playerRoster:own,playerBench:bench,opponentRoster:away,playerSelection:selection,playerEntryMinute:63,playerCoachExitMinute:80,
  playerUserClubId:'baku',playerUserIsHome:false,playerWorldSeason:1,playerClubName:'Baku Athletic',playerOpponentName:'Coast United',
  playerAttributes:{pace:72,passing:68,shooting:64,defending:61,energy:84,fitness:88,morale:72,confidence:74,trust:65,focus:76,cooperation:67,discipline:71,experience:20,stress:25},
  playerAppearance:{hair:'short',beard:'none',boots:'white'}};
 const e=new MatchEngine(options);e.matchId=`live-${options.playerFixtureId}`;
 // Arrange a valid snapshot independently of the coach AI's timing.
 for(const [team,roster]of [[0,own],[1,away]])for(let i=0;i<11;i++){
  const p=e.players[team*11+i],r=roster[i];Object.assign(p,{...r,id:team*11+i,team,persistentId:r.id,naturalRole:r.role,stamina:84,sentOff:false,yellow:0});
 }
 e.bench=structuredClone(bench);e.hasPersistentRoster=true;e.hasPlayerCareerRoster=true;e.heroPersistentId='player-hero';
 e.playerCareerStatus=selection==='starter'?'playing':selection;e.playerCoachEntryMinute=63;e.playerCoachSubstitutionReason='';
 e.controlled=e.careerPlayer=selection==='starter'?6:-1;e.managerStats={};
 for(const p of e.players)e.managerStats[p.persistentId]={persistentId:p.persistentId,team:p.team,name:p.name,minutes:0,goals:0,assists:0,passes:0,completedPasses:0,keyPasses:0,shots:0,yellow:0,red:false,rating:6,fitness:84};
 e.matchMeta={fixtureId:options.playerFixtureId,season:1,userClubId:'baku'};
 return e;
}
function memory(){const values=new Map();return {values,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};}

test('persistent player starter retains hero identity, club context, mental attributes and appearance',()=>{
 const e=fixture(),restored=restoreMatch(captureMatch(e));assert.ok(restored);
 assert.equal(restored.hasPlayerCareerRoster,true);assert.equal(restored.heroPersistentId,'player-hero');
 assert.equal(restored.controlled,6);assert.equal(restored.careerPlayer,6);assert.equal(restored.players[6].persistentId,'player-hero');
 assert.deepEqual(restored.options.playerAttributes,e.options.playerAttributes);
 assert.deepEqual(restored.players[6].appearance,e.players[6].appearance);
 assert.deepEqual(restored.options.playerAppearance,e.options.playerAppearance);
 assert.equal(restored.options.playerUserIsHome,false);assert.equal(restored.options.playerClubName,'Baku Athletic');
 assert.equal(restored.options.playerOpponentName,'Coast United');assert.equal(restored.options.playerCoachExitMinute,80);
 assert.equal(restored.matchMeta.fixtureId,e.options.playerFixtureId);
});
test('benched hero resumes without granting control of a teammate',()=>{
 const e=fixture('bench'),restored=restoreMatch(captureMatch(e));assert.ok(restored);
 assert.equal(restored.playerCareerStatus,'bench');assert.equal(restored.controlled,-1);assert.equal(restored.careerPlayer,-1);
 assert.equal(restored.playerCoachEntryMinute,63);assert.ok(restored.bench.some(p=>p.persistentId==='player-hero'));
 assert.equal(restored.players.some(p=>p.persistentId==='player-hero'),false);
 for(const action of ['pass','shoot','call','switch'])assert.equal(restored.action(action),false);
});
test('omitted hero has no phantom active person or eligible substitute after restoring',()=>{
 const e=fixture('omitted'),restored=restoreMatch(captureMatch(e));assert.ok(restored);
 assert.equal(restored.playerCareerStatus,'omitted');assert.equal(restored.controlled,-1);assert.equal(restored.careerPlayer,-1);
 assert.equal(restored.players.some(p=>p.persistentId==='player-hero'),false);
 assert.equal(restored.bench.some(p=>p.persistentId==='player-hero'),false);
});
test('departed hero keeps fractional minutes, key passes, card and coach explanation',()=>{
 const e=fixture(),old=e.players[6],incoming=e.bench[3];
 e.managerStats['player-hero']={...e.managerStats['player-hero'],minutes:68.75,goals:1,assists:2,passes:19,completedPasses:16,keyPasses:3,yellow:1,rating:8.4,fitness:39};
 Object.assign(old,{...incoming,id:6,team:0,persistentId:incoming.id,naturalRole:incoming.role});e.bench=e.bench.filter(p=>p.id!==incoming.id);
 e.departedPersistentIds=['player-hero'];e.controlled=e.careerPlayer=-1;e.playerCareerStatus='substituted';e.playerCoachSubstitutionReason='fatigue';
 e.substitutionEvents=[{outgoingPersistentId:'player-hero',incomingPersistentId:incoming.id,minute:68.75,reason:'fatigue',style:'private',outFitness:39,inFitness:84}];
 const restored=restoreMatch(captureMatch(e));assert.ok(restored);
 assert.equal(restored.playerCareerStatus,'substituted');assert.equal(restored.playerCoachSubstitutionReason,'fatigue');
 assert.equal(restored.managerStats['player-hero'].minutes,68.75);assert.equal(restored.managerStats['player-hero'].keyPasses,3);
 assert.equal(restored.managerStats['player-hero'].assists,2);assert.equal(restored.managerStats['player-hero'].yellow,1);
 assert.equal(restored.controlled,-1);assert.equal(restored.substitutionEvents[0].outgoingPersistentId,'player-hero');
});
test('player snapshot rejects control hijacking and duplicate hero identities',()=>{
 const e=fixture(),wrong=captureMatch(e);wrong.controlled=5;assert.equal(restoreMatch(wrong),null);
 const duplicate=captureMatch(e);duplicate.bench[0]=person('player-hero');assert.equal(restoreMatch(duplicate),null);
 const noId=captureMatch(e);delete noId.options.playerHeroId;assert.equal(restoreMatch(noId),null);
});
test('legacy player saves still select an ordinary controlled slot',()=>{
 const e=new MatchEngine({mode:'player'}),restored=restoreMatch(captureMatch(e));assert.ok(restored);
 assert.ok(restored.controlled>=0);assert.equal(restored.options.playerFixtureId,undefined);
});
test('independent player and manager suspended games survive a portable export',()=>{
 const save=loadSave(null),e=fixture('bench'),manager=new MatchEngine({mode:'manager'});manager.matchId='independent-manager';
 save.suspendedByMode.player=captureMatch(e);save.suspendedByMode.manager=captureMatch(manager);
 const restored=importSave(exportSave(save));assert.ok(restored);
 assert.equal(restored.suspendedByMode.player.controlled,-1);assert.equal(restored.suspendedByMode.player.options.playerFixtureId,e.options.playerFixtureId);
 assert.equal(restored.suspendedByMode.manager.matchId,'independent-manager');
});
test('malformed or future player journeys are rejected instead of overwriting a valid legacy document',()=>{
 const storage=memory(),save=loadSave(null);assert.equal(saveData(save,storage),true);const old=storage.values.get(SAVE_KEY);
 for(const journey of [{version:99},{version:1},{version:1,heroId:'fake'}]){
  const bad=JSON.parse(old);bad.careers.player.journey=journey;
  assert.equal(importSave(JSON.stringify(bad)),null);assert.equal(saveData(bad,storage),false);
  assert.equal(storage.values.get(SAVE_KEY),old);
 }
});


test('saved bench energy is used by the coach entry after resume and preserves the new hero slot',()=>{
 const e=fixture('bench'),hero=e.bench.find(p=>p.persistentId==='player-hero');hero.energy=31;
 e.clock.half=2;e.clock.elapsed=18*60;
 const restored=restoreMatch(captureMatch(e));assert.equal(restored.bench.find(p=>p.persistentId==='player-hero').energy,31);
 restored.resume();restored._updatePlayerCareerCoach();
 assert.equal(restored.playerCareerStatus,'playing');assert.ok(restored.controlled>=0);
 assert.equal(restored.controlledPlayer.persistentId,'player-hero');assert.equal(restored.controlledPlayer.stamina,31);
 const again=restoreMatch(captureMatch(restored));assert.ok(again);assert.equal(again.controlled,restored.controlled);
 assert.equal(again.controlledPlayer.persistentId,'player-hero');assert.equal(again.playerCoachSubstitutionReason,'coach_opportunity');
});
test('live curved shot spin and its future trajectory survive a paused snapshot',()=>{
 const e=fixture();e.state='IN_PLAY';e.restart=null;Object.assign(e.ball,{owner:null,x:40,y:34,z:1.1,vx:20,vy:2,vz:1,spin:-.7});
 const restored=restoreMatch(captureMatch(e));assert.ok(restored);assert.equal(restored.ball.spin,-.7);
 assert.equal(restored.ball.vx,20);assert.equal(restored.ball.vy,2);assert.equal(restored.ball.vz,1);
});
test('a refused scheduled fixture cannot still receive aggregate career credit',()=>{
 const save=loadSave(null),e=new MatchEngine({mode:'manager',managerFixtureId:'nonexistent-fixture'});
 e.matchId='invalid-scheduled-game';e.state='FULL_TIME';e.score=[3,0];
 assert.equal(recordResult(save,e),false);assert.equal(save.career.played,0);assert.equal(save.career.goals,0);
 assert.equal(save.career.recordedIds.includes(e.matchId),false);assert.notEqual(e.resultRecorded,true);
});


function journeySave(){
 const save=loadSave(null),p=save.careers.player,j=p.journey=createPlayerJourney(p,save.profile);ensurePlayerLife(p,j);
 return {save,player:p,journey:j};
}
test('portable player journey retains real offers, skill progress, life decisions, possessions and a live bench slot',()=>{
 const {save,player:p,journey:j}=journeySave();j.skillPoints=7;j.careerStats.minutes=123.5;j.careerStats.appearances=p.appearances=2;
 assert.equal(playerLifeAction(p,j,'purchase',{itemId:'pet_cat'}).ok,true);
 assert.equal(playerLifeAction(p,j,'appearance',{field:'boots',value:'red'}).ok,true);
 assert.equal(playerLifeAction(p,j,'appearance',{field:'hair',value:'long'}).ok,true);
 const event=j.life.events[0];assert.equal(resolvePlayerEvent(p,j,event.id,event.choices[0].id).ok,true);
 assert.equal(playerWorldAction(j,p,'request_transfer',{},save.profile).ok,true);assert.ok(j.offers.length);
 p.day=j.seasonStartDay+j.fixtures.find(f=>!f.played&&(f.homeClubId===j.clubId||f.awayClubId===j.clubId)).day;j.day=p.day;p.energy=30;const prepared=preparePlayerMatch(j,p,save.profile);assert.equal(prepared.ok,true);assert.equal(prepared.selection.status,'bench');
 prepared.options.playerAppearance=structuredClone(j.life.appearance);
 const e=new MatchEngine(prepared.options);e.matchId=`live-${prepared.fixture.id}`;
 assert.equal(beginPlayerFixture(j,p).ok,true);p.day=j.day;
 save.suspendedByMode.player=captureMatch(e);
 const restored=importSave(exportSave(save));assert.ok(restored);
 const loaded=restored.careers.player.journey;
 assert.equal(loaded.clubId,j.clubId);assert.equal(loaded.skillPoints,7);assert.equal(loaded.careerStats.minutes,123.5);
 assert.equal(loaded.offers.length,j.offers.length);assert.equal(loaded.offers[0].id,j.offers[0].id);
 assert.ok(loaded.life.possessions.includes('pet_cat'));assert.equal(loaded.life.appearance.boots,'red');assert.equal(loaded.life.appearance.hair,'long');
 assert.equal(loaded.life.events.find(item=>item.id===event.id).status,'resolved');
 assert.equal(restored.suspendedByMode.player.controlled,-1);assert.equal(restored.suspendedByMode.player.playerCareerStatus,'bench');
 assert.equal(restored.suspendedByMode.player.options.playerFixtureId,j.pendingFixtureId);
 assert.equal(restored.suspendedByMode.player.bench.find(p=>p.persistentId==='player-hero').appearance.boots,'red');
});
test('valid free agency retains the unattached hero and does not invent a playable club fixture',()=>{
 const {save,journey:j}=journeySave();j.clubId=null;j.players.find(p=>p.id===j.heroId).clubId=null;j.contract.clubId=null;
 const restored=importSave(exportSave(save));assert.ok(restored);
 assert.equal(restored.careers.player.journey.clubId,null);
 assert.equal(restored.careers.player.journey.players.find(p=>p.id==='player-hero').clubId,null);
 assert.equal(getPlayerFixture(restored.careers.player.journey),null);
});
test('corrupt journey identities and fixtures are refused instead of silently regenerating personal history',()=>{
 const {save}=journeySave(),base=JSON.parse(exportSave(save));
 const duplicates=structuredClone(base);duplicates.careers.player.journey.players[1].id=duplicates.careers.player.journey.players[0].id;
 const hero=structuredClone(base);hero.careers.player.journey.players.find(p=>p.id==='player-hero').clubId='baku';
 const fixtures=structuredClone(base);fixtures.careers.player.journey.fixtures[1].id=fixtures.careers.player.journey.fixtures[0].id;
 const version=structuredClone(base);version.careers.player.journey.version=2;
 for(const bad of [duplicates,hero,fixtures,version])assert.equal(importSave(JSON.stringify(bad)),null);
});
test('corrupt personal season recovers the previous complete journey from backup',()=>{
 const {save,journey:j}=journeySave(),storage=memory();j.skillPoints=4;assert.equal(saveData(save,storage),true);
 save.careers.player.journey.skillPoints=9;assert.equal(saveData(save,storage),true);
 const current=JSON.parse(storage.values.get(SAVE_KEY));current.careers.player.journey.clubs.pop();storage.values.set(SAVE_KEY,JSON.stringify(current));
 const restored=loadSave(storage);assert.equal(restored.recoveredFromBackup,true);assert.equal(restored.careers.player.journey.skillPoints,4);
 assert.equal(restored.careers.player.journey.players.length,176);assert.ok(storage.values.has(SAVE_BACKUP_KEY));
});
test('inconsistent personal playing status cannot grant or strand another identity after import',()=>{
 const active=captureMatch(fixture());active.controlled=active.careerPlayer=-1;assert.equal(restoreMatch(active),null);
 const benched=captureMatch(fixture('bench'));benched.playerCareerStatus='playing';assert.equal(restoreMatch(benched),null);
});
