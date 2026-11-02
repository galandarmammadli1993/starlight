/** Advance the authoritative clock and physics together, independently of rendering. */
export function advanceSimulation(engine, realSeconds, input = {}, speed = 1) {
  if (!engine || !Number.isFinite(realSeconds) || realSeconds <= 0) return 0;
  if (['PAUSED', 'HALF_TIME', 'FULL_TIME'].includes(engine.state)) return 0;
  if (realSeconds > 5) { engine.pause(); return 0; }
  const multiplier = [1, 2, 4, 8].includes(Number(speed)) ? Number(speed) : 1;
  let remaining = realSeconds * multiplier, advanced = 0;
  while (remaining > 1e-9 && !['PAUSED', 'HALF_TIME', 'FULL_TIME'].includes(engine.state)) {
    const chunk = Math.min(.2, remaining);
    engine.step(chunk, input);
    remaining -= chunk; advanced += chunk;
  }
  return advanced;
}
