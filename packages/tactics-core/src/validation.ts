// Shared only by the two Core 02 families; Core 01 keeps its original validation.
export function readSeed(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 0xffffffff
  )
    throw new RangeError("Seed deve ser um inteiro entre 0 e 4294967295.");
  return value === 0 ? 0 : value;
}

export function readVersion(value: unknown, expected: number): void {
  if (value !== expected)
    throw new RangeError("Versão do gerador incompatível.");
}

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("Modelo inválido.");
  return value as Record<string, unknown>;
}

/** Compare against a finite, generated data model, including nested keys and arrays.
 * Never serializes or coerces untrusted values; sparse arrays are incompatible. */
export function matchesCanonical(value: unknown, expected: unknown): boolean {
  if (expected === null || typeof expected !== "object")
    return value === expected;
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) !== Array.isArray(expected)
  )
    return false;
  if (
    Array.isArray(expected) &&
    (!Array.isArray(value) || value.length !== expected.length)
  )
    return false;
  const actual = value as Record<string, unknown>;
  const canonical = expected as Record<string, unknown>;
  const keys = Object.keys(canonical);
  return (
    Object.keys(actual).length === keys.length &&
    keys.every(
      (key) =>
        Object.hasOwn(actual, key) &&
        matchesCanonical(actual[key], canonical[key]),
    )
  );
}

export function requireCanonical<T>(value: unknown, expected: T): T {
  if (!matchesCanonical(value, expected))
    throw new TypeError("Modelo diverge da geração canônica.");
  return expected;
}

export function errorReason(error: unknown): string {
  return error instanceof Error ? error.message : "Modelo inválido.";
}
