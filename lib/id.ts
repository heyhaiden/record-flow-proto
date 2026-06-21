let seq = 1000;

/** Monotonic id generator shared across seed + runtime so ids never collide. */
export function newId(prefix: string): string {
  return `${prefix}_${++seq}`;
}
