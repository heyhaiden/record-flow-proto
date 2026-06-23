let seq = 1000;

/**
 * Runtime-safe id generator. The old monotonic counter reset on every reload,
 * which let newly-created projects collide with localStorage records like
 * `visit_1001`.
 */
export function newId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}_${uuid}`;
  return `${prefix}_${Date.now().toString(36)}_${++seq}`;
}
