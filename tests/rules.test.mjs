import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELD, detectBoundary, createOffsideSnapshot, offsideInvolvement,
  resetOffsideByOpponent, MatchClock, evaluateFoul, goalkeeperHandControl,
  restartDelaySanction, inPenaltyArea } from '../src/game/rules.mjs';

const p = (x, y = 34, z = .11) => ({ x, y, z });
const touch = (team) => ({ team, playerId: team * 11 + 2 });
const boundary = (a, b, team = 0, dirs = [1, -1], source = null) => detectBoundary(a, b, touch(team), dirs, source);

test('whole ball over top touchline awards throw to opponents at crossing', () => {
  const event = boundary(p(20, 1), p(26, -2));
  assert.equal(event.type, 'THROW_IN'); assert.equal(event.team, 1);
  assert.equal(event.y, 0); assert.ok(Math.abs(event.crossing.y + .11) < 1e-10);
  assert.ok(event.x > 20 && event.x < 26);
});
test('whole ball over bottom touchline awards throw', () => {
  const event = boundary(p(50, 67), p(52, 70), 1);
  assert.equal(event.type, 'THROW_IN'); assert.equal(event.team, 0); assert.equal(event.y, 68);
});
test('attacker last touch over goal line away from posts is goal kick', () => {
  const event = boundary(p(103, 10), p(107, 10), 0);
  assert.equal(event.type, 'GOAL_KICK'); assert.equal(event.team, 1);
  assert.equal(event.x, 99.5); assert.equal(event.y, 34);
});
test('defender last touch over own goal line is corner at nearest corner', () => {
  const event = boundary(p(104, 50), p(107, 50), 1);
  assert.equal(event.type, 'CORNER_KICK'); assert.equal(event.team, 0);
  assert.equal(event.x, 105); assert.equal(event.y, 68);
});
test('opposite end chooses correct defending team', () => {
  assert.equal(boundary(p(1, 10), p(-3, 10), 0).type, 'CORNER_KICK');
  assert.equal(boundary(p(1, 10), p(-3, 10), 1).type, 'GOAL_KICK');
});
test('centre across line with ball still overlapping stays in play', () => {
  assert.equal(boundary(p(10, .1), p(10, -.1)), null);
  assert.equal(boundary(p(104, 10), p(105.1, 10)), null);
});
test('ball exactly tangent to outer edge still overlaps line', () => {
  assert.equal(boundary(p(10, .1), p(10, -.11)), null);
});
test('airborne whole-ball exit triggers throw', () => {
  const event = boundary(p(20, 1, 6), p(22, -2, 5));
  assert.equal(event.type, 'THROW_IN'); assert.ok(event.crossing.z > 5);
});
test('boundary never mutates or clamps ball trajectory', () => {
  const previous = p(20, 1), next = p(20, -100);
  const original = { ...next };
  assert.equal(boundary(previous, next).type, 'THROW_IN');
  assert.deepEqual(next, original);
});
test('high speed exit detected continuously once', () => {
  const a = p(52, 34), b = p(200, 34);
  assert.equal(boundary(a, b).type, 'GOAL');
  assert.equal(boundary(b, p(220, 34)), null);
});
test('already outside one boundary cannot emit again at another boundary', () => {
  assert.equal(boundary(p(104, -2), p(110, -2)), null);
});
test('diagonal crossing reports earliest plane', () => {
  assert.equal(boundary(p(100, 1), p(130, -30)).type, 'THROW_IN');
});
test('valid low shot counts as goal', () => {
  assert.equal(boundary(p(103, 34), p(107, 34)).type, 'GOAL');
  assert.equal(boundary(p(103, 34), p(107, 34)).team, 0);
});
test('over-bar shot is goal kick', () => {
  assert.equal(boundary(p(103, 34, 3), p(107, 34, 3)).type, 'GOAL_KICK');
});
test('ball not wholly between posts is not goal', () => {
  assert.equal(boundary(p(103, 37.6), p(107, 37.6)).type, 'GOAL_KICK');
});
test('ordinary open-play own goal counts', () => {
  const event = boundary(p(103, 34), p(107, 34), 1);
  assert.equal(event.type, 'GOAL'); assert.equal(event.team, 0);
});
test('direction changes choose correct scoring team', () => {
  assert.equal(boundary(p(103, 34), p(107, 34), 1, [-1, 1]).team, 1);
});
for (const type of ['THROW_IN', 'INDIRECT_FREE_KICK', 'OFFSIDE_RESTART', 'DROPPED_BALL']) {
  test(`direct ${type} into opponents goal gives goal kick`, () => {
    assert.equal(boundary(p(100, 34), p(107, 34), 0, [1, -1], { type, team: 0, untouched: true }).type, 'GOAL_KICK');
  });
  test(`direct ${type} into own goal gives corner`, () => {
    assert.equal(boundary(p(3, 34), p(-3, 34), 0, [1, -1], { type, team: 0, untouched: true }).type, 'CORNER_KICK');
  });
}
for (const type of ['CORNER_KICK', 'GOAL_KICK', 'DIRECT_FREE_KICK', 'KICK_OFF']) {
  test(`direct ${type} into opponents goal counts`, () => {
    assert.equal(boundary(p(100, 34), p(107, 34), 0, [1, -1], { type, team: 0, untouched: true }).type, 'GOAL');
  });
  test(`direct ${type} own goal does not count`, () => {
    assert.equal(boundary(p(3, 34), p(-3, 34), 0, [1, -1], { type, team: 0, untouched: true }).type, 'CORNER_KICK');
  });
}
test('another touch removes direct restart restriction', () => {
  assert.equal(boundary(p(100, 34), p(107, 34), 0, [1, -1], { type: 'THROW_IN', team: 0, untouched: false }).type, 'GOAL');
});

const samplePlayers = (attackerX = 90) => [
  { id: 0, team: 0, x: 60 }, { id: 1, team: 0, x: attackerX },
  { id: 11, team: 1, x: 102 }, { id: 12, team: 1, x: 85 }, { id: 13, team: 1, x: 70 },
];
test('offside freezes positions at pass and penalizes active receipt', () => {
  const players = samplePlayers();
  const snapshot = createOffsideSnapshot(players, p(60), 0);
  players[1].x = 70;
  assert.equal(snapshot.line, 85); assert.equal(offsideInvolvement(snapshot, 1), true);
});
test('level with second-last opponent is legal', () => {
  assert.equal(offsideInvolvement(createOffsideSnapshot(samplePlayers(85), p(60), 0), 1), false);
});
test('level with ball is legal even beyond second-last opponent', () => {
  assert.equal(offsideInvolvement(createOffsideSnapshot(samplePlayers(90), p(90), 0), 1), false);
});
test('offside position alone is not offence', () => {
  const snapshot = createOffsideSnapshot(samplePlayers(), p(60), 0);
  assert.deepEqual(snapshot.candidates, [1]);
  assert.equal(offsideInvolvement(snapshot, 1, 'NO_INVOLVEMENT'), false);
});
test('own half cannot be offside', () => {
  const players = [{ id: 1, team: 0, x: 50 }, { id: 11, team: 1, x: 20 }, { id: 12, team: 1, x: 30 }];
  assert.deepEqual(createOffsideSnapshot(players, p(40), 0).candidates, []);
});
for (const source of ['THROW_IN', 'CORNER_KICK', 'GOAL_KICK']) {
  test(`direct ${source} receipt is exempt from offside`, () => {
    const snapshot = createOffsideSnapshot(samplePlayers(), p(60), 0, [1, -1], source);
    assert.equal(offsideInvolvement(snapshot, 1), false);
  });
}
test('rebounds and deliberate saves retain offside', () => {
  const snapshot = createOffsideSnapshot(samplePlayers(), p(60), 0);
  assert.equal(offsideInvolvement(resetOffsideByOpponent(snapshot, 'SAVE'), 1, 'REBOUND'), true);
  assert.equal(offsideInvolvement(resetOffsideByOpponent(snapshot, 'DEFLECTION'), 1), true);
});
test('opponent deliberate play resets offside', () => {
  const snapshot = createOffsideSnapshot(samplePlayers(), p(60), 0);
  assert.equal(resetOffsideByOpponent(snapshot, 'DELIBERATE_PLAY'), null);
});
test('opposite attacking direction works', () => {
  const players = samplePlayers().map((pl) => ({ ...pl, x: FIELD.length - pl.x }));
  const snapshot = createOffsideSnapshot(players, p(45), 0, [-1, 1]);
  assert.equal(snapshot.line, 20); assert.equal(offsideInvolvement(snapshot, 1), true);
});
test('backward-pass classification depends on position, not pass label', () => {
  assert.equal(offsideInvolvement(createOffsideSnapshot(samplePlayers(90), p(95), 0), 1), false);
  assert.equal(offsideInvolvement(createOffsideSnapshot(samplePlayers(90), p(80), 0), 1), true);
});
test('hands and arms do not define offside position', () => {
  const players = samplePlayers(84);
  players[1].bodyParts = [{ type: 'foot', x: 84 }, { type: 'hand', x: 95 }, { type: 'arm', x: 92 }];
  assert.equal(offsideInvolvement(createOffsideSnapshot(players, p(60), 0), 1), false);
  players[1].bodyParts.push({ type: 'head', x: 86 });
  assert.equal(offsideInvolvement(createOffsideSnapshot(players, p(60), 0), 1), true);
});
test('interfering with goalkeeper and challenges are involvement', () => {
  const snapshot = createOffsideSnapshot(samplePlayers(), p(60), 0);
  assert.equal(offsideInvolvement(snapshot, 1, 'BLOCK_VIEW'), true);
  assert.equal(offsideInvolvement(snapshot, 1, 'CHALLENGE'), true);
});
test('dismissed defender does not set the offside line', () => {
  const players = samplePlayers(80); players[3].sentOff = true;
  assert.equal(createOffsideSnapshot(players, p(60), 0).line, 70);
});

test('default half lasts twelve real minutes without stoppages', () => {
  const clock = new MatchClock();
  assert.equal(clock.halfMinutes, 12);
  assert.equal(clock.tick(719), null); assert.equal(clock.tick(1), 'HALF_TIME');
  assert.equal(clock.display, '45:00');
});
for (const halfMinutes of [5, 8, 12, 15, 20, 45]) {
  test(`${halfMinutes}-minute half conversion is exact`, () => {
    const clock = new MatchClock(halfMinutes);
    assert.equal(clock.tick(halfMinutes * 60), 'HALF_TIME');
    assert.equal(clock.elapsed, 2700);
  });
}
test('clock is frame-rate independent at 30, 60 and 144 FPS', () => {
  const clocks = [30, 60, 144].map((fps) => {
    const clock = new MatchClock();
    for (let i = 0; i < fps * 20; i++) clock.tick(1 / fps);
    return clock;
  });
  for (const clock of clocks) assert.ok(Math.abs(clock.elapsed - 75) < 1e-8);
  assert.deepEqual(clocks.map((c) => c.display), ['01:15', '01:15', '01:15']);
});
test('paused clock does not move', () => {
  const clock = new MatchClock(); clock.tick(10, true); assert.equal(clock.elapsed, 0);
});
test('stoppages add time instead of stopping match clock', () => {
  const clock = new MatchClock();
  clock.tick(16, false, true); // sixty football seconds lost
  assert.equal(clock.elapsed, 60); assert.equal(clock.stoppedSeconds, 60);
  assert.equal(clock.tick(704), null); assert.equal(clock.addedSeconds, 60);
  assert.equal(clock.tick(16), 'HALF_TIME'); assert.equal(clock.display, '46:00');
});
test('half-time event occurs once and next half starts at 45 minutes', () => {
  const clock = new MatchClock(); clock.tick(720);
  assert.equal(clock.tick(2), null); assert.equal(clock.nextHalf(), true);
  assert.equal(clock.display, '45:00'); assert.equal(clock.half, 2);
  assert.equal(clock.tick(720), 'FULL_TIME'); assert.equal(clock.display, '90:00');
  assert.equal(clock.finished, true); assert.equal(clock.nextHalf(), false);
  assert.equal(clock.tick(100), null);
});
test('invalid and negative clock ticks cannot corrupt time', () => {
  const clock = new MatchClock();
  for (const dt of [-5, NaN, Infinity, 0]) clock.tick(dt);
  assert.equal(clock.elapsed, 0);
});

test('no contact means no random tackle foul', () => {
  assert.equal(evaluateFoul({ team: 0, contact: false, severity: 'RECKLESS' }), null);
});
test('legal contact is not automatically foul', () => {
  assert.equal(evaluateFoul({ team: 0, contact: true, severity: 'LEGAL' }), null);
});
test('careless contact gives direct free kick without card', () => {
  const decision = evaluateFoul({ team: 0, contact: true, severity: 'CARELESS', x: 45, y: 25 });
  assert.equal(decision.type, 'DIRECT_FREE_KICK'); assert.equal(decision.team, 1); assert.equal(decision.card, null);
});
test('reckless contact gives yellow and second yellow dismissal', () => {
  assert.equal(evaluateFoul({ team: 0, contact: true, severity: 'RECKLESS' }).card, 'YELLOW');
  assert.equal(evaluateFoul({ team: 0, contact: true, severity: 'RECKLESS', yellowCards: 1 }).card, 'SECOND_YELLOW');
});
test('excessive force gives red and cannot be waived by advantage flag', () => {
  const decision = evaluateFoul({ team: 0, contact: true, severity: 'EXCESSIVE', advantage: true });
  assert.equal(decision.card, 'RED'); assert.equal(decision.advantage, false);
});
test('direct offence in own penalty area gives penalty', () => {
  assert.equal(evaluateFoul({ team: 0, contact: true, severity: 'CARELESS', x: 10, y: 34 }).type, 'PENALTY');
  assert.equal(evaluateFoul({ team: 1, contact: true, severity: 'CARELESS', x: 95, y: 34 }).type, 'PENALTY');
});
test('outside width of penalty area is ordinary free kick', () => {
  assert.equal(evaluateFoul({ team: 0, contact: true, severity: 'CARELESS', x: 10, y: 5 }).type, 'DIRECT_FREE_KICK');
});
test('dangerous play without contact and backpass handling are indirect', () => {
  for (const kind of ['DANGEROUS_PLAY', 'BACKPASS_HANDLING', 'DOUBLE_TOUCH']) {
    assert.equal(evaluateFoul({ team: 0, contact: false, kind, x: 10, y: 34 }).type, 'INDIRECT_FREE_KICK');
  }
});
test('penalty area follows change of ends', () => {
  assert.equal(inPenaltyArea(95, 34, 0, [-1, 1]), true);
  assert.equal(inPenaltyArea(10, 34, 0, [-1, 1]), false);
});
test('DOGSO genuine ball attempt in penalty area gets yellow, elsewhere red', () => {
  const event = { team: 0, contact: true, severity: 'CARELESS', dogso: true, attemptToPlayBall: true, x: 10, y: 34 };
  assert.equal(evaluateFoul(event).card, 'YELLOW');
  assert.equal(evaluateFoul({ ...event, x: 30 }).card, 'RED');
});
test('eight-second keeper breach awards nearest corner, exactly eight is allowed', () => {
  assert.equal(goalkeeperHandControl(8, 0), null);
  assert.deepEqual(goalkeeperHandControl(8.01, 0, 10), { type: 'CORNER_KICK', team: 1, x: 0, y: 0, z: .11, reason: 'Goalkeeper exceeded eight seconds' });
});
test('restart delay countdown never runs automatically', () => {
  assert.equal(restartDelaySanction({ type: 'THROW_IN', team: 0, seconds: 20 }), null);
});
test('referee-initiated five-second throw countdown reverses possession', () => {
  const event = { type: 'THROW_IN', team: 0, seconds: 4.9, refereeCounting: true, x: 20, y: 0 };
  assert.equal(restartDelaySanction(event), null);
  const sanction = restartDelaySanction({ ...event, seconds: 5 });
  assert.equal(sanction.type, 'THROW_IN'); assert.equal(sanction.team, 1); assert.equal(sanction.x, 20);
});
test('delayed goal kick sanctions corner for opponents', () => {
  const event = restartDelaySanction({ type: 'GOAL_KICK', team: 1, seconds: 5, refereeCounting: true, y: 50 });
  assert.equal(event.type, 'CORNER_KICK'); assert.equal(event.team, 0); assert.equal(event.x, 105); assert.equal(event.y, 68);
});
