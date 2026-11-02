/** The bridge between the persistent club, human decisions and the live match. */
import { normalizeManagerWorld, getClubPlayers, getNextFixture, prepareManagerMatch, beginManagerFixture, finishManagerMatch, managerWorldAction } from './manager-world.mjs';
import { initializePsychology, generateManagerEvents, resolveManagerEvent, assignMentor, holdTeamMeeting, setCoachStyle, giveTeamTalk, reactToSubstitution, playerPsychologyEffect } from './manager-psychology.mjs';

const clamp = n => Math.max(0, Math.min(100, n));
export function refreshManagerPsychology(world) {
  initializePsychology(world);
  for (const player of world.players) player.psychMatch = playerPsychologyEffect(player, world);
  return world;
}
export function ensureManagerSimulation(manager) {
  if (!manager.world || manager.world.version !== 1) {
    manager.world = normalizeManagerWorld(manager.world, manager);
    initializePsychology(manager.world);
    manager.world.psychology.boardTrust = manager.world.boardConfidence;
  }
  refreshManagerPsychology(manager.world);
  return manager.world;
}
export function syncManagerSummary(manager) {
  const w = manager.world;
  if (!w) return manager;
  const squad = getClubPlayers(w), avg = key => squad.reduce((sum,p) => sum+p[key],0)/Math.max(1,squad.length);
  Object.assign(manager, { day:w.day, budget:w.budget, boardConfidence:w.boardConfidence,
    teamMorale:avg('morale'), teamFitness:avg('fitness'), formation:w.plan.formation,
    tactic:w.plan.tactic, trainingFocus:w.plan.trainingFocus, youthLevel:w.facilities.academy,
    scoutingReports:w.scoutReports.length });
  w.psychology.boardTrust = w.boardConfidence;
  w.clubs.find(c => c.id === w.userClubId).budget = w.budget;
  w.managerStatus = w.boardConfidence <= 10 ? 'under_review' : 'employed';
  return manager;
}
function noteResult(manager, result, matchId, score) {
  if (manager.completedMatchIds.includes(matchId)) return;
  manager.completedMatchIds.push(matchId);
  manager.completedMatchIds = manager.completedMatchIds.slice(-10000);
  manager.record.played++;
  manager.record[result === 'win' ? 'won' : result === 'draw' ? 'drawn' : 'lost']++;
  manager.record.goals += score[0];
  manager.results.unshift({id:matchId,mode:'manager',score:[...score],result,date:new Date().toISOString()});
  manager.results = manager.results.slice(0,20);
}
function startPsychologicalSeason(world,previousDay,previousRound) {
  const p=world.psychology;
  p.processedDays=[];p.processedContexts=[];p.lastMeetingDay=-2;
  p.talkKeys=p.talkKeys.filter(key=>!key.startsWith('meeting-'));
  for(const mentor of p.mentorships.filter(m=>m.status==='active')){mentor.lastDay=world.day;mentor.startDay=world.day;}
  for(const event of p.events.filter(e=>e.status==='scheduled'))event.dueDay=world.day+Math.max(1,event.dueDay-previousDay);
  for(const player of world.players){
    player.psych.focusBoost=0;player.psych.focusUntilRound=0;
    for(const promise of player.psych.promises.filter(p=>p.status==='open'))promise.dueRound=Math.max(1,promise.dueRound-previousRound);
  }
}
export function managerDecision(manager, action, payload = {}) {
  const w = ensureManagerSimulation(manager), beforeBoard = w.psychology.boardTrust, beforeBudget=w.budget;
  const previousDay=w.day,previousRound=w.round;
  if(action==='simulate'&&w.pendingMatchId)return {ok:false,message:'Davam edən matçı əvvəlcə tamamla.'};
  let result, psychological = true;
  if (action === 'resolve_event') result = resolveManagerEvent(w,payload.eventId,payload.choiceId);
  else if (action === 'mentor') result = assignMentor(w,payload.mentorId,payload.menteeId);
  else if (action === 'meeting') result = holdTeamMeeting(w,payload.approach ?? w.psychology.policies.coachStyle);
  else if (action === 'coach_style') result = setCoachStyle(w,payload.style ?? payload.value);
  else if (action === 'team_talk') result = giveTeamTalk(w,payload.phase,payload.style ?? w.psychology.policies.coachStyle,payload.context ?? {});
  else if (action === 'substitution') result = reactToSubstitution(w,payload.outgoingId,payload.incomingId,payload.minute,payload.reason,payload.style,payload.context);
  else if (action === 'begin_match') { psychological = false; result = beginManagerFixture(w,payload.fixtureId); }
  else { psychological = false; result = managerWorldAction(w,action,payload); }
  if (!result?.ok) return result ?? {ok:false,message:'Qərar tapılmadı.'};
  if(action==='next_season')startPsychologicalSeason(w,previousDay,previousRound);
  if (psychological) w.boardConfidence = clamp(w.boardConfidence+w.psychology.boardTrust-beforeBoard);
  else w.psychology.boardTrust = w.boardConfidence;
  if(psychological&&w.budget!==beforeBudget){w.ledger.unshift({id:`ledger-${w.season}-${++w.sequence}`,day:w.day,amount:w.budget-beforeBudget,balance:w.budget,description:'İnsan idarəetməsi: intizam qərarı'});w.ledger=w.ledger.slice(0,100);}
  if (action === 'simulate') {
    const score = result.context.score;
    noteResult(manager,result.result,`sim-${result.fixture.id}`,score);
  }
  // Daily and fixture keys prevent reloads or repeated menu rendering from farming events.
  if (action !== 'begin_match') generateManagerEvents(w,result.context ?? {});
  refreshManagerPsychology(w);
  syncManagerSummary(manager);
  manager.activityLog.unshift({day:w.day,kind:action,message:result.message});
  manager.activityLog = manager.activityLog.slice(0,20);
  return result;
}
export function managerMatchOptions(manager) {
  const w = ensureManagerSimulation(manager);
  const prepared = prepareManagerMatch(w);
  if (!prepared.ok) return prepared;
  prepared.options.managerUserName = prepared.userClub.name;
  prepared.options.managerOpponentName = prepared.opponent.name;
  return prepared;
}
export function applyManagerSimulationResult(manager, engine) {
  const w = ensureManagerSimulation(manager);
  const result = finishManagerMatch(w,engine);
  if (!result.ok) return result;
  w.psychology.boardTrust = w.boardConfidence;
  for (const sub of engine.substitutionEvents ?? []) reactToSubstitution(w,sub.outgoingPersistentId ?? sub.outId,sub.incomingPersistentId ?? sub.inId,sub.minute,sub.reason,sub.style ?? 'private',{fixtureId:result.fixture.id});
  generateManagerEvents(w,result.context);
  noteResult(manager,result.result,engine.matchId,engine.score);
  refreshManagerPsychology(w);
  syncManagerSummary(manager);
  manager.activityLog.unshift({day:w.day,kind:'match',message:result.message});
  manager.activityLog = manager.activityLog.slice(0,20);
  return result;
}
export { getNextFixture };
