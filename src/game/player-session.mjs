/** One player-facing bridge: personal life, club career and the live footballer. */
import { normalizePlayerJourney, preparePlayerMatch, beginPlayerFixture, finishPlayerFixture, playerWorldAction, getPlayerFixture } from './player-world.mjs';
import { ensurePlayerLife, generatePlayerEvents, resolvePlayerEvent, playerLifeAction, playerLifeEffect } from './player-life.mjs';

const clamp=(n,lo=0,hi=100)=>Math.max(lo,Math.min(hi,n));
const log=(player,kind,message)=>{player.activityLog.unshift({day:player.day,kind,message});player.activityLog=player.activityLog.slice(0,20);};
export function ensurePlayerSimulation(player,profile={}) {
  const newLife=!player.journey?.life;
  if(!player.journey||player.journey.version!==1)player.journey=normalizePlayerJourney(player.journey,player,profile);
  ensurePlayerLife(player,player.journey);
  if(newLife&&Number.isInteger(profile.shirtNumber))player.journey.life.appearance.jerseyNumber=profile.shirtNumber;
  return player.journey;
}
export function advancePlayerCalendar(player,journey,days=1,recover=false) {
  const count=clamp(Math.floor(Number(days)||0),0,400);
  for(let i=0;i<count;i++){
    const oldWeek=Math.floor((player.day-1)/7);player.day++;player.balance=Math.max(0,player.balance-20);
    if(Math.floor((player.day-1)/7)>oldWeek){player.balance+=player.salary;log(player,'salary',`Həftəlik maaş: €${player.salary}.`);}
    if(recover){player.energy=clamp(player.energy+8);player.fitness=clamp(player.fitness+1);}
    journey.injuryDays=Math.max(0,(journey.injuryDays??0)-1);
  }
  journey.day=player.day;
  generatePlayerEvents(player,journey,{kind:'day'});
  return count;
}
export function getPlayerMatchAttributes(player,profile={}) {
  const journey=ensurePlayerSimulation(player,profile),mental=playerLifeEffect(player,journey);
  mental.experience=Math.min(99,Math.max(mental.experience,8+(journey.careerStats.minutes??0)/120));
  return {...player.skills,fitness:player.fitness,energy:player.energy,...mental};
}
export function playerMatchOptions(player,profile={}) {
  const j=ensurePlayerSimulation(player,profile),prepared=preparePlayerMatch(j,player,profile);
  if(!prepared.ok)return prepared;
  const mental=getPlayerMatchAttributes(player,profile),appearance=j.life.appearance;
  prepared.options.playerAttributes=mental;prepared.options.playerAppearance={...appearance};
  for(const roster of [prepared.options.playerRoster,prepared.options.playerBench])for(const person of roster??[]){
    if((person.id??person.persistentId)!==j.heroId)continue;
    Object.assign(person,{attributes:{...player.skills},fitness:player.fitness,fatigue:100-player.energy,morale:player.morale,confidence:mental.confidence,trust:mental.trust,experience:mental.experience,psychMatch:{...mental},appearance:{...appearance},psych:{...(person.psych??{}),professionalism:j.life.professionalism,stress:j.life.stress,experience:mental.experience}});
  }
  return prepared;
}
function notePersonalResult(player,journey,result,id,score) {
  if(player.completedMatchIds.includes(id))return;
  const context=result.context??{},minutes=Number(context.minutes??context.heroMinutes??0),goals=Math.max(0,Math.floor(Number(context.goals)||0));
  const remainingDays=Math.max(0,context.advanceDays??0);
  const fixtureDay=(journey.seasonStartDay??0)+(result.fixture?.day??0);
  const beforeMatch=Math.min(remainingDays,Math.max(0,fixtureDay-player.day));
  // Rest before a simulated match uses the same energy cap as entering its live fixture.
  advancePlayerCalendar(player,journey,beforeMatch,true);
  const outcome=score[0]>score[1]?'win':score[0]===score[1]?'draw':'loss';
  player.completedMatchIds.push(id);player.completedMatchIds=player.completedMatchIds.slice(-10000);
  player.results.unshift({id,mode:'player',score:[...score],result:outcome,date:new Date().toISOString()});player.results=player.results.slice(0,20);
  if(minutes>0){player.appearances++;player.goals+=goals;player.balance+=120+goals*40;player.reputation=clamp(player.reputation+1+goals);player.energy=clamp(player.energy-Math.max(5,24*Math.min(1,minutes/90)));}
  player.morale=clamp(player.morale+(minutes===0?-2:outcome==='win'?6:outcome==='draw'?1:-4));
  advancePlayerCalendar(player,journey,remainingDays-beforeMatch,true);
  generatePlayerEvents(player,journey,{...context,kind:'match',fixtureId:result.fixture?.id??context.fixtureId,score:[...score],minutes,goals,result:outcome});
  log(player,'match',`${score.join('–')} · ${Math.round(minutes)} dəqiqə · ${goals} qol. ${minutes>0?'Oyun bonusu və fərdi statistika yazıldı.':'Bu matçda meydana çıxmadın.'}`);
}
const legacyActivities={train_passing:['passing',18],train_shooting:['shooting',22],train_fitness:['pace',24]};
export function playerDecision(player,profile,action,payload={}) {
  const j=ensurePlayerSimulation(player,profile);
  if(j.pendingFixtureId)return {ok:false,message:'Davam edən matçı əvvəlcə tamamla.'};
  const timeAction=Object.hasOwn(legacyActivities,action)||['rest','community','family_time','team_bonding','media_training','mindfulness','study','gym','mentor_session'].includes(action);
  const next=getPlayerFixture(j),matchDay=next?.absoluteDay??((j.seasonStartDay??0)+(next?.day??Infinity));
  if(timeAction&&j.clubId&&!next&&j.round>=14)return {ok:false,message:'Mövsüm bitib. Növbəti hazırlıq günləri üçün yeni mövsümə keç.'};
  if(timeAction&&next&&player.day>=matchDay)return {ok:false,message:'Matç günüdür. Əvvəlcə oyunu tamamla; növbəti hazırlıq günləri sonra açılacaq.'};
  let result,consumesDay=0;
  if(Object.hasOwn(legacyActivities,action)||['rest','community'].includes(action)){
    const train=legacyActivities[action];
    if(train){
      if(player.energy<train[1])return {ok:false,message:'Enerjin çatmır. Əvvəlcə bərpa et.'};
      player.energy-=train[1];player.skills[train[0]]=clamp(player.skills[train[0]]+2);player.fitness=clamp(player.fitness+(action==='train_fitness'?3:1));player.morale=clamp(player.morale+1);
      j.life.coachTrust=clamp(j.life.coachTrust+1);result={ok:true,message:'Fərdi məşq tamamlandı. Bacarıq +2; məşqçi hazırlığını izləyir.'};
    }else if(action==='rest'){
      player.energy=clamp(player.energy+32);player.fitness=clamp(player.fitness+2);player.morale=clamp(player.morale+3);result={ok:true,message:'Bərpa günü: enerji +32, hazırlıq +2.'};
    }else{
      if(player.energy<10)return {ok:false,message:'Azarkeş görüşündən əvvəl dincəl.'};
      player.energy-=10;player.reputation=clamp(player.reputation+2);player.morale=clamp(player.morale+6);j.life.fansTrust=clamp(j.life.fansTrust+5);result={ok:true,message:'Azarkeşlərlə görüş nüfuzunu və münasibəti yaxşılaşdırdı.'};
    }
    consumesDay=1;
  }else if(action==='resolve_event')result=resolvePlayerEvent(player,j,payload.eventId,payload.choiceId);
  else{
    result=playerLifeAction(player,j,action,payload);
    if(result?.unknownAction||result?.code==='UNKNOWN_ACTION')result=playerWorldAction(j,player,action,payload,profile);
    // Unknown life commands are not a reason to discard a football-world action.
    else if(!result?.ok&&['simulate','next_season','request_transfer','request_loan','renew_contract','accept_offer','reject_offer','unlock_position','spend_skill','active_position','retire'].includes(action))result=playerWorldAction(j,player,action,payload,profile);
    consumesDay=Number(result?.consumesDay)||0;
  }
  if(!result?.ok)return result??{ok:false,message:'Bu qərar tapılmadı.'};
  if(action==='simulate'){
    const score=result.context?.score??result.score??result.fixture?.score??[0,0];
    notePersonalResult(player,j,result,`player-sim-${result.fixture?.id??result.context?.fixtureId}`,score);
  }else{
    advancePlayerCalendar(player,j,consumesDay||result.context?.advanceDays||0,!!result.context?.advanceDays);
    generatePlayerEvents(player,j,result.context??{kind:'decision'});
    log(player,action,result.message);
  }
  if(action==='active_position'&&j.activePosition)profile.position=j.activePosition;
  return result;
}
export function beginPlayerSession(player,profile={}) {
  const j=ensurePlayerSimulation(player,profile),result=beginPlayerFixture(j,player);
  if(result.ok)advancePlayerCalendar(player,j,result.context?.advanceDays??0,true);
  return result;
}
export function applyPlayerSimulationResult(player,engine,profile={}) {
  const j=ensurePlayerSimulation(player,profile),result=finishPlayerFixture(j,player,engine.playerMatchReport??engine);
  if(!result.ok)return result;
  notePersonalResult(player,j,result,engine.matchId,engine.score);
  return result;
}
export {getPlayerFixture};
