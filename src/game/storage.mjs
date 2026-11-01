import { MatchEngine } from './engine.mjs';

export const SAVE_KEY = 'footba11-heroes-save-v1';
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
    players.push({ id: p.id, team: p.team, number: integer(p.number, p.id % 11 + 1, 1, 99),
      name: text(p.name, 'Player', 32), role: choose(p.role, ['GK', 'DEF', 'MID', 'FWD'], 'MID'),
      x: p.x, y: p.y, vx: num(p.vx, 0, -300, 300), vy: num(p.vy, 0, -300, 300),
      homeX: num(p.homeX, 52.5, -10, 115), homeY: num(p.homeY, 34, -10, 78),
      stamina: num(p.stamina, 100, 0, 100), sentOff: !!p.sentOff, yellow: integer(p.yellow, 0, 0, 2),
      timer: num(p.timer, 0, -100, 100), faceX: num(p.faceX, p.team ? -1 : 1, -1, 1),
      faceY: num(p.faceY, 0, -1, 1), animation: text(p.animation, 'idle', 20),
      animationTime: num(p.animationTime, 0, 0, 1000), substituted: !!p.substituted,
      challengeWait: num(p.challengeWait, 0, 0, 100), lastPassTime: num(p.lastPassTime, 0),
    });
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
  const snapshot = {
    version: 1, matchId: text(value.matchId, '', 100) || identifier(), resultRecorded: !!value.resultRecorded,
    options, players,
    ball: { x: b.x, y: b.y, z: b.z, vx: num(b.vx, 0, -300, 300), vy: num(b.vy, 0, -300, 300),
      vz: num(b.vz, 0, -300, 300), owner: b.owner,
      lastTouch: { team: b.lastTouch.team, playerId: b.lastTouch.playerId } },
    directions: Array.isArray(value.directions) && value.directions.length === 2
      && value.directions[0] === -value.directions[1] && Math.abs(value.directions[0]) === 1
      ? [...value.directions] : [1, -1],
    score: two(value.score).map(Math.floor), formation: choose(value.formation, FORMATIONS, options.formation),
    tactic: choose(value.tactic, ['balanced', 'press', 'wide', 'counter'], 'balanced'),
    state: value.state, previousState: choose(value.previousState, STATES.filter((s) => s !== 'PAUSED'), 'IN_PLAY'),
    stateAge: num(value.stateAge), pausedStateAge: num(value.pausedStateAge, num(value.stateAge)),
    time: num(value.time), accumulator: num(value.accumulator, 0, 0, 2),
    controlled: playerId(value.controlled) ? value.controlled : 6,
    careerPlayer: playerId(value.careerPlayer) ? value.careerPlayer : 6,
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
  return { version: 1, profile: { ...DEFAULT_PROFILE }, career: careerOf(null), suspended: null };
}
export function loadSave(storage) {
  try {
    const raw = storageOrDefault(storage)?.getItem(SAVE_KEY);
    if (!raw || raw.length > 2_000_000) return emptySave();
    const data = JSON.parse(raw);
    if (!isObject(data) || data.version !== 1) return emptySave();
    return { version: 1, profile: profileOf(data.profile), career: careerOf(data.career),
      suspended: sanitizeSnapshot(data.suspended) };
  } catch { return emptySave(); }
}
export function saveData(data, storage) {
  try {
    const target = storageOrDefault(storage);
    if (!target || !isObject(data) || data.version !== 1) return false;
    const value = { version: 1, profile: profileOf(data.profile), career: careerOf(data.career),
      suspended: sanitizeSnapshot(data.suspended) };
    target.setItem(SAVE_KEY, JSON.stringify(value));
    return true;
  } catch { return false; }
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
  save.career = careerOf(save.career);
  if (engine.resultRecorded || save.career.recordedIds.includes(engine.matchId)) return false;
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
