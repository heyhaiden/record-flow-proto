export const FINISH_DISTANCE = -96;
export const FINISH_VELOCITY = -0.7;
export const REST_VELOCITY = 0.02;
export const FRICTION = 0.004;
export const RUBBER = 280;

/** Map a raw upward drag onto a heavier, resisted travel. */
export function resistedDy(rawDy: number): number {
  if (rawDy >= 0) return 0;
  const mag = -rawDy;
  return rawDy / (1 + mag / RUBBER);
}

export function sampleVelocity(
  prevY: number,
  y: number,
  prevT: number,
  t: number,
  prevV: number,
): number {
  const dt = t - prevT;
  if (dt <= 0) return prevV;
  const instant = (y - prevY) / dt;
  return prevV * 0.65 + instant * 0.35;
}

export function shouldFinish(dy: number, velocity: number): boolean {
  return dy <= FINISH_DISTANCE || (velocity <= FINISH_VELOCITY && dy < -24);
}

export function tickInertia(
  dy: number,
  velocity: number,
  dt: number,
): { dy: number; velocity: number; settled: boolean } {
  const nextV = velocity * Math.exp(-FRICTION * dt);
  const nextDy = Math.min(0, dy + nextV * dt);
  const settled = Math.abs(nextV) < REST_VELOCITY && nextDy > FINISH_DISTANCE;
  return { dy: nextDy, velocity: nextV, settled };
}
