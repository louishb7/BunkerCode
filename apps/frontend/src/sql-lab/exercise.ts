// Trusted, versioned author configuration. Local grading is never completion proof.
interface SqlExerciseBase {
  id: string;
  version: number;
  title: string;
  objective: string;
  instructions: string;
  starterSql: string;
  setupSql: string;
  schema: {
    name: string;
    columns: {
      name: string;
      type: string;
      primaryKey?: boolean;
      references?: string;
    }[];
  }[];
  schemaNote: string;
  limits: { maxRows: number; initializationMs: number; queryMs: number };
}
export type SqlExercise = SqlExerciseBase &
  (
    | { mode: "query"; expectedQuery: string; orderMatters?: boolean }
    | { mode: "mutation"; expectedSql: string }
  );

export interface SqlResult {
  fields: string[];
  rows: unknown[][];
  truncated: boolean;
  affectedRows?: number;
  correct?: boolean;
}

export type SqlRequest =
  | { type: "initialize"; id: number; exercise: SqlExercise }
  | { type: "preview"; id: number; table: string }
  | { type: "verify-state"; id: number }
  | { type: "query"; id: number; sql: string; verify: boolean };

export type SqlResponse =
  | { type: "ready"; id: number }
  | { type: "result"; id: number; result: SqlResult }
  | { type: "error"; id: number; error: { message: string; code?: string } };

// Bump version for any configuration change within the same identity.
export function sqlSessionKey(exercise: Pick<SqlExercise, "id" | "version">) {
  return JSON.stringify([exercise.id, exercise.version]);
}
