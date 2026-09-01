/** Deep clone of JSON-serializable values. Avoids `structuredClone` (missing on Hermes). */
export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
