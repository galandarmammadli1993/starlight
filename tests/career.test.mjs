import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureCareers, getCareerView, careerAction, getPlayerAttributes, getManagerAttributes, setTrainingFocus, setManagerPlan, applyCareerMatch } from '../src/game/career.mjs';
const fresh = () => ({ version: 1, profile: { name: 'Hero' }, career: { results: [] } });
const match = (mode, id = 'match-1', score = [2, 1]) => ({ state: 'FULL_TIME', options: { mode }, matchId: id, score, careerPlayer: 6, playerGoals: { 6: 1, 9: 1 } });

test('player life and manager club start with separate state and no shared references', () => {
  const save = fresh(), careers = ensureCareers(save);
  assert.equal(careers.player.energy, 85);assert.equal(careers.manager.budget, 50000);
  assert.equal(careers.player.appearances, 0);assert.equal(careers.manager.record.played, 0);
  assert.notEqual(careers.player.results, careers.manager.results);
});
test('legacy mode-tagged history migrates without deleting the original totals', () => {
  const save = fresh();save.career = { played: 35, goals: 87, results: [
    { id: 'p', mode: 'player', score: [2, 0], result: 'win' },
    { id: 'm', mode: 'manager', score: [1, 1], result: 'draw' },
  ] };
  const c = ensureCareers(save);
  assert.equal(save.career.played, 35);assert.equal(save.career.goals, 87);
  assert.equal(c.player.appearances, 1);assert.equal(c.manager.record.played, 1);assert.equal(c.manager.record.drawn, 1);
  assert.deepEqual(c.player.completedMatchIds, ['p']);assert.deepEqual(c.manager.completedMatchIds, ['m']);
});
test('player training changes real match attributes and spends energy and one day', () => {
  const save = fresh();const before = getPlayerAttributes(save);
  assert.equal(careerAction(save, 'player', 'train_passing').ok, true);
  const after = getPlayerAttributes(save);
  assert.equal(after.passing, before.passing + 2);assert.equal(after.energy, before.energy - 18);
  assert.equal(save.careers.player.day, 2);assert.equal(save.careers.player.balance, 980);
  assert.equal(save.careers.manager.day, 1);
});
test('exhausted player cannot train without recovery and failed action consumes no day', () => {
  const save = fresh();ensureCareers(save).player.energy = 2;
  assert.equal(careerAction(save, 'player', 'train_shooting').ok, false);
  assert.equal(save.careers.player.day, 1);assert.equal(save.careers.player.skills.shooting, 60);
  assert.equal(careerAction(save, 'player', 'rest').ok, true);
  assert.equal(careerAction(save, 'player', 'train_shooting').ok, true);
});
test('salary is paid once at a weekly boundary and daily living costs remain accounted', () => {
  const save = fresh();ensureCareers(save);
  for (let i = 0; i < 7; i++) careerAction(save, 'player', 'rest');
  assert.equal(save.careers.player.day, 8);assert.equal(save.careers.player.balance, 1000 + 700 - 7 * 20);
  careerAction(save, 'player', 'rest');assert.equal(save.careers.player.balance, 1000 + 700 - 8 * 20);
  assert.equal(save.careers.player.activityLog.filter(a => a.kind === 'salary').length, 1);
});
test('community activity affects personal reputation without changing club morale or finances', () => {
  const save = fresh();const manager = structuredClone(ensureCareers(save).manager);
  careerAction(save, 'player', 'community');
  assert.equal(save.careers.player.reputation, 12);assert.deepEqual(save.careers.manager, manager);
});
test('club training improves match preparation with real budget and fitness costs', () => {
  const save = fresh();const before = getManagerAttributes(save);
  careerAction(save, 'manager', 'team_training');
  assert.equal(save.careers.manager.budget, 49500);assert.equal(save.careers.manager.teamFitness, 68);
  assert.ok(getManagerAttributes(save).passing > before.passing);
  assert.equal(save.careers.player.day, 1);assert.equal(save.careers.player.energy, 85);
});
test('club cannot buy development or reports without money', () => {
  const save = fresh();ensureCareers(save).manager.budget = 100;
  for (const action of ['team_training', 'scouting', 'youth', 'recovery']) assert.equal(careerAction(save, 'manager', action).ok, false);
  assert.equal(save.careers.manager.day, 1);assert.equal(save.careers.manager.budget, 100);
  assert.equal(careerAction(save, 'manager', 'rest_team').ok, true);
});
test('recovery and youth decisions influence the team attributes rather than the personal player', () => {
  const save = fresh();const before = getManagerAttributes(save);
  careerAction(save, 'manager', 'recovery');assert.equal(getManagerAttributes(save).fitness, 100);
  careerAction(save, 'manager', 'youth');assert.ok(getManagerAttributes(save).passing > before.passing);
  assert.equal(save.careers.player.skills.passing, 60);assert.equal(save.careers.manager.budget, 44650);
});
test('attack and defensive training focus produce different match attributes', () => {
  const save = fresh();assert.equal(setTrainingFocus(save, 'attack'), true);const attack = getManagerAttributes(save);
  setTrainingFocus(save, 'defence');const defence = getManagerAttributes(save);
  assert.ok(attack.shooting > defence.shooting);assert.ok(defence.defending > attack.defending);
  assert.equal(setTrainingFocus(save, 'anything'), false);assert.equal(save.careers.manager.trainingFocus, 'defence');
});
test('manager match plan persists independently from personal profile and player career', () => {
  const save = fresh();save.profile.formation = '4-3-3';
  const player = structuredClone(ensureCareers(save).player);
  assert.equal(setManagerPlan(save, { formation: '3-5-2', tactic: 'press' }), true);
  assert.equal(save.careers.manager.formation, '3-5-2');assert.equal(save.careers.manager.tactic, 'press');
  assert.equal(save.profile.formation, '4-3-3');assert.deepEqual(save.careers.player, player);
  setManagerPlan(save, { tactic: 'wide' });assert.equal(getCareerView(save, 'manager').formation, '3-5-2');
  assert.equal(getCareerView(save, 'manager').tactic, 'wide');
});
test('invalid manager plan is rejected atomically without changing a valid plan', () => {
  const save = fresh();setManagerPlan(save, { formation: '4-4-2', tactic: 'counter' });
  for (const plan of [null, [], {}, { formation: '8-1-1' }, { tactic: 'chaos' }, { formation: '3-5-2', tactic: 'chaos' }, { formation: '3-5-2', unknown: true }]) {
    assert.equal(setManagerPlan(save, plan), false);
  }
  assert.equal(save.careers.manager.formation, '4-4-2');assert.equal(save.careers.manager.tactic, 'counter');
});
test('wrong career cannot execute the other career decisions', () => {
  const save = fresh();ensureCareers(save);
  assert.equal(careerAction(save, 'player', 'scouting').ok, false);assert.equal(careerAction(save, 'manager', 'train_shooting').ok, false);
  assert.equal(careerAction(save, 'quick', 'rest').ok, false);assert.equal(save.careers.player.day, 1);assert.equal(save.careers.manager.day, 1);
});
test('personal match result records only individual goals and does not advance manager record', () => {
  const save = fresh();assert.equal(applyCareerMatch(save, match('player')), true);
  assert.equal(save.careers.player.appearances, 1);assert.equal(save.careers.player.goals, 1);
  assert.equal(save.careers.player.balance, 1140);assert.equal(save.careers.player.energy, 61);
  assert.equal(save.careers.manager.record.played, 0);
});
test('club match result changes board, budget and team record while player life stays untouched', () => {
  const save = fresh();const before = structuredClone(ensureCareers(save).player);
  assert.equal(applyCareerMatch(save, match('manager')), true);
  assert.equal(save.careers.manager.record.played, 1);assert.equal(save.careers.manager.record.won, 1);
  assert.equal(save.careers.manager.budget, 52700);assert.equal(save.careers.manager.boardConfidence, 65);
  assert.deepEqual(save.careers.player, before);
});
test('finished result is idempotent across fresh engine object and refuses unfinished or exhibition matches', () => {
  const save = fresh();applyCareerMatch(save, match('player'));
  assert.equal(applyCareerMatch(save, match('player')), false);
  assert.equal(applyCareerMatch(save, { ...match('manager'), state: 'IN_PLAY' }), false);
  assert.equal(applyCareerMatch(save, match('quick')), false);
  assert.equal(save.careers.player.appearances, 1);
});
test('legacy goal totals are not falsely attributed to the controlled career player', () => {
  const save = fresh();const e = match('player');delete e.playerGoals;
  applyCareerMatch(save, e);assert.equal(save.careers.player.goals, 0);
});
test('validated views bound malformed numbers and histories and expose the week', () => {
  const save = fresh();save.careers = { player: { day: 15, energy: 200, balance: Infinity, skills: { pace: -50 }, activityLog: Array(50).fill({ message: 'Hi' }) }, manager: { budget: -20, trainingFocus: 'bad' } };
  const view = getCareerView(save, 'player');assert.equal(view.week, 3);assert.equal(view.energy, 100);assert.equal(view.balance, 1000);assert.equal(view.skills.pace, 0);assert.equal(view.activityLog.length, 20);
  assert.equal(save.careers.manager.budget, 0);assert.equal(save.careers.manager.trainingFocus, 'balanced');
  view.skills.pace = 99;assert.equal(save.careers.player.skills.pace, 0);assert.equal(getCareerView(save, 'quick'), null);
});
