import { PGlite, type Results } from "@electric-sql/pglite";
import type { PublicSqlExercise } from "./sql";
export interface SqlResult {
  fields: string[];
  types?: number[];
  rows: unknown[][];
  truncated: boolean;
  affectedRows?: number;
  correct?: boolean;
}
const identifier = (name: string) => '"' + name.replaceAll('"', '""') + '"';
function bounded(result: Results<unknown[]>, limit: number): SqlResult {
  return {
    fields: result.fields.map((field) => field.name),
    types: result.fields.map((field) => field.dataTypeID),
    rows: result.rows.slice(0, limit),
    truncated: result.rows.length > limit,
  };
}
async function tableSnapshot(
  db: PGlite,
  exercise: PublicSqlExercise,
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

export async function createPracticeEngine(
  exercise: PublicSqlExercise,
  observe?: (phase: "pgliteMs" | "setupMs", milliseconds: number) => void,
) {
  const start = performance.now();
  const db = await PGlite.create();
  observe?.("pgliteMs", Math.round(performance.now() - start));
  const setup = performance.now();
  try {
    await db.exec(exercise.setupSql);
    const tables = await db.query<{ name: string }>(
      "SELECT tablename AS name FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename",
    );
    if (
      exercise.mode === "mutation" &&
      JSON.stringify(tables.rows.map((t) => t.name)) !==
        JSON.stringify(exercise.schema.map((t) => t.name).sort())
    )
      throw new Error(
        "A atividade de alteração deve declarar todas as tabelas do dataset.",
      );
    const database = await db.query<{ name: string }>(
      "SELECT current_database() AS name",
    );
    await db.exec(`CREATE ROLE bunkercode_student NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
      REVOKE CREATE ON SCHEMA public FROM PUBLIC;
      REVOKE TEMPORARY,CREATE ON DATABASE ${identifier(database.rows[0]!.name)} FROM PUBLIC;
      REVOKE EXECUTE ON FUNCTION pg_catalog.set_config(text,text,boolean) FROM PUBLIC;
      GRANT USAGE ON SCHEMA public TO bunkercode_student;`);
    for (const table of tables.rows)
      await db.exec(
        `GRANT ${exercise.mode === "query" ? "SELECT" : "SELECT,INSERT,UPDATE,DELETE"} ON public.${identifier(table.name)} TO bunkercode_student`,
      );
    await db.exec("SET SESSION AUTHORIZATION bunkercode_student");
    if (exercise.mode === "query")
      await db.exec("SET default_transaction_read_only=on");
    observe?.("setupMs", Math.round(performance.now() - setup));
    const select = async (sql: string): Promise<SqlResult> => {
      const statement = sql.trim().replace(/;\s*$/, "");
      const result = await db.query<unknown[]>(
        `SELECT * FROM (\n${statement}\n) AS student_query LIMIT ${exercise.limits.maxRows + 1}`,
        [],
        { rowMode: "array" },
      );
      return bounded(result, exercise.limits.maxRows);
    };
    return {
      async execute(sql: string): Promise<SqlResult> {
        if (exercise.mode === "query") return select(sql);
        return db.transaction(async (tx) => {
          await tx.query(`EXPLAIN ${sql}`);
          const result = await tx.query<unknown[]>(sql, [], {
            rowMode: "array",
          });
          if (
            !result.command ||
            !["SELECT", "INSERT", "UPDATE", "DELETE"].includes(result.command)
          )
            throw new Error("Comando não suportado.");
          return {
            ...bounded(result, exercise.limits.maxRows),
            affectedRows: result.affectedRows ?? 0,
          };
        });
      },
      snapshot: () => tableSnapshot(db, exercise),
      async preview(table: string): Promise<SqlResult> {
        if (!exercise.schema.some((item) => item.name === table))
          throw new Error("Tabela não disponível nesta atividade.");
        return bounded(
          await db.query<unknown[]>(
            `SELECT * FROM public.${identifier(table)} LIMIT 11`,
            [],
            { rowMode: "array" },
          ),
          10,
        );
      },
      close: () => db.close(),
    };
  } catch (error) {
    await db.close();
    throw error;
  }
}
