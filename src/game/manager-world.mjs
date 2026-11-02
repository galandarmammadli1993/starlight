/** Persistent fictional football world. No DOM, network, licensed names or wall-clock randomness. */
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const n=(v,d=0,a=0,b=1e9)=>typeof v==='number'&&Number.isFinite(v)?clamp(v,a,b):d;
const int=(v,d=0,a=0,b=1e9)=>Math.floor(n(v,d,a,b));
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const text=(v,d='',limit=100)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,limit):d;
const clone=v=>structuredClone(v);
const FORMATIONS={'4-3-3':[4,3,3],'4-4-2':[4,4,2],'4-2-3-1':[4,5,1],'3-5-2':[3,5,2]};
const TACTICS=['balanced','press','wide','counter'];
const CLUBS=[['baku','Baku Athletic','BAK'],['coast','Coast United','COA'],['caspian','Caspian Rovers','CAS'],['highland','Highland FC','HIG'],['harbor','Harbor City','HAR'],['forest','Forest Sporting','FOR'],['riverside','Riverside AFC','RIV'],['sunrise','Sunrise Academy','SUN']];
const FIRST=['Araz','Murad','Elvin','Kamal','Rauf','Tural','Nihad','Orxan','Emin','Samir','Javid','Farid','Ali','Ramil','Rashad','Vugar','Ilkin','Adil','Togrul','Emil','Nurlan','Anar','Leon','Mateo','Alex','Lucas','Omar','Marco','Daniel','Adam','Ilyas','Niko'];
const LAST=['Karimli','Rzayev','Mammadov','Aliyev','Huseynli','Safarov','Qasimov','Ismayilov','Suleymanov','Rahimli','Nazarov','Aslanov','Reid','Silva','Costa','Marin','Kovac','Diaz','Ward','Cole','Stone','Park','Santos','Blake'];
export const MANAGER_WORLD_VERSION=1;
export const MANAGER_FORMATIONS=Object.keys(FORMATIONS);
function mixSeed(value){let v=int(value,27,0,0xffffffff)>>>0;v=Math.imul(v^(v>>>16),0x7feb352d);v=Math.imul(v^(v>>>15),0x846ca68b);return (v^(v>>>16))>>>0;}
function rand(world){world.rng=(Math.imul(int(world.rng,27,0,0xffffffff),1664525)+1013904223)>>>0;return world.rng/4294967296;}
function seeded(seed){let state=int(seed,27,0,0xffffffff)>>>0;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}
function skill(p,key){return n(p.attributes?.[key],60,1,99);}
export function playerOverall(p){return Math.round((skill(p,'pace')+skill(p,'passing')+skill(p,'shooting')+skill(p,'defending'))/4);}
export function getPlayer(world,id){return world.players.find(p=>p.id===id)??null;}
export function getClubPlayers(world,clubId=world.userClubId){return world.players.filter(p=>p.clubId===clubId);}
function log(world,message,kind='club',extra={}){world.inbox.unshift({id:`note-${world.season}-${++world.sequence}`,day:world.day,kind,message,...extra});world.inbox=world.inbox.slice(0,120);}
function ledger(world,amount,description){world.budget=Math.round(world.budget+amount);const club=world.clubs.find(c=>c.id===world.userClubId);if(club)club.budget=world.budget;world.ledger.unshift({id:`ledger-${world.season}-${++world.sequence}`,day:world.day,amount,balance:world.budget,description});world.ledger=world.ledger.slice(0,100);}
function generatePlayer(clubId,index,clubIndex,rng,id=null){
 const role=index<2?'GK':index<10?'DEF':index<17?'MID':'FWD';
 const ages=[33,20,31,29,25,22,19,18,27,23,34,28,24,21,18,20,30,29,26,22,19,17];
 const age=clamp(ages[index%22]+((clubIndex%3)-1),17,36);
 const star=index===12||index===18,veteran=age>=30,quality=star?76+Math.floor(rng()*7):54+Math.floor(rng()*20)+(veteran?3:0);
 const attrs={pace:clamp(quality+(age<24?7:age>31?-10:0),32,92),passing:clamp(quality+(role==='MID'?8:0),30,92),shooting:clamp(quality+(role==='FWD'?9:role==='GK'?-20:-7),20,93),defending:clamp(quality+(role==='DEF'||role==='GK'?9:-7),25,94)};
 const potential=clamp(quality+(age<23?12+Math.floor(rng()*8):3),quality,95);
 return {id:id??`${clubId}-p${String(index+1).padStart(2,'0')}`,clubId,name:`${FIRST[(index+clubIndex*5)%FIRST.length]} ${LAST[(index*3+clubIndex*7)%LAST.length]}`,number:index+1,age,role,attributes:attrs,potential,dominantFoot:index%5===0?'left':'right',fitness:82+Math.floor(rng()*15),fatigue:5+Math.floor(rng()*12),morale:65+Math.floor(rng()*18),confidence:61+Math.floor(rng()*20),trust:62+Math.floor(rng()*15),injuryDays:0,suspension:0,value:Math.round((quality*quality*18+(potential-quality)*1400)*(age<23?1.2:age>31?.65:1)),wage:250+Math.round(quality*6+(star?180:0)),contractEnd:2+Math.floor(rng()*2),status:star?'star':age<=21?'prospect':veteran?'veteran':'rotation',group:age<=22?'young':veteran?'veterans':index%3===0?'international':'core',psych:{ego:star?86:35+Math.floor(rng()*35),professionalism:veteran?82:45+Math.floor(rng()*42),ambition:age<=22?82:star?88:58,loyalty:48+Math.floor(rng()*37),leadership:veteran?82:star?68:30+Math.floor(rng()*30),influence:star?89:veteran?77:age<=21?32:54,experience:clamp((age-16)*4,8,90),temperament:index%6===0?77:40+Math.floor(rng()*25),minutesExpected:star?80:veteran?55:age<=21?25:45,stress:15,disciplineRecord:0,promises:[]},statistics:{appearances:0,goals:0,assists:0,minutes:0,yellow:0,red:0,rating:6.5}};
}
function schedule(clubs,season=1){
 const rotation=clubs.map(c=>c.id),result=[];
 for(let round=0;round<7;round++){
  for(let j=0;j<4;j++){
   const a=rotation[j],b=rotation[7-j],home=(round+j)%2?a:b,away=home===a?b:a;
   result.push({id:`s${season}-r${round+1}-${home}-${away}`,season,round,day:4+round*7,homeClubId:home,awayClubId:away,score:null,played:false});
  }
  rotation.splice(1,0,rotation.pop());
 }
 for(const first of [...result])result.push({id:`s${season}-r${first.round+8}-${first.awayClubId}-${first.homeClubId}`,season,round:first.round+7,day:4+(first.round+7)*7,homeClubId:first.awayClubId,awayClubId:first.homeClubId,score:null,played:false});
 return result.sort((a,b)=>a.round-b.round||a.id.localeCompare(b.id));
}
function available(p){return p.injuryDays<=0&&p.suspension<=0;}
function roleOrder(p){return ['GK','DEF','MID','FWD'].indexOf(p.role);}
function autoLineup(world,clubId,formation='4-3-3'){
 const counts=[1,...(FORMATIONS[formation]??FORMATIONS['4-3-3'])],roles=['GK','DEF','MID','FWD'],players=getClubPlayers(world,clubId).filter(available),chosen=[];
 for(let i=0;i<roles.length;i++){
  const group=players.filter(p=>p.role===roles[i]).sort((a,b)=>(playerOverall(b)+b.fitness*.05-b.fatigue*.12)-(playerOverall(a)+a.fitness*.05-a.fatigue*.12));
  chosen.push(...group.slice(0,counts[i]));
 }
 for(const p of players.sort((a,b)=>playerOverall(b)-playerOverall(a)))if(chosen.length<11&&!chosen.includes(p))chosen.push(p);
 return chosen.slice(0,11).sort((a,b)=>roleOrder(a)-roleOrder(b)).map(p=>p.id);
}
function repairSelection(world){
 const user=getClubPlayers(world),ids=new Set(user.map(p=>p.id));
 world.lineup=[...new Set(world.lineup??[])].filter(id=>ids.has(id)&&available(getPlayer(world,id))).slice(0,11);
 if(world.lineup.length!==11||world.lineup.filter(id=>getPlayer(world,id).role==='GK').length!==1)world.lineup=autoLineup(world,world.userClubId,world.plan.formation);
 world.bench=[...new Set(world.bench??[])].filter(id=>ids.has(id)&&!world.lineup.includes(id)&&available(getPlayer(world,id))).slice(0,7);
 const candidates=user.filter(p=>available(p)&&!world.lineup.includes(p.id)&&!world.bench.includes(p.id)).sort((a,b)=>playerOverall(b)-playerOverall(a));
 for(const p of candidates)if(world.bench.length<7)world.bench.push(p.id);
}
export function createManagerWorld(seed=27,legacy={}){
 const rng=seeded(seed),clubs=CLUBS.map(([id,name,short],i)=>({id,name,short,budget:id==='baku'?int(legacy.budget,125000,0,1e9):100000+Math.floor(rng()*150000),reputation:62+i%4*4}));
 const players=clubs.flatMap((c,i)=>Array.from({length:22},(_,j)=>generatePlayer(c.id,j,i,rng)));
 const world={version:1,seed:int(seed,27,0,0xffffffff),rng:mixSeed(seed),season:1,day:1,round:0,userClubId:'baku',clubs,players,fixtures:schedule(clubs),lineup:[],bench:[],budget:clubs[0].budget,wageBudget:25000,plan:{formation:FORMATIONS[legacy.formation]?legacy.formation:'4-3-3',tactic:TACTICS.includes(legacy.tactic)?legacy.tactic:'balanced',trainingFocus:'balanced'},facilities:{academy:1,medical:1,training:1},scoutReports:[],inbox:[],ledger:[],completedMatchIds:[],sequence:0,activitiesSinceFixture:0,lastPaidRound:-1,boardConfidence:n(legacy.boardConfidence,65,0,100),supporterTrust:65,objectives:{targetPosition:4,youthMinutes:180,youthMinutesPlayed:0,completed:false},seasonHistory:[],pendingMatchId:null,transferLog:[],warnings:[],managerStatus:'employed'};
 repairSelection(world);log(world,'Kluba xoş gəlmisiniz. Mövsüm: 8 klub, 14 tur. Heyəti seçin və soyunub-geyinmə otağını tanıyın.','welcome');
 return world;
}
function normalizePlayer(raw,base){
 const p={...base,...clone(obj(raw))};
 p.id=text(p.id,base.id,70);p.name=text(p.name,base.name,60);p.clubId=text(p.clubId,base.clubId,30);p.role=['GK','DEF','MID','FWD'].includes(p.role)?p.role:base.role;
 for(const [key,def,lo,hi] of [['age',base.age,16,45],['number',base.number,1,99],['potential',base.potential,1,99],['fitness',90,0,100],['fatigue',10,0,100],['morale',70,0,100],['confidence',65,0,100],['trust',65,0,100],['value',50000,0,1e8],['wage',600,0,1e6],['contractEnd',2,0,100],['injuryDays',0,0,365],['suspension',0,0,20]])p[key]=n(p[key],def,lo,hi);
 p.attributes=Object.fromEntries(['pace','passing','shooting','defending'].map(k=>[k,n(p.attributes?.[k],base.attributes[k],1,99)]));
 p.psych={...base.psych,...obj(p.psych)};for(const k of ['ego','professionalism','ambition','loyalty','leadership','influence','experience','temperament','minutesExpected','stress'])p.psych[k]=n(p.psych[k],base.psych[k]??50,0,100);
 p.psych.disciplineRecord=int(p.psych.disciplineRecord,0,0,100);p.psych.promises=Array.isArray(p.psych.promises)?p.psych.promises.slice(-30):[];
 p.statistics={...base.statistics,...obj(p.statistics)};for(const k of ['appearances','goals','assists','yellow','red'])p.statistics[k]=int(p.statistics[k]);p.statistics.minutes=n(p.statistics.minutes,0,0,1e7);p.statistics.rating=n(p.statistics.rating,6.5,1,10);
 return p;
}
export function normalizeManagerWorld(value,legacy={}){
 if(!value||typeof value!=='object'||value.version!==1)return createManagerWorld(27,legacy);
 const base=createManagerWorld(value.seed??27,legacy),world={...base,...clone(value)};
 world.version=1;world.season=int(value.season,1,1,100);world.day=int(value.day,1,1,10000);world.round=int(value.round,0,0,14);world.seed=int(value.seed,27,0,0xffffffff);world.rng=int(value.rng,mixSeed(world.seed),0,0xffffffff);world.userClubId='baku';
 world.clubs=base.clubs.map(c=>({...c,...obj(value.clubs?.find(v=>v.id===c.id)),id:c.id,budget:int(value.clubs?.find(v=>v.id===c.id)?.budget,c.budget,0,1e9)}));
 const seen=new Set();world.players=(Array.isArray(value.players)?value.players:base.players).slice(0,600).filter(p=>p&&typeof p.id==='string'&&!seen.has(p.id)&&world.clubs.some(c=>c.id===p.clubId)&&(seen.add(p.id)||true)).map((p,i)=>normalizePlayer(p,base.players.find(b=>b.id===p.id)??generatePlayer(p.clubId,i,0,seeded(world.seed+i),p.id)));
 if(getClubPlayers(world).length<11){world.players=base.players;world.warnings=['Zədələnmiş heyət məlumatı bərpa edildi.'];}
 world.plan={formation:FORMATIONS[value.plan?.formation]?value.plan.formation:'4-3-3',tactic:TACTICS.includes(value.plan?.tactic)?value.plan.tactic:'balanced',trainingFocus:['balanced','attack','defence'].includes(value.plan?.trainingFocus)?value.plan.trainingFocus:'balanced'};
 const known=new Set(world.clubs.map(c=>c.id));
 const validFixtures=Array.isArray(value.fixtures)&&value.fixtures.length===56&&value.fixtures.every(f=>f&&known.has(f.homeClubId)&&known.has(f.awayClubId)&&f.homeClubId!==f.awayClubId&&Number.isInteger(f.round)&&f.round>=0&&f.round<14);
 world.fixtures=validFixtures?value.fixtures.map(f=>({...f,id:text(f.id,'',120),season:world.season,day:int(f.day,4+f.round*7,1,10000),played:!!f.played,score:Array.isArray(f.score)&&f.score.length===2?f.score.map(v=>int(v,0,0,20)):null})):schedule(world.clubs,world.season);
 world.budget=int(value.budget,base.budget,-1e7,1e9);world.wageBudget=int(value.wageBudget,25000,1000,1e7);world.sequence=int(value.sequence);world.activitiesSinceFixture=int(value.activitiesSinceFixture,0,0,3);world.lastPaidRound=int(value.lastPaidRound,-1,-1,14);world.boardConfidence=n(value.boardConfidence,65,0,100);world.supporterTrust=n(value.supporterTrust,65,0,100);
 world.objectives={targetPosition:int(value.objectives?.targetPosition,4,1,8),youthMinutes:int(value.objectives?.youthMinutes,180,0,30000),youthMinutesPlayed:n(value.objectives?.youthMinutesPlayed,0,0,1e7),completed:!!value.objectives?.completed};
 world.facilities=Object.fromEntries(['academy','medical','training'].map(k=>[k,int(value.facilities?.[k],1,1,10)]));
 world.lineup=Array.isArray(value.lineup)?value.lineup:[];world.bench=Array.isArray(value.bench)?value.bench:[];repairSelection(world);
 for(const [key,max]of [['scoutReports',40],['inbox',120],['ledger',100],['completedMatchIds',2000],['seasonHistory',30],['transferLog',80],['warnings',10]])world[key]=Array.isArray(value[key])?clone(value[key]).slice(key==='completedMatchIds'?-max:0,key==='completedMatchIds'?undefined:max):base[key];
 world.scoutReports=world.scoutReports.filter(r=>r&&typeof r==='object'&&Array.isArray(r.playerIds)).map(r=>({...r,id:text(r.id,'',120),day:int(r.day,1,1,10000),playerIds:r.playerIds.filter(id=>typeof id==='string'&&world.players.some(p=>p.id===id)).slice(0,12),players:Array.isArray(r.players)?r.players.filter(p=>p&&typeof p==='object'&&typeof p.playerId==='string').slice(0,12):[]}));
 world.inbox=world.inbox.filter(r=>r&&typeof r==='object').map(r=>({...r,id:text(r.id,'',120),kind:text(r.kind,'club',40),message:text(r.message,'',400),day:int(r.day,1,1,10000)}));
 world.ledger=world.ledger.filter(r=>r&&typeof r==='object').map(r=>({...r,amount:n(r.amount,0,-1e9,1e9),balance:n(r.balance,0,-1e9,1e9),day:int(r.day,1,1,10000),description:text(r.description,'',200)}));
 world.completedMatchIds=[...new Set(world.completedMatchIds.filter(id=>typeof id==='string').map(id=>id.slice(0,120)))];
 world.clubs.find(c=>c.id===world.userClubId).budget=world.budget;
 return world;
}
export function getNextFixture(world){return world.fixtures.find(f=>!f.played&&(f.homeClubId===world.userClubId||f.awayClubId===world.userClubId))??null;}
export function getStandings(world){
 const table=world.clubs.map(c=>({clubId:c.id,name:c.name,short:c.short,played:0,won:0,drawn:0,lost:0,gf:0,ga:0,gd:0,points:0}));
 for(const f of world.fixtures){if(!f.played||!f.score)continue;const a=table.find(t=>t.clubId===f.homeClubId),b=table.find(t=>t.clubId===f.awayClubId);a.played++;b.played++;a.gf+=f.score[0];a.ga+=f.score[1];b.gf+=f.score[1];b.ga+=f.score[0];if(f.score[0]>f.score[1]){a.won++;b.lost++;a.points+=3;}else if(f.score[0]<f.score[1]){b.won++;a.lost++;b.points+=3;}else{a.drawn++;b.drawn++;a.points++;b.points++;}}
 for(const t of table)t.gd=t.gf-t.ga;
 return table.sort((a,b)=>b.points-a.points||b.gd-a.gd||b.gf-a.gf||a.name.localeCompare(b.name)).map((t,i)=>({...t,position:i+1}));
}
export function selectLineup(world,playerId,replaceId=null){
 if(world.pendingMatchId)return {ok:false,message:'Matç davam edir. Dəyişiklikləri matç daxilində edin.'};
 const player=getPlayer(world,playerId);if(!player||player.clubId!==world.userClubId)return {ok:false,message:'Bu oyunçu heyətinizdə deyil.'};
 if(!available(player))return {ok:false,message:player.injuryDays?'Oyunçu zədəlidir.':'Oyunçu cəzalıdır.'};
 if(world.lineup.includes(playerId))return {ok:true,message:'Oyunçu artıq əsas heyətdədir.'};
 const current=replaceId?getPlayer(world,replaceId):world.lineup.map(id=>getPlayer(world,id)).filter(p=>p.role===player.role).sort((a,b)=>playerOverall(a)-playerOverall(b))[0];
 if(!current||current.role!==player.role||!world.lineup.includes(current.id))return {ok:false,message:'Eyni mövqedə əsas heyət oyunçusu seçin.'};
 const index=world.lineup.indexOf(current.id);world.lineup[index]=playerId;world.bench=world.bench.filter(id=>id!==playerId);if(!world.bench.includes(current.id))world.bench.unshift(current.id);world.bench=world.bench.slice(0,7);repairSelection(world);
 log(world,`${player.name} əsas heyətə, ${current.name} ehtiyata keçirildi.`,'lineup');
 return {ok:true,message:`${player.name} əsas heyətdədir.`,context:{kind:'selection',playerId,removedPlayerId:current.id}};
}
export function prepareManagerMatch(world){
 const fixture=getNextFixture(world);if(!fixture)return {ok:false,message:'Mövsüm bitib. Yeni mövsümə keçin.'};
 repairSelection(world);if(world.lineup.length<11)return {ok:false,message:'11 uyğun oyunçu yoxdur. Ehtiyat/youth və ya transferdən istifadə edin.'};
 const opponentId=fixture.homeClubId===world.userClubId?fixture.awayClubId:fixture.homeClubId;
 const opponentIds=autoLineup(world,opponentId,'4-3-3');if(opponentIds.length<11)return {ok:false,message:'Rəqib heyəti tam deyil.'};
 const team=world.lineup.map(id=>getPlayer(world,id)),avg=key=>team.reduce((a,p)=>a+n(p[key],70,0,100),0)/team.length;
 const copy=p=>({...clone(p),stamina:clamp(p.fitness-p.fatigue*.55,20,100)});
 return {ok:true,fixture:clone(fixture),opponent:clone(world.clubs.find(c=>c.id===opponentId)),userClub:clone(world.clubs.find(c=>c.id===world.userClubId)),options:{mode:'manager',formation:world.plan.formation,managerRoster:team.map(copy),managerBench:world.bench.map(id=>copy(getPlayer(world,id))),opponentRoster:opponentIds.map(id=>copy(getPlayer(world,id))),managerFixtureId:fixture.id,managerUserClubId:world.userClubId,managerUserIsHome:fixture.homeClubId===world.userClubId,managerHomeIsUser:fixture.homeClubId===world.userClubId,managerOpponentName:world.clubs.find(c=>c.id===opponentId).name,managerOpponentClubId:opponentId,managerWorldSeason:world.season,teamAttributes:{fitness:avg('fitness'),morale:avg('morale'),confidence:avg('confidence'),passing:team.reduce((a,p)=>a+skill(p,'passing'),0)/11,shooting:team.reduce((a,p)=>a+skill(p,'shooting'),0)/11,defending:team.reduce((a,p)=>a+skill(p,'defending'),0)/11}}};
}
export function beginManagerFixture(world,fixtureId=null){const f=getNextFixture(world);if(!f||fixtureId&&f.id!==fixtureId)return {ok:false,message:'Uyğun növbəti matç yoxdur.'};if(world.pendingMatchId&&world.pendingMatchId!==f.id)return {ok:false,message:'Başqa matç davam edir.'};world.day=Math.max(world.day,f.day);world.pendingMatchId=f.id;return {ok:true,fixture:f};}
function teamStrength(world,clubId,ids=null){
 const players=(ids??autoLineup(world,clubId)).map(id=>getPlayer(world,id)).filter(Boolean);
 if(!players.length)return 20;
 return players.reduce((sum,p)=>{
  // Focus, cooperation and composure are refreshed by the psychology layer before
  // simulation. Their combined influence is deliberately small (maximum ±3).
  const psych=p.psychMatch??{},mental=clamp((n(psych.focus,60,0,100)-60)*.025+(n(psych.cooperation,60,0,100)-60)*.025+(n(psych.composure,60,0,100)-60)*.02,-3,3);
  return sum+playerOverall(p)*(.65+p.fitness*.002-p.fatigue*.0015)+(p.morale-50)*.035+(p.confidence-50)*.025+(p.trust-50)*.02+mental;
 },0)/players.length;
}
function simulatedScore(world,a,b){
 const sa=teamStrength(world,a,a===world.userClubId?world.lineup:null),sb=teamStrength(world,b,b===world.userClubId?world.lineup:null);
 const chance=(strength,opponent)=>clamp(.22+(strength-opponent)*.007,.08,.45);
 let ga=0,gb=0;for(let i=0;i<8;i++){if(rand(world)<chance(sa+2,sb))ga++;if(rand(world)<chance(sb,sa+2))gb++;}return [ga,gb];
}
function resultPlayers(world,report,fixture,userScore){
 const starters=new Set(world.lineup),reportPlayers=Array.isArray(report.players)?report.players.filter(p=>p.team===0):[],simulated=!Array.isArray(report.players),played=new Set(),cards=[],playerMinutes={};
 for(const p of getClubPlayers(world)){
  if(p.suspension>0)p.suspension--;
  if(p.injuryDays>0)p.injuryDays=Math.max(0,p.injuryDays-7);
  const ep=reportPlayers.find(e=>(e.persistentId??e.clubPlayerId??e.rosterId)===p.id);
  const mins=simulated?(starters.has(p.id)?90:0):ep?clamp(n(ep.minutes, n(ep.minutesPlayed,0)),0,150):0;
  playerMinutes[p.id]=mins;
  if(mins<=0){p.fatigue=clamp(p.fatigue-10,0,100);continue;}
  played.add(p.id);p.statistics.appearances++;p.statistics.minutes+=mins;
  p.fatigue=clamp(p.fatigue+(18+(p.age>31?6:0))*Math.min(1,mins/90),0,100);
  p.fitness=clamp(simulated?p.fitness-5:n(ep.fitness,p.fitness-5,10,100),10,100);
  const scored=simulated?0:int(ep.goals,0,0,20),assists=simulated?0:int(ep.assists,0,0,20);
  p.statistics.goals+=scored;p.statistics.assists+=assists;
  const rating=clamp(simulated?6+(userScore[0]-userScore[1])*.25+(p.morale-50)*.005:n(ep.rating,6.5,1,10),1,10);
  p.statistics.rating=Math.round((p.statistics.rating*(p.statistics.appearances-1)+rating)/p.statistics.appearances*10)/10;
  p.morale=clamp(p.morale+(userScore[0]>userScore[1]?5:userScore[0]===userScore[1]?0:-6),0,100);p.confidence=clamp(p.confidence+(rating-6)*2,0,100);
  if(ep?.yellow){p.statistics.yellow+=int(ep.yellow,0,0,2);cards.push({playerId:p.id,type:'yellow'});}
  if(ep?.red||ep?.sentOff){p.statistics.red++;p.suspension=Math.max(p.suspension,ep.yellow>=2?1:2);cards.push({playerId:p.id,type:'red'});}
  if(ep?.injured){p.injuryDays=Math.max(p.injuryDays,int(ep.injuryDays,7,1,365));log(world,`${p.name}: ${p.injuryDays} günlük zədə.`,'injury',{playerId:p.id});}
  if(simulated&&rand(world)<.045){p.statistics.yellow++;cards.push({playerId:p.id,type:'yellow'});if(p.psych.temperament>70&&rand(world)<.2){p.statistics.red++;p.suspension=2;cards.push({playerId:p.id,type:'red'});}}
  if(simulated&&rand(world)<.018*(p.fatigue>65?2:1)){p.injuryDays=4+Math.floor(rand(world)*8);log(world,`${p.name}: ${p.injuryDays} günlük yüngül zədə.`,'injury',{playerId:p.id});}
 }
 if(simulated&&userScore[0]){const eligible=world.lineup.map(id=>getPlayer(world,id)).filter(p=>p.role==='FWD'||p.role==='MID');for(let i=0;i<userScore[0];i++){const scorer=eligible[Math.floor(rand(world)*eligible.length)];if(scorer)scorer.statistics.goals++;}}
 return {playerIds:[...played],cards,playerMinutes};
}
export function finishManagerMatch(world,engine){
 const report=engine.managerMatchReport??engine;
 const fixtureId=engine.options?.managerFixtureId??report.fixtureId??world.pendingMatchId;const fixture=world.fixtures.find(f=>f.id===fixtureId);
 const matchId=text(engine.matchId??report.matchId??fixtureId,'',120);if(!fixture||fixture.played||world.completedMatchIds.includes(matchId))return {ok:false,message:'Bu matç artıq qeydə alınıb və ya tapılmadı.'};
 const next=getNextFixture(world);if(next?.id!==fixture.id)return {ok:false,message:'Təqvimdən kənar matç qeydə alınmadı.'};
 if((report.state&&report.state!=='FULL_TIME')||report.completed===false)return {ok:false,message:'Matç bitməyib.'};
 if(!Array.isArray(report.score)||report.score.length!==2||report.score.some(v=>!Number.isFinite(v)||v<0||v>20))return {ok:false,message:'Hesab düzgün deyil.'};
 const userScore=report.score.map(v=>Math.floor(v));world.day=Math.max(world.day,fixture.day);
 const context=resultPlayers(world,report,fixture,userScore);
 world.objectives.youthMinutesPlayed=n(world.objectives.youthMinutesPlayed,0)+Object.entries(context.playerMinutes).reduce((sum,[id,minutes])=>sum+(getPlayer(world,id)?.age<23?minutes:0),0);
 fixture.score=fixture.homeClubId===world.userClubId?userScore:[userScore[1],userScore[0]];fixture.played=true;fixture.matchId=matchId;
 for(const f of world.fixtures.filter(f=>f.round===fixture.round&&!f.played)){f.score=simulatedScore(world,f.homeClubId,f.awayClubId);f.played=true;}
 const result=userScore[0]>userScore[1]?'win':userScore[0]===userScore[1]?'draw':'loss';
 const wages=getClubPlayers(world).reduce((sum,p)=>sum+p.wage,0),revenue=16000+(result==='win'?4500:result==='draw'?1800:0);
 ledger(world,revenue,'Matç bileti və sponsor gəliri');ledger(world,-wages,'Həftəlik futbolçu maaşları');ledger(world,-(2500+world.facilities.medical*150+world.facilities.training*150),'İşçi heyəti və obyekt xərcləri');world.lastPaidRound=fixture.round;
 world.boardConfidence=clamp(world.boardConfidence+(result==='win'?4:result==='draw'?0:-5)+(world.budget<0?-6:0),0,100);world.supporterTrust=clamp(world.supporterTrust+(result==='win'?4:result==='draw'?-1:-4),0,100);
 world.completedMatchIds.push(matchId);world.completedMatchIds=world.completedMatchIds.slice(-2000);world.pendingMatchId=null;world.round=fixture.round+1;world.activitiesSinceFixture=0;world.day=fixture.day+1;
 const table=getStandings(world),position=table.find(t=>t.clubId===world.userClubId).position;
 if(world.round>=14){world.objectives.completed=position<=world.objectives.targetPosition&&world.objectives.youthMinutesPlayed>=world.objectives.youthMinutes;world.seasonHistory.unshift({season:world.season,position,record:table.find(t=>t.clubId===world.userClubId),budget:world.budget,objectives:clone(world.objectives)});world.seasonHistory=world.seasonHistory.slice(0,30);world.boardConfidence=clamp(world.boardConfidence+(world.objectives.completed?12:-10),0,100);log(world,`Mövsüm bitdi. Yekun yer: ${position}. ${world.objectives.completed?'İdarə heyətinin məqsədi yerinə yetirildi.':'Məqsədə çatılmadı; etimad azaldı.'}`,'season_end');}
 if(world.boardConfidence<=10){world.managerStatus='under_review';log(world,'İdarə heyəti işinizi nəzərdən keçirir. Növbəti nəticələr və münasibətlər həlledicidir.','board');}
 repairSelection(world);log(world,`${world.clubs.find(c=>c.id===world.userClubId).name}: ${userScore.join('–')}. Tur ${world.round}/14; liqada ${position}-ci yer.`,'match',{fixtureId,score:userScore});
 return {ok:true,message:`Matç qeydə alındı: ${userScore.join('–')}. Tur ${world.round}/14.`,result,fixture:clone(fixture),context:{kind:'match',fixtureId,score:userScore,result,position,...context},revenue,wages};
}
export function simulateManagerFixture(world){const prepared=prepareManagerMatch(world);if(!prepared.ok)return prepared;const fixture=prepared.fixture;beginManagerFixture(world,fixture.id);const score=simulatedScore(world,world.userClubId,prepared.opponent.id);return finishManagerMatch(world,{fixtureId:fixture.id,matchId:`sim-${fixture.id}`,score,state:'FULL_TIME'});}
function spendAction(world,cost,label,fn){
 if(world.pendingMatchId)return {ok:false,message:'Matç davam edərkən bu qərar verilmir.'};
 if(world.activitiesSinceFixture>=3)return {ok:false,message:'Bu tur üçün hazırlıq günləri bitib. Matça keçin.'};
 if(world.budget<cost)return {ok:false,message:`Büdcə çatmır. Lazım olan məbləğ: €${cost}.`};
 const fixture=getNextFixture(world);if(!fixture)return {ok:false,message:'Mövsüm bitib. Yeni mövsümə keçin.'};
 ledger(world,-cost,label);fn();world.activitiesSinceFixture++;world.day=Math.min(fixture.day,world.day+1);log(world,label,'preparation');return {ok:true,message:label,context:{kind:'day',action:label}};
}
export function managerWorldAction(world,action,payload={}){
 if(!world||world.version!==1)return {ok:false,message:'Klub məlumatı tapılmadı.'};
 if(action==='select_starter'||action==='lineup')return selectLineup(world,payload.playerId,payload.replaceId);
 if(action==='bench'){const id=payload.playerId,p=getPlayer(world,id);if(!p||p.clubId!==world.userClubId||!available(p)||world.lineup.includes(id))return {ok:false,message:'Yalnız uyğun ehtiyat oyunçusu seçilə bilər.'};world.bench=world.bench.filter(v=>v!==id);if(world.bench.length>=7)world.bench.pop();world.bench.push(id);return {ok:true,message:`${p.name} ehtiyat skamyasındadır.`};}
 if(action==='auto_lineup'){if(world.pendingMatchId)return {ok:false,message:'Matç davam edir.'};world.lineup=autoLineup(world,world.userClubId,world.plan.formation);world.bench=[];repairSelection(world);return {ok:true,message:'Ən hazır oyunçularla əsas heyət seçildi.'};}
 if(action==='formation'){if(!FORMATIONS[payload.value]||world.pendingMatchId)return {ok:false,message:'Bu sxem seçilə bilmir.'};world.plan.formation=payload.value;world.lineup=autoLineup(world,world.userClubId,payload.value);world.bench=[];repairSelection(world);return {ok:true,message:'Komandanın sxemi yeniləndi.'};}
 if(action==='tactic'){if(!TACTICS.includes(payload.value))return {ok:false,message:'Taktika düzgün deyil.'};world.plan.tactic=payload.value;return {ok:true,message:'Komanda planı saxlanıldı.'};}
 if(action==='training_focus'){if(!['balanced','attack','defence'].includes(payload.value))return {ok:false,message:'Məşq istiqaməti düzgün deyil.'};world.plan.trainingFocus=payload.value;return {ok:true,message:'Məşq istiqaməti saxlanıldı.'};}
 if(action==='simulate')return simulateManagerFixture(world);
 if(action==='next_season'){
  if(getNextFixture(world))return {ok:false,message:'Cari mövsümün matçları bitməyib.'};
  world.season++;world.round=0;world.day=1;world.fixtures=schedule(world.clubs,world.season);world.activitiesSinceFixture=0;world.lastPaidRound=-1;world.pendingMatchId=null;world.scoutReports=[];
  for(const p of world.players){p.age++;p.fatigue=0;p.fitness=clamp(p.fitness+15,0,100);p.injuryDays=0;p.suspension=0;if(p.age<23)for(const k of Object.keys(p.attributes))p.attributes[k]=clamp(p.attributes[k]+1,1,p.potential);if(p.age>32)p.attributes.pace=clamp(p.attributes.pace-2,20,99);if(p.contractEnd<world.season&&p.clubId===world.userClubId){p.contractEnd=world.season;p.wage=Math.round(p.wage*1.05);log(world,`${p.name}: müqavilə yenilənməsi prioritetdir; müvəqqəti 1 illik uzatma tətbiq edildi.`,'contract');}}
  world.objectives={targetPosition:4,youthMinutes:180,youthMinutesPlayed:0,completed:false};world.managerStatus=world.boardConfidence<20?'under_review':'employed';repairSelection(world);log(world,`${world.season}-ci mövsüm başladı. Təqvim və futbolçuların yaşları yeniləndi.`,'season');return {ok:true,message:'Yeni mövsüm başladı.',context:{kind:'season'}};
 }
 if(['train','team_training','rest','rest_team','recovery','advance_day'].includes(action)){
  const rest=['rest','rest_team','advance_day'].includes(action),cost=rest?0:action==='recovery'?500:700;
  return spendAction(world,cost,rest?'Komanda bərpa günü keçirdi.':action==='recovery'?'Tibbi bərpa seansı keçirildi.':'Komanda məşqi keçirildi.',()=>{for(const p of getClubPlayers(world)){if(p.injuryDays>0)p.injuryDays=Math.max(0,p.injuryDays-1);if(rest||action==='recovery'){p.fatigue=clamp(p.fatigue-(action==='recovery'?20:13),0,100);p.fitness=clamp(p.fitness+(action==='recovery'?6:2),0,100);p.morale=clamp(p.morale+2,0,100);}else{p.fatigue=clamp(p.fatigue+8,0,100);const key=world.plan.trainingFocus==='attack'?'shooting':world.plan.trainingFocus==='defence'?'defending':'passing';p.attributes[key]=clamp(p.attributes[key]+.35,1,p.potential);p.fitness=clamp(p.fitness+1,0,100);}}});
 }
 if(action==='scout'||action==='scouting')return spendAction(world,1200,'Skaut hesabatı hazırdır: 4 real namizəd.',()=>{
  const candidates=world.players.filter(p=>p.clubId!==world.userClubId&&p.age<=28).sort((a,b)=>(b.potential-playerOverall(b))-(a.potential-playerOverall(a))||a.value-b.value);
  const offset=(world.scoutReports.length*4)%Math.max(1,candidates.length);const selected=Array.from({length:Math.min(4,candidates.length)},(_,i)=>candidates[(offset+i)%candidates.length]);
  world.scoutReports.unshift({id:`scout-${world.season}-${++world.sequence}`,day:world.day,playerIds:selected.map(p=>p.id),players:selected.map(p=>({playerId:p.id,potentialLow:Math.max(playerOverall(p),p.potential-6),potentialHigh:Math.min(99,p.potential+3),estimatedValue:p.value,comment:p.psych.ego>75?'İstedadlıdır; yüksək oyun vaxtı gözləntisi var.':p.age<=21?'İnkişaf potensialı yüksəkdir; mentor faydalıdır.':'Roluna uyğun sabit namizəddir.'}))});world.scoutReports=world.scoutReports.slice(0,20);
 });
 if(action==='youth'&&getClubPlayers(world).length>=30)return {ok:false,message:'Heyət doludur: əvvəlcə yer açın.'};
 if(action==='youth')return spendAction(world,5000,'Akademiyadan yeni gənc futbolçu əsas heyətə yüksəldi.',()=>{
  const count=getClubPlayers(world).length;if(count>=30)return;
  const i=world.players.length,id=`baku-youth-s${world.season}-${++world.sequence}`,p=generatePlayer(world.userClubId,17+world.sequence%5,0,()=>rand(world),id);p.age=17;p.status='prospect';p.group='young';p.name=`${FIRST[world.sequence%FIRST.length]} ${LAST[(world.sequence+4)%LAST.length]}`;p.number=Math.max(...getClubPlayers(world).map(p=>p.number))+1;p.wage=180;p.value=Math.round(p.value*.5);p.psych.ego=30;p.psych.professionalism=60;p.psych.experience=4;p.psych.minutesExpected=15;p.attributes=Object.fromEntries(Object.entries(p.attributes).map(([k,v])=>[k,clamp(v-8,40,65)]));p.potential=82+Math.floor(rand(world)*10);world.players.push(p);world.facilities.academy=clamp(world.facilities.academy+1,1,10);
 });
 if(action==='transfer'||action==='recruit'){
  if(world.pendingMatchId)return {ok:false,message:'Matç bitdikdən sonra transfer edin.'};
  const p=getPlayer(world,payload.playerId);if(!p||p.clubId===world.userClubId)return {ok:false,message:'Transfer namizədi tapılmadı.'};
  if(world.round>3&&world.round<7||world.round>10)return {ok:false,message:'Transfer pəncərəsi bağlıdır. Mövsümün 1–4 və 8–11-ci turlarında açılır.'};
  if(!world.scoutReports.some(r=>r.playerIds?.includes(p.id)))return {ok:false,message:'Əvvəlcə bu oyunçu üçün skaut hesabatı alın.'};
  if(p.injuryDays>0)return {ok:false,message:'Oyunçu tibbi baxışdan keçə bilmir.'};
  if(getClubPlayers(world).length>=30)return {ok:false,message:'Heyət limiti 30 oyunçudur.'};
  if(getClubPlayers(world,p.clubId).length<=18)return {ok:false,message:'Satıcı klubun heyəti çox kiçikdir.'};
  const fee=int(payload.offer,p.value,0,1e8);if(fee<p.value*.9)return {ok:false,message:'Satıcı klub bu təklifi qəbul etmir.'};
  if(fee>world.budget)return {ok:false,message:'Transfer üçün büdcə çatmır.'};
  const wage=int(payload.wage,p.wage,0,1e6),weekly=getClubPlayers(world).reduce((s,p)=>s+p.wage,0);
  if(wage<p.wage||weekly+wage>world.wageBudget)return {ok:false,message:'Maaş təklifi və ya maaş büdcəsi uyğun deyil.'};
  const seller=world.clubs.find(c=>c.id===p.clubId),from=p.clubId;ledger(world,-fee,`${p.name} transfer ödənişi`);seller.budget+=fee;p.clubId=world.userClubId;p.wage=wage;p.contractEnd=world.season+3;p.number=Math.max(...getClubPlayers(world).filter(v=>v.id!==p.id).map(v=>v.number))+1;p.trust=55;p.morale=70;p.confidence=65;
  world.transferLog.unshift({season:world.season,day:world.day,playerId:p.id,from,to:world.userClubId,fee,wage});world.transferLog=world.transferLog.slice(0,80);repairSelection(world);log(world,`${p.name} kluba qoşuldu. Qiymət €${fee}, həftəlik maaş €${wage}.`,'transfer',{playerId:p.id});return {ok:true,message:`${p.name} transfer edildi.`,context:{kind:'transfer',playerId:p.id}};
 }
 if(action==='renew'){
  const p=getPlayer(world,payload.playerId);if(!p||p.clubId!==world.userClubId)return {ok:false,message:'Oyunçu heyətdə deyil.'};
  const wage=int(payload.wage,Math.round(p.wage*1.1),0,1e6),years=int(payload.years,2,1,4),weekly=getClubPlayers(world).reduce((s,p)=>s+p.wage,0)-p.wage+wage;
  if(wage<p.wage||weekly>world.wageBudget||world.budget<500)return {ok:false,message:'Müqavilə şərtləri və ya büdcə uyğun deyil.'};
  ledger(world,-500,`${p.name} müqavilə imza xərci`);p.wage=wage;p.contractEnd=world.season+years;p.morale=clamp(p.morale+7,0,100);p.trust=clamp(p.trust+5,0,100);return {ok:true,message:'Müqavilə yeniləndi.',context:{kind:'contract',playerId:p.id}};
 }
 if(action==='release'||action==='sell'){
  const p=getPlayer(world,payload.playerId);if(!p||p.clubId!==world.userClubId||world.pendingMatchId)return {ok:false,message:'Oyunçu buraxıla bilmir.'};
  if(getClubPlayers(world).length<=18)return {ok:false,message:'Ən azı 18 futbolçu saxlayın.'};
  const buyer=world.clubs.filter(c=>c.id!==world.userClubId&&c.budget>=p.value*.65&&getClubPlayers(world,c.id).length<28).sort((a,b)=>b.budget-a.budget)[0];if(!buyer)return {ok:false,message:'Uyğun alıcı klub tapılmadı.'};
  const fee=Math.round(p.value*.65);buyer.budget-=fee;p.clubId=buyer.id;ledger(world,fee,`${p.name} satış gəliri`);world.lineup=world.lineup.filter(id=>id!==p.id);world.bench=world.bench.filter(id=>id!==p.id);repairSelection(world);world.transferLog.unshift({season:world.season,day:world.day,playerId:p.id,from:world.userClubId,to:buyer.id,fee});log(world,`${p.name} ${buyer.name} klubuna keçdi.`,'transfer');return {ok:true,message:'Oyunçu satıldı.',context:{kind:'transfer',playerId:p.id}};
 }
 return {ok:false,message:'Bu klub əməliyyatı tanınmır.'};
}
