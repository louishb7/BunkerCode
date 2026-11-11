// Trusted, versioned lesson configuration. This is not a backend exercise or a
// persisted completion contract; verification supplies browser-local feedback.
export interface SqlExercise {
  id: string;
  title: string;
  instructions: string;
  starterSql: string;
  setupSql: string;
  schema: { name: string; columns: { name: string; type: string }[] }[];
  schemaNote: string;
  expectedQuery: string;
  limits: { maxRows: number; initializationMs: number; queryMs: number };
}

export interface SqlResult {
  fields: string[];
  rows: unknown[][];
  truncated: boolean;
  correct?: boolean;
}

export type SqlRequest =
  | { type: "initialize"; id: number; exercise: SqlExercise }
  | { type: "query"; id: number; sql: string; verify: boolean };

export type SqlResponse =
  | { type: "ready"; id: number }
  | { type: "result"; id: number; result: SqlResult }
  | { type: "error"; id: number; error: { message: string; code?: string } };
