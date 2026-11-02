import test from 'node:test';
import assert from 'node:assert/strict';
import {createManagerWorld,normalizeManagerWorld} from '../src/game/manager-world.mjs';
import {initializePsychology,normalizePsychology,generateManagerEvents,resolveManagerEvent,assignMentor,holdTeamMeeting,giveTeamTalk,reactToSubstitution,playerPsychologyEffect,setCoachStyle,MANAGER_EVENT_TYPES} from '../src/game/manager-psychology.mjs';
const fresh=()=>{const w=createManagerWorld(27);initializePsychology(w);return w;};
const squad=w=>w.players.filter(p=>p.clubId===w.userClubId);
const young=w=>squad(w).find(p=>p.age<=22);
const veteran=w=>squad(w).find(p=>p.age>=30);
function event(w,type,player=squad(w)[0],evidence='confirmed'){
 const id=`test-${type}-${w.psychology.sequence++}`;
 w.psychology.events.push({id,type,title:type,body:'Uydurma test hadisəsi',playerId:player.id,day:w.day,dueDay:w.day,status:'pending',evidence,context:{key:id}});
 normalizePsychology(w);return w.psychology.events.find(e=>e.id===id);
}
function resolve(w,type,choice,player=squad(w)[0],evidence='confirmed'){const e=event(w,type,player,evidence);return {e,result:resolveManagerEvent(w,e.id,choice)};}

test('initialization gives three unique actionable dilemmas exactly once',()=>{
 const w=fresh(),ids=w.psychology.events.map(e=>e.id);assert.equal(ids.length,3);assert.equal(new Set(ids).size,3);
 for(let i=0;i<5;i++)initializePsychology(w);assert.deepEqual(w.psychology.events.map(e=>e.id),ids);
 assert.ok(w.psychology.events.every(e=>e.choices.length>=3&&e.choices.every(c=>c.preview.length>10)));
});
test('actual world social groups retain every own player, including veterans and international group',()=>{
 const w=fresh(),groups=w.psychology.groups;const ids=groups.flatMap(g=>g.playerIds);
 assert.equal(new Set(ids).size,squad(w).length);assert.ok(groups.some(g=>g.id==='veterans'&&g.playerIds.length));assert.ok(groups.some(g=>g.id==='international'));
});
test('normalization bounds hostile numbers and preserves negative focus changes',()=>{
 const w=fresh(),p=young(w);p.psych.focusBoost=-9;p.psych.stress=1000;w.psychology.cohesion=-100;normalizePsychology(w);
 assert.equal(p.psych.focusBoost,-9);assert.equal(p.psych.stress,100);assert.equal(w.psychology.cohesion,0);
});
test('save/world normalization preserves event decisions, negative focus and actual group membership',()=>{
 const w=fresh();giveTeamTalk(w,'pre_match','angry',{fixtureId:'f',score:[2,0]});const e=w.psychology.events[0];resolveManagerEvent(w,e.id,e.choices[0].id);
 const restored=normalizeManagerWorld(JSON.parse(JSON.stringify(w)));initializePsychology(restored);
 assert.equal(restored.psychology.events.find(x=>x.id===e.id).status,'resolved');assert.ok(squad(restored).some(p=>p.psych.focusBoost<0));
});
test('resolving a dilemma mutates state once and returns explicit effects',()=>{
 const w=fresh(),p=young(w),{e,result}=resolve(w,'late_training','listen',p);assert.equal(result.ok,true);assert.ok(result.effects.some(x=>x.includes('trust')));
 const trust=p.trust;assert.equal(resolveManagerEvent(w,e.id,'listen').ok,false);assert.equal(p.trust,trust);
});
test('unknown event or choice cannot change finances or player trust',()=>{
 const w=fresh(),before=JSON.stringify(w);assert.equal(resolveManagerEvent(w,'missing','fine').ok,false);assert.equal(JSON.stringify(w),before);
 const e=w.psychology.events[0];assert.equal(resolveManagerEvent(w,e.id,'invented').ok,false);assert.equal(JSON.stringify(w),before);
});
test('nightlife investigation schedules next-day facts without presuming guilt or fine',()=>{
 const w=fresh(),p=young(w),money=w.budget;const {result}=resolve(w,'nightlife','investigate',p,'rumour');assert.ok(result.ok);assert.equal(w.budget,money);
 const next=w.psychology.events.find(e=>e.type.startsWith('nightlife_'));assert.ok(next);assert.equal(next.status,'scheduled');assert.equal(resolveManagerEvent(w,next.id,next.choices[0].id).ok,false);
 w.day++;generateManagerEvents(w,{id:'next-day'});assert.equal(w.psychology.events.find(e=>e.id===next.id).status,'pending');
});
test('punishing unverified nightlife allegations harms fairness and personal trust',()=>{
 const w=fresh(),p=young(w),trust=p.trust,fairness=w.psychology.fairness;resolve(w,'nightlife','public',p,'rumour');assert.ok(p.trust<trust);assert.ok(w.psychology.fairness<fairness);
});
test('confirmed misconduct fine uses wages, changes discipline and cannot repeat',()=>{
 const w=fresh(),p=squad(w)[0],money=w.budget;const {e}=resolve(w,'nightlife_confirmed','fine',p);
 assert.equal(w.budget,money+Math.round(p.wage*.2));assert.equal(p.psych.disciplineRecord,1);resolveManagerEvent(w,e.id,'fine');assert.equal(p.psych.disciplineRecord,1);
});
test('cleared player receives support, trust and confidence instead of a punishment',()=>{
 const w=fresh(),p=young(w),trust=p.trust;resolve(w,'nightlife_unfounded','defend',p,'unsubstantiated');assert.ok(p.trust>trust);assert.ok(w.psychology.fairness>65);
});
test('late arrival discipline differs from private listening and ignoring patterns',()=>{
 const a=fresh(),b=fresh(),c=fresh();const pa=young(a),pb=young(b),pc=young(c),start=pa.psych.professionalism;
 resolve(a,'late_training','listen',pa);resolve(b,'late_training','warning',pb);resolve(c,'late_training','ignore',pc);
 assert.ok(pa.trust>pb.trust);assert.ok(pb.psych.professionalism>start);assert.ok(pc.psych.professionalism<start);
});
test('star minute promise is recorded and penalized when actually broken',()=>{
 const w=fresh(),p=squad(w).find(x=>x.status==='star');resolve(w,'star_ego','promise',p);assert.equal(p.psych.promises.at(-1).target,60);
 const trust=p.trust;w.round=2;w.day=10;generateManagerEvents(w,{kind:'match',fixtureId:'promise-broken',score:[0,0]});assert.equal(p.psych.promises.at(-1).status,'broken');assert.ok(p.trust<trust);
});
test('kept minute promise uses persistent minutes and improves trust once',()=>{
 const w=fresh(),p=veteran(w);resolve(w,'veteran_role','rotate',p);const trust=p.trust;p.statistics.minutes+=60;w.round=2;
 generateManagerEvents(w,{kind:'match',fixtureId:'promise-kept',score:[1,0]});assert.equal(p.psych.promises.at(-1).status,'kept');assert.ok(p.trust>trust);const result=p.trust;
 generateManagerEvents(w,{kind:'match',fixtureId:'promise-kept',score:[1,0]});assert.equal(p.trust,result);
});
test('star public bench changes the actual starting selection and causes social fallout',()=>{
 const w=fresh(),p=w.lineup.map(id=>w.players.find(x=>x.id===id)).find(p=>p.role!=='GK');p.psych.ego=90;
 const trust=p.trust;resolve(w,'star_ego','bench',p);assert.ok(!w.lineup.includes(p.id));assert.ok(w.bench.includes(p.id));assert.ok(p.trust<trust);
});
test('young-player support lowers stress while a harsh challenge can damage confidence',()=>{
 const a=fresh(),b=fresh(),pa=young(a),pb=young(b);pa.psych.professionalism=pb.psych.professionalism=50;const confidence=pb.confidence;
 resolve(a,'young_anxiety','support',pa);resolve(b,'young_anxiety','challenge',pb);assert.ok(pa.psych.stress<pb.psych.stress);assert.ok(pb.confidence<confidence);
});
test('veteran age humiliation affects actual veteran group rather than an empty alias',()=>{
 const w=fresh(),p=veteran(w),other=squad(w).find(x=>x.group==='veterans'&&x.id!==p.id),trust=other.trust;
 resolve(w,'veteran_role','cut',p);assert.ok(other.trust<trust);assert.ok(w.psychology.cohesion<65);
});
test('group mediation creates a persistent cross-group relationship and improves cooperation',()=>{
 const w=fresh(),p=young(w),before=playerPsychologyEffect(p,w).cooperation;
 resolve(w,'training_conflict','mediate',p);assert.ok(w.psychology.relationships['young:experienced']>50);assert.ok(playerPsychologyEffect(p,w).cooperation>before);
});
test('taking one age group side damages the other age group trust',()=>{
 const w=fresh(),p=veteran(w),trust=p.trust;resolve(w,'training_conflict','youth',young(w));assert.ok(p.trust<trust);
});
test('red card reaction cannot erase an official suspension',()=>{
 const w=fresh(),p=young(w);p.suspension=2;const temperament=p.psych.temperament;resolve(w,'red_card','review',p);assert.equal(p.suspension,2);assert.ok(p.psych.temperament<temperament);
});
test('actual red-card context generates a player-specific decision once',()=>{
 const w=fresh(),p=young(w);const ctx={kind:'match',fixtureId:'red-fixture',score:[0,1],cards:[{playerId:p.id,type:'red'}]};generateManagerEvents(w,ctx);generateManagerEvents(w,ctx);
 assert.equal(w.psychology.events.filter(e=>e.type==='red_card'&&e.playerId===p.id).length,1);
});
test('family-pressure decision never changes ability; merit costs board trust and improves fairness',()=>{
 const w=fresh(),p=young(w),attrs={...p.attributes},board=w.psychology.boardTrust;resolve(w,'board_relative','merit',p);assert.deepEqual(p.attributes,attrs);assert.ok(w.psychology.boardTrust<board);assert.ok(w.psychology.fairness>65);
});
test('accepting external selection pressure really selects a bench player and hurts fairness',()=>{
 const w=fresh(),p=w.bench.map(id=>w.players.find(x=>x.id===id)).find(p=>p.role!=='GK'),fairness=w.psychology.fairness;
 resolve(w,'board_relative','pressure',p);assert.ok(w.lineup.includes(p.id));assert.ok(w.psychology.fairness<fairness);assert.ok(w.psychology.boardTrust>60);
});
test('calm factual media response reduces pressure; attacking media increases it',()=>{
 const a=fresh(),b=fresh();resolve(a,'media_smear','facts');resolve(b,'media_smear','attack');assert.ok(a.psychology.mediaPressure<b.psychology.mediaPressure);
 assert.ok(b.psychology.media.every(x=>x.fictional));assert.ok(b.psychology.media.some(x=>x.channel==='tv'));
});
test('social support improves confidence and consensual media break is timed',()=>{
 const w=fresh(),p=young(w),confidence=p.confidence;resolve(w,'social_backlash','support',p);assert.ok(p.confidence>confidence);
 resolve(w,'social_backlash','break',p);assert.equal(p.psych.mediaBreakUntil,w.day+3);
});
test('TV criticism response affects team trust and actual media pressure',()=>{
 const a=fresh(),b=fresh();resolve(a,'tv_criticism','tactical');resolve(b,'tv_criticism','attack');assert.ok(a.psychology.mediaPressure<b.psychology.mediaPressure);
});
test('contract dialogue records a real next-step intention without silently rewriting wages',()=>{
 const w=fresh(),p=young(w),wage=p.wage;resolve(w,'contract_discontent','negotiate',p);assert.equal(p.wage,wage);assert.equal(p.psych.roleIntent,'contract_review');
});
test('medical overload response charges budget, improves recovery and rejects insufficient funds',()=>{
 const w=fresh(),p=young(w);p.fitness=45;p.fatigue=70;const money=w.budget;resolve(w,'fitness_overload','medical',p);assert.equal(w.budget,money-200);assert.equal(p.fatigue,60);
 const e=event(w,'fitness_overload',p);w.budget=10;assert.equal(resolveManagerEvent(w,e.id,'medical').ok,false);assert.equal(e.status,'pending');
});
test('mentor eligibility checks club, age, self-link and maximum capacity',()=>{
 const w=fresh(),m=veteran(w),y=young(w);assert.equal(assignMentor(w,y.id,m.id).ok,false);assert.equal(assignMentor(w,m.id,m.id).ok,false);
 assert.equal(assignMentor(w,m.id,w.players.find(x=>x.clubId!=='baku').id).ok,false);assert.equal(assignMentor(w,m.id,y.id).ok,true);assert.equal(assignMentor(w,m.id,y.id).ok,false);
});
test('mentor bonuses require a full week and repeated day processing cannot farm them',()=>{
 const w=fresh(),m=veteran(w),y=young(w);m.psych.professionalism=95;m.psych.leadership=95;m.trust=90;assert.ok(assignMentor(w,m.id,y.id).ok);
 const skill=y.role==='DEF'?'defending':y.role==='FWD'?'shooting':'passing',before=y.attributes[skill];w.day=7;generateManagerEvents(w,{id:'day7'});assert.equal(y.attributes[skill],before);
 w.day=8;generateManagerEvents(w,{id:'day8'});assert.equal(y.attributes[skill],before+.5);generateManagerEvents(w,{id:'day8-again'});assert.equal(y.attributes[skill],before+.5);
});
test('bad mentor fit can raise stress rather than guarantee growth',()=>{
 const w=fresh(),m=veteran(w),y=young(w);m.psych.professionalism=20;m.psych.leadership=20;m.psych.ego=95;m.trust=20;
 assignMentor(w,m.id,y.id);const stress=y.psych.stress;w.day=8;generateManagerEvents(w,{id:'bad-fit'});assert.ok(y.psych.stress>stress);
});
test('mentor transfer ends the link instead of applying a remote club buff',()=>{
 const w=fresh(),m=veteran(w),y=young(w);assignMentor(w,m.id,y.id);m.clubId='other';w.day=8;generateManagerEvents(w,{id:'mentor-left'});assert.equal(w.psychology.mentorships[0].status,'ended');
});
test('a mentorship choice resolves its actual event despite nested helper calls',()=>{
 const w=fresh(),e=event(w,'young_anxiety',young(w));assert.ok(resolveManagerEvent(w,e.id,'mentor').ok);assert.equal(w.psychology.events.find(x=>x.id===e.id).status,'resolved');
});
test('team-meeting cooldown survives nested talks and save normalization',()=>{
 const w=fresh();assert.ok(holdTeamMeeting(w,'supportive').ok);assert.equal(w.psychology.lastMeetingDay,1);assert.equal(holdTeamMeeting(w,'supportive').ok,false);
 const loaded=normalizeManagerWorld(JSON.parse(JSON.stringify(w)));initializePsychology(loaded);assert.equal(holdTeamMeeting(loaded,'calm').ok,false);loaded.day=4;assert.ok(holdTeamMeeting(loaded,'calm').ok);
});
test('each fixture phase allows one talk; a new phase or fixture remains independent',()=>{
 const w=fresh();assert.ok(giveTeamTalk(w,'pre_match','supportive',{fixtureId:'f'}).ok);assert.equal(giveTeamTalk(w,'pre_match','angry',{fixtureId:'f'}).ok,false);
 assert.ok(giveTeamTalk(w,'half_time','tactical',{fixtureId:'f'}).ok);assert.ok(giveTeamTalk(w,'pre_match','calm',{fixtureId:'f2'}).ok);
});
test('supportive halftime and harsh halftime produce different real player focus/stress',()=>{
 const a=fresh(),b=fresh(),pa=young(a),pb=young(b);pa.trust=pb.trust=35;pa.psych.professionalism=pb.psych.professionalism=45;
 giveTeamTalk(a,'half_time','supportive',{fixtureId:'f',score:[0,1]});giveTeamTalk(b,'half_time','angry',{fixtureId:'f',score:[0,1]});
 assert.ok(playerPsychologyEffect(pa,a).focus>playerPsychologyEffect(pb,b).focus);assert.ok(pa.psych.stress<pb.psych.stress);assert.ok(pb.psych.focusBoost<0);
});
test('angry speech can motivate trusted professional veterans when trailing but backfires while winning',()=>{
 const a=fresh(),b=fresh(),pa=veteran(a),pb=veteran(b);for(const p of [pa,pb]){p.psych.professionalism=90;p.trust=90;}
 giveTeamTalk(a,'half_time','angry',{fixtureId:'f',score:[0,2]});giveTeamTalk(b,'half_time','angry',{fixtureId:'f',score:[2,0]});assert.ok(pa.psych.focusBoost>0);assert.ok(pb.psych.focusBoost<0);
});
test('tactical talk creates a bounded match-focus effect that expires after the next round',()=>{
 const w=fresh(),p=young(w),before=playerPsychologyEffect(p,w).focus;giveTeamTalk(w,'half_time','tactical',{fixtureId:'f'});const during=playerPsychologyEffect(p,w).focus;assert.ok(during>before);
 w.round=3;assert.ok(playerPsychologyEffect(p,w).focus<during);
});
test('early public star substitution harms trust more than a normal private sixty-minute change',()=>{
 const a=fresh(),b=fresh(),outA=veteran(a),outB=veteran(b),inA=young(a),inB=young(b);outA.psych.ego=outB.psych.ego=90;
 reactToSubstitution(a,outA.id,inA.id,18,'tactical','public',{fixtureId:'f'});reactToSubstitution(b,outB.id,inB.id,60,'tactical','private',{fixtureId:'f'});
 assert.ok(outA.trust<outB.trust);assert.ok(outA.morale<outB.morale);
});
test('injury and fatigue explanation reduce early substitution hurt and preserve veteran respect',()=>{
 for(const reason of ['injury','fitness','fatigue','medical']){const w=fresh(),out=veteran(w),incoming=young(w),trust=out.trust;
  const result=reactToSubstitution(w,out.id,incoming.id,15,reason,'private',{fixtureId:'f'});assert.ok(result.ok);assert.ok(out.trust>trust);}
});
test('an ambitious young substitute reacts to a token late cameo differently from a real opportunity',()=>{
 const a=fresh(),b=fresh(),ya=young(a),yb=young(b);ya.psych.ambition=yb.psych.ambition=90;
 reactToSubstitution(a,veteran(a).id,ya.id,88,'tactical','private',{fixtureId:'f'});reactToSubstitution(b,veteran(b).id,yb.id,55,'tactical','private',{fixtureId:'f'});assert.ok(ya.morale<yb.morale);assert.ok(ya.confidence<yb.confidence);
});
test('substitution reaction is idempotent and cannot apply to another club player',()=>{
 const w=fresh(),out=veteran(w),incoming=young(w);assert.ok(reactToSubstitution(w,out.id,incoming.id,30,'tactical','private',{fixtureId:'f'}).ok);
 const morale=out.morale;assert.equal(reactToSubstitution(w,out.id,incoming.id,30,'tactical','private',{fixtureId:'f'}).ok,false);assert.equal(out.morale,morale);
 assert.equal(reactToSubstitution(w,out.id,w.players.find(p=>p.clubId!=='baku').id,60).ok,false);
});
test('coach styles validate input and persist without a free attribute bonus',()=>{
 const w=fresh(),playerBefore=JSON.stringify(squad(w));assert.equal(setCoachStyle(w,'invented').ok,false);assert.ok(setCoachStyle(w,'tactical').ok);assert.equal(w.psychology.policies.coachStyle,'tactical');assert.equal(JSON.stringify(squad(w)),playerBefore);
});
test('daily contextual events are deterministic, bounded, and do not duplicate on rerender',()=>{
 const a=fresh(),b=fresh();a.day=b.day=2;generateManagerEvents(a,{kind:'day'});generateManagerEvents(b,{kind:'day'});assert.deepEqual(a.psychology.events,b.psychology.events);
 const count=a.psychology.events.length;generateManagerEvents(a,{kind:'day'});assert.equal(a.psychology.events.length,count);assert.ok(a.psychology.events.filter(e=>e.status==='pending').length<=5);
 assert.ok(MANAGER_EVENT_TYPES.length>=15);
});
test('all psychological output values stay bounded and affect actual technical modifiers',()=>{
 const w=fresh(),p=young(w);p.morale=5;p.confidence=10;p.trust=15;p.psych.stress=90;const low=playerPsychologyEffect(p,w);
 p.morale=95;p.confidence=95;p.trust=95;p.psych.stress=5;const high=playerPsychologyEffect(p,w);
 assert.ok(high.focus>low.focus);assert.ok(high.cooperation>low.cooperation);assert.ok(high.moraleModifier>low.moraleModifier);
 for(const v of Object.values(high))assert.ok(Number.isFinite(v));assert.ok(high.moraleModifier<=10&&low.moraleModifier>=-12);
});

test('playing-time concern uses actual minutes instead of the repaired next-match lineup',()=>{
 const w=fresh(),p=squad(w).find(x=>x.status==='star');
 w.lineup=w.lineup.filter(id=>id!==p.id);p.psych.minutesExpected=80;
 generateManagerEvents(w,{kind:'match',fixtureId:'played-full-game',score:[1,0],playerMinutes:{[p.id]:90}});
 assert.ok(!w.psychology.events.some(e=>e.type==='playing_time'&&e.playerId===p.id));
 generateManagerEvents(w,{kind:'match',fixtureId:'unused-star',score:[1,0],playerMinutes:{[p.id]:0}});
 assert.ok(w.psychology.events.some(e=>e.type==='playing_time'&&e.playerId===p.id));
});
test('injured or suspended star is not treated as unfairly benched',()=>{
 for(const reason of ['injuryDays','suspension']){
  const w=fresh(),p=squad(w).find(x=>x.status==='star');w.lineup=w.lineup.filter(id=>id!==p.id);p[reason]=2;p.psych.minutesExpected=80;
  generateManagerEvents(w,{kind:'match',fixtureId:`unavailable-${reason}`,score:[1,0],playerMinutes:{[p.id]:0}});
  assert.ok(!w.psychology.events.some(e=>e.type==='playing_time'&&e.playerId===p.id));
 }
});
