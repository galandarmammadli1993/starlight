import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayerJourney,normalizePlayerJourney,getPlayerFixture,getPlayerStandings,preparePlayerMatch,beginPlayerFixture,finishPlayerFixture,playerWorldAction } from '../src/game/player-world.mjs';
import { createManagerWorld } from '../src/game/manager-world.mjs';
function fresh(position='MID'){
 const player={day:1,energy:85,fitness:70,morale:70,skills:{pace:60,passing:60,shooting:60,defending:60},reputation:10,balance:1000,salary:700,appearances:0,goals:0};
 const profile={name:'Araz Hero',shirtNumber:10,position};return {player,profile,j:createPlayerJourney(player,profile)};
}
function finished(j,player,profile,extra={}){
 const prepared=preparePlayerMatch(j,player,profile);assert.equal(prepared.ok,true);assert.equal(beginPlayerFixture(j,player).ok,true);
 const result=finishPlayerFixture(j,player,{fixtureId:prepared.fixture.id,state:'FULL_TIME',completed:true,score:[2,1],players:[{persistentId:j.heroId,team:0,minutes:90,goals:1,assists:1,yellow:0,red:0,rating:8,...extra}]});
 assert.equal(result.ok,true);player.day+=result.context.advanceDays;return result;
}
function season(j,player,profile){for(let i=0;i<14;i++)finished(j,player,profile);}
function move(j,player,profile,kind='request_transfer'){
 const request=playerWorldAction(j,player,kind,{},profile);assert.equal(request.ok,true);
 const offer=j.offers.find(o=>o.status==='pending');assert.ok(offer);
 assert.equal(playerWorldAction(j,player,'accept_offer',{offerId:offer.id},profile).ok,true);return offer;
}

test('player journey starts in a fictional academy with independent persistent identity',()=>{
 const {j,player}=fresh();assert.equal(j.clubId,'sunrise');assert.equal(j.age,18);assert.equal(j.clubs.length,8);assert.equal(j.players.length,176);assert.equal(j.fixtures.length,56);
 assert.equal(j.players.filter(p=>p.id==='player-hero').length,1);assert.equal(j.players.find(p=>p.id===j.heroId).name,'Araz Hero');assert.equal(player.appearances,0);
});
test('player journey never shares or mutates manager-world objects',()=>{
 const manager=createManagerWorld(),before=JSON.stringify(manager),{j,player,profile}=fresh();finished(j,player,profile);move(j,player,profile);assert.equal(JSON.stringify(manager),before);assert.notEqual(j.players,manager.players);
});
test('schedule is a complete 14-round double round robin with one game per club per round',()=>{
 const {j}=fresh();const pairs=new Map();for(let round=0;round<14;round++){const fixtures=j.fixtures.filter(f=>f.round===round);assert.equal(fixtures.length,4);assert.equal(new Set(fixtures.flatMap(f=>[f.homeClubId,f.awayClubId])).size,8);}
 for(const f of j.fixtures){const key=`${f.homeClubId}/${f.awayClubId}`;pairs.set(key,(pairs.get(key)??0)+1);}assert.equal(pairs.size,56);assert.ok([...pairs.values()].every(n=>n===1));
});
test('initial selection gives a fit prospect a genuine named starting place',()=>{
 const {j,player,profile}=fresh(),match=preparePlayerMatch(j,player,profile);assert.equal(match.ok,true);assert.equal(match.selection.status,'starter');assert.equal(match.options.playerRoster.length,11);assert.equal(match.options.playerBench.length,7);assert.equal(match.options.opponentRoster.length,11);assert.equal(match.options.playerRoster.filter(p=>p.id===j.heroId).length,1);
 assert.equal(match.options.playerHeroId,j.heroId);assert.equal(match.options.playerUserClubId,j.clubId);assert.equal(match.options.playerClubName,'Sunrise Academy');assert.equal(match.options.playerAttributes.energy,85);
});
test('starter role follows the single unlocked profile position for every supported outfield role',()=>{
 for(const role of ['DEF','MID','FWD']){const {j,player,profile}=fresh(role),m=preparePlayerMatch(j,player,profile);assert.equal(m.options.position,role);assert.equal(m.options.playerRoster.find(p=>p.id===j.heroId).role,role);}
});
test('hero shirt numbers remain unique after creation and profile edits',()=>{
 const {j,player,profile}=fresh();for(const number of [10,20,21,7,10]){profile.shirtNumber=number;preparePlayerMatch(j,player,profile);const squad=j.players.filter(p=>p.clubId===j.clubId);assert.equal(new Set(squad.map(p=>p.number)).size,squad.length);assert.equal(squad.find(p=>p.id===j.heroId).number,number);}
});
test('poor coach trust leads to bench selection and no duplicate hero on the pitch',()=>{
 const {j,player,profile}=fresh();j.life={coachTrust:0,confidence:60,stress:20};j.coachTrust=100;
 const m=preparePlayerMatch(j,player,profile);assert.equal(m.selection.status,'bench');assert.equal(m.options.playerEntryMinute,65);assert.ok(!m.options.playerRoster.some(p=>p.id===j.heroId));assert.equal(m.options.playerBench.filter(p=>p.id===j.heroId).length,1);
});
test('low energy creates late bench opportunity and exhaustion omits the player',()=>{
 const {j,player,profile}=fresh();player.day=4;player.energy=30;let m=preparePlayerMatch(j,player,profile);assert.equal(m.selection.status,'bench');assert.equal(m.options.playerEntryMinute,75);player.energy=10;m=preparePlayerMatch(j,player,profile);assert.equal(m.selection.status,'omitted');assert.ok(!m.options.playerRoster.some(p=>p.id===j.heroId));assert.ok(!m.options.playerBench.some(p=>p.id===j.heroId));
});
test('injury and suspension prohibit selection even when coach trust and energy are high',()=>{
 for(const reason of ['injuryDays','suspension']){const {j,player,profile}=fresh();player.day=4;j[reason]=2;const m=preparePlayerMatch(j,player,profile);assert.equal(m.selection.status,'omitted');assert.ok(m.selection.reason.length>10);}
});
test('once begun a fixture keeps its actual selection rather than recalculating during play',()=>{
 const {j,player,profile}=fresh();const m=preparePlayerMatch(j,player,profile);beginPlayerFixture(j,player);player.energy=0;j.life={coachTrust:0};assert.equal(preparePlayerMatch(j,player,profile).selection.status,m.selection.status);
});
test('fixture calendar exposes absolute day and returns only elapsed days for root calendar ownership',()=>{
 const {j,player,profile}=fresh();assert.equal(getPlayerFixture(j).absoluteDay,4);const begin=beginPlayerFixture(j,player);assert.equal(begin.context.advanceDays,3);assert.equal(player.day,1);const result=finished(j,player,profile);assert.equal(result.context.advanceDays,4);assert.equal(player.day,5);
});
test('actual report awards appearances, minutes, goals and assists to the hero only',()=>{
 const {j,player,profile}=fresh(),result=finished(j,player,profile,{minutes:35.75,goals:2,assists:1,yellow:1,rating:8.3});
 assert.equal(j.careerStats.appearances,1);assert.equal(j.careerStats.minutes,35.75);assert.equal(j.careerStats.goals,2);assert.equal(j.seasonStats.assists,1);assert.equal(result.context.minutes,35.75);assert.equal(j.skillPoints,2);
 assert.equal(player.appearances,0);assert.equal(player.goals,0);assert.equal(player.balance,1000);assert.equal(player.energy,85);assert.equal(player.salary,700);
});
test('a tiny cameo does not yield full development points and no appearance gives no stats',()=>{
 for(const minutes of [0,.5]){const {j,player,profile}=fresh();finished(j,player,profile,{minutes,rating:9});assert.equal(j.skillPoints,0);assert.equal(j.careerStats.appearances,minutes>0?1:0);}
});
test('omitted player cannot acquire invented appearance stats from a supplied hero report',()=>{
 const {j,player,profile}=fresh();j.injuryDays=4;finished(j,player,profile);assert.equal(j.careerStats.minutes,0);assert.equal(j.careerStats.goals,0);assert.equal(j.skillPoints,0);assert.equal(j.injuryDays,4);
});
test('live report getter is accepted and outgoing/bench physical slots never alter hero identity',()=>{
 const {j,player,profile}=fresh();const m=preparePlayerMatch(j,player,profile);beginPlayerFixture(j,player);const report={state:'FULL_TIME',completed:true,fixtureId:m.fixture.id,score:[1,0],players:[{persistentId:'not-the-hero',minutes:90,goals:1},{persistentId:j.heroId,minutes:24.5,goals:0,assists:1,rating:7.2}]};const engine={options:{playerFixtureId:m.fixture.id},get playerMatchReport(){return report;}};assert.equal(finishPlayerFixture(j,player,engine).ok,true);assert.equal(j.careerStats.minutes,24.5);assert.equal(j.careerStats.goals,0);assert.equal(j.careerStats.assists,1);
});
test('full time advances exactly one global round and all four league fixtures',()=>{
 const {j,player,profile}=fresh();finished(j,player,profile);assert.equal(j.round,1);assert.equal(j.fixtures.filter(f=>f.played).length,4);assert.equal(getPlayerStandings(j).every(row=>row.played===1),true);assert.equal(j.pendingFixtureId,null);
});
test('duplicate, unfinished and wrong-fixture reports cannot farm points, stats or league rounds',()=>{
 const {j,player,profile}=fresh();const m=preparePlayerMatch(j,player,profile),bad={fixtureId:m.fixture.id,state:'IN_PLAY',score:[2,0],players:[]};assert.equal(finishPlayerFixture(j,player,bad).ok,false);assert.equal(finishPlayerFixture(j,player,{...bad,state:'FULL_TIME',fixtureId:'wrong'}).ok,false);finished(j,player,profile);const before=JSON.stringify(j);assert.equal(finishPlayerFixture(j,player,{...bad,state:'FULL_TIME'}).ok,false);assert.equal(JSON.stringify(j),before);
});
test('away fixture scores are converted for league standings while the hero score stays user oriented',()=>{
 const {j,player,profile}=fresh();while(getPlayerFixture(j).homeClubId===j.clubId)finished(j,player,profile);const f=getPlayerFixture(j);const r=finished(j,player,profile);assert.equal(f.awayClubId,j.clubId);assert.deepEqual(j.fixtures.find(x=>x.id===f.id).score,[1,2]);assert.deepEqual(r.context.score,[2,1]);
});
test('red card produces persistent suspension and serves one scheduled fixture',()=>{
 const {j,player,profile}=fresh();finished(j,player,profile,{red:1});assert.equal(j.suspension,2);assert.equal(preparePlayerMatch(j,player,profile).selection.status,'omitted');finished(j,player,profile);assert.equal(j.suspension,1);finished(j,player,profile);assert.equal(j.suspension,0);
});
test('second yellow yields one-match ban and an event-ready red context',()=>{
 const {j,player,profile}=fresh(),r=finished(j,player,profile,{yellow:2,red:1});assert.equal(j.suspension,1);assert.equal(r.context.red,1);assert.equal(j.careerStats.yellow,2);
});
test('match rating changes actual coach trust read by future selection',()=>{
 const {j,player,profile}=fresh();j.life={coachTrust:60};finished(j,player,profile,{rating:9});assert.ok(j.life.coachTrust>60);assert.equal(j.coachTrust,j.life.coachTrust);
 const {j:b,player:q,profile:r}=fresh();b.life={coachTrust:60};finished(b,q,r,{rating:4,red:1});assert.ok(b.life.coachTrust<60);
});
test('development points change actual match attributes and cannot be spent twice',()=>{
 const {j,player,profile}=fresh();j.skillPoints=1;assert.equal(playerWorldAction(j,player,'spend_skill',{skill:'passing'},profile).ok,true);assert.equal(player.skills.passing,62);assert.equal(j.skillPoints,0);assert.equal(playerWorldAction(j,player,'spend_skill',{skill:'passing'},profile).ok,false);assert.equal(preparePlayerMatch(j,player,profile).options.playerRoster.find(p=>p.id===j.heroId).attributes.passing,62);
});
test('positions require earned points and locked profile edits cannot bypass the chosen role',()=>{
 const {j,player,profile}=fresh();profile.position='FWD';assert.equal(preparePlayerMatch(j,player,profile).options.position,'MID');assert.equal(playerWorldAction(j,player,'unlock_position',{position:'FWD'},profile).ok,false);j.skillPoints=3;assert.equal(playerWorldAction(j,player,'unlock_position',{position:'FWD'},profile).ok,true);assert.equal(j.skillPoints,0);assert.equal(playerWorldAction(j,player,'active_position',{position:'FWD'},profile).ok,true);assert.equal(preparePlayerMatch(j,player,profile).options.position,'FWD');assert.equal(playerWorldAction(j,player,'active_position',{position:'GK'},profile).ok,false);
});
test('scouted contract offers carry real wages, bonus and a deadline',()=>{
 const {j,player,profile}=fresh();assert.equal(playerWorldAction(j,player,'request_transfer',{},profile).ok,true);assert.ok(j.offers.length>=1);for(const offer of j.offers){assert.ok(offer.salary>0);assert.ok(offer.signingBonus>0);assert.equal(offer.expiresRound,2);assert.equal(offer.status,'pending');assert.notEqual(offer.clubId,j.clubId);}
});
test('club offers respect playing ability and reputation rather than gifting elite clubs',()=>{
 const {j,player,profile}=fresh();playerWorldAction(j,player,'request_transfer',{},profile);assert.ok(!j.offers.some(o=>o.clubId==='baku'));
 const {j:b,player:q,profile:r}=fresh();q.reputation=100;for(const k of Object.keys(q.skills))q.skills[k]=90;playerWorldAction(b,q,'request_transfer',{},r);assert.ok(b.offers.some(o=>o.clubId==='baku'));
});
test('accepted transfer moves the same hero to another actual roster and pays the bonus once',()=>{
 const {j,player,profile}=fresh(),before=player.balance,oldClub=j.clubId,offer=move(j,player,profile);assert.notEqual(j.clubId,oldClub);assert.equal(j.players.find(p=>p.id===j.heroId).clubId,j.clubId);assert.equal(player.salary,offer.salary);assert.equal(player.balance,before+offer.signingBonus);assert.equal(preparePlayerMatch(j,player,profile).options.playerClubName,j.clubs.find(c=>c.id===offer.clubId).name);assert.equal(playerWorldAction(j,player,'accept_offer',{offerId:offer.id},profile).ok,false);assert.equal(player.balance,before+offer.signingBonus);
});
test('agent cannot spam new offer batches or transfer bonuses in the same round',()=>{
 const {j,player,profile}=fresh();playerWorldAction(j,player,'request_transfer',{},profile);assert.equal(playerWorldAction(j,player,'request_transfer',{},profile).ok,false);playerWorldAction(j,player,'accept_offer',{offerId:j.offers[0].id},profile);assert.equal(playerWorldAction(j,player,'request_transfer',{},profile).ok,false);assert.equal(playerWorldAction(j,player,'renew_contract',{},profile).ok,false);
});
test('rejected and expired offers do not change balance or club and cannot later be accepted',()=>{
 const {j,player,profile}=fresh();playerWorldAction(j,player,'request_transfer',{},profile);const offer=j.offers[0];assert.equal(playerWorldAction(j,player,'reject_offer',{offerId:offer.id},profile).ok,true);assert.equal(playerWorldAction(j,player,'accept_offer',{offerId:offer.id},profile).ok,false);const other=j.offers.find(o=>o.status==='pending');j.round=3;assert.equal(playerWorldAction(j,player,'accept_offer',{offerId:other.id},profile).ok,false);assert.equal(other.status,'expired');assert.equal(player.balance,1000);assert.equal(j.clubId,'sunrise');
});
test('club transfers obey windows but free agents can sign outside them',()=>{
 const {j,player,profile}=fresh();j.round=5;assert.equal(playerWorldAction(j,player,'request_transfer',{},profile).ok,false);j.clubId=null;j.players.find(p=>p.id===j.heroId).clubId=null;assert.equal(playerWorldAction(j,player,'request_transfer',{},profile).ok,true);assert.equal(playerWorldAction(j,player,'accept_offer',{offerId:j.offers[0].id},profile).ok,true);
});
test('contract renewal replaces actual salary and expiry without moving clubs',()=>{
 const {j,player,profile}=fresh(),old=j.clubId;assert.equal(playerWorldAction(j,player,'renew_contract',{},profile).ok,true);const offer=j.offers[0];assert.equal(offer.kind,'renewal');assert.equal(playerWorldAction(j,player,'accept_offer',{offerId:offer.id},profile).ok,true);assert.equal(j.clubId,old);assert.equal(j.contract.expiresSeason,offer.contractUntilSeason);assert.equal(player.salary,offer.salary);
});
test('loan moves hero temporarily, preserves parent contract through a save and returns next season',()=>{
 const {j,player,profile}=fresh(),parent=j.clubId,oldSalary=player.salary;const offer=move(j,player,profile,'request_loan');assert.equal(offer.signingBonus,0);assert.equal(j.contract.parentClubId,parent);assert.equal(playerWorldAction(j,player,'request_transfer',{},profile).ok,false);
 const restored=normalizePlayerJourney(JSON.parse(JSON.stringify(j)),player,profile);season(restored,player,profile);const r=playerWorldAction(restored,player,'next_season',{},profile);assert.equal(r.ok,true);assert.equal(restored.clubId,parent);assert.equal(restored.contract.parentClubId,null);assert.equal(player.salary,oldSalary);assert.equal(restored.contract.expiresSeason,2);
});
test('full season records fourteen personal fixtures and complete eight-team standings',()=>{
 const {j,player,profile}=fresh();season(j,player,profile);assert.equal(j.round,14);assert.equal(j.fixtures.filter(f=>f.played).length,56);assert.equal(j.history.length,14);assert.equal(j.careerStats.appearances,14);assert.equal(j.careerStats.goals,14);assert.equal(j.seasonStats.minutes,1260);assert.equal(getPlayerFixture(j),null);assert.ok(getPlayerStandings(j).every(row=>row.played===14));
});
test('new season retains career legacy but resets seasonal stats, advances age and monotonic calendar',()=>{
 const {j,player,profile}=fresh();season(j,player,profile);const day=player.day;const r=playerWorldAction(j,player,'next_season',{},profile);assert.equal(r.ok,true);assert.equal(r.context.advanceDays,14);assert.equal(j.age,19);assert.equal(j.season,2);assert.equal(j.careerStats.appearances,14);assert.equal(j.seasonStats.appearances,0);assert.ok(getPlayerFixture(j).absoluteDay>day);assert.ok(j.fixtures.every(f=>f.id.startsWith('p-s2-')));
});
test('actual contract expiry creates free agency and signing an offer restores playable league fixtures',()=>{
 const {j,player,profile}=fresh();season(j,player,profile);let r=playerWorldAction(j,player,'next_season',{},profile);player.day+=r.context.advanceDays;season(j,player,profile);r=playerWorldAction(j,player,'next_season',{},profile);player.day+=r.context.advanceDays;assert.equal(j.clubId,null);assert.equal(j.players.find(p=>p.id===j.heroId).clubId,null);assert.equal(player.salary,0);assert.equal(getPlayerFixture(j),null);assert.equal(preparePlayerMatch(j,player,profile).ok,false);move(j,player,profile);assert.ok(getPlayerFixture(j));assert.equal(preparePlayerMatch(j,player,profile).ok,true);
});
test('fast simulation records meaningful starter, substitute and omitted personal minutes',()=>{
 for(const [energy,status,minutes] of [[85,'starter',90],[30,'bench',15],[10,'omitted',0]]){const {j,player,profile}=fresh();player.day=4;player.energy=energy;const r=playerWorldAction(j,player,'simulate',{},profile);assert.equal(r.ok,true);assert.equal(r.context.selection,status);assert.equal(r.context.minutes,minutes);assert.equal(j.round,1);assert.equal(j.fixtures.filter(f=>f.played).length,4);assert.equal(j.careerStats.appearances,minutes?1:0);}
});
test('simulation is deterministic for identical persisted player state',()=>{
 const {j,player,profile}=fresh(),b=clone(j),q=clone(player);const a=playerWorldAction(j,player,'simulate',{},profile),c=playerWorldAction(b,q,'simulate',{},profile);assert.deepEqual(a.context,c.context);assert.deepEqual(j.fixtures,b.fixtures);assert.deepEqual(j.careerStats,b.careerStats);
});
test('development and club decisions cannot mutate a live fixture',()=>{
 const {j,player,profile}=fresh();preparePlayerMatch(j,player,profile);beginPlayerFixture(j,player);for(const action of ['spend_skill','request_transfer','simulate','next_season','retire'])assert.equal(playerWorldAction(j,player,action,{skill:'passing'},profile).ok,false);assert.equal(playerWorldAction(j,player,'active_position',{position:'MID'},profile).ok,false);
});
test('debut, first goal and assist are lifetime milestones and never duplicate',()=>{
 const {j,player,profile}=fresh();finished(j,player,profile);finished(j,player,profile);for(const id of ['debut','first_goal','first_assist'])assert.equal(j.milestones.filter(m=>m.id===id).length,1);assert.equal(j.records.bestMatchGoals,1);assert.equal(j.records.bestRating,8);
});
test('retirement guard is real and eligible retirement retains legacy and closes gameplay',()=>{
 const {j,player,profile}=fresh();assert.equal(playerWorldAction(j,player,'retire',{},profile).ok,false);j.age=30;assert.equal(playerWorldAction(j,player,'retire',{},profile).ok,true);assert.equal(j.retired,true);assert.ok(j.milestones.some(m=>m.id==='retired'));assert.equal(preparePlayerMatch(j,player,profile).ok,false);assert.equal(playerWorldAction(j,player,'simulate',{},profile).ok,false);assert.equal(getPlayerFixture(j),null);
});
test('normalization preserves transfers, actual fractional minutes, ongoing offers and life state',()=>{
 const {j,player,profile}=fresh();finished(j,player,profile,{minutes:35.75});move(j,player,profile);j.life={coachTrust:34,events:[{id:'persisted-dilemma',status:'resolved'}],stress:62};const restored=normalizePlayerJourney(JSON.parse(JSON.stringify(j)),player,profile);assert.equal(restored.clubId,j.clubId);assert.equal(restored.careerStats.minutes,35.75);assert.equal(restored.life.coachTrust,34);assert.deepEqual(restored.life.events,j.life.events);assert.equal(restored.players.filter(p=>p.id===j.heroId).length,1);assert.equal(restored.contract.clubId,j.clubId);assert.equal(restored.completedFixtureIds.length,1);
});
test('normalization bounds malformed numeric values and safely reconstructs missing hero',()=>{
 const {j,player,profile}=fresh();j.age=Infinity;j.form=-100;j.skillPoints=-1;j.players=j.players.filter(p=>p.id!==j.heroId);const restored=normalizePlayerJourney(j,player,profile);assert.equal(restored.age,18);assert.equal(restored.form,0);assert.equal(restored.skillPoints,0);assert.equal(restored.players.filter(p=>p.id===j.heroId).length,1);
});
test('normalization does not coerce unknown positions or accept duplicate player IDs',()=>{
 const {j,player,profile}=fresh();j.positions=['GK','FWD','FWD'];j.activePosition='GK';j.players.push(clone(j.players[0]));const restored=normalizePlayerJourney(j,player,profile);assert.deepEqual(restored.positions,['FWD']);assert.equal(restored.activePosition,'FWD');assert.equal(new Set(restored.players.map(p=>p.id)).size,restored.players.length);
});
test('legacy player state migrates without assigning old team goals to a new individual season',()=>{
 const {player,profile}=fresh();player.appearances=9;player.goals=4;const j=createPlayerJourney(player,profile);assert.equal(j.careerStats.appearances,9);assert.equal(j.careerStats.goals,4);assert.equal(j.seasonStats.goals,0);assert.equal(j.seasonStats.appearances,0);
});
function clone(v){return structuredClone(v);}

test('expired pending offers cannot block the next round of agent negotiations',()=>{
 const {j,player,profile}=fresh();assert.equal(playerWorldAction(j,player,'request_transfer',{},profile).ok,true);const old=j.offers.map(o=>o.id);j.round=3;assert.equal(playerWorldAction(j,player,'request_transfer',{},profile).ok,true);assert.ok(j.offers.filter(o=>old.includes(o.id)).every(o=>o.status==='expired'));assert.ok(j.offers.some(o=>o.status==='pending'&&!old.includes(o.id)));
});

test('selection projects recovery and injury healing to the actual fixture day',()=>{
 const {j,player,profile}=fresh();player.energy=30;j.injuryDays=2;const m=preparePlayerMatch(j,player,profile);assert.equal(m.selection.daysUntilMatch,3);assert.equal(m.selection.projectedEnergy,54);assert.equal(m.selection.status,'starter');assert.match(m.selection.reason,/Matç günü/);assert.equal(player.energy,30);assert.equal(j.injuryDays,2);
});
test('projected bench selection agrees with kickoff readiness after calendar recovery',()=>{
 const {j,player,profile}=fresh();player.energy=0;j.injuryDays=2;const before=preparePlayerMatch(j,player,profile);assert.equal(before.selection.projectedEnergy,24);assert.equal(before.selection.status,'omitted');const begin=beginPlayerFixture(j,player);player.day+=begin.context.advanceDays;player.energy+=8*begin.context.advanceDays;j.injuryDays=Math.max(0,j.injuryDays-begin.context.advanceDays);const kickoff=preparePlayerMatch(j,player,profile);assert.equal(kickoff.selection.status,before.selection.status);assert.equal(player.energy,kickoff.selection.projectedEnergy);
});

test('retirement stops active wages while preserving the career archive',()=>{
 const {player,profile,j}=fresh();j.age=35;j.careerStats.appearances=100;
 assert.equal(playerWorldAction(j,player,'retire',{},profile).ok,true);
 assert.equal(player.salary,0);assert.equal(j.contract.salary,0);assert.equal(j.retired,true);
 assert.equal(j.careerStats.appearances,100);assert.ok(j.milestones.some(m=>m.id==='retired'||m.key==='retired'));
});
