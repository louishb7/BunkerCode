import type { SqlResult } from "./sql-engine";
import type { SqlFormativeOracle } from "./sql";
// Preserve SQL NULL versus non-finite floats, and normalize JSON object key order.
function canonicalCell(value: unknown): unknown {
  if (value === null) return ["null"];
  if (value instanceof Date) return ["date", value.toISOString()];
  if (Array.isArray(value)) return ["array", value.map(canonicalCell)];
  if (typeof value === "object")
    return [
      "object",
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, canonicalCell(item)]),
    ];
  if (["string", "boolean", "number", "bigint"].includes(typeof value))
    return [typeof value, String(value)];
  throw new Error("Tipo de valor SQL não suportado para comparação.");
}

export function equivalentResults(
  actual: SqlResult,
  expected: SqlResult,
  orderMatters = false,
): boolean {
  if (actual.truncated || expected.truncated) return false;
  return (
    JSON.stringify(canonicalResult(actual, orderMatters)) ===
    JSON.stringify(canonicalResult(expected, orderMatters))
  );
}

export function canonicalResult(result: SqlResult, orderMatters: boolean) {
  if (result.truncated) throw new Error("Resultado formativo truncado.");
  const rows = result.rows.map((row) => JSON.stringify(row.map(canonicalCell)));
  return {
    fields: result.fields,
    types: result.types,
    rows: orderMatters ? rows : rows.sort(),
    truncated: false as const,
  };
}
export function matchesFormative(
  result: SqlResult,
  oracle: SqlFormativeOracle,
): boolean {
  return (
    !result.truncated &&
    JSON.stringify(canonicalResult(result, oracle.orderMatters)) ===
      JSON.stringify(oracle.expected)
  );
}
