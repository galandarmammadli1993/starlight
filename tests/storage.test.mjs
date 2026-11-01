import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchEngine } from '../src/game/engine.mjs';
import { MatchClock } from '../src/game/rules.mjs';
import { SAVE_KEY, DEFAULT_PROFILE, loadSave, saveData, captureMatch, restoreMatch, recordResult } from '../src/game/storage.mjs';

function memoryStorage(initial) {
  const values = new Map(initial === undefined ? [] : [[SAVE_KEY, initial]]);
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
function careerEngine(mode = 'player') {
  const engine = new MatchEngine({ mode }); engine.matchId = 'test-match'; return engine;
}
test('fresh save has independent defaults and empty career', () => {
  const one = loadSave(memoryStorage()), two = loadSave(memoryStorage());
  assert.deepEqual(one.profile, DEFAULT_PROFILE);
  assert.equal(one.version, 1); assert.equal(one.career.played, 0); assert.equal(one.suspended, null);
  one.profile.name = 'Changed'; assert.equal(two.profile.name, 'Alex Hero');
});
test('missing browser storage is harmless in Node', () => {
  assert.equal(loadSave(null).career.played, 0); assert.equal(saveData(loadSave(null), null), false);
});
test('invalid JSON, wrong versions and primitive roots recover safely', () => {
  for (const value of ['{broken', 'null', '[]', 'true', '{"version":99}']) {
    assert.deepEqual(loadSave(memoryStorage(value)).profile, DEFAULT_PROFILE);
  }
});
test('blocked and quota-exceeded localStorage does not throw', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } };
  assert.equal(loadSave(blocked).career.played, 0);
  assert.equal(saveData(loadSave(null), blocked), false);
});
test('invalid profile numbers and enums return to supported defaults', () => {
  const storage = memoryStorage(JSON.stringify({ version: 1, profile: {
    name: '\u0000', position: 'GK', shirtNumber: -5, kitColor: 'red', halfMinutes: 1, formation: '10-0-0',
  } }));
  assert.deepEqual(loadSave(storage).profile, DEFAULT_PROFILE);
});
test('valid profile persists and names remain plain data', () => {
  const storage = memoryStorage(), save = loadSave(storage);
  Object.assign(save.profile, { name: '<b>Alex</b>', position: 'FWD', kitColor: 'rose', halfMinutes: 20, shirtNumber: 99 });
  assert.equal(saveData(save, storage), true);
  assert.equal(loadSave(storage).profile.name, '<b>Alex</b>');
  assert.equal(loadSave(storage).profile.position, 'FWD');
  assert.equal(loadSave(storage).profile.kitColor, 'rose');
});
test('invalid save objects cannot overwrite valid stored progress', () => {
  const storage = memoryStorage(), save = loadSave(storage);
  save.career.played = 7; saveData(save, storage);
  assert.equal(saveData(null, storage), false); assert.equal(saveData({ version: 2 }, storage), false);
  assert.equal(loadSave(storage).career.played, 7);
});
test('capture creates a stable serializable match ID and bounded event log', () => {
  const engine = new MatchEngine();
  engine.eventLog = Array.from({ length: 200 }, (_, id) => ({ id, time: '00:00', type: 'TEST', message: 'Event' }));
  const snapshot = captureMatch(engine);
  assert.ok(snapshot.matchId); assert.equal(captureMatch(engine).matchId, snapshot.matchId);
  assert.equal(snapshot.eventLog.length, 80); assert.equal(JSON.parse(JSON.stringify(snapshot)).version, 1);
});
test('pending throw-in restores paused with taker and lawful restart intact', () => {
  const engine = careerEngine();
  engine._setupRestart({ type: 'THROW_IN', team: 0, x: 42, y: 0 });
  engine.stateAge = 3;
  const restored = restoreMatch(captureMatch(engine));
  assert.ok(restored instanceof MatchEngine); assert.equal(restored.state, 'PAUSED');
  assert.equal(restored.previousState, 'THROW_IN_SETUP'); assert.equal(restored.pausedStateAge, 3);
  assert.equal(restored.restart.type, 'THROW_IN'); assert.equal(restored.restart.x, 42);
  restored.resume(); assert.equal(restored.state, 'THROW_IN_SETUP');
  assert.equal(restored.action('pass'), true); assert.equal(restored.state, 'IN_PLAY');
  assert.ok(Math.hypot(restored.ball.vx, restored.ball.vy) > 0);
});
test('paused clock preserves its class, time and pause semantics', () => {
  const engine = careerEngine(); engine.clock.tick(30); engine.pause();
  const restored = restoreMatch(captureMatch(engine));
  assert.ok(restored.clock instanceof MatchClock);
  assert.equal(restored.clock.display, engine.clock.display);
  const elapsed = restored.clock.elapsed; restored.step(5);
  assert.equal(restored.clock.elapsed, elapsed); assert.equal(restored.state, 'PAUSED');
});
test('snapshot preserves ball trajectory, last touch, offside and keeper timers', () => {
  const engine = careerEngine(); engine.continueMatch();
  Object.assign(engine.ball, { owner: null, x: 70, y: 10, z: 3, vx: 15, vy: -4, vz: 2 });
  engine.offside = { team: 0, direction: 1, line: 85, secondLast: 85, ballX: 70, source: 'OPEN_PLAY', candidates: [9] };
  engine.keeperTime = 6; engine.lastKicker = 7; engine.kickCooldown = .1;
  const restored = restoreMatch(captureMatch(engine));
  assert.deepEqual(restored.ball, engine.ball); assert.deepEqual(restored.offside, engine.offside);
  assert.equal(restored.keeperTime, 6); assert.equal(restored.lastKicker, 7); assert.equal(restored.kickCooldown, .1);
});
test('invalid coordinates, duplicate player IDs and invalid owner reject snapshot', () => {
  const snapshot = captureMatch(careerEngine());
  const invalidX = structuredClone(snapshot); invalidX.players[0].x = Infinity;
  const duplicate = structuredClone(snapshot); duplicate.players[1].id = duplicate.players[0].id;
  const owner = structuredClone(snapshot); owner.ball.owner = 200;
  const missing = structuredClone(snapshot); missing.players.pop();
  for (const value of [invalidX, duplicate, owner, missing, null]) assert.equal(restoreMatch(value), null);
});
test('unresumable setup with no valid restart is rejected', () => {
  const snapshot = captureMatch(careerEngine()); snapshot.restart = null;
  assert.equal(restoreMatch(snapshot), null);
});
test('restart taker must belong to the awarded team and remain eligible', () => {
  const snapshot = captureMatch(careerEngine());
  snapshot.restart.takerId = 12;
  assert.equal(restoreMatch(snapshot), null);
  snapshot.restart.takerId = 9;
  snapshot.players[9].sentOff = true;
  assert.equal(restoreMatch(snapshot), null);
});
test('out-of-play pending restart survives Main Menu save/load', () => {
  const storage = memoryStorage(), save = loadSave(storage), engine = careerEngine();
  engine.continueMatch(); engine._stop({ type: 'CORNER_KICK', team: 1, x: 0, y: 68 });
  engine.pause(); save.suspended = captureMatch(engine); assert.equal(saveData(save, storage), true);
  const restored = restoreMatch(loadSave(storage).suspended);
  assert.equal(restored.previousState, 'OUT_OF_PLAY'); assert.equal(restored.pendingRestart.type, 'CORNER_KICK');
  restored.resume(); restored.step(1);
  assert.equal(restored.state, 'CORNER_KICK_SETUP');
});
test('half-time and full-time snapshots preserve explicit states', () => {
  for (const state of ['HALF_TIME', 'FULL_TIME']) {
    const engine = careerEngine(); engine.state = state;
    assert.equal(restoreMatch(captureMatch(engine)).state, state);
  }
});
test('only completed player or manager matches add career results', () => {
  const save = loadSave(memoryStorage()), engine = careerEngine();
  assert.equal(recordResult(save, engine), false);
  const quick = careerEngine('quick'); quick.state = 'FULL_TIME';
  assert.equal(recordResult(save, quick), false); assert.equal(save.career.played, 0);
});
test('completed career match records once across save/load and restored snapshots', () => {
  const storage = memoryStorage(), save = loadSave(storage), engine = careerEngine();
  engine.state = 'FULL_TIME'; engine.score = [3, 1];
  assert.equal(recordResult(save, engine), true); assert.equal(recordResult(save, engine), false);
  assert.equal(save.career.played, 1); assert.equal(save.career.won, 1); assert.equal(save.career.goals, 3);
  saveData(save, storage);
  const second = careerEngine(); second.state = 'FULL_TIME'; second.score = [3, 1];
  assert.equal(recordResult(loadSave(storage), second), false);
  const restored = restoreMatch(captureMatch(engine));
  assert.equal(recordResult(loadSave(storage), restored), false);
});
test('league draws and losses are recorded correctly', () => {
  const save = loadSave(memoryStorage());
  const draw = careerEngine('manager'); draw.matchId = 'draw'; draw.state = 'FULL_TIME'; draw.score = [2, 2];
  const loss = careerEngine('player'); loss.matchId = 'loss'; loss.state = 'FULL_TIME'; loss.score = [0, 1];
  assert.equal(recordResult(save, draw), true); assert.equal(recordResult(save, loss), true);
  assert.equal(save.career.played, 2); assert.equal(save.career.drawn, 1); assert.equal(save.career.lost, 1);
  assert.equal(save.career.results[0].result, 'loss');
});
test('career history is bounded to twenty and discarded results remain deduplicated', () => {
  const save = loadSave(memoryStorage());
  for (let i = 0; i < 25; i++) {
    const engine = careerEngine(); engine.matchId = `match-${i}`; engine.state = 'FULL_TIME';
    assert.equal(recordResult(save, engine), true);
  }
  assert.equal(save.career.results.length, 20); assert.equal(save.career.played, 25);
  const replay = careerEngine(); replay.matchId = 'match-0'; replay.state = 'FULL_TIME';
  assert.equal(recordResult(save, replay), false);
});
test('negative career fields and malformed suspended data cannot corrupt progress', () => {
  const storage = memoryStorage(JSON.stringify({ version: 1, career: { played: -4, won: '7', goals: 2 }, suspended: { state: 'IN_PLAY' } }));
  const save = loadSave(storage);
  assert.equal(save.career.played, 0); assert.equal(save.career.won, 0); assert.equal(save.career.goals, 2);
  assert.equal(save.suspended, null);
});
for (const [half, event] of [[1, 'HALF_TIME'], [2, 'FULL_TIME']]) {
  test(`${event} stays deferred until the saved in-progress penalty finishes`, () => {
    const storage = memoryStorage(), save = loadSave(storage), engine = careerEngine();
    engine._setupRestart({ type: 'PENALTY', team: 0, x: 94, y: 34 });
    engine.clock.half = half; engine.clock.elapsed = 2759.99; engine.clock.addedSeconds = 60;
    engine.step(.1);
    assert.equal(engine.state, 'PENALTY_SETUP'); assert.equal(engine.deferredClockEvent, event);
    assert.equal(engine.action('shoot'), true); assert.equal(engine.penaltyInProgress, true);
    engine.pause(); save.suspended = captureMatch(engine); assert.equal(saveData(save, storage), true);
    const restored = restoreMatch(loadSave(storage).suspended);
    assert.equal(restored.state, 'PAUSED'); assert.equal(restored.previousState, 'IN_PLAY');
    assert.equal(restored.penaltyInProgress, true); assert.equal(restored.deferredClockEvent, event);
    assert.equal(restored.clock.halfEnded, true); restored.resume();
    assert.equal(restored.state, 'IN_PLAY');
    Object.assign(restored.ball, { x: 104.9, y: 34, z: 1, vx: 40, vy: 0, vz: 0, owner: null });
    restored.step(1 / 60);
    assert.equal(restored.state, event); assert.deepEqual(restored.score, [1, 0]);
    assert.equal(restored.deferredClockEvent, null); assert.equal(restored.penaltyInProgress, false);
  });
}
test('invalid penalty extension fields are normalized safely', () => {
  const snapshot = captureMatch(careerEngine());
  snapshot.penaltyInProgress = 'true'; snapshot.deferredClockEvent = 'PAUSED';
  const restored = restoreMatch(snapshot);
  assert.equal(restored.penaltyInProgress, false); assert.equal(restored.deferredClockEvent, null);
});
