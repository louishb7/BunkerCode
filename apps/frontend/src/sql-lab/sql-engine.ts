import { PGlite, type Results } from "@electric-sql/pglite";
import type { SqlExercise, SqlResult } from "./exercise";

// Preserve SQL NULL versus non-finite floats, and normalize JSON object key order.
function canonicalCell(value: unknown): unknown {
  if (value === null) return ["null"];
  if (value instanceof Date) return ["date", value.toISOString()];
  if (Array.isArray(value)) return ["array", value.map(canonicalCell)];
  if (typeof value === "object")
    return [
      "object",
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
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
  const canonical = (rows: unknown[][]) => {
    const serialized = rows.map((row) =>
      JSON.stringify(row.map(canonicalCell)),
    );
    return orderMatters ? serialized : serialized.sort();
  };
  return (
    JSON.stringify(actual.fields) === JSON.stringify(expected.fields) &&
    JSON.stringify(canonical(actual.rows)) ===
      JSON.stringify(canonical(expected.rows))
  );
}
const identifier = (name: string) => '"' + name.replaceAll('"', '""') + '"';
function bounded(result: Results<unknown[]>, limit: number): SqlResult {
  return {
    fields: result.fields.map((field) => field.name),
    rows: result.rows.slice(0, limit),
    truncated: result.rows.length > limit,
  };
}
async function tableSnapshot(
  db: PGlite,
  exercise: SqlExercise,
): Promise<SqlResult[]> {
  // All author-declared public tables are checked, including unrelated rows/tables.
  const inventory = await db.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name",
  );
  const configured = exercise.schema.map((table) => table.name).sort();
  if (
    JSON.stringify(inventory.rows.map((row) => row.table_name)) !==
    JSON.stringify(configured)
  )
    throw new Error(
      "A atividade de alteração deve declarar todas as tabelas do dataset.",
    );
  const states: SqlResult[] = [];
  for (const table of exercise.schema) {
    const result = await db.query<unknown[]>(
      `SELECT * FROM public.${identifier(table.name)} LIMIT ${exercise.limits.maxRows + 1}`,
      [],
      { rowMode: "array" },
    );
    states.push(bounded(result, exercise.limits.maxRows));
  }
  return states;
}

// At most one in-memory database is alive here. The independent reference is
// closed before creating the student's session, and only its bounded rows remain.
export async function createSqlEngine(exercise: SqlExercise) {
  let expectedState: SqlResult[] | undefined;
  if (exercise.mode === "mutation") {
    const reference = await PGlite.create();
    try {
      await reference.exec(exercise.setupSql);
      await reference.exec(exercise.expectedSql);
      expectedState = await tableSnapshot(reference, exercise);
      if (expectedState.some((result) => result.truncated))
        throw new Error(
          "O estado esperado excede o limite de linhas da atividade.",
        );
    } finally {
      await reference.close();
    }
  }
  const db = await PGlite.create();
  try {
    await db.exec(exercise.setupSql);
    if (exercise.mode === "query")
      await db.exec("SET default_transaction_read_only = on");
    else {
      const database = await db.query<{ name: string }>(
        "SELECT current_database() AS name",
      );
      await db.exec(`CREATE ROLE bunkercode_student NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
        REVOKE CREATE ON SCHEMA public FROM PUBLIC;
        REVOKE TEMPORARY, CREATE ON DATABASE ${identifier(database.rows[0]!.name)} FROM PUBLIC;
        GRANT USAGE ON SCHEMA public TO bunkercode_student;`);
      for (const table of exercise.schema)
        await db.exec(
          `GRANT SELECT, INSERT, UPDATE, DELETE ON public.${identifier(table.name)} TO bunkercode_student`,
        );
    }
    const select = async (sql: string): Promise<SqlResult> => {
      const statement = sql.trim().replace(/;\s*$/, "");
      const result = await db.query<unknown[]>(
        `SELECT * FROM (\n${statement}\n) AS student_query LIMIT ${exercise.limits.maxRows + 1}`,
        [],
        { rowMode: "array" },
      );
      return bounded(result, exercise.limits.maxRows);
    };
    const expected =
      exercise.mode === "query"
        ? await select(exercise.expectedQuery)
        : undefined;
    return {
      async execute(sql: string, verify = false): Promise<SqlResult> {
        if (exercise.mode === "query") {
          const result = await select(sql);
          return verify
            ? {
                ...result,
                correct: equivalentResults(
                  result,
                  expected!,
                  exercise.orderMatters,
                ),
              }
            : result;
        }
        if (verify)
          throw new Error(
            "Verifique o estado separadamente da execução do comando.",
          );
        return db.transaction(async (tx) => {
          // PostgreSQL parses one plannable statement. Never EXPLAIN ANALYZE:
          // planning must not apply the change. Transaction/control commands fail
          // parsing here; unsupported command tags roll back below. No regex parser.
          // Table ownership and CREATE/TEMP privileges stay with the setup role.
          // This is a local execution constraint, not a general security sandbox.
          await tx.query("SET LOCAL ROLE bunkercode_student");
          await tx.query(`EXPLAIN ${sql}`);
          const result = await tx.query<unknown[]>(sql, [], {
            rowMode: "array",
          });
          if (
            !result.command ||
            !["SELECT", "INSERT", "UPDATE", "DELETE"].includes(result.command)
          )
            throw new Error(
              "Use um único SELECT, INSERT, UPDATE ou DELETE nesta atividade.",
            );
          return {
            ...bounded(result, exercise.limits.maxRows),
            affectedRows: result.affectedRows ?? 0,
          };
        });
      },
      async verifyState(): Promise<SqlResult> {
        if (!expectedState)
          throw new Error(
            "Esta atividade verifica o resultado de uma consulta.",
          );
        const actual = await tableSnapshot(db, exercise);
        return {
          fields: [],
          rows: [],
          truncated: false,
          correct: actual.every((state, index) =>
            equivalentResults(state, expectedState![index]!),
          ),
        };
      },
      async preview(table: string): Promise<SqlResult> {
        if (!exercise.schema.some((item) => item.name === table))
          throw new Error("Tabela não disponível nesta atividade.");
        const result = await db.query<unknown[]>(
          `SELECT * FROM public.${identifier(table)} LIMIT 11`,
          [],
          { rowMode: "array" },
        );
        return bounded(result, 10);
      },
      close: () => db.close(),
    };
  } catch (error) {
    await db.close();
    throw error;
  }
}
