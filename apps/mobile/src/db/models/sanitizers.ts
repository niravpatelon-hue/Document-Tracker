/** JSON-column sanitizers for WatermelonDB @json fields. */

export function stringArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
}

export function numberArray(raw: unknown): number[] {
  return Array.isArray(raw) ? raw.filter((x): x is number => typeof x === 'number') : [];
}

export function plainObject(raw: unknown): Record<string, unknown> {
  return raw != null && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}
