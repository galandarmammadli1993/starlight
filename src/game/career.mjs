/** Separate, deterministic life and club simulations. No browser dependency. */
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const number = (value, fallback, lo = 0, hi = 100) => typeof value === 'number' && Number.isFinite(value) ? clamp(value, lo, hi) : fallback;
const integer = (value, fallback = 0, lo = 0, hi = 1e7) => Math.floor(number(value, fallback, lo, hi));
const text = (value, fallback = '', limit = 160) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, limit) : fallback;
const SKILLS = ['pace', 'passing', 'shooting', 'defending'];
const focusOptions = ['balanced', 'attack', 'defence'];
const formationOptions = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2'];
const tacticOptions = ['balanced', 'wide', 'press', 'counter'];
const ids = value => [...new Set((Array.isArray(value) ? value : []).filter(v => typeof v === 'string' && v.length > 0 && v.length < 101))].slice(-10000);
function history(value, mode) {
  return (Array.isArray(value) ? value : []).map(object).filter(r => r.id && (!r.mode || r.mode === mode)).slice(0, 20).map(r => ({
    id: text(r.id, '', 100), mode, score: [integer(r.score?.[0]), integer(r.score?.[1])],
    result: ['win', 'draw', 'loss'].includes(r.result) ? r.result : 'draw', date: text(r.date, '', 40),
  }));
}
function activity(value) {
  return (Array.isArray(value) ? value : []).slice(0, 20).map(object).map(a => ({ day: integer(a.day, 1, 1), message: text(a.message), kind: text(a.kind, 'activity', 32) }));
}
function record(value) {
  const r = object(value);
  return Object.fromEntries(['played', 'won', 'drawn', 'lost', 'goals'].map(key => [key, integer(r[key])]));
}
function playerOf(value, old) {
  const p = object(value), migrated = !value ? history(old?.results, 'player') : [];
  const results = history(p.results ?? migrated, 'player');
  return {
    day: integer(p.day, 1, 1), energy: number(p.energy, 85), fitness: number(p.fitness, 70), morale: number(p.morale, 70),
    skills: Object.fromEntries(SKILLS.map(key => [key, number(p.skills?.[key], 60)])),
    reputation: number(p.reputation, 10), balance: integer(p.balance, 1000), salary: integer(p.salary, 700, 0, 100000),
    appearances: integer(p.appearances, migrated.length), goals: integer(p.goals),
    results, activityLog: activity(p.activityLog), completedMatchIds: ids(p.completedMatchIds ?? results.map(r => r.id)),
  };
}
function managerOf(value, old) {
  const m = object(value), migrated = !value ? history(old?.results, 'manager') : [];
  const results = history(m.results ?? migrated, 'manager');
  const migratedRecord = migrated.reduce((r, match) => {
    r.played++; r[match.result === 'win' ? 'won' : match.result === 'draw' ? 'drawn' : 'lost']++;r.goals += match.score[0];return r;
  }, record(null));
  return {
    day: integer(m.day, 1, 1), budget: integer(m.budget, 50000), teamMorale: number(m.teamMorale, 70),
    boardConfidence: number(m.boardConfidence, 60), trainingFocus: focusOptions.includes(m.trainingFocus) ? m.trainingFocus : 'balanced',
    formation: formationOptions.includes(m.formation) ? m.formation : '4-3-3',
    tactic: tacticOptions.includes(m.tactic) ? m.tactic : 'balanced',
    teamFitness: number(m.teamFitness, 75), trainingLevel: number(m.trainingLevel, 0, 0, 20),
    scoutingReports: integer(m.scoutingReports, 0, 0, 100), youthLevel: integer(m.youthLevel, 0, 0, 10),
    objective: 'Build a winning team and keep the club solvent.',
    record: record(m.record ?? migratedRecord), results, activityLog: activity(m.activityLog),
    completedMatchIds: ids(m.completedMatchIds ?? results.map(r => r.id)),
  };
}

/** Adds careers to legacy version-one saves without losing their shared history. */
export function ensureCareers(save) {
  const existing = object(save.careers);
  save.careers = { player: playerOf(existing.player, save.career), manager: managerOf(existing.manager, save.career) };
  return save.careers;
}
export function getCareerView(save, mode) {
  const careers = ensureCareers(save);
  if (!['player', 'manager'].includes(mode)) return null;
  return { ...structuredClone(careers[mode]), week: Math.floor((careers[mode].day - 1) / 7) + 1 };
}
function log(career, message, kind) {
  career.activityLog.unshift({ day: career.day, message, kind });
  career.activityLog = career.activityLog.slice(0, 20);
}
function advanceLife(p) {
  const previousWeek = Math.floor((p.day - 1) / 7);
  p.day++;
  p.balance = Math.max(0, p.balance - 20);
  if (Math.floor((p.day - 1) / 7) > previousWeek) {
    p.balance += p.salary;
    log(p, `Weekly salary received: €${p.salary}.`, 'salary');
  }
}
export function careerAction(save, mode, action) {
  const careers = ensureCareers(save);
  if (!['player', 'manager'].includes(mode)) return { ok: false, message: 'Choose a career first.' };
  if (mode === 'player') {
    const p = careers.player;
    const train = { train_passing: ['passing', 18], train_shooting: ['shooting', 22], train_fitness: ['pace', 24] }[action];
    let message;
    if (train) {
      if (p.energy < train[1]) return { ok: false, message: 'Your energy is too low. Take a recovery day first.' };
      p.energy -= train[1];p.skills[train[0]] = clamp(p.skills[train[0]] + 2, 0, 100);
      p.fitness = clamp(p.fitness + (action === 'train_fitness' ? 3 : 1), 0, 100);
      p.morale = clamp(p.morale + 1, 0, 100);
      message = `${train[0][0].toUpperCase() + train[0].slice(1)} training completed. Skill +2.`;
    } else if (action === 'rest') {
      p.energy = clamp(p.energy + 32, 0, 100);p.fitness = clamp(p.fitness + 2, 0, 100);p.morale = clamp(p.morale + 3, 0, 100);
      message = 'Recovery day completed. Energy +32; fitness and morale improved.';
    } else if (action === 'community') {
      if (p.energy < 10) return { ok: false, message: 'Rest before your community visit.' };
      p.energy -= 10;p.reputation = clamp(p.reputation + 2, 0, 100);p.morale = clamp(p.morale + 6, 0, 100);
      message = 'Community visit completed. Reputation +2 and morale +6.';
    } else return { ok: false, message: 'Unknown player activity.' };
    advanceLife(p);log(p, message, action);
    return { ok: true, message: `${message} Day ${p.day}. Living costs: €20.` };
  }
  const m = careers.manager;
  const plan = {
    team_training: { cost: 500, message: 'Team session completed. Match preparation improved.' },
    rest_team: { cost: 0, message: 'Squad given a rest day. Fitness and morale recovered.' },
    scouting: { cost: 1200, message: 'Scouting report delivered. Board confidence improved.' },
    youth: { cost: 5000, message: 'Youth development upgraded. Team technical ability improved.' },
    recovery: { cost: 350, message: 'Recovery staff session completed. Team fitness improved.' },
  }[action];
  if (!plan) return { ok: false, message: 'Unknown club decision.' };
  if (m.budget < plan.cost) return { ok: false, message: `Club budget is too low. This decision costs €${plan.cost}.` };
  if (action === 'youth' && m.youthLevel >= 10) return { ok: false, message: 'Youth development is already at its maximum level.' };
  m.budget -= plan.cost;m.day++;
  if (action === 'team_training') { m.trainingLevel = clamp(m.trainingLevel + 1, 0, 20);m.teamFitness = clamp(m.teamFitness - 7, 0, 100);m.teamMorale = clamp(m.teamMorale + 2, 0, 100); }
  if (action === 'rest_team') { m.teamFitness = clamp(m.teamFitness + 18, 0, 100);m.teamMorale = clamp(m.teamMorale + 4, 0, 100); }
  if (action === 'recovery') m.teamFitness = clamp(m.teamFitness + 28, 0, 100);
  if (action === 'scouting') {m.scoutingReports++;m.boardConfidence = clamp(m.boardConfidence + 1, 0, 100);}
  if (action === 'youth') {m.youthLevel++;m.boardConfidence = clamp(m.boardConfidence + 3, 0, 100);}
  log(m, plan.message, action);
  return { ok: true, message: `${plan.message} Cost: €${plan.cost}.` };
}
export function setTrainingFocus(save, focus) {
  const m = ensureCareers(save).manager;
  if (!focusOptions.includes(focus)) return false;
  m.trainingFocus = focus;return true;
}
/** A club match plan never overwrites the personal player's match profile. */
export function setManagerPlan(save, plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return false;
  const keys = Object.keys(plan);
  if (!keys.length || keys.some(key => !['formation', 'tactic'].includes(key))) return false;
  if (plan.formation !== undefined && !formationOptions.includes(plan.formation)) return false;
  if (plan.tactic !== undefined && !tacticOptions.includes(plan.tactic)) return false;
  const m = ensureCareers(save).manager;
  if (plan.formation !== undefined) m.formation = plan.formation;
  if (plan.tactic !== undefined) m.tactic = plan.tactic;
  return true;
}
export function getPlayerAttributes(save) {
  const p = ensureCareers(save).player;
  return { ...p.skills, fitness: p.fitness, energy: p.energy };
}
export function getManagerAttributes(save) {
  const m = ensureCareers(save).manager;
  const base = 60 + m.trainingLevel * .6 + m.youthLevel;
  return {
    fitness: m.teamFitness, morale: m.teamMorale,
    passing: clamp(base + (m.trainingFocus === 'balanced' ? 3 : 0), 0, 100),
    shooting: clamp(base + (m.trainingFocus === 'attack' ? 6 : 0), 0, 100),
    defending: clamp(base + (m.trainingFocus === 'defence' ? 6 : 0), 0, 100),
  };
}

/** Used only after full time; individual and club histories never cross modes. */
export function applyCareerMatch(save, engine) {
  const mode = engine.options?.mode;
  if (engine.state !== 'FULL_TIME' || !['player', 'manager'].includes(mode) || !engine.matchId) return false;
  const career = ensureCareers(save)[mode];
  if (career.completedMatchIds.includes(engine.matchId)) return false;
  const score = [integer(engine.score?.[0]), integer(engine.score?.[1])];
  const result = score[0] > score[1] ? 'win' : score[0] === score[1] ? 'draw' : 'loss';
  career.completedMatchIds.push(engine.matchId);career.completedMatchIds = career.completedMatchIds.slice(-10000);
  career.results.unshift({ id: engine.matchId, mode, score, result, date: new Date().toISOString() });career.results = career.results.slice(0, 20);
  if (mode === 'player') {
    career.appearances++;
    const goals = integer(engine.playerGoals?.[engine.careerPlayer]);
    career.goals += goals;career.energy = clamp(career.energy - 24, 0, 100);
    career.balance += 120 + goals * 40;career.reputation = clamp(career.reputation + 1 + goals, 0, 100);
    career.morale = clamp(career.morale + (result === 'win' ? 8 : result === 'draw' ? 2 : -5), 0, 100);
    advanceLife(career);log(career, `Match completed: ${score.join('–')}. Appearance bonus €120${goals ? `; ${goals} personal goal(s)` : ''}.`, 'match');
  } else {
    career.record.played++;career.record[result === 'win' ? 'won' : result === 'draw' ? 'drawn' : 'lost']++;career.record.goals += score[0];
    career.day++;career.budget += 1200 + (result === 'win' ? 1500 : result === 'draw' ? 500 : 0);
    career.boardConfidence = clamp(career.boardConfidence + (result === 'win' ? 5 : result === 'draw' ? 0 : -6), 0, 100);
    career.teamMorale = clamp(career.teamMorale + (result === 'win' ? 7 : result === 'draw' ? 1 : -6), 0, 100);
    career.teamFitness = clamp(career.teamFitness - 16, 0, 100);
    log(career, `Club result: ${score.join('–')}. Match revenue received; squad needs recovery.`, 'match');
  }
  return true;
}
