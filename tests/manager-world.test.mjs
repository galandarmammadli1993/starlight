import test from 'node:test';
import assert from 'node:assert/strict';
import {createManagerWorld,normalizeManagerWorld,getNextFixture,getStandings,getClubPlayers,getPlayer,playerOverall,prepareManagerMatch,beginManagerFixture,finishManagerMatch,simulateManagerFixture,selectLineup,managerWorldAction} from '../src/game/manager-world.mjs';
const fresh=()=>createManagerWorld(27);
function finish(w,score=[2,1],extra={}){const f=getNextFixture(w);return finishManagerMatch(w,{fixtureId:f.id,score,state:'FULL_TIME',matchId:`test-${f.id}`,...extra});}
function wealthy(){const w=fresh();w.budget=3000000;w.wageBudget=200000;return w;}
function scout(w){assert.equal(managerWorldAction(w,'scout').ok,true);return getPlayer(w,w.scoutReports[0].playerIds[0]);}

test('world has eight original clubs and 176 persistent uniquely identified players',()=>{const w=fresh();assert.equal(w.clubs.length,8);assert.equal(w.players.length,176);assert.equal(new Set(w.players.map(p=>p.id)).size,176);assert.equal(getClubPlayers(w).length,22);});
test('every club has keepers defenders midfielders forwards and mixed ages',()=>{const w=fresh();for(const c of w.clubs){const p=getClubPlayers(w,c.id);for(const role of ['GK','DEF','MID','FWD'])assert.ok(p.some(v=>v.role===role));assert.ok(p.some(v=>v.age<=21));assert.ok(p.some(v=>v.age>=30));}});
test('player profiles contain meaningful attributes contracts value foot psychology and stats',()=>{const p=fresh().players[0];assert.ok(p.value>0&&p.wage>0&&p.contractEnd>0);assert.ok(['left','right'].includes(p.dominantFoot));for(const key of ['pace','passing','shooting','defending'])assert.ok(p.attributes[key]>0);assert.ok(p.psych.professionalism>0);assert.equal(p.statistics.appearances,0);});
test('same seed creates reproducible worlds and a different seed changes the roster',()=>{assert.deepEqual(fresh(),fresh());assert.notDeepEqual(fresh().players,createManagerWorld(28).players);});
test('legacy financial and tactical state is retained during initial migration',()=>{const w=createManagerWorld(27,{budget:50000,formation:'4-4-2',tactic:'wide',boardConfidence:42});assert.equal(w.budget,50000);assert.equal(w.plan.formation,'4-4-2');assert.equal(w.plan.tactic,'wide');assert.equal(w.boardConfidence,42);});
test('double round robin consists of fourteen rounds and fifty-six fixtures',()=>{const w=fresh();assert.equal(w.fixtures.length,56);for(let round=0;round<14;round++){const f=w.fixtures.filter(x=>x.round===round);assert.equal(f.length,4);assert.equal(new Set(f.flatMap(x=>[x.homeClubId,x.awayClubId])).size,8);}});
test('each club plays all seven opponents once home and once away',()=>{const w=fresh();for(const c of w.clubs)for(const o of w.clubs){if(c.id===o.id)continue;assert.equal(w.fixtures.filter(f=>f.homeClubId===c.id&&f.awayClubId===o.id).length,1);}});
test('schedule days advance weekly and user has fourteen distinct fixtures',()=>{const w=fresh();const f=w.fixtures.filter(f=>[f.homeClubId,f.awayClubId].includes('baku'));assert.equal(f.length,14);assert.equal(new Set(f.map(f=>f.id)).size,14);assert.equal(f[0].day,4);assert.equal(f[13].day,95);});
test('initial standings start at zero with eight clubs',()=>{const table=getStandings(fresh());assert.equal(table.length,8);assert.ok(table.every(t=>t.played===0&&t.points===0&&t.gd===0));});
test('starting eleven and seven bench players are distinct real roster identities',()=>{const w=fresh();assert.equal(w.lineup.length,11);assert.equal(w.bench.length,7);assert.equal(new Set([...w.lineup,...w.bench]).size,18);assert.ok([...w.lineup,...w.bench].every(id=>getPlayer(w,id).clubId==='baku'));assert.equal(w.lineup.filter(id=>getPlayer(w,id).role==='GK').length,1);});
test('preparing live match exposes actual roster skills bench and opponent data',()=>{const w=fresh(),p=prepareManagerMatch(w);assert.equal(p.ok,true);assert.equal(p.options.managerRoster.length,11);assert.equal(p.options.managerBench.length,7);assert.equal(p.options.opponentRoster.length,11);assert.equal(p.options.managerFixtureId,getNextFixture(w).id);assert.equal(p.options.managerOpponentName,p.opponent.name);assert.ok(p.options.managerRoster.every(p=>typeof p.id==='string'&&p.attributes.passing));});
test('preparation alone does not consume a fixture or write finance',()=>{const w=fresh(),before=structuredClone(w);prepareManagerMatch(w);assert.deepEqual(w,before);});
test('begin fixture sets pending identity and moves to its scheduled date',()=>{const w=fresh(),f=getNextFixture(w);assert.equal(beginManagerFixture(w,f.id).ok,true);assert.equal(w.pendingMatchId,f.id);assert.equal(w.day,f.day);assert.equal(getNextFixture(w).played,false);});
test('wrong fixture cannot be started',()=>{const w=fresh();assert.equal(beginManagerFixture(w,'unknown').ok,false);assert.equal(w.pendingMatchId,null);});
test('winning away score is flipped into home-away league storage correctly',()=>{const w=fresh(),f=getNextFixture(w);assert.equal(f.awayClubId,'baku');assert.equal(finish(w,[3,1]).ok,true);assert.deepEqual(f.score,[1,3]);const row=getStandings(w).find(t=>t.clubId==='baku');assert.equal(row.points,3);assert.equal(row.gf,3);assert.equal(row.ga,1);});
test('every completed user fixture simulates the three other results once',()=>{const w=fresh();finish(w);assert.equal(w.fixtures.filter(f=>f.played).length,4);assert.ok(getStandings(w).every(t=>t.played===1));});
test('draw awards one point and loss awards none',()=>{for(const [score,points]of [[[1,1],1],[[0,2],0]]){const w=fresh();finish(w,score);assert.equal(getStandings(w).find(t=>t.clubId==='baku').points,points);}});
test('same match and fixture cannot credit stats or money twice',()=>{const w=fresh(),f=getNextFixture(w);const result={fixtureId:f.id,matchId:'duplicate',score:[2,0],state:'FULL_TIME'};assert.equal(finishManagerMatch(w,result).ok,true);const before=structuredClone(w);assert.equal(finishManagerMatch(w,result).ok,false);assert.deepEqual(w,before);});
test('unfinished and invalid scores are rejected without changing league state',()=>{for(const score of [[-1,0],[NaN,0],[100,0],[1]]){const w=fresh(),f=getNextFixture(w),before=structuredClone(w);assert.equal(finishManagerMatch(w,{fixtureId:f.id,score,state:'FULL_TIME'}).ok,false);assert.deepEqual(w,before);}const w=fresh();assert.equal(finish(w,[1,0],{state:'IN_PLAY'}).ok,false);});
test('future fixture cannot bypass the current round',()=>{const w=fresh(),f=w.fixtures.find(f=>f.round===5&&[f.homeClubId,f.awayClubId].includes('baku'));assert.equal(finishManagerMatch(w,{fixtureId:f.id,score:[9,0],state:'FULL_TIME'}).ok,false);assert.equal(w.round,0);});
test('weekly wages and staff costs are actually deducted once',()=>{const w=fresh(),before=w.budget,wages=getClubPlayers(w).reduce((s,p)=>s+p.wage,0);const r=finish(w,[2,0]);assert.equal(r.wages,wages);assert.equal(w.budget,before+20500-wages-2800);assert.equal(w.ledger.length,3);assert.equal(w.lastPaidRound,0);});
test('three preparation days are a hard cap and rest cannot generate money',()=>{const w=fresh(),before=w.budget;for(let i=0;i<3;i++)assert.equal(managerWorldAction(w,'rest').ok,true);const day=w.day;assert.equal(managerWorldAction(w,'rest').ok,false);assert.equal(w.day,day);assert.equal(w.budget,before);});
test('training spends budget and improves the chosen actual attribute',()=>{const w=fresh(),p=getClubPlayers(w)[4],before=p.attributes.shooting;managerWorldAction(w,'training_focus',{value:'attack'});assert.equal(managerWorldAction(w,'train').ok,true);assert.ok(p.attributes.shooting>before);assert.equal(w.budget,125000-700);});
test('recovery reduces individual fatigue and heals a treatment day',()=>{const w=fresh(),p=getClubPlayers(w)[2];p.fatigue=70;p.injuryDays=4;managerWorldAction(w,'recovery');assert.equal(p.fatigue,50);assert.equal(p.injuryDays,3);});
test('new fixture resets preparation allowance',()=>{const w=fresh();for(let i=0;i<3;i++)managerWorldAction(w,'rest');finish(w);assert.equal(w.activitiesSinceFixture,0);assert.equal(managerWorldAction(w,'rest').ok,true);});
test('preparation cannot mutate a pending live match',()=>{const w=fresh();beginManagerFixture(w);const before=structuredClone(w);assert.equal(managerWorldAction(w,'train').ok,false);assert.deepEqual(w,before);});
test('insufficient funds reject spending without losing preparation time',()=>{const w=fresh();w.budget=10;assert.equal(managerWorldAction(w,'scout').ok,false);assert.equal(w.activitiesSinceFixture,0);assert.equal(w.budget,10);});
test('scouting creates four real candidates with readable potential reports',()=>{const w=fresh();scout(w);assert.equal(w.scoutReports.length,1);const report=w.scoutReports[0];assert.equal(report.playerIds.length,4);assert.ok(report.playerIds.every(id=>getPlayer(w,id).clubId!=='baku'));assert.ok(report.players.every(p=>p.potentialLow<=p.potentialHigh&&p.comment));assert.equal(w.budget,123800);});
test('successive scouting reports rotate candidates',()=>{const w=fresh();scout(w);const ids=w.scoutReports[0].playerIds;scout(w);assert.notDeepEqual(w.scoutReports[0].playerIds,ids);});
test('youth investment promotes a real new persistent player',()=>{const w=fresh(),before=w.players.length;const r=managerWorldAction(w,'youth');assert.equal(r.ok,true);assert.equal(w.players.length,before+1);const p=w.players.at(-1);assert.equal(p.clubId,'baku');assert.equal(p.age,17);assert.ok(p.id.includes('youth'));assert.equal(p.statistics.appearances,0);assert.ok(p.potential>=82);});
test('full squad blocks academy promotion without charging money',()=>{const w=fresh();for(let i=0;i<8;i++)w.players.push({...structuredClone(w.players[2]),id:`extra-${i}`});const budget=w.budget,day=w.day;assert.equal(managerWorldAction(w,'youth').ok,false);assert.equal(w.budget,budget);assert.equal(w.day,day);});
test('transfer requires a real prior scouting report',()=>{const w=wealthy(),p=w.players.find(p=>p.clubId!=='baku');assert.equal(managerWorldAction(w,'transfer',{playerId:p.id}).ok,false);});
test('successful transfer moves ownership and credits the seller atomically',()=>{const w=wealthy(),p=scout(w),seller=w.clubs.find(c=>c.id===p.clubId),sellerBudget=seller.budget,fee=p.value,budget=w.budget;const r=managerWorldAction(w,'transfer',{playerId:p.id});assert.equal(r.ok,true);assert.equal(p.clubId,'baku');assert.equal(w.budget,budget-fee);assert.equal(seller.budget,sellerBudget+fee);assert.equal(getClubPlayers(w).length,23);assert.equal(w.transferLog[0].playerId,p.id);});
test('rejected low transfer offer does not move the player or spend money',()=>{const w=wealthy(),p=scout(w),club=p.clubId,budget=w.budget;assert.equal(managerWorldAction(w,'transfer',{playerId:p.id,offer:1}).ok,false);assert.equal(p.clubId,club);assert.equal(w.budget,budget);});
test('transfer respects cash and weekly wage budget',()=>{const w=wealthy(),p=scout(w);w.budget=100;assert.equal(managerWorldAction(w,'transfer',{playerId:p.id}).ok,false);w.budget=3000000;w.wageBudget=1;assert.equal(managerWorldAction(w,'transfer',{playerId:p.id}).ok,false);});
test('injured candidate fails medical without money loss',()=>{const w=wealthy(),p=scout(w);p.injuryDays=7;const budget=w.budget;assert.equal(managerWorldAction(w,'transfer',{playerId:p.id}).ok,false);assert.equal(w.budget,budget);});
test('transfer window closes between designated periods',()=>{const w=wealthy(),p=scout(w);w.round=5;assert.equal(managerWorldAction(w,'transfer',{playerId:p.id}).ok,false);w.round=8;assert.equal(managerWorldAction(w,'transfer',{playerId:p.id}).ok,true);});
test('renewal changes real wage contract end and personal trust',()=>{const w=fresh(),p=getClubPlayers(w)[1],old=p.wage,trust=p.trust;assert.equal(managerWorldAction(w,'renew',{playerId:p.id,wage:old+100,years:3}).ok,true);assert.equal(p.wage,old+100);assert.equal(p.contractEnd,w.season+3);assert.ok(p.trust>trust);assert.equal(w.budget,124500);});
test('renewal cannot reduce agreed wage or exceed wage budget',()=>{const w=fresh(),p=w.players[1];assert.equal(managerWorldAction(w,'renew',{playerId:p.id,wage:p.wage-1}).ok,false);w.wageBudget=100;assert.equal(managerWorldAction(w,'renew',{playerId:p.id}).ok,false);});
test('selling moves a real player to another club and repairs starting selection',()=>{const w=fresh(),p=getPlayer(w,w.lineup[2]),budget=w.budget;const r=managerWorldAction(w,'sell',{playerId:p.id});assert.equal(r.ok,true);assert.notEqual(p.clubId,'baku');assert.ok(w.budget>budget);assert.equal(w.lineup.length,11);assert.ok(!w.lineup.includes(p.id));});
test('club cannot sell below an eighteen-person squad',()=>{const w=fresh();w.players=w.players.filter(p=>p.clubId!=='baku'||Number(p.id.slice(-2))<=18);const p=getClubPlayers(w)[3];assert.equal(managerWorldAction(w,'sell',{playerId:p.id}).ok,false);});
test('selecting a starter swaps a real same-role reserve onto the pitch',()=>{const w=fresh(),reserve=getClubPlayers(w).find(p=>!w.lineup.includes(p.id)&&p.role==='MID'),out=w.lineup.find(id=>getPlayer(w,id).role==='MID');assert.equal(selectLineup(w,reserve.id,out).ok,true);assert.ok(w.lineup.includes(reserve.id));assert.ok(w.bench.includes(out));assert.equal(w.lineup.length,11);});
test('injured and suspended players cannot be selected',()=>{for(const property of ['injuryDays','suspension']){const w=fresh(),p=getClubPlayers(w).find(p=>!w.lineup.includes(p.id)&&p.role==='MID');p[property]=2;assert.equal(selectLineup(w,p.id).ok,false);}});
test('lineup changes are blocked while a live fixture is pending',()=>{const w=fresh();beginManagerFixture(w);const p=getClubPlayers(w).find(p=>!w.lineup.includes(p.id)&&p.role==='MID');assert.equal(selectLineup(w,p.id).ok,false);});
test('formation choice produces the expected role distribution',()=>{const w=fresh();assert.equal(managerWorldAction(w,'formation',{value:'3-5-2'}).ok,true);const roles=w.lineup.map(id=>getPlayer(w,id).role);assert.equal(roles.filter(v=>v==='DEF').length,3);assert.equal(roles.filter(v=>v==='MID').length,5);assert.equal(roles.filter(v=>v==='FWD').length,2);});
test('invalid formation and training direction never replace the current plan',()=>{const w=fresh(),before=structuredClone(w.plan);assert.equal(managerWorldAction(w,'formation',{value:'1-1'}).ok,false);assert.equal(managerWorldAction(w,'training_focus',{value:'nonsense'}).ok,false);assert.deepEqual(w.plan,before);});
test('actual match ledger includes outgoing and incoming player minutes goals assists and red bans',()=>{const w=fresh(),f=getNextFixture(w),out=getPlayer(w,w.lineup[2]),incoming=getPlayer(w,w.bench.find(id=>getPlayer(w,id).role===out.role)),unused=getPlayer(w,w.bench.at(-1));const report={fixtureId:f.id,state:'FULL_TIME',completed:true,score:[2,1],players:[{persistentId:out.id,team:0,minutes:35,goals:1,assists:1,yellow:1,red:1,rating:7.8,fitness:71},{persistentId:incoming.id,team:0,minutes:55,goals:1,assists:0,yellow:0,red:0,rating:7.4,fitness:82}]};const r=finishManagerMatch(w,{managerMatchReport:report,matchId:'ledger-match'});assert.equal(r.ok,true);assert.equal(out.statistics.minutes,35);assert.equal(out.statistics.goals,1);assert.equal(out.statistics.assists,1);assert.equal(out.statistics.red,1);assert.equal(out.suspension,2);assert.equal(incoming.statistics.minutes,55);assert.equal(unused.statistics.appearances,0);assert.equal(out.fitness,71);assert.equal(r.context.playerMinutes[out.id],35);assert.ok(r.context.cards.some(c=>c.playerId===out.id&&c.type==='red'));});
test('unused or missing report players are not assigned imaginary ninety-minute appearances',()=>{const w=fresh(),f=getNextFixture(w);const r=finishManagerMatch(w,{fixtureId:f.id,state:'FULL_TIME',score:[0,0],players:[]});assert.equal(r.ok,true);assert.equal(getClubPlayers(w).reduce((sum,p)=>sum+p.statistics.appearances,0),0);});
test('a red-card ban serves one match at a time and blocks the next lineup',()=>{const w=fresh(),p=getPlayer(w,w.lineup[2]);p.suspension=2;finish(w);assert.equal(p.suspension,1);assert.ok(!w.lineup.includes(p.id));finish(w);assert.equal(p.suspension,0);});
test('simulation results use seed state and are reproducible without guaranteed wins',()=>{const a=fresh(),b=fresh();assert.deepEqual(simulateManagerFixture(a),simulateManagerFixture(b));const outcomes=[];for(let seed=1;seed<=12;seed++){const w=createManagerWorld(seed);simulateManagerFixture(w);outcomes.push(w.fixtures.find(f=>f.played&&[f.homeClubId,f.awayClubId].includes('baku')).score.join(':'));}assert.ok(new Set(outcomes).size>3);});
test('all fourteen rounds finish and all clubs play fourteen games',()=>{const w=fresh();for(let i=0;i<14;i++){const r=simulateManagerFixture(w);assert.equal(r.ok,true,`round ${i}: ${r.message}`);}assert.equal(getNextFixture(w),null);assert.equal(w.fixtures.filter(f=>f.played).length,56);assert.ok(getStandings(w).every(t=>t.played===14));assert.equal(w.seasonHistory.length,1);assert.equal(w.round,14);});
test('new season keeps persistent identities and finances but resets schedule',()=>{const w=fresh(),id=w.players[0].id,age=w.players[0].age;for(let i=0;i<14;i++)simulateManagerFixture(w);const budget=w.budget;assert.equal(managerWorldAction(w,'next_season').ok,true);assert.equal(w.season,2);assert.equal(w.round,0);assert.equal(w.fixtures.filter(f=>f.played).length,0);assert.equal(w.players[0].id,id);assert.equal(w.players[0].age,age+1);assert.equal(w.budget,budget);});
test('new season is blocked before all user fixtures are complete',()=>{const w=fresh();assert.equal(managerWorldAction(w,'next_season').ok,false);assert.equal(w.season,1);});
test('normalization retains completed season data real roster and psychology state',()=>{const w=fresh();finish(w);w.psychology={events:[{id:'incident'}],managerTrust:42};w.players[0].psych.promises=[{id:'promise'}];const copy=normalizeManagerWorld(JSON.parse(JSON.stringify(w)));assert.equal(copy.round,1);assert.equal(copy.fixtures.filter(f=>f.played).length,4);assert.deepEqual(copy.psychology,w.psychology);assert.deepEqual(copy.players[0].psych.promises,w.players[0].psych.promises);});
test('missing or corrupt world safely starts an initialized playable world',()=>{for(const value of [null,undefined,{},[],{version:99}])assert.equal(normalizeManagerWorld(value).players.length,176);});
test('malformed finite numbers are bounded during normalization',()=>{const w=fresh();w.budget=Infinity;w.players[0].attributes.pace=NaN;w.players[0].fitness=-20;w.plan.formation='broken';const normalized=normalizeManagerWorld(w);assert.ok(Number.isFinite(normalized.budget));assert.equal(normalized.players[0].attributes.pace,fresh().players[0].attributes.pace);assert.equal(normalized.players[0].fitness,0);assert.equal(normalized.plan.formation,'4-3-3');});
test('helper lookups do not invent players and ratings remain bounded',()=>{const w=fresh();assert.equal(getPlayer(w,'missing'),null);for(const p of w.players)assert.ok(playerOverall(p)>20&&playerOverall(p)<=99);});

test('fractional football minutes survive normalized save restoration',()=>{const w=fresh();w.players[0].statistics.minutes=35.75;const restored=normalizeManagerWorld(JSON.parse(JSON.stringify(w)));assert.equal(restored.players[0].statistics.minutes,35.75);});

test('current focus cooperation and composure influence seeded fast simulation without guaranteeing a win',()=>{
 let changed=0,highGoalDifference=0,lowGoalDifference=0,highLosses=0;
 for(let seed=1;seed<=100;seed++){
  const low=createManagerWorld(seed),high=createManagerWorld(seed);
  for(const p of getClubPlayers(low))p.psychMatch={focus:0,cooperation:0,composure:0};
  for(const p of getClubPlayers(high))p.psychMatch={focus:100,cooperation:100,composure:100};
  const a=simulateManagerFixture(low),b=simulateManagerFixture(high);
  lowGoalDifference+=a.context.score[0]-a.context.score[1];highGoalDifference+=b.context.score[0]-b.context.score[1];
  if(a.context.score.join(':')!==b.context.score.join(':'))changed++;
  if(b.context.score[0]<b.context.score[1])highLosses++;
 }
 assert.ok(changed>0,'mental state must change outcomes under identical seeds');
 assert.ok(highGoalDifference>lowGoalDifference,'stronger focus/cooperation/composure should improve the seeded treatment aggregate');
 assert.ok(highLosses>0,'a positive team talk must not guarantee victory');
});
test('each mental dimension can independently change a deterministic simulation treatment',()=>{
 for(const key of ['focus','cooperation','composure']){
  let changed=0;
  for(let seed=1;seed<=70;seed++){
   const a=createManagerWorld(seed),b=createManagerWorld(seed);
   for(const p of getClubPlayers(a))p.psychMatch={focus:60,cooperation:60,composure:60,[key]:0};
   for(const p of getClubPlayers(b))p.psychMatch={focus:60,cooperation:60,composure:60,[key]:100};
   const before=simulateManagerFixture(a).context.score,after=simulateManagerFixture(b).context.score;
   if(before.join(':')!==after.join(':'))changed++;
  }
  assert.ok(changed>0,`${key} must reach simulated match strength`);
 }
});
test('new world initializes the under23 season objective with zero actual minutes',()=>{const w=fresh();assert.equal(w.objectives.youthMinutes,180);assert.equal(w.objectives.youthMinutesPlayed,0);});
test('actual under23 minutes count once while age23 and older minutes do not',()=>{
 const w=fresh(),young=getClubPlayers(w).find(p=>p.age<23),older=getClubPlayers(w).find(p=>p.id!==young.id);older.age=23;
 const f=getNextFixture(w),report={fixtureId:f.id,state:'FULL_TIME',score:[1,0],players:[{persistentId:young.id,team:0,minutes:35.75},{persistentId:older.id,team:0,minutes:90}]};
 assert.equal(finishManagerMatch(w,report).ok,true);assert.equal(w.objectives.youthMinutesPlayed,35.75);
 assert.equal(finishManagerMatch(w,report).ok,false);assert.equal(w.objectives.youthMinutesPlayed,35.75);
 const restored=normalizeManagerWorld(JSON.parse(JSON.stringify(w)));assert.equal(restored.objectives.youthMinutesPlayed,35.75);
});
test('simulated fixtures credit actual selected under23 starters and not unselected youth',()=>{
 const w=fresh(),expected=w.lineup.filter(id=>getPlayer(w,id).age<23).length*90;
 simulateManagerFixture(w);assert.equal(w.objectives.youthMinutesPlayed,expected);
});
test('a qualifying league place alone does not complete the youth development objective',()=>{
 const w=fresh();w.objectives.targetPosition=8;
 for(let i=0;i<14;i++)finish(w,[1,1],{players:[]});
 assert.equal(w.objectives.youthMinutesPlayed,0);assert.equal(w.objectives.completed,false);
 assert.equal(w.seasonHistory[0].objectives.completed,false);
});
test('league place and at least180 under23 minutes complete both objectives and new season resets the counter',()=>{
 const w=fresh(),young=getClubPlayers(w).filter(p=>p.age<23).slice(0,2);w.objectives.targetPosition=8;
 finish(w,[1,1],{players:young.map(p=>({persistentId:p.id,team:0,minutes:90}))});
 for(let i=1;i<14;i++)finish(w,[1,1],{players:[]});
 assert.equal(w.objectives.youthMinutesPlayed,180);assert.equal(w.objectives.completed,true);
 assert.equal(w.seasonHistory[0].objectives.youthMinutesPlayed,180);
 managerWorldAction(w,'next_season');assert.equal(w.objectives.youthMinutesPlayed,0);assert.equal(w.objectives.completed,false);
});
