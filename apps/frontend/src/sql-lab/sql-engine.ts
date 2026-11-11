import { PGlite } from "@electric-sql/pglite";
import type { SqlExercise, SqlResult } from "./exercise";

export function equivalentResults(
  actual: SqlResult,
  expected: SqlResult,
): boolean {
  if (actual.truncated || expected.truncated) return false;
  const canonical = (rows: unknown[][]) =>
    rows.map((row) => JSON.stringify(row)).sort();
  return (
    JSON.stringify(actual.fields) === JSON.stringify(expected.fields) &&
    JSON.stringify(canonical(actual.rows)) ===
      JSON.stringify(canonical(expected.rows))
  );
}

// One disposable in-memory engine per Worker. No application API or credentials.
export async function createSqlEngine(exercise: SqlExercise) {
  const db = await PGlite.create();
  try {
    await db.exec(exercise.setupSql);
    await db.exec("SET default_transaction_read_only = on");
    const select = async (sql: string): Promise<SqlResult> => {
      const statement = sql.trim().replace(/;\s*$/, "");
      const result = await db.query<unknown[]>(
        `SELECT * FROM (\n${statement}\n) AS student_query LIMIT ${exercise.limits.maxRows + 1}`,
        [],
        { rowMode: "array" },
      );
      return {
        fields: result.fields.map((field) => field.name),
        rows: result.rows.slice(0, exercise.limits.maxRows),
        truncated: result.rows.length > exercise.limits.maxRows,
      };
    };
    const expected = await select(exercise.expectedQuery);
    return {
      async execute(sql: string, verify: boolean): Promise<SqlResult> {
        const result = await select(sql);
        return verify
          ? { ...result, correct: equivalentResults(result, expected) }
          : result;
      },
      close: () => db.close(),
    };
  } catch (error) {
    await db.close();
    throw error;
  }
}
