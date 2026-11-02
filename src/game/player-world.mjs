/** An independent, fictional player career. It never reads or mutates the manager save. */
import { createManagerWorld } from './manager-world.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const number=(v,d=0,a=0,b=1e9)=>typeof v==='number'&&Number.isFinite(v)?clamp(v,a,b):d;
const integer=(v,d=0,a=0,b=1e9)=>Math.floor(number(v,d,a,b));
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const text=(v,d='',limit=120)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,limit):d;
const clone=v=>structuredClone(v);
const legacyResultsOf=value=>(Array.isArray(value)?value:[]).filter(r=>r&&typeof r.id==='string').slice(0,20).map(r=>({id:text(r.id,'',100),score:[integer(r.score?.[0],0,0,100),integer(r.score?.[1],0,0,100)],result:['win','draw','loss'].includes(r.result)?r.result:'draw',date:text(r.date,'',40)}));
const roles=['DEF','MID','FWD'],skills=['pace','passing','shooting','defending'];
const idOf=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/.test(v);
const statsOf=v=>({appearances:integer(v?.appearances),minutes:number(v?.minutes,0,0,1e7),goals:integer(v?.goals),assists:integer(v?.assists),yellow:integer(v?.yellow),red:integer(v?.red),rating:number(v?.rating,6.5,1,10)});
export const PLAYER_WORLD_VERSION=1;
export const PLAYER_HERO_ID='player-hero';
export const PLAYER_POSITION_COST=3;
function random(j){j.rng=(Math.imul(integer(j.rng,93,0,0xffffffff),1664525)+1013904223)>>>0;return j.rng/4294967296;}
function log(j,message,kind='career',extra={}){j.inbox.unshift({id:`player-note-${j.season}-${++j.sequence}`,season:j.season,round:j.round,day:j.day,message,kind,...extra});j.inbox=j.inbox.slice(0,80);}
function overall(p){return skills.reduce((sum,k)=>sum+number(p.attributes?.[k],60,0,100),0)/4;}
function schedule(clubs,season){
 const rotation=clubs.map(c=>c.id),fixtures=[];
 for(let round=0;round<7;round++){
  for(let index=0;index<4;index++){const a=rotation[index],b=rotation[7-index],home=(round+index)%2?a:b,away=home===a?b:a;fixtures.push({id:`p-s${season}-r${round+1}-${home}-${away}`,season,round,day:4+round*7,homeClubId:home,awayClubId:away,played:false,score:null});}
  rotation.splice(1,0,rotation.pop());
 }
 for(const f of [...fixtures])fixtures.push({...f,id:`p-s${season}-r${f.round+8}-${f.awayClubId}-${f.homeClubId}`,round:f.round+7,day:f.day+49,homeClubId:f.awayClubId,awayClubId:f.homeClubId});
 return fixtures.sort((a,b)=>a.round-b.round||a.id.localeCompare(b.id));
}
function heroOf(j){return j.players.find(p=>p.id===j.heroId);}
function syncHero(j,p,profile={}){
 const hero=heroOf(j);if(!hero)return;
 const oldNumber=hero.number;
 hero.clubId=j.clubId;hero.name=text(profile.name,hero.name||'Alex Hero',60);hero.role=j.activePosition;
 hero.number=integer(profile.shirtNumber,hero.number||10,2,99);hero.age=j.age;
 hero.attributes=Object.fromEntries(skills.map(k=>[k,number(p.skills?.[k],60,0,100)]));
 hero.energy=number(p.energy,85,0,100);hero.fitness=number(p.fitness,70,0,100);hero.fatigue=100-hero.energy;
 hero.morale=number(p.morale,70,0,100);hero.confidence=number(j.life?.confidence,65,0,100);hero.trust=number(j.life?.coachTrust,j.coachTrust,0,100);
 hero.psych={...hero.psych,stress:number(j.life?.stress,20,0,100),experience:clamp(8+j.careerStats.minutes/120,8,99),professionalism:number(j.life?.professionalism,65,0,100),loyalty:60};
 hero.psychMatch={...(hero.psychMatch??{}),focus:clamp(55+(hero.confidence-50)*.25-hero.psych.stress*.15,25,95),cooperation:clamp((hero.trust+number(j.life?.teammateTrust,60,0,100))/2,20,95)};
 hero.injuryDays=j.injuryDays;hero.suspension=j.suspension;hero.statistics=clone(j.careerStats);
 const other=j.players.find(person=>person.id!==hero.id&&person.clubId===j.clubId&&person.number===hero.number);
 if(other){const used=new Set(j.players.filter(person=>person.clubId===j.clubId&&person.id!==other.id).map(person=>person.number));other.number=!used.has(oldNumber)?oldNumber:Array.from({length:99},(_,i)=>i+1).find(value=>!used.has(value))??99;}
}
export function createPlayerJourney(player={},profile={}){
 const source=createManagerWorld(93),clubId='sunrise',position=roles.includes(profile.position)?profile.position:'MID';
 const replaced=source.players.find(p=>p.clubId===clubId&&p.role===position&&p.age<=23)??source.players.find(p=>p.clubId===clubId&&p.role===position);
 const players=source.players.filter(p=>p.id!==replaced.id);
 players.push({...replaced,id:PLAYER_HERO_ID,name:text(profile.name,'Alex Hero',60),age:18,role:position,clubId});
 const j={version:1,seed:93,rng:245901,heroId:PLAYER_HERO_ID,clubId,age:18,season:1,round:0,day:integer(player.day,1,1),seasonStartDay:integer(player.day,1,1)-1,
  clubs:source.clubs.map((club,index)=>({...club,reputation:[82,77,72,68,65,61,58,48][index]})),players,fixtures:[],selection:{status:'starter',plannedEntryMinute:null,reason:'Məşqçi ilk fürsəti sənə verir.'},
  contract:{clubId,salary:integer(player.salary,700,0,100000),expiresSeason:2,role:'rotation',parentClubId:null,loanUntilSeason:null},offers:[],history:[],inbox:[],pendingFixtureId:null,completedFixtureIds:[],
  form:65,coachTrust:65,injuryDays:0,suspension:0,skillPoints:0,positions:[position],activePosition:position,milestones:[],seasonStats:statsOf(null),careerStats:{...statsOf(null),appearances:integer(player.appearances),goals:integer(player.goals)},
  records:{bestMatchGoals:0,bestRating:6.5,trophies:0},legacyResults:legacyResultsOf(player.results).filter(r=>!r.id.startsWith('player-live-')&&!r.id.startsWith('player-sim-')),sequence:0,lastMarketKey:null,lastMoveKey:null,retired:false};
 j.fixtures=schedule(j.clubs,1);syncHero(j,player,profile);log(j,'Sunrise Academy-də yolun başlayır. Forma, hazırlıq və məşqçiyə münasibətin heyətdəki yerini dəyişəcək.','welcome');return j;
}
export function normalizePlayerJourney(value,player={},profile={}){
 if(!value||value.version!==1)return createPlayerJourney(player,profile);
 const base=createPlayerJourney(player,profile),raw=object(value),j={...base};
 j.seed=integer(raw.seed,93,0,0xffffffff);j.rng=integer(raw.rng,245901,0,0xffffffff);j.season=integer(raw.season,1,1,100);j.round=integer(raw.round,0,0,14);j.age=integer(raw.age,18,16,55);j.day=integer(player.day,integer(raw.day,1,1),1);j.seasonStartDay=integer(raw.seasonStartDay,0,0,1e7);
 j.clubs=base.clubs.map(club=>({...club,name:text(raw.clubs?.find(c=>c.id===club.id)?.name,club.name,80),reputation:number(raw.clubs?.find(c=>c.id===club.id)?.reputation,club.reputation,1,100)}));
 const clubIds=new Set(j.clubs.map(c=>c.id));j.clubId=raw.clubId===null?null:clubIds.has(raw.clubId)?raw.clubId:base.clubId;
 const seen=new Set();j.players=(Array.isArray(raw.players)?raw.players:base.players).slice(0,600).filter(p=>p&&idOf(p.id)&&!seen.has(p.id)&&(clubIds.has(p.clubId)||p.id===PLAYER_HERO_ID&&p.clubId===null)&&(seen.add(p.id)||true)).map(p=>({id:p.id,clubId:p.clubId,name:text(p.name,'Footballer',60),number:integer(p.number,1,1,99),age:integer(p.age,24,16,55),role:['GK',...roles].includes(p.role)?p.role:'MID',attributes:Object.fromEntries(skills.map(k=>[k,number(p.attributes?.[k],60,0,100)])),fitness:number(p.fitness,85,0,100),fatigue:number(p.fatigue,10,0,100),morale:number(p.morale,70,0,100),confidence:number(p.confidence,65,0,100),trust:number(p.trust,65,0,100),psych:clone(object(p.psych)),psychMatch:clone(object(p.psychMatch)),statistics:statsOf(p.statistics),injuryDays:integer(p.injuryDays,0,0,365),suspension:integer(p.suspension,0,0,20)}));
 if(!j.players.some(p=>p.id===PLAYER_HERO_ID)||j.clubs.some(club=>j.players.filter(p=>p.clubId===club.id).length<11)){j.players=base.players;j.clubId=base.clubId;}
 const expected=schedule(j.clubs,j.season),valid=Array.isArray(raw.fixtures)&&raw.fixtures.length===56&&new Set(raw.fixtures.map(f=>f?.id)).size===56&&raw.fixtures.every(f=>f&&idOf(f.id)&&clubIds.has(f.homeClubId)&&clubIds.has(f.awayClubId)&&f.homeClubId!==f.awayClubId&&Number.isInteger(f.round)&&f.round>=0&&f.round<14);
 j.fixtures=valid?raw.fixtures.map(f=>({id:f.id,season:j.season,round:f.round,day:4+f.round*7,homeClubId:f.homeClubId,awayClubId:f.awayClubId,played:!!f.played,score:Array.isArray(f.score)&&f.score.length===2?f.score.map(s=>integer(s,0,0,20)):null})):expected;
 for(const key of ['form','coachTrust'])j[key]=number(raw[key],base[key],0,100);
 for(const key of ['injuryDays','suspension','skillPoints','sequence'])j[key]=integer(raw[key],0,0,key==='injuryDays'?365:key==='suspension'?20:1e7);
 j.positions=[...new Set((Array.isArray(raw.positions)?raw.positions:base.positions).filter(p=>roles.includes(p)))];if(!j.positions.length)j.positions=base.positions;
 j.activePosition=j.positions.includes(raw.activePosition)?raw.activePosition:j.positions[0];
 j.selection={status:['starter','bench','omitted'].includes(raw.selection?.status)?raw.selection.status:'starter',plannedEntryMinute:raw.selection?.plannedEntryMinute===null?null:integer(raw.selection?.plannedEntryMinute,65,45,85),projectedEnergy:number(raw.selection?.projectedEnergy,number(player.energy,85,0,100),0,100),daysUntilMatch:integer(raw.selection?.daysUntilMatch,0,0,400),reason:text(raw.selection?.reason,base.selection.reason,240)};
 const contract=object(raw.contract);j.contract={clubId:j.clubId,salary:integer(contract.salary,integer(player.salary,700,0,100000),0,100000),expiresSeason:integer(contract.expiresSeason,j.season+1,0,200),role:contract.role==='first_team'?'first_team':'rotation',parentClubId:clubIds.has(contract.parentClubId)?contract.parentClubId:null,loanUntilSeason:contract.loanUntilSeason===null?null:integer(contract.loanUntilSeason,0,0,200),parentExpiresSeason:contract.parentExpiresSeason===null?null:integer(contract.parentExpiresSeason,j.season,0,200),parentSalary:contract.parentSalary===null?null:integer(contract.parentSalary,integer(player.salary,700),0,100000)};
 j.offers=(Array.isArray(raw.offers)?raw.offers:[]).slice(0,40).filter(offer=>offer&&idOf(offer.id)&&clubIds.has(offer.clubId)).map(offer=>({id:offer.id,clubId:offer.clubId,kind:['transfer','loan','renewal'].includes(offer.kind)?offer.kind:'transfer',salary:integer(offer.salary,700,0,100000),signingBonus:integer(offer.signingBonus,0,0,1e6),expiresRound:integer(offer.expiresRound,0,0,16),expiresSeason:integer(offer.expiresSeason,j.season,1,200),contractUntilSeason:integer(offer.contractUntilSeason,j.season+1,1,200),status:['pending','accepted','rejected','expired'].includes(offer.status)?offer.status:'expired'}));
 j.history=(Array.isArray(raw.history)?raw.history:[]).slice(0,100).filter(h=>h&&idOf(h.fixtureId)).map(h=>({...clone(h),season:integer(h.season,1,1,100),round:integer(h.round,0,0,13),score:Array.isArray(h.score)?h.score.slice(0,2).map(s=>integer(s,0,0,20)):[0,0],minutes:number(h.minutes,0,0,150),goals:integer(h.goals,0,0,20),assists:integer(h.assists,0,0,20),rating:number(h.rating,6,1,10)}));
 j.inbox=(Array.isArray(raw.inbox)?raw.inbox:[]).slice(0,80).filter(h=>h&&typeof h==='object').map(h=>({id:text(h.id,'',120),day:integer(h.day,1,1),season:integer(h.season,1,1,100),round:integer(h.round,0,0,14),message:text(h.message,'',600),kind:text(h.kind,'career',40)}));
 j.completedFixtureIds=[...new Set((Array.isArray(raw.completedFixtureIds)?raw.completedFixtureIds:[]).filter(idOf))].slice(-2000);
 j.pendingFixtureId=j.fixtures.some(f=>f.id===raw.pendingFixtureId&&!f.played)?raw.pendingFixtureId:null;
 j.milestones=(Array.isArray(raw.milestones)?raw.milestones:[]).slice(0,100).filter(m=>m&&typeof m.id==='string').map(m=>({id:text(m.id,'',80),title:text(m.title,'',160),season:integer(m.season,1,1,100),round:integer(m.round,0,0,14),value:number(m.value,0,0,1e7)}));
 j.seasonStats=statsOf(raw.seasonStats);j.careerStats=statsOf(raw.careerStats);j.records={bestMatchGoals:integer(raw.records?.bestMatchGoals,0,0,20),bestRating:number(raw.records?.bestRating,6.5,1,10),trophies:integer(raw.records?.trophies)};
 j.legacyResults=Array.isArray(raw.legacyResults)?legacyResultsOf(raw.legacyResults):j.legacyResults;
 j.lastMarketKey=text(raw.lastMarketKey,'',100)||null;j.lastMoveKey=text(raw.lastMoveKey,'',100)||null;j.retired=!!raw.retired;
 if(raw.life&&typeof raw.life==='object'&&!Array.isArray(raw.life))j.life=clone(raw.life);
 syncHero(j,player,profile);expireOffers(j);return j;
}
export function getPlayerFixture(j){if(!j.clubId||j.retired)return null;const f=j.fixtures.find(f=>!f.played&&f.round>=j.round&&(f.homeClubId===j.clubId||f.awayClubId===j.clubId));return f?{...f,absoluteDay:j.seasonStartDay+f.day}:null;}
export function getPlayerStandings(j){
 const table=j.clubs.map(c=>({clubId:c.id,name:c.name,short:c.short,played:0,won:0,drawn:0,lost:0,gf:0,ga:0,gd:0,points:0}));
 for(const f of j.fixtures){if(!f.played||!f.score)continue;const a=table.find(t=>t.clubId===f.homeClubId),b=table.find(t=>t.clubId===f.awayClubId);a.played++;b.played++;a.gf+=f.score[0];a.ga+=f.score[1];b.gf+=f.score[1];b.ga+=f.score[0];if(f.score[0]>f.score[1]){a.won++;b.lost++;a.points+=3;}else if(f.score[1]>f.score[0]){b.won++;a.lost++;b.points+=3;}else{a.drawn++;b.drawn++;a.points++;b.points++;}}
 for(const row of table)row.gd=row.gf-row.ga;return table.sort((a,b)=>b.points-a.points||b.gd-a.gd||b.gf-a.gf||a.name.localeCompare(b.name)).map((row,i)=>({...row,position:i+1}));
}
function select(j,p){
 if(j.pendingFixtureId)return j.selection;
 const daysUntilMatch=Math.max(0,(getPlayerFixture(j)?.absoluteDay??integer(p.day,1,1))-integer(p.day,1,1));
 const trust=number(j.life?.coachTrust,j.coachTrust,0,100),energy=clamp(number(p.energy,85,0,100)+8*daysUntilMatch,0,100),injuryRemaining=Math.max(0,j.injuryDays-daysUntilMatch),quality=skills.reduce((s,k)=>s+number(p.skills?.[k],60,0,100),0)/4;
 const score=quality*.45+j.form*.2+trust*.2+energy*.15;
 const status=injuryRemaining>0||j.suspension>0||energy<25?'omitted':energy<35||score<60?'bench':'starter';
 const reason=injuryRemaining>0?'Matç gününə zədə tam sağalmayacaq; tibbi icazə yoxdur.':j.suspension>0?'Cəza səbəbilə bu matçı buraxırsan.':energy<25?'Matç günü üçün proqnozlaşdırılan enerji çox aşağıdır; məşqçi səni heyətə daxil etmir.':status==='bench'?'Matç gününün hazırlığına görə məşqçi səni ehtiyatda saxlayır; ikinci hissədə fürsət gözlə.':'Matç günü üçün planlaşdırılan forma, hazırlıq və etimad əsas heyətə kifayətdir.';
 j.selection={status,plannedEntryMinute:status==='bench'?(energy<45?75:65):null,projectedEnergy:energy,daysUntilMatch,reason};return j.selection;
}
function lineup(j,clubId,includeHero=false){
 const players=j.players.filter(p=>p.clubId===clubId&&p.id!==j.heroId&&p.injuryDays<=0&&p.suspension<=0),chosen=[];
 for(const [role,count] of [['GK',1],['DEF',4],['MID',3],['FWD',3]]){
  const group=players.filter(p=>p.role===role).sort((a,b)=>overall(b)-overall(a));
  if(includeHero&&j.activePosition===role){chosen.push(heroOf(j));chosen.push(...group.slice(0,count-1));}else chosen.push(...group.slice(0,count));
 }
 for(const candidate of players.sort((a,b)=>overall(b)-overall(a)))if(chosen.length<11&&!chosen.includes(candidate))chosen.push(candidate);
 return chosen.slice(0,11).sort((a,b)=>['GK',...roles].indexOf(a.role)-['GK',...roles].indexOf(b.role));
}
export function preparePlayerMatch(j,player,profile={}){
 if(j.retired)return {ok:false,message:'Futbolçu karyerası başa çatıb. İrs bölməsində nəticələrin qalır.'};
 if(!j.clubId)return {ok:false,message:'Hazırda azad agentsən. Agent bölməsindən klub təklifi al və müqavilə imzala.'};
 const fixture=getPlayerFixture(j);if(!fixture)return {ok:false,message:'Mövsüm bitib. Yeni mövsümə keç.'};
 syncHero(j,player,profile);const selection=select(j,player),own=lineup(j,j.clubId,selection.status==='starter');
 const opponent=j.clubs.find(c=>c.id===(fixture.homeClubId===j.clubId?fixture.awayClubId:fixture.homeClubId)),rival=lineup(j,opponent.id);
 const ownIds=new Set(own.map(p=>p.id));let bench=j.players.filter(p=>p.clubId===j.clubId&&!ownIds.has(p.id)&&p.id!==j.heroId&&p.injuryDays<=0&&p.suspension<=0).sort((a,b)=>overall(b)-overall(a)).slice(0,selection.status==='bench'?6:7);
 if(selection.status==='bench')bench=[heroOf(j),...bench];
 if(own.length!==11||rival.length!==11)return {ok:false,message:'Matç üçün hər iki komandada 11 uyğun futbolçu lazımdır.'};
 return {ok:true,fixture,club:clone(j.clubs.find(c=>c.id===j.clubId)),opponent:clone(opponent),selection:clone(selection),options:{mode:'player',formation:'4-3-3',position:j.activePosition,playerRoster:clone(own),playerBench:clone(bench),opponentRoster:clone(rival),playerFixtureId:fixture.id,playerHeroId:j.heroId,playerSelection:selection.status,playerEntryMinute:selection.plannedEntryMinute,playerExitMinute:selection.status==='starter'&&selection.projectedEnergy<45?65:null,playerUserClubId:j.clubId,playerUserIsHome:fixture.homeClubId===j.clubId,playerWorldSeason:j.season,playerClubName:j.clubs.find(c=>c.id===j.clubId).name,playerOpponentName:opponent.name,playerAttributes:{...player.skills,energy:player.energy,fitness:player.fitness}}};
}
export function beginPlayerFixture(j,player={}){const fixture=getPlayerFixture(j);if(!fixture)return {ok:false,message:'Növbəti matç tapılmadı.'};if(j.pendingFixtureId&&j.pendingFixtureId!==fixture.id)return {ok:false,message:'Əvvəlcə davam edən matçı bitir.'};j.pendingFixtureId=fixture.id;const target=fixture.absoluteDay;j.day=Math.max(j.day,target);return {ok:true,fixture,context:{kind:'begin_match',advanceDays:Math.max(0,target-integer(player.day,j.day,1))}};}
function award(j,id,title,value=0){if(!j.milestones.some(m=>m.id===id))j.milestones.unshift({id,title,value,season:j.season,round:j.round});}
function updateStats(stats,entry){if(entry.minutes<=0)return;const old=stats.appearances;stats.appearances++;for(const k of ['minutes','goals','assists','yellow','red'])stats[k]+=number(entry[k],0,0,k==='minutes'?150:20);stats.rating=(stats.rating*old+entry.rating)/stats.appearances;}
function expireOffers(j){for(const offer of j.offers)if(offer.status==='pending'&&(offer.expiresSeason<j.season||offer.expiresSeason===j.season&&offer.expiresRound<j.round))offer.status='expired';}
export function finishPlayerFixture(j,player,engine){
 const report=engine?.playerMatchReport??engine,fixtureId=engine?.options?.playerFixtureId??report?.fixtureId??j.pendingFixtureId;
 const fixture=j.fixtures.find(f=>f.id===fixtureId),next=getPlayerFixture(j);
 if(!fixture||fixture.played||j.completedFixtureIds.includes(fixtureId)||next?.id!==fixtureId)return {ok:false,message:'Bu matç artıq qeydə alınıb və ya təqvimə uyğun deyil.'};
 if(report?.state&&report.state!=='FULL_TIME'||report?.completed===false)return {ok:false,message:'Matç hələ bitməyib.'};
 if(!Array.isArray(report?.score)||report.score.length!==2||report.score.some(s=>!Number.isFinite(s)||s<0||s>20))return {ok:false,message:'Hesab düzgün deyil.'};
 const score=report.score.map(Math.floor),ledger=Array.isArray(report.players)?report.players:[],raw=ledger.find(p=>(p.persistentId??p.id)===j.heroId)??report.hero??{};
 const hero={minutes:number(raw.minutes,0,0,150),goals:integer(raw.goals,0,0,20),assists:integer(raw.assists,0,0,20),yellow:integer(raw.yellow,0,0,2),red:raw.red||raw.sentOff?1:0,rating:number(raw.rating,6.5,1,10)};
 if(j.selection.status==='omitted')for(const k of ['minutes','goals','assists','yellow','red'])hero[k]=0;
 if(hero.minutes===0){hero.goals=0;hero.assists=0;hero.rating=6.5;}
 for(const person of j.players){const entry=ledger.find(p=>(p.persistentId??p.id)===person.id);if(entry&&person.id!==j.heroId)updateStats(person.statistics,{...entry,rating:number(entry.rating,6.5,1,10),red:entry.red||entry.sentOff?1:0});}
 updateStats(j.seasonStats,hero);updateStats(j.careerStats,hero);
 if(j.suspension>0)j.suspension--;if(hero.red)j.suspension=Math.max(j.suspension,hero.yellow>=2?1:2);
 if(hero.minutes>0){j.skillPoints+=(hero.minutes>=15?1:0)+(hero.minutes>=30&&hero.rating>=8?1:0);j.form=clamp(j.form*.75+(hero.rating*10)*.25,0,100);award(j,'debut','Peşəkar debüt',1);if(hero.goals)award(j,'first_goal','İlk peşəkar qol',1);if(hero.assists)award(j,'first_assist','İlk assist',1);if(j.careerStats.appearances>=10)award(j,'ten_matches','On peşəkar matç',10);if(j.careerStats.goals>=20)award(j,'twenty_goals','İyirmi karyera qolu',20);}
 if(hero.minutes>0){const change=(hero.rating-6)*2.5-(hero.red?5:0);j.coachTrust=clamp(number(j.life?.coachTrust,j.coachTrust,0,100)+change,0,100);if(j.life)j.life.coachTrust=j.coachTrust;}
 j.records.bestMatchGoals=Math.max(j.records.bestMatchGoals,hero.goals);j.records.bestRating=Math.max(j.records.bestRating,hero.rating);
 fixture.score=fixture.homeClubId===j.clubId?score:[score[1],score[0]];fixture.played=true;
 for(const other of j.fixtures.filter(f=>f.round===fixture.round&&!f.played)){other.score=simulateScore(j,other.homeClubId,other.awayClubId);other.played=true;}
 const opponentId=fixture.homeClubId===j.clubId?fixture.awayClubId:fixture.homeClubId,result=score[0]>score[1]?'win':score[0]===score[1]?'draw':'loss';
 j.history.unshift({fixtureId,season:j.season,round:fixture.round,clubId:j.clubId,opponentId,score, ...hero,result});j.history=j.history.slice(0,100);j.completedFixtureIds.push(fixtureId);j.completedFixtureIds=j.completedFixtureIds.slice(-2000);j.pendingFixtureId=null;j.round=fixture.round+1;j.day=Math.max(integer(player.day,1,1),j.seasonStartDay+fixture.day+1);expireOffers(j);
 if(j.round===14){const standing=getPlayerStandings(j).find(row=>row.clubId===j.clubId);if(standing?.position===1){j.records.trophies++;award(j,`champion-s${j.season}`,'Liqa çempionu',j.season);}if(j.seasonStats.appearances>=10&&j.seasonStats.rating>=7.5)award(j,`season-star-s${j.season}`,'Mövsümün yüksələn ulduzu',j.season);}
 log(j,`${score.join('–')} · ${hero.minutes.toFixed(1)} dəqiqə, ${hero.goals} qol, ${hero.assists} assist.`, 'match');
 return {ok:true,message:`Tur ${j.round}/14 qeydə alındı. ${hero.minutes>0?`Reytinq ${hero.rating.toFixed(1)}; inkişaf xalı qazanıldı.`:'Bu matçda meydanda olmadın; oyunda iştirak bonusu və inkişaf xalı yoxdur.'}`,fixture:clone(fixture),result,context:{kind:'match',fixtureId,score,result,...hero,selection:j.selection.status,advanceDays:Math.max(0,j.day-integer(player.day,1,1))}};
}
function teamStrength(j,clubId){const team=lineup(j,clubId,clubId===j.clubId&&j.selection.status==='starter');return team.reduce((sum,p)=>sum+overall(p)+(p.id===j.heroId?(j.form-50)*.08:0),0)/Math.max(1,team.length);}
function simulateScore(j,homeId,awayId){const home=teamStrength(j,homeId)+2,away=teamStrength(j,awayId);let a=0,b=0;for(let chance=0;chance<8;chance++){if(random(j)<clamp(.2+(home-away)*.007,.06,.44))a++;if(random(j)<clamp(.2+(away-home)*.007,.06,.44))b++;}return [a,b];}
function simulateFixture(j,player,profile){
 const prepared=preparePlayerMatch(j,player,profile);if(!prepared.ok)return prepared;
 const fixture=prepared.fixture;beginPlayerFixture(j,player);const homeScore=simulateScore(j,fixture.homeClubId,fixture.awayClubId),score=fixture.homeClubId===j.clubId?homeScore:[homeScore[1],homeScore[0]];
 const heroMinutes=prepared.selection.status==='starter'?(prepared.options.playerExitMinute??90):prepared.selection.status==='bench'?90-prepared.selection.plannedEntryMinute:0;
 const played=[...prepared.options.playerRoster,...prepared.options.opponentRoster].map((p,index)=>({persistentId:p.id,team:index<11?0:1,minutes:90,goals:0,assists:0,yellow:0,red:0,rating:clamp(6+(score[index<11?0:1]-score[index<11?1:0])*.2,4,8),fitness:p.fitness}));
 let ownHero=played.find(p=>p.persistentId===j.heroId);if(!ownHero&&heroMinutes>0){ownHero={persistentId:j.heroId,team:0,minutes:heroMinutes,goals:0,assists:0,yellow:0,red:0,rating:6.5};played.push(ownHero);const replaced=played.find(p=>p.team===0&&j.players.find(person=>person.id===p.persistentId)?.role===j.activePosition);if(replaced)replaced.minutes=90-heroMinutes;}
 if(ownHero)ownHero.minutes=heroMinutes;
 for(const team of [0,1]){const candidates=played.filter(p=>p.team===team&&p.minutes>0&&j.players.find(person=>person.id===p.persistentId)?.role!=='GK');for(let goal=0;goal<score[team];goal++){const scorer=candidates[Math.floor(random(j)*candidates.length)];if(scorer){scorer.goals++;scorer.rating=clamp(scorer.rating+.8,1,10);const assister=candidates.filter(p=>p!==scorer)[Math.floor(random(j)*Math.max(1,candidates.length-1))];if(assister){assister.assists++;assister.rating=clamp(assister.rating+.4,1,10);}}}}
 return finishPlayerFixture(j,player,{fixtureId:fixture.id,state:'FULL_TIME',completed:true,score,players:played});
}
function makeOffer(j,club,kind,player){const quality=skills.reduce((s,k)=>s+number(player.skills?.[k],60,0,100),0)/4;return {id:`player-offer-${j.season}-${++j.sequence}`,clubId:club.id,kind,salary:Math.round(350+quality*5+club.reputation*6+number(player.reputation,10,0,100)*4),signingBonus:kind==='loan'?0:Math.round(200+club.reputation*6),expiresRound:j.round+2,expiresSeason:j.season,contractUntilSeason:j.season+2,status:'pending'};}
export function playerWorldAction(j,player,action,payload={},profile={}){
 if(!j||j.version!==1)return {ok:false,message:'Futbolçu karyerası tapılmadı.'};
 if(j.retired)return {ok:false,message:'Karyera artıq başa çatıb. İrsin və rekordların saxlanılır.'};
 expireOffers(j);
 if(j.pendingFixtureId&&action!=='active_position')return {ok:false,message:'Əvvəlcə davam edən matçı tamamla.'};
 if(action==='simulate')return simulateFixture(j,player,profile);
 if(action==='spend_skill'){if(!skills.includes(payload.skill)||j.skillPoints<1)return {ok:false,message:'Bacarıq seç və ən azı bir inkişaf xalı qazan.'};if(number(player.skills?.[payload.skill],60)>=100)return {ok:false,message:'Bu bacarıq artıq maksimumdadır.'};j.skillPoints--;player.skills[payload.skill]=clamp(number(player.skills[payload.skill],60)+2,0,100);syncHero(j,player,profile);return {ok:true,message:'İnkişaf xalı bacarığa çevrildi: +2.',context:{kind:'development'}};}
 if(action==='unlock_position'){const position=payload.position;if(!roles.includes(position)||j.positions.includes(position))return {ok:false,message:'Yeni və uyğun mövqe seç.'};if(j.skillPoints<PLAYER_POSITION_COST)return {ok:false,message:'Yeni mövqe üçün üç inkişaf xalı lazımdır.'};j.skillPoints-=PLAYER_POSITION_COST;j.positions.push(position);return {ok:true,message:'Yeni mövqe açıldı. İndi həmin rolda oynaya bilərsən.',context:{kind:'development'}};}
 if(action==='active_position'){if(!j.positions.includes(payload.position)||j.pendingFixtureId)return {ok:false,message:'Yalnız açılmış mövqeyi matçdan əvvəl seçə bilərsən.'};j.activePosition=payload.position;syncHero(j,player,profile);return {ok:true,message:'Matç mövqeyin dəyişdi.'};}
 if(['request_transfer','request_loan','renew_contract'].includes(action)){
  if(j.lastMoveKey===`${j.season}:${j.round}`)return {ok:false,message:'Bu turda artıq müqavilə imzalamısan. Növbəti matçı tamamla.'};
  if(j.contract.parentClubId)return {ok:false,message:'İcarə müqaviləsi bitənədək klub dəyişikliyi gözləməlidir.'};
  if(action==='request_loan'&&!j.clubId)return {ok:false,message:'Azad agent icarəyə verilə bilməz; əvvəlcə klubla müqavilə imzala.'};
  if(action==='renew_contract'&&!j.clubId)return {ok:false,message:'Yenilənəcək klub müqavilən yoxdur.'};
  if(j.clubId&&action!=='renew_contract'&&j.round>3&&j.round<7||j.clubId&&action!=='renew_contract'&&j.round>10)return {ok:false,message:'Transfer pəncərəsi bağlıdır. 1–4 və 8–11-ci turlarda müraciət et.'};
  const key=j.clubId?`${j.season}:${j.round}`:`${j.season}:free:${integer(player.day,1,1)}`;
  if(j.lastMarketKey===key||j.offers.some(o=>o.status==='pending'))return {ok:false,message:'Mövcud təkliflərə qərar ver; agent bu tur üçün artıq müraciət edib.'};
  j.lastMarketKey=key;expireOffers(j);
  const ability=skills.reduce((s,k)=>s+number(player.skills?.[k],60,0,100),0)/4*.6+number(player.reputation,10,0,100)*.3+j.form*.1;
  const candidates=action==='renew_contract'?j.clubs.filter(c=>c.id===j.clubId):j.clubs.filter(c=>c.id!==j.clubId&&c.reputation*.65<=ability).sort((a,b)=>b.reputation-a.reputation).slice(0,3);
  if(!candidates.length)return {ok:false,message:'Hazırkı forma və nüfuzuna uyğun təklif gəlmədi. Məşqə və matçlara davam et.'};
  const kind=action==='renew_contract'?'renewal':action==='request_loan'?'loan':'transfer';j.offers.unshift(...candidates.map(c=>makeOffer(j,c,kind,player)));j.offers=j.offers.slice(0,40);log(j,`${candidates.length} klubdan müqavilə təklifi gəldi. Şərtləri və son tarixi yoxla.`,'offer');return {ok:true,message:`${candidates.length} klub təklifi gəldi.`,context:{kind:'offers',advanceDays:j.clubId?0:1}};
 }
 if(action==='accept_offer'||action==='reject_offer'){
  expireOffers(j);const offer=j.offers.find(o=>o.id===payload.offerId);if(!offer||offer.status!=='pending')return {ok:false,message:'Bu təklif açıq deyil və ya vaxtı keçib.'};
  if(action==='reject_offer'){offer.status='rejected';return {ok:true,message:'Təklif rədd edildi.'};}
  if(j.lastMoveKey===`${j.season}:${j.round}`)return {ok:false,message:'Bu tur üçün klub qərarın artıq verilib.'};
  const oldClubId=j.clubId,parent=offer.kind==='loan'?oldClubId:null;
  if(offer.kind==='loan'&&!oldClubId)return {ok:false,message:'İcarə üçün ana klub müqaviləsi lazımdır.'};
  offer.status='accepted';for(const other of j.offers)if(other.id!==offer.id&&other.status==='pending')other.status='rejected';
  j.clubId=offer.clubId;j.contract={clubId:j.clubId,salary:offer.salary,expiresSeason:offer.contractUntilSeason,role:'rotation',parentClubId:parent,loanUntilSeason:parent?j.season:null,parentExpiresSeason:parent?j.contract.expiresSeason:null,parentSalary:parent?j.contract.salary:null};player.salary=offer.salary;player.balance=integer(player.balance)+offer.signingBonus;j.lastMoveKey=`${j.season}:${j.round}`;j.selection={status:'bench',plannedEntryMinute:65,reason:'Yeni klubda etimad qazanmaq lazımdır.'};syncHero(j,player,profile);
  const club=j.clubs.find(c=>c.id===j.clubId);log(j,`${club.name} ilə ${offer.kind==='loan'?'icarə':'klub'} müqaviləsi imzalandı. Maaş €${offer.salary}.`,'transfer');return {ok:true,message:`${club.name} klubuna qoşuldun. İmza bonusu €${offer.signingBonus}.`,context:{kind:'transfer',fromClubId:oldClubId,clubId:j.clubId,loan:!!parent}};
 }
 if(action==='next_season'){
  if(j.clubId&&getPlayerFixture(j))return {ok:false,message:'Cari mövsümün matçları bitməyib.'};
  if(!j.clubId&&j.round<14)return {ok:false,message:'Azad agent kimi əvvəlcə yeni klub tap.'};
  const oldSeason=j.season;j.season++;j.round=0;j.age++;j.seasonStartDay=integer(player.day,j.day,1)+13;j.day=j.seasonStartDay+1;j.fixtures=schedule(j.clubs,j.season);j.seasonStats=statsOf(null);j.pendingFixtureId=null;j.lastMarketKey=null;j.lastMoveKey=null;j.offers=[];j.suspension=0;j.form=clamp(j.form*.75+16.25,0,100);
  for(const person of j.players)if(person.id!==j.heroId){person.age++;if(person.age>32)person.attributes.pace=clamp(person.attributes.pace-1,20,99);person.suspension=0;person.injuryDays=0;}
  if(j.contract.parentClubId&&j.contract.loanUntilSeason<=oldSeason){j.clubId=j.contract.parentClubId;j.contract={clubId:j.clubId,salary:integer(j.contract.parentSalary,integer(player.salary,700),0,100000),expiresSeason:integer(j.contract.parentExpiresSeason,j.season,0,200),role:'rotation',parentClubId:null,loanUntilSeason:null};player.salary=j.contract.salary;log(j,'İcarə bitdi; ana klubuna qayıtdın.','loan_return');}
  if(j.contract.expiresSeason<j.season){j.clubId=null;j.contract={clubId:null,salary:0,expiresSeason:j.season-1,role:'rotation',parentClubId:null,loanUntilSeason:null};player.salary=0;log(j,'Müqavilən bitdi. Azad agentsən; agentindən yeni təkliflər istə.','free_agent');}
  syncHero(j,player,profile);log(j,`${j.age} yaşında ${j.season}-ci mövsümün başlayır.`,'season');return {ok:true,message:j.clubId?'Yeni mövsüm başladı.':'Yeni mövsüm: müqavilən bitdi, azad agentsən.',context:{kind:'season',advanceDays:14}};
 }
 if(action==='retire'){
  if(j.age<30&&j.careerStats.appearances<100)return {ok:false,message:'Karyeranı bitirmək 30 yaşdan və ya 100 peşəkar matçdan sonra mümkündür.'};
  player.salary=0;j.contract.salary=0;j.contract.expiresSeason=j.season-1;
  j.retired=true;award(j,'retired','Karyera tamamlandı',j.careerStats.appearances);log(j,'Karyeranı tamamladın. Matçlar, nailiyyətlər və rekordlar irsində qalır.','retirement');return {ok:true,message:'Karyeran başa çatdı. İrsin saxlanıldı.',context:{kind:'retirement'}};
 }
 return {ok:false,message:'Bu futbolçu qərarı tanınmır.'};
}
