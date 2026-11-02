import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchEngine } from '../src/game/engine.mjs';
import { createManagerWorld, prepareManagerMatch } from '../src/game/manager-world.mjs';
import { initializePsychology } from '../src/game/manager-psychology.mjs';
import { SAVE_KEY, SAVE_BACKUP_KEY, MAX_SAVE_CHARS, loadSave, saveData, exportSave, importSave, captureMatch, restoreMatch } from '../src/game/storage.mjs';

function memory() {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
function managerMatch() {
  const world = createManagerWorld(27, { budget: 150000 });
  initializePsychology(world);
  const prepared = prepareManagerMatch(world);
  assert.equal(prepared.ok, true);
  const engine = new MatchEngine({ ...prepared.options, halfMinutes: 5,
    homeTeamName: 'Baku Athletic', awayTeamName: prepared.opponent.name });
  engine.matchId = prepared.fixture.id;
  return { world, engine };
}

test('manager snapshot keeps actual persistent identities, attributes, names and home/away context', () => {
  const { engine } = managerMatch();
  engine.players[6].morale = 38;engine.players[6].confidence = 84;
  engine.players[6].psychMatch = { focus: .92, cooperation: 1.03, discipline: .87 };
  const restored = restoreMatch(captureMatch(engine));
  assert.equal(restored.hasPersistentRoster, true);
  assert.equal(restored.options.managerFixtureId, engine.options.managerFixtureId);
  assert.equal(restored.options.managerUserIsHome, engine.options.managerUserIsHome);
  assert.equal(restored.options.homeTeamName, 'Baku Athletic');
  assert.equal(restored.options.awayTeamName, engine.options.awayTeamName);
  assert.deepEqual(restored.players.map(p => p.persistentId), engine.players.map(p => p.persistentId));
  assert.deepEqual(restored.players[6].attributes, engine.players[6].attributes);
  assert.equal(restored.players[6].morale, 38);assert.equal(restored.players[6].confidence, 84);
  assert.deepEqual(restored.players[6].psychMatch, engine.players[6].psychMatch);
  assert.equal(restored.bench.length, 7);
});

test('a real bench substitution survives pause and restore with its separate identities and minutes', () => {
  const { engine } = managerMatch();
  engine._setupRestart({ type: 'THROW_IN', team: 0, x: 45, y: 0 });
  engine.clock.elapsed = 23 * 60;
  const outgoing = engine.players.find(p => p.team === 0 && engine.bench.some(b => b.role === p.naturalRole));
  const oldId = outgoing.persistentId, incoming = engine.bench.find(p => p.role === outgoing.naturalRole);
  engine.managerStats[oldId].minutes = 23;
  assert.equal(engine.substitute(outgoing.id, incoming.id, 'fitness'), true);
  engine.substitutionEvents.at(-1).style = 'public';
  engine.managerStats[incoming.id].minutes = 1.25;
  engine.pause();
  const restored = restoreMatch(captureMatch(engine));
  assert.equal(restored.state, 'PAUSED');
  assert.equal(restored.previousState, 'THROW_IN_SETUP');
  assert.equal(restored.players[outgoing.id].persistentId, incoming.id);
  assert.ok(restored.departedPersistentIds.includes(oldId));
  assert.equal(restored.bench.length, 6);
  assert.ok(!restored.bench.some(p => p.id === incoming.id || p.id === oldId));
  assert.equal(restored.managerStats[oldId].minutes, 23);
  assert.equal(restored.managerStats[incoming.id].minutes, 1.25);
  assert.equal(restored.substitutionEvents[0].outgoingPersistentId, oldId);
  assert.equal(restored.substitutionEvents[0].incomingPersistentId, incoming.id);
  assert.equal(restored.substitutionEvents[0].minute, 23);
  assert.equal(restored.substitutionEvents[0].reason, 'fitness');
  assert.equal(restored.substitutionEvents[0].style, 'public');
});

test('manager ledgers preserve bool red cards, assists and mental updates through a saved match', () => {
  const { engine } = managerMatch();engine.state = 'IN_PLAY';engine.restart = null;
  const p = engine.players[2];p.sentOff = true;p.yellow = 2;
  Object.assign(engine.managerStats[p.persistentId], { minutes: 36.5, goals: 1, assists: 2, red: true, yellow: 2 });
  engine.lastAssistCandidate = { team: 0, playerId: 6, receiverId: 9, time: 128.5 };
  const restored = restoreMatch(captureMatch(engine));
  assert.equal(restored.managerStats[p.persistentId].red, true);
  assert.equal(restored.managerStats[p.persistentId].assists, 2);
  assert.equal(restored.managerStats[p.persistentId].minutes, 36.5);
  assert.deepEqual(restored.lastAssistCandidate, engine.lastAssistCandidate);
  const row = restored.managerMatchReport.players.find(row => row.persistentId === p.persistentId);
  assert.equal(row.red, true);assert.equal(row.assists, 2);
});

test('a duplicate active/bench persistent identity cannot be imported as an eligible substitute', () => {
  const { engine } = managerMatch();const snapshot = captureMatch(engine);
  snapshot.bench[0].id = snapshot.players[0].persistentId;
  snapshot.bench[0].persistentId = snapshot.players[0].persistentId;
  assert.equal(restoreMatch(snapshot), null);
});

test('a valid previous save is kept as backup and recovered when the main document is corrupt', () => {
  const storage = memory(), save = loadSave(storage);
  save.profile.name = 'First manager';assert.equal(saveData(save, storage), true);
  save.profile.name = 'Second manager';assert.equal(saveData(save, storage), true);
  assert.ok(storage.values.has(SAVE_BACKUP_KEY));
  storage.values.set(SAVE_KEY, '{corrupt');
  const recovered = loadSave(storage);
  assert.equal(recovered.profile.name, 'First manager');
  assert.equal(recovered.recoveredFromBackup, true);
});

test('a corrupt main save is never copied over a valid backup during a later save', () => {
  const storage = memory(), save = loadSave(storage);
  save.profile.name = 'Preserved';saveData(save, storage);
  save.profile.name = 'Latest';saveData(save, storage);
  const backup = storage.values.get(SAVE_BACKUP_KEY);
  storage.values.set(SAVE_KEY, '{broken');
  assert.equal(saveData(save, storage), true);
  assert.equal(storage.values.get(SAVE_BACKUP_KEY), backup);
});

test('a failed main write reports failure and leaves the old persisted document intact', () => {
  const initial = exportSave(loadSave(null));
  const storage = { getItem: key => key === SAVE_KEY ? initial : null,
    setItem(key) { if (key === SAVE_KEY) throw new Error('quota'); } };
  const save = loadSave(storage);save.profile.name = 'Unsaved manager';
  assert.equal(saveData(save, storage), false);
  assert.equal(loadSave(storage).profile.name, 'Alex Hero');
});

test('export/import validates documents and refuses unsupported, dangerous or oversized data', () => {
  const save = loadSave(null);save.profile.name = 'Portable';
  const exported = exportSave(save);
  assert.equal(importSave(exported).profile.name, 'Portable');
  for (const raw of ['{}', '[]', '{broken', '{"version":99,"profile":{},"careers":{}}',
    '{"version":1,"profile":{},"careers":{"__proto__":{"polluted":true}}}',
    ' '.repeat(MAX_SAVE_CHARS + 1)]) assert.equal(importSave(raw), null);
  assert.equal({}.polluted, undefined);
  assert.equal(exportSave({ version: 2 }), null);
});

test('import can explicitly persist and report quota failure without overwriting a valid save', () => {
  const storage = memory(), save = loadSave(null);save.profile.name = 'Imported';
  assert.equal(importSave(exportSave(save), storage).profile.name, 'Imported');
  assert.equal(loadSave(storage).profile.name, 'Imported');
  const blocked = { getItem() { return null; }, setItem() { throw new Error('quota'); } };
  assert.equal(importSave(exportSave(save), blocked), null);
});

test('portable save retains the persistent manager season, psychology and two independent unfinished careers', () => {
  const { world, engine } = managerMatch(), save = loadSave(null);
  save.careers.manager.world = world;
  const player = new MatchEngine({ mode: 'player' });player.matchId = 'personal-match';
  save.suspendedByMode.manager = captureMatch(engine);
  save.suspendedByMode.player = captureMatch(player);
  const reloaded = importSave(exportSave(save));
  assert.equal(reloaded.careers.manager.world.players.length, world.players.length);
  assert.equal(reloaded.careers.manager.world.fixtures.length, 56);
  assert.equal(reloaded.careers.manager.world.psychology.initialized, true);
  assert.equal(reloaded.suspendedByMode.manager.options.managerFixtureId, engine.options.managerFixtureId);
  assert.equal(reloaded.suspendedByMode.player.matchId, 'personal-match');
});

test('import rejects duplicate roster identities, duplicate fixtures and unsupported world schemas', () => {
  const { world } = managerMatch(), save = loadSave(null);save.careers.manager.world = world;
  const exported = JSON.parse(exportSave(save));
  const players = structuredClone(exported);players.careers.manager.world.players[1].id = players.careers.manager.world.players[0].id;
  const fixtures = structuredClone(exported);fixtures.careers.manager.world.fixtures[1].id = fixtures.careers.manager.world.fixtures[0].id;
  const version = structuredClone(exported);version.careers.manager.world.version = 99;
  const budget = structuredClone(exported);budget.careers.manager.world.budget = 'free money';
  for (const data of [players, fixtures, version, budget]) assert.equal(importSave(JSON.stringify(data)), null);
});

test('semantically corrupt manager state falls back to the previous valid season document', () => {
  const { world } = managerMatch(), storage = memory(), save = loadSave(null);
  save.careers.manager.world = world;save.profile.name = 'Backup coach';saveData(save, storage);
  save.profile.name = 'Current coach';saveData(save, storage);
  const broken = JSON.parse(storage.values.get(SAVE_KEY));broken.careers.manager.world.players[1].id = broken.careers.manager.world.players[0].id;
  storage.values.set(SAVE_KEY, JSON.stringify(broken));
  const recovered = loadSave(storage);assert.equal(recovered.profile.name, 'Backup coach');
  assert.equal(recovered.careers.manager.world.fixtures.length, 56);assert.equal(recovered.recoveredFromBackup, true);
});
