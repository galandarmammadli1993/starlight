/** Deterministic, renderer-independent rules used by both match modes.
 * Coordinates are metres; x follows pitch length, y width, z ball-centre height.
 * This implements the playable rules subset documented in docs/IMPLEMENTATION.md;
 * it does not assert certification against all seventeen IFAB Laws.
 */
export const FIELD = Object.freeze({
  length: 105, width: 68, goalWidth: 7.32, goalHeight: 2.44,
  ballRadius: 0.11, penaltyDepth: 16.5, penaltyWidth: 40.32,
  goalAreaDepth: 5.5, goalAreaWidth: 18.32,
});
export const MIN_PLAYERS = 7;
const EPS = 1e-8;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const other = (team) => team === 0 ? 1 : 0;
const normalized = (s) => String(s ?? '').toUpperCase().replace(/[ -]/g, '_');

/** Earliest continuous, whole-ball exit; an already-out ball cannot emit twice.
 * Keep crossing and legal restart positions separate. Never clamp the live ball.
 */
export function detectBoundary(prev, next, lastTouch, directions = [1, -1], restartOrigin = null) {
  const r = FIELD.ballRadius;
  if (prev.x < -r - EPS || prev.x > FIELD.length + r + EPS
    || prev.y < -r - EPS || prev.y > FIELD.width + r + EPS) return null;
  const candidates = [];
  const add = (axis, plane, sign, side) => {
    const a = Number(prev[axis] ?? 0), b = Number(next[axis] ?? 0);
    // At equality part of the ball still touches the boundary plane.
    if (sign * (a - plane) > EPS || sign * (b - plane) <= EPS || a === b) return;
    const t = (plane - a) / (b - a);
    if (t < -EPS || t > 1 + EPS) return;
    candidates.push({ t, side, crossing: {
      x: prev.x + (next.x - prev.x) * t,
      y: prev.y + (next.y - prev.y) * t,
      z: (prev.z ?? r) + ((next.z ?? r) - (prev.z ?? r)) * t,
    } });
  };
  add('x', -r, -1, 'LEFT');
  add('x', FIELD.length + r, 1, 'RIGHT');
  add('y', -r, -1, 'TOP');
  add('y', FIELD.width + r, 1, 'BOTTOM');
  candidates.sort((a, b) => a.t - b.t);
  const exit = candidates[0];
  if (!exit) return null;
  const { crossing, side } = exit;
  const lastTeam = lastTouch?.team === 1 ? 1 : 0;
  if (side === 'TOP' || side === 'BOTTOM') {
    return { type: 'THROW_IN', team: other(lastTeam), x: clamp(crossing.x, 0, FIELD.length),
      y: side === 'TOP' ? 0 : FIELD.width, z: r, crossing, side };
  }
  const goalX = side === 'LEFT' ? 0 : FIELD.length;
  const scoringTeam = directions.findIndex((d) => d === (side === 'RIGHT' ? 1 : -1));
  const attack = scoringTeam < 0 ? (side === 'RIGHT' ? 0 : 1) : scoringTeam;
  const defence = other(attack);
  const corner = () => ({ type: 'CORNER_KICK', team: attack, x: goalX,
    y: crossing.y < FIELD.width / 2 ? 0 : FIELD.width, z: r, crossing, side });
  const goalKick = () => ({ type: 'GOAL_KICK', team: defence,
    x: side === 'LEFT' ? FIELD.goalAreaDepth : FIELD.length - FIELD.goalAreaDepth,
    y: FIELD.width / 2, z: r, crossing, side });
  const insideGoal = Math.abs(crossing.y - FIELD.width / 2) + r <= FIELD.goalWidth / 2 + EPS
    && crossing.z + r <= FIELD.goalHeight + EPS && crossing.z >= -EPS;
  if (insideGoal) {
    if (restartOrigin?.untouched) {
      const source = normalized(restartOrigin.type);
      // A restart cannot score directly into its own goal. A direct throw,
      // indirect kick or dropped ball cannot score directly against opponents.
      if (restartOrigin.team !== attack) return corner();
      if (['THROW_IN', 'INDIRECT_FREE_KICK', 'OFFSIDE_RESTART', 'DROPPED_BALL'].includes(source)) return goalKick();
    }
    return { type: 'GOAL', team: attack, x: goalX, y: crossing.y,
      z: crossing.z, crossing, side };
  }
  return lastTeam === defence ? corner() : goalKick();
}

/** Body-part data can be supplied by a future skeletal renderer. Arms/hands do
 * not define the offside line. With point players, x is their legal body point.
 */
function legalPosition(player, direction) {
  const parts = player.legalParts ?? player.bodyParts;
  const legal = Array.isArray(parts) ? parts.filter((p) => !['ARM', 'HAND'].includes(normalized(p.type ?? p.part))) : [];
  if (legal.length) return direction > 0 ? Math.max(...legal.map((p) => p.x)) : Math.min(...legal.map((p) => p.x));
  return Number(player.offsideX ?? player.x);
}

export function createOffsideSnapshot(players, ball, team, directions = [1, -1], source = 'OPEN_PLAY') {
  const direction = directions[team];
  const exempt = ['THROW_IN', 'CORNER_KICK', 'GOAL_KICK'].includes(normalized(source));
  const opponents = players.filter((p) => p.team !== team && !p.sentOff)
    .map((p) => legalPosition(p, direction)).sort((a, b) => direction * (b - a));
  const secondLast = opponents[1] ?? opponents[0] ?? (direction > 0 ? FIELD.length : 0);
  const line = direction > 0 ? Math.max(ball.x, secondLast) : Math.min(ball.x, secondLast);
  const candidates = exempt ? [] : players.filter((p) => p.team === team && !p.sentOff)
    .filter((p) => direction * (legalPosition(p, direction) - FIELD.length / 2) > EPS)
    .filter((p) => direction * (legalPosition(p, direction) - line) > EPS)
    .map((p) => p.id);
  return { team, direction, line, secondLast, ballX: ball.x, source: normalized(source), candidates };
}

export function offsideInvolvement(snapshot, playerId, kind = 'PLAY') {
  if (!snapshot || !snapshot.candidates.includes(typeof playerId === 'object' ? playerId.id : playerId)) return false;
  return ['PLAY', 'INTERFERE', 'INTERFERING_WITH_PLAY', 'INTERFERING_WITH_OPPONENT',
    'REBOUND', 'SAVE', 'CHALLENGE', 'BLOCK_VIEW', 'GAINING_ADVANTAGE'].includes(normalized(kind));
}

export function resetOffsideByOpponent(snapshot, kind = 'DELIBERATE_PLAY') {
  return ['SAVE', 'DELIBERATE_SAVE', 'DEFLECTION', 'REBOUND'].includes(normalized(kind)) ? snapshot : null;
}

/** One clock, independent of rendering. elapsed/stoppedSeconds are football
 * seconds in this half; tick accepts real seconds. Pauses never consume time.
 */
export class MatchClock {
  constructor(halfMinutes = 12) {
    this.halfMinutes = [5, 8, 12, 15, 20, 45].includes(Number(halfMinutes)) ? Number(halfMinutes) : 12;
    this.elapsed = 0; this.half = 1; this.addedSeconds = 0;
    this.stoppedSeconds = 0; this.finished = false; this.halfEnded = false;
  }
  get rate() { return 45 / this.halfMinutes; }
  get display() {
    const total = Math.max(0, Math.floor((this.half - 1) * 2700 + this.elapsed + EPS));
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }
  tick(realDt, paused = false, stopped = false) {
    if (paused || this.finished || this.halfEnded || !Number.isFinite(realDt) || realDt <= 0) return null;
    const dt = realDt * this.rate;
    this.elapsed += dt;
    if (stopped) this.stoppedSeconds += dt;
    if (this.elapsed + EPS < 2700) return null;
    // Indicated added time is a minimum, rounded up to a football minute.
    if (!this.addedSeconds && this.stoppedSeconds > EPS) this.addedSeconds = Math.ceil(this.stoppedSeconds / 60) * 60;
    const end = 2700 + Math.max(this.addedSeconds, this.stoppedSeconds);
    if (this.elapsed + EPS < end) return null;
    this.elapsed = end;
    this.halfEnded = true;
    if (this.half === 2) { this.finished = true; return 'FULL_TIME'; }
    return 'HALF_TIME';
  }
  nextHalf() {
    if (this.half !== 1 || !this.halfEnded) return false;
    this.half = 2; this.elapsed = 0; this.stoppedSeconds = 0;
    this.addedSeconds = 0; this.halfEnded = false;
    return true;
  }
}

export function inPenaltyArea(x, y, defendingTeam, directions = [1, -1]) {
  const ownLeft = directions[defendingTeam] > 0;
  return y >= (FIELD.width - FIELD.penaltyWidth) / 2 && y <= (FIELD.width + FIELD.penaltyWidth) / 2
    && (ownLeft ? x >= 0 && x <= FIELD.penaltyDepth : x <= FIELD.length && x >= FIELD.length - FIELD.penaltyDepth);
}

/** Foul decisions depend on an actual offence/contact, never random rolls.
 * team is the offending team; returned team receives the restart.
 */
export function evaluateFoul(event = {}) {
  const kind = normalized(event.kind ?? event.offence ?? 'TACKLE');
  const indirect = ['DANGEROUS_PLAY', 'IMPEDING_NO_CONTACT', 'BACKPASS_HANDLING', 'DOUBLE_TOUCH'].includes(kind);
  const nonContact = indirect || kind === 'HANDBALL';
  if (!event.contact && !nonContact) return null;
  const severity = normalized(event.severity ?? (event.excessive ? 'EXCESSIVE' : event.reckless ? 'RECKLESS' : event.careless ? 'CARELESS' : 'LEGAL'));
  if (!indirect && kind !== 'HANDBALL' && severity === 'LEGAL') return null;
  const offendingTeam = event.team === 1 ? 1 : 0;
  let card = null;
  if (['EXCESSIVE', 'EXCESSIVE_FORCE', 'SERIOUS_FOUL_PLAY', 'VIOLENT'].includes(severity)) card = 'RED';
  else if (severity === 'RECKLESS') card = event.yellowCards >= 1 ? 'SECOND_YELLOW' : 'YELLOW';
  const x = clamp(event.x ?? FIELD.length / 2, 0, FIELD.length);
  const y = clamp(event.y ?? FIELD.width / 2, 0, FIELD.width);
  const penalty = !indirect && inPenaltyArea(x, y, offendingTeam, event.directions);
  if (event.dogso && !card) card = penalty && event.attemptToPlayBall ? 'YELLOW' : 'RED';
  return { type: penalty ? 'PENALTY' : indirect ? 'INDIRECT_FREE_KICK' : 'DIRECT_FREE_KICK',
    team: other(offendingTeam), offendingTeam, x, y, card, kind,
    advantage: !!event.advantage && !['RED', 'SECOND_YELLOW'].includes(card) };
}

/** The goalkeeper hand-control sanction is a corner, not an indirect kick. */
export function goalkeeperHandControl(seconds, team, y = FIELD.width / 2, directions = [1, -1]) {
  if (seconds <= 8) return null;
  return { type: 'CORNER_KICK', team: other(team), x: directions[team] > 0 ? 0 : FIELD.length,
    y: y < FIELD.width / 2 ? 0 : FIELD.width, z: FIELD.ballRadius, reason: 'Goalkeeper exceeded eight seconds' };
}

/** Countdown starts only after the referee judges unfair delay. */
export function restartDelaySanction({ type, team, seconds, refereeCounting = false, x = 0, y = 0, directions = [1, -1] }) {
  if (!refereeCounting || seconds < 5) return null;
  if (normalized(type) === 'THROW_IN') return { type: 'THROW_IN', team: other(team), x, y, reason: 'Delayed throw-in' };
  if (normalized(type) === 'GOAL_KICK') return { type: 'CORNER_KICK', team: other(team),
    x: directions[team] > 0 ? 0 : FIELD.length, y: y < FIELD.width / 2 ? 0 : FIELD.width, reason: 'Delayed goal kick' };
  return null;
}
