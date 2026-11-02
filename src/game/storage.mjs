import { MatchEngine } from './engine.mjs';
import { ensureCareers, applyCareerMatch } from './career.mjs';

export const SAVE_KEY = 'footba11-heroes-save-v1';
export const BACKUP_SAVE_KEY = `${SAVE_KEY}-backup`;
export const SAVE_BACKUP_KEY = BACKUP_SAVE_KEY;
export const MAX_SAVE_CHARS = 8 * 1024 * 1024;
export const DEFAULT_PROFILE = Object.freeze({
  name: 'Alex Hero', position: 'MID', shirtNumber: 10, kitColor: 'mint',
  halfMinutes: 12, formation: '4-3-3',
});
const FORMATIONS = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2'];
const STATES = ['PRE_MATCH', 'KICK_OFF_SETUP', 'IN_PLAY', 'OUT_OF_PLAY', 'THROW_IN_SETUP',
  'GOAL_KICK_SETUP', 'CORNER_KICK_SETUP', 'FREE_KICK_SETUP', 'PENALTY_SETUP',
  'OFFSIDE_RESTART', 'GOAL_CELEBRATION', 'HALF_TIME', 'FULL_TIME', 'PAUSED'];
const RESTART_TYPES = ['KICK_OFF', 'THROW_IN', 'CORNER_KICK', 'GOAL_KICK', 'DIRECT_FREE_KICK',
  'INDIRECT_FREE_KICK', 'FREE_KICK', 'PENALTY', 'DROPPED_BALL', 'GOAL'];
const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const num = (v, fallback = 0, lo = 0, hi = 1e8) => finite(v, lo, hi) ? v : fallback;
const integer = (v, fallback = 0, lo = 0, hi = 1e8) => Number.isInteger(v) && finite(v, lo, hi) ? v : fallback;
const choose = (v, values, fallback) => values.includes(v) ? v : fallback;
const text = (v, fallback = '', limit = 120) => typeof v === 'string'
  ? v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, limit) : fallback;
const playerId = (v) => Number.isInteger(v) && v >= 0 && v < 22;
const teamId = (v) => v === 0 || v === 1;
const two = (v, fallback = [0, 0]) => Array.isArray(v) && v.length === 2
  ? v.map((n, i) => num(n, fallback[i])) : [...fallback];
function storageOrDefault(storage) {
  try { return storage === undefined ? globalThis.localStorage : storage; } catch { return null; }
}
function identifier() {
  return globalThis.crypto?.randomUUID?.() ?? `match-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function profileOf(value) {
  const p = isObject(value) ? value : {};
  return {
    name: text(p.name, DEFAULT_PROFILE.name, 24) || DEFAULT_PROFILE.name,
    position: choose(p.position, ['DEF', 'MID', 'FWD'], DEFAULT_PROFILE.position),
    shirtNumber: integer(p.shirtNumber, DEFAULT_PROFILE.shirtNumber, 2, 99),
    kitColor: choose(p.kitColor, ['mint', 'blue', 'rose'], DEFAULT_PROFILE.kitColor),
    halfMinutes: choose(p.halfMinutes, [5, 8, 12, 15, 20, 45], DEFAULT_PROFILE.halfMinutes),
    formation: choose(p.formation, FORMATIONS, DEFAULT_PROFILE.formation),
  };
}
function careerOf(value) {
  const c = isObject(value) ? value : {};
  const career = { played: integer(c.played), won: integer(c.won), drawn: integer(c.drawn),
    lost: integer(c.lost), goals: integer(c.goals), results: [], recordedIds: [] };
  if (Array.isArray(c.results)) career.results = c.results.filter(isObject).slice(0, 20).map((r) => ({
    id: text(r.id, '', 100), mode: choose(r.mode, ['player', 'manager'], 'player'),
    score: two(r.score).map(Math.floor), result: choose(r.result, ['win', 'draw', 'loss'], 'draw'),
    date: text(r.date, '', 40),
  })).filter((r) => r.id);
  if (Array.isArray(c.recordedIds)) career.recordedIds = [...new Set(c.recordedIds
    .filter((v) => typeof v === 'string' && v.length > 0 && v.length <= 100))].slice(-10000);
  for (const r of career.results) if (!career.recordedIds.includes(r.id)) career.recordedIds.push(r.id);
  return career;
}
function restartOf(value) {
  if (!isObject(value) || !RESTART_TYPES.includes(value.type) || !teamId(value.team)
    || !finite(value.x, -1, 106) || !finite(value.y, -1, 69)) return null;
  const r = { type: value.type, team: value.team, x: value.x, y: value.y,
    z: num(value.z, .11, 0, 100), offside: !!value.offside };
  if (playerId(value.takerId)) r.takerId = value.takerId;
  if (['YELLOW', 'SECOND_YELLOW', 'RED'].includes(value.card)) r.card = value.card;
  if (value.reason) r.reason = text(value.reason);
  if (value.side) r.side = text(value.side, '', 12);
  if (isObject(value.crossing)) r.crossing = { x: num(value.crossing.x, 0, -1000, 1000),
    y: num(value.crossing.y, 0, -1000, 1000), z: num(value.crossing.z, .11, 0, 1000) };
  return r;
}
function attributesOf(value) {
  if (!isObject(value)) return undefined;
  return Object.fromEntries(['pace', 'passing', 'shooting', 'defending', 'fitness', 'energy', 'morale',
    'confidence', 'trust', 'experience', 'focus', 'cooperation', 'discipline', 'composure', 'stress']
    .filter(key => finite(value[key], 0, 100)).map(key => [key, value[key]]));
}
const persistentId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/.test(value);
function detailsOf(value, depth = 0) {
  if (!isObject(value) || depth > 3) return {};
  const out = {};
  for (const [key, item] of Object.entries(value).slice(0, 60)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) continue;
    if (typeof item === 'number' && Number.isFinite(item)) out[key] = Math.max(-10000, Math.min(10000, item));
    else if (typeof item === 'string') out[key] = text(item, '', 160);
    else if (typeof item === 'boolean' || item === null) out[key] = item;
    else if (isObject(item)) out[key] = detailsOf(item, depth + 1);
    else if (Array.isArray(item)) out[key] = item.slice(0, 30).filter(x => ['string', 'number', 'boolean'].includes(typeof x)).map(x => typeof x === 'string' ? text(x, '', 100) : typeof x === 'number' ? num(x, 0, -10000, 10000) : x);
  }
  return out;
}
function rosterPersonOf(value) {
  if (!isObject(value)) return null;
  const id = value.persistentId ?? value.id;
  if (!persistentId(id)) return null;
  return { id, persistentId: id, name: text(value.name, 'Player', 80),
    clubId: text(value.clubId, '', 80), number: integer(value.number, 1, 1, 99),
    role: choose(value.role, ['GK', 'DEF', 'MID', 'FWD'], 'MID'),
    naturalRole: choose(value.naturalRole ?? value.role, ['GK', 'DEF', 'MID', 'FWD'], 'MID'),
    age: integer(value.age, 24, 15, 50), attributes: attributesOf(value.attributes) ?? {},
    morale: num(value.morale, 70, 0, 100), confidence: num(value.confidence, 70, 0, 100),
    trust: num(value.trust, 60, 0, 100), experience: num(value.experience, 50, 0, 100),
    fitness: num(value.fitness, 80, 0, 100), energy: num(value.energy, num(value.fitness, 80, 0, 100), 0, 100), fatigue: num(value.fatigue, 0, 0, 100),
    stamina: num(value.stamina, 80, 0, 100), injuryDays: integer(value.injuryDays, 0, 0, 365),
    suspension: integer(value.suspension, 0, 0, 20), suspendedMatches: integer(value.suspendedMatches, 0, 0, 20),
    status: text(value.status, 'rotation', 30), dominantFoot: choose(value.dominantFoot, ['left', 'right', 'both'], 'right'),
    psych: detailsOf(value.psych), psychMatch: detailsOf(value.psychMatch), appearance: detailsOf(value.appearance), group: text(value.group, '', 80),
  };
}
function rosterOf(value, limit = 25) {
  if (!Array.isArray(value)) return [];
  const ids = new Set();
  return value.slice(0, limit).map(rosterPersonOf).filter(person => person && !ids.has(person.persistentId) && ids.add(person.persistentId));
}
function managerStatsOf(value) {
  if (!isObject(value)) return {};
  const out = {};
  for (const [key, item] of Object.entries(value).slice(0, 60)) {
    if (!persistentId(key) || !isObject(item)) continue;
    out[key] = { persistentId: key, team: teamId(item.team) ? item.team : 0,
      name: text(item.name, 'Player', 80), minutes: num(item.minutes, 0, 0, 160),
      goals: integer(item.goals, 0, 0, 100), assists: integer(item.assists, 0, 0, 100),
      passes: integer(item.passes, 0, 0, 10000), completedPasses: integer(item.completedPasses, 0, 0, 10000),
      shots: integer(item.shots, 0, 0, 10000), keyPasses: integer(item.keyPasses, 0, 0, 10000), yellow: integer(item.yellow, 0, 0, 2),
      red: item.red === true || item.red === 1, rating: num(item.rating, 6, 0, 10), fitness: num(item.fitness, 80, 0, 100) };
  }
  return out;
}
function sanitizeSnapshot(value) {
  if (!isObject(value) || value.version !== 1 || !STATES.includes(value.state)
    || !Array.isArray(value.players) || value.players.length !== 22
    || !isObject(value.ball) || !isObject(value.clock)) return null;
  const ids = new Set();
  const players = [];
  for (const p of value.players) {
    if (!isObject(p) || !playerId(p.id) || ids.has(p.id) || p.team !== Math.floor(p.id / 11)
      || !finite(p.x, -1000, 1000) || !finite(p.y, -1000, 1000)) return null;
    ids.add(p.id);
    const player = { id: p.id, team: p.team, number: integer(p.number, p.id % 11 + 1, 1, 99),
      name: text(p.name, 'Player', 32), role: choose(p.role, ['GK', 'DEF', 'MID', 'FWD'], 'MID'),
      x: p.x, y: p.y, vx: num(p.vx, 0, -300, 300), vy: num(p.vy, 0, -300, 300),
      homeX: num(p.homeX, 52.5, -10, 115), homeY: num(p.homeY, 34, -10, 78),
      stamina: num(p.stamina, 100, 0, 100), sentOff: !!p.sentOff, yellow: integer(p.yellow, 0, 0, 2),
      timer: num(p.timer, 0, -100, 100), faceX: num(p.faceX, p.team ? -1 : 1, -1, 1),
      faceY: num(p.faceY, 0, -1, 1), animation: text(p.animation, 'idle', 20),
      animationTime: num(p.animationTime, 0, 0, 1000), substituted: !!p.substituted,
      challengeWait: num(p.challengeWait, 0, 0, 100), lastPassTime: num(p.lastPassTime, 0),
      enteredAsSub: p.enteredAsSub === true,
    };
    if (persistentId(p.persistentId)) {
      const person = rosterPersonOf(p);
      for (const key of ['persistentId', 'naturalRole', 'attributes', 'age', 'morale', 'confidence', 'trust', 'experience', 'fitness', 'energy', 'fatigue', 'psych', 'psychMatch', 'appearance', 'group']) player[key] = person[key];
    }
    players.push(player);
  }
  players.sort((a, b) => a.id - b.id);
  const b = value.ball;
  if (!finite(b.x, -1000, 1000) || !finite(b.y, -1000, 1000) || !finite(b.z, 0, 1000)
    || (b.owner !== null && !playerId(b.owner)) || !teamId(b.lastTouch?.team)
    || (b.lastTouch.playerId !== null && !playerId(b.lastTouch.playerId))) return null;
  if (b.owner !== null && players[b.owner].sentOff) return null;
  const options = { halfMinutes: choose(value.options?.halfMinutes, [5, 8, 12, 15, 20, 45], 12),
    mode: choose(value.options?.mode, ['quick', 'player', 'manager'], 'quick'),
    position: choose(value.options?.position, ['DEF', 'MID', 'FWD'], 'MID'),
    formation: choose(value.options?.formation, FORMATIONS, '4-3-3'), difficulty: 'normal' };
  if (attributesOf(value.options?.playerAttributes)) options.playerAttributes = attributesOf(value.options.playerAttributes);
  if (attributesOf(value.options?.teamAttributes)) options.teamAttributes = attributesOf(value.options.teamAttributes);
  for (const key of ['managerRoster', 'managerBench', 'playerRoster', 'playerBench', 'opponentRoster']) {
    if (Array.isArray(value.options?.[key])) options[key] = rosterOf(value.options[key], key.endsWith('Bench') ? 25 : 11);
  }
  for (const key of ['playerFixtureId', 'playerHeroId', 'playerUserClubId']) if (persistentId(value.options?.[key])) options[key] = value.options[key];
  if (finite(value.options?.playerWorldSeason, 1, 10000)) options.playerWorldSeason = Math.floor(value.options.playerWorldSeason);
  if (typeof value.options?.playerUserIsHome === 'boolean') options.playerUserIsHome = value.options.playerUserIsHome;
  if (['starter', 'bench', 'omitted'].includes(value.options?.playerSelection)) options.playerSelection = value.options.playerSelection;
  if (finite(value.options?.playerEntryMinute, 0, 130)) options.playerEntryMinute = value.options.playerEntryMinute;
  if (finite(value.options?.playerCoachExitMinute, 0, 130)) options.playerCoachExitMinute = value.options.playerCoachExitMinute;
  if (finite(value.options?.playerExitMinute, 0, 130)) options.playerExitMinute = value.options.playerExitMinute;
  if (isObject(value.options?.playerAppearance)) options.playerAppearance = detailsOf(value.options.playerAppearance);
  if (persistentId(value.options?.managerFixtureId)) options.managerFixtureId = value.options.managerFixtureId;
  if (persistentId(value.options?.managerUserClubId)) options.managerUserClubId = value.options.managerUserClubId;
  if (finite(value.options?.managerWorldSeason, 1, 10000)) options.managerWorldSeason = Math.floor(value.options.managerWorldSeason);
  if (typeof value.options?.managerUserIsHome === 'boolean') options.managerUserIsHome = value.options.managerUserIsHome;
  if (typeof value.options?.managerHomeIsUser === 'boolean') options.managerHomeIsUser = value.options.managerHomeIsUser;
  for (const key of ['homeTeamName', 'awayTeamName', 'managerHomeName', 'managerAwayName', 'managerOpponentName', 'managerUserClubName', 'managerUserName', 'managerOpponentClubId', 'playerClubName', 'playerOpponentName']) {
    if (typeof value.options?.[key] === 'string') options[key] = text(value.options[key], '', 80);
  }
  if (Array.isArray(value.options?.teamNames) && value.options.teamNames.length === 2) options.teamNames = value.options.teamNames.map(name => text(name, 'Team', 80));
  if (options.managerFixtureId && (options.mode !== 'manager' || options.managerRoster?.length !== 11 || options.opponentRoster?.length !== 11)) return null;
  if (options.playerFixtureId && (options.mode !== 'player' || options.playerRoster?.length !== 11
    || options.opponentRoster?.length !== 11 || !persistentId(options.playerHeroId))) return null;
  const persistentPlayer = options.mode === 'player' && !!options.playerFixtureId;
  const snapshot = {
    version: 1, matchId: text(value.matchId, '', 100) || identifier(), resultRecorded: !!value.resultRecorded,
    options, players,
    ball: { x: b.x, y: b.y, z: b.z, vx: num(b.vx, 0, -300, 300), vy: num(b.vy, 0, -300, 300),
      vz: num(b.vz, 0, -300, 300), spin: num(b.spin, 0, -1, 1), owner: b.owner,
      lastTouch: { team: b.lastTouch.team, playerId: b.lastTouch.playerId } },
    directions: Array.isArray(value.directions) && value.directions.length === 2
      && value.directions[0] === -value.directions[1] && Math.abs(value.directions[0]) === 1
      ? [...value.directions] : [1, -1],
    score: two(value.score).map(Math.floor), formation: choose(value.formation, FORMATIONS, options.formation),
    tactic: choose(value.tactic, ['balanced', 'press', 'wide', 'counter'], 'balanced'),
    state: value.state, previousState: choose(value.previousState, STATES.filter((s) => s !== 'PAUSED'), 'IN_PLAY'),
    stateAge: num(value.stateAge), pausedStateAge: num(value.pausedStateAge, num(value.stateAge)),
    time: num(value.time), accumulator: num(value.accumulator, 0, 0, 2),
    controlled: playerId(value.controlled) || persistentPlayer && value.controlled === -1 ? value.controlled : 6,
    careerPlayer: playerId(value.careerPlayer) || persistentPlayer && value.careerPlayer === -1 ? value.careerPlayer : 6,
    clock: { halfMinutes: options.halfMinutes, elapsed: num(value.clock.elapsed, 0, 0, 10000),
      half: value.clock.half === 2 ? 2 : 1, addedSeconds: num(value.clock.addedSeconds, 0, 0, 10000),
      stoppedSeconds: num(value.clock.stoppedSeconds, 0, 0, 10000),
      finished: !!value.clock.finished, halfEnded: !!value.clock.halfEnded },
    stats: {}, notification: text(value.notification, '', 200), lastDecision: text(value.lastDecision, '', 200),
    eventLog: Array.isArray(value.eventLog) ? value.eventLog.filter(isObject).slice(0, 80).map((e) => ({
      id: integer(e.id), time: text(e.time, '00:00', 12), type: text(e.type, '', 32), message: text(e.message, '', 200),
    })) : [],
    sequence: integer(value.sequence), substitutions: integer(value.substitutions, 0, 0, 5),
    restart: restartOf(value.restart), pendingRestart: restartOf(value.pendingRestart),
    lastBoundary: restartOf(value.lastBoundary), restartOrigin: null, offside: null,
    selectedTarget: playerId(value.selectedTarget) ? value.selectedTarget : null,
    lastKicker: playerId(value.lastKicker) ? value.lastKicker : null,
    keeperHold: playerId(value.keeperHold) ? value.keeperHold : null,
    oneTwoRunner: playerId(value.oneTwoRunner) ? value.oneTwoRunner : null,
    keeperTime: num(value.keeperTime, 0, 0, 100), kickCooldown: num(value.kickCooldown, 0, 0, 100),
    dribbleTimer: num(value.dribbleTimer, 0, -100, 100), delayWarned: !!value.delayWarned,
    penaltyInProgress: value.penaltyInProgress === true,
    deferredClockEvent: choose(value.deferredClockEvent, ['HALF_TIME', 'FULL_TIME'], null),
    playerGoals: Object.fromEntries(Object.entries(isObject(value.playerGoals) ? value.playerGoals : {})
      .filter(([id, count]) => playerId(Number(id)) && Number.isInteger(count) && count >= 0 && count < 10000)),
  };
  snapshot.cameraMode = choose(value.cameraMode, ['close', 'broadcast'], options.mode === 'player' ? 'close' : 'broadcast');
  snapshot.hasPersistentRoster = persistentPlayer || value.hasPersistentRoster === true;
  if (persistentPlayer) {
    snapshot.hasPlayerCareerRoster = true;
    snapshot.heroPersistentId = persistentId(value.heroPersistentId) ? value.heroPersistentId : options.playerHeroId;
    if (snapshot.heroPersistentId !== options.playerHeroId) return null;
    snapshot.playerCareerStatus = choose(value.playerCareerStatus, ['playing', 'bench', 'omitted', 'substituted', 'sent_off'], 'playing');
    snapshot.playerCoachEntryMinute = num(value.playerCoachEntryMinute, options.playerEntryMinute ?? 60, 0, 130);
    snapshot.playerCoachSubstitutionReason = text(value.playerCoachSubstitutionReason, '', 80);
    for (const key of ['controlled', 'careerPlayer']) if (snapshot[key] >= 0 && players[snapshot[key]]?.persistentId !== snapshot.heroPersistentId) return null;
  }
  snapshot.bench = rosterOf(value.bench);
  snapshot.departedPersistentIds = Array.isArray(value.departedPersistentIds) ? [...new Set(value.departedPersistentIds.filter(persistentId))].slice(0, 25) : [];
  const activeIds = players.filter(p => p.persistentId).map(p => p.persistentId);
  if (persistentPlayer && activeIds.length !== 22) return null;
  if (new Set(activeIds).size !== activeIds.length || snapshot.bench.some(p => activeIds.includes(p.persistentId) || snapshot.departedPersistentIds.includes(p.persistentId))) return null;
  if (persistentPlayer) {
    const hero = players.find(p => p.persistentId === snapshot.heroPersistentId);
    if (snapshot.playerCareerStatus === 'playing') {
      if (!hero || hero.sentOff || snapshot.controlled !== hero.id || snapshot.careerPlayer !== hero.id) return null;
    } else {
      if (snapshot.controlled !== -1 || snapshot.careerPlayer !== -1) return null;
      if (snapshot.playerCareerStatus === 'sent_off' ? !hero?.sentOff : !!hero) return null;
      if (snapshot.playerCareerStatus === 'bench' && !snapshot.bench.some(p => p.persistentId === snapshot.heroPersistentId)) return null;
    }
  }
  snapshot.managerStats = managerStatsOf(value.managerStats);
  snapshot.substitutionEvents = Array.isArray(value.substitutionEvents) ? value.substitutionEvents.filter(isObject).slice(0, 10).map(event => ({
    outId: text(event.outId ?? event.outgoingPersistentId, '', 100), inId: text(event.inId ?? event.incomingPersistentId, '', 100),
    outgoingPersistentId: text(event.outgoingPersistentId ?? event.outId, '', 100), incomingPersistentId: text(event.incomingPersistentId ?? event.inId, '', 100),
    minute: num(event.minute, 0, 0, 160), reason: text(event.reason, 'tactical', 40),
    style: choose(event.style, ['private', 'supportive', 'public'], 'private'),
    outFitness: num(event.outFitness, 80, 0, 100), inFitness: num(event.inFitness, 80, 0, 100),
  })).filter(event => persistentId(event.outgoingPersistentId) && persistentId(event.incomingPersistentId)) : [];
  snapshot.matchMeta = { fixtureId: text(value.matchMeta?.fixtureId ?? options.managerFixtureId ?? options.playerFixtureId, '', 100),
    season: integer(value.matchMeta?.season ?? options.managerWorldSeason ?? options.playerWorldSeason, 1, 1, 10000),
    userClubId: text(value.matchMeta?.userClubId ?? options.managerUserClubId ?? options.playerUserClubId, '', 100) };
  if (isObject(value.lastAssistCandidate)) snapshot.lastAssistCandidate = {
    team: teamId(value.lastAssistCandidate.team) ? value.lastAssistCandidate.team : 0,
    playerId: playerId(value.lastAssistCandidate.playerId) ? value.lastAssistCandidate.playerId : null,
    receiverId: playerId(value.lastAssistCandidate.receiverId) ? value.lastAssistCandidate.receiverId : null,
    time: num(value.lastAssistCandidate.time),
  };
  for (const stat of ['shots', 'passes', 'completed', 'possession', 'corners', 'fouls', 'offsides']) snapshot.stats[stat] = two(value.stats?.[stat]);
  const origin = value.restartOrigin;
  if (isObject(origin) && RESTART_TYPES.includes(origin.type) && teamId(origin.team)) snapshot.restartOrigin = {
    type: origin.type, team: origin.team, untouched: !!origin.untouched,
  };
  const offside = value.offside;
  if (isObject(offside) && teamId(offside.team) && finite(offside.line, -1000, 1000)) snapshot.offside = {
    team: offside.team, direction: offside.direction === -1 ? -1 : 1, line: offside.line,
    secondLast: num(offside.secondLast, offside.line, -1000, 1000),
    ballX: num(offside.ballX, 52.5, -1000, 1000), source: text(offside.source, 'OPEN_PLAY', 32),
    candidates: Array.isArray(offside.candidates) ? [...new Set(offside.candidates.filter(playerId))] : [],
  };
  const effectiveState = snapshot.state === 'PAUSED' ? snapshot.previousState : snapshot.state;
  if (['KICK_OFF_SETUP', 'THROW_IN_SETUP', 'GOAL_KICK_SETUP', 'CORNER_KICK_SETUP',
    'FREE_KICK_SETUP', 'PENALTY_SETUP', 'OFFSIDE_RESTART'].includes(effectiveState)
    && (!snapshot.restart || !playerId(snapshot.restart.takerId)
      || snapshot.players[snapshot.restart.takerId].team !== snapshot.restart.team
      || snapshot.players[snapshot.restart.takerId].sentOff)) return null;
  if (['OUT_OF_PLAY', 'GOAL_CELEBRATION'].includes(effectiveState) && !snapshot.pendingRestart) return null;
  return snapshot;
}

function emptySave() {
  const save = { version: 1, profile: { ...DEFAULT_PROFILE }, career: careerOf(null), suspended: null,
    suspendedByMode: { quick: null, player: null, manager: null } };
  ensureCareers(save);return save;
}
function suspendedModes(value, legacy) {
  const snapshots = Object.fromEntries(['quick', 'player', 'manager'].map(mode => {
    const snapshot = sanitizeSnapshot(value?.[mode]);
    return [mode, snapshot?.options.mode === mode ? snapshot : null];
  }));
  if (!isObject(value) && legacy && ['quick', 'player', 'manager'].includes(legacy.options.mode)) snapshots[legacy.options.mode] = legacy;
  return snapshots;
}
function safeDocumentShape(value) {
  const pending = [{ value, depth: 0 }];let visited = 0;
  while (pending.length) {
    const { value: item, depth } = pending.pop();
    if (++visited > 350000 || depth > 40) return false;
    if (!item || typeof item !== 'object') continue;
    for (const [key, child] of Object.entries(item)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) return false;
      if (child && typeof child === 'object') pending.push({ value: child, depth: depth + 1 });
    }
  }
  return true;
}
function validPlayerJourney(journey) {
  if (journey === undefined || journey === null) return true;
  if (!isObject(journey) || journey.version !== 1 || journey.heroId !== 'player-hero'
    || !Number.isInteger(journey.season) || !finite(journey.season, 1, 10000)
    || !Number.isInteger(journey.round) || !finite(journey.round, 0, 14)
    || !Array.isArray(journey.clubs) || journey.clubs.length !== 8
    || !Array.isArray(journey.players) || journey.players.length < 11 || journey.players.length > 600
    || !Array.isArray(journey.fixtures) || journey.fixtures.length !== 56) return false;
  const clubs = new Set(journey.clubs.map(club => club?.id));
  const players = new Set(journey.players.map(player => player?.id));
  const fixtureIds = new Set(journey.fixtures.map(fixture => fixture?.id));
  if (clubs.size !== 8 || [...clubs].some(id => !persistentId(id))
    || players.size !== journey.players.length || fixtureIds.size !== 56
    || journey.clubId !== null && !clubs.has(journey.clubId)) return false;
  const hero = journey.players.find(player => player?.id === journey.heroId);
  if (!hero || hero.clubId !== journey.clubId) return false;
  if (journey.players.some(player => !persistentId(player?.id)
    || !clubs.has(player?.clubId) && !(player.id === journey.heroId && player.clubId === null))) return false;
  if (journey.fixtures.some(fixture => !persistentId(fixture?.id)
    || !clubs.has(fixture?.homeClubId) || !clubs.has(fixture?.awayClubId)
    || fixture.homeClubId === fixture.awayClubId || !Number.isInteger(fixture.round)
    || !finite(fixture.round, 0, 13))) return false;
  if (journey.pendingFixtureId !== null && journey.pendingFixtureId !== undefined
    && !fixtureIds.has(journey.pendingFixtureId)) return false;
  return true;
}
function documentOf(data) {
  if (!isObject(data) || data.version !== 1 || !safeDocumentShape(data)
    || !validPlayerJourney(data.careers?.player?.journey)) return null;
  const suspended = sanitizeSnapshot(data.suspended);
  const save = { version: 1, profile: profileOf(data.profile), career: careerOf(data.career),
    careers: data.careers, suspended, suspendedByMode: suspendedModes(data.suspendedByMode, suspended) };
  ensureCareers(save);return save;
}
function parseDocument(raw, strict = false) {
  try {
    if (typeof raw !== 'string' || !raw || raw.length > MAX_SAVE_CHARS) return null;
    const parsed = JSON.parse(raw);
    if (strict && (!isObject(parsed?.profile) || !isObject(parsed?.careers) && !isObject(parsed?.career))) return null;
    const world = parsed?.careers?.manager?.world;
    if (world !== undefined && world !== null) {
      if (!isObject(world) || world.version !== 1 || !Array.isArray(world.clubs) || world.clubs.length !== 8
        || !Array.isArray(world.players) || world.players.length < 11 || world.players.length > 600
        || !Array.isArray(world.fixtures) || world.fixtures.length !== 56 || !finite(world.budget, -1e7, 1e9)) return null;
      const clubs = new Set(world.clubs.map(club => club?.id)), ids = new Set(world.players.map(player => player?.id));
      if (clubs.size !== 8 || ids.size !== world.players.length || !clubs.has(world.userClubId)
        || world.players.some(player => !persistentId(player?.id) || !clubs.has(player?.clubId))) return null;
      const fixtureIds = new Set(world.fixtures.map(fixture => fixture?.id));
      if (fixtureIds.size !== 56 || world.fixtures.some(fixture => !persistentId(fixture?.id)
        || !clubs.has(fixture?.homeClubId) || !clubs.has(fixture?.awayClubId) || fixture.homeClubId === fixture.awayClubId)) return null;
    }
    return documentOf(parsed);
  } catch { return null; }
}
/** Load the last valid document. A corrupt main save never destroys its backup. */
export function loadSave(storage) {
  const target = storageOrDefault(storage);
  if (!target) return emptySave();
  try {
    const main = parseDocument(target.getItem(SAVE_KEY));
    if (main) return main;
  } catch { /* Blocked storage may still expose a valid backup via another binding. */ }
  try {
    const backup = parseDocument(target.getItem(SAVE_BACKUP_KEY));
    if (backup) { backup.recoveredFromBackup = true;return backup; }
  } catch { /* No usable persisted state. */ }
  return emptySave();
}
export function saveData(data, storage) {
  try {
    const target = storageOrDefault(storage), value = documentOf(data);
    if (!target || !value) return false;
    const serialized = JSON.stringify(value);
    if (serialized.length > MAX_SAVE_CHARS) return false;
    let previous = null;
    try { previous = target.getItem(SAVE_KEY); } catch { /* Main write still reports failure below if blocked. */ }
    if (previous && previous !== serialized && parseDocument(previous)) {
      try { target.setItem(SAVE_BACKUP_KEY, previous); } catch { /* A full backup quota must not prevent a valid main overwrite. */ }
    }
    target.setItem(SAVE_KEY, serialized);
    return true;
  } catch { return false; }
}
/** Portable, normalized save. A null result means the source cannot be exported. */
export function exportSave(data) {
  try {
    const value = documentOf(data);if (!value) return null;
    const serialized = JSON.stringify(value, null, 2);
    return serialized.length <= MAX_SAVE_CHARS ? serialized : null;
  } catch { return null; }
}
/** Parse-only by default. Supply a storage object to atomically persist on success. */
export function importSave(raw, storage) {
  const save = parseDocument(raw, true);
  if (!save) return null;
  if (arguments.length > 1 && !saveData(save, storage)) return null;
  return save;
}
export function captureMatch(engine) {
  if (!engine || !Array.isArray(engine.players)) return null;
  if (!engine.matchId) engine.matchId = identifier();
  return sanitizeSnapshot({ ...engine, version: 1 });
}
export function restoreMatch(value) {
  const snapshot = sanitizeSnapshot(value);
  if (!snapshot) return null;
  const engine = new MatchEngine(snapshot.options);
  for (const [key, v] of Object.entries(snapshot)) if (!['version', 'clock'].includes(key)) engine[key] = v;
  Object.assign(engine.clock, snapshot.clock);
  engine.input = { x: 0, y: 0, sprint: false, press: false, shield: false };
  if (!['PAUSED', 'HALF_TIME', 'FULL_TIME'].includes(engine.state)) {
    engine.previousState = engine.state;
    engine.pausedStateAge = engine.stateAge;
    engine.state = 'PAUSED';
  }
  return engine;
}
/** Career records are committed once per stable match ID, only after full time. */
export function recordResult(save, engine) {
  if (!save || !engine || engine.state !== 'FULL_TIME' || !['player', 'manager'].includes(engine.options?.mode)) return false;
  if (!engine.matchId) engine.matchId = identifier();
  ensureCareers(save);
  save.career = careerOf(save.career);
  if (engine.resultRecorded || save.career.recordedIds.includes(engine.matchId)) return false;
  if (!applyCareerMatch(save, engine)) return false;
  const score = two(engine.score).map(Math.floor);
  const result = score[0] === score[1] ? 'draw' : score[0] > score[1] ? 'win' : 'loss';
  save.career.played++;
  save.career[result === 'win' ? 'won' : result === 'draw' ? 'drawn' : 'lost']++;
  save.career.goals += score[0];
  save.career.results.unshift({ id: engine.matchId, mode: engine.options.mode, score, result, date: new Date().toISOString() });
  save.career.results = save.career.results.slice(0, 20);
  save.career.recordedIds.push(engine.matchId);
  save.career.recordedIds = save.career.recordedIds.slice(-10000);
  engine.resultRecorded = true;
  return true;
}
