import type {
  PublicSqlExercise,
  SqlFormativeOracle,
} from "@bunkercode/content/sql";
export type SqlExercise = PublicSqlExercise;
export interface SqlLessonTask {
  taskId: string;
  exercise: SqlExercise;
}
export type { SqlResult } from "@bunkercode/content/sql-engine";
import type { SqlResult } from "@bunkercode/content/sql-engine";

export type SqlRequest = (
  | { type: "initialize"; id: number; exercise: SqlExercise }
  | { type: "preview"; id: number; table: string }
  | { type: "query"; id: number; sql: string; formative?: SqlFormativeOracle }
) & { measure?: boolean };

export type SqlResponse = (
  | { type: "ready"; id: number }
  | { type: "result"; id: number; result: SqlResult }
  | { type: "error"; id: number; error: { message: string; code?: string } }
) & { diagnostics?: Record<string, number> };

// Bump version for any configuration change within the same identity.
export function sqlSessionKey(exercise: Pick<SqlExercise, "id" | "version">) {
  return JSON.stringify([exercise.id, exercise.version]);
}
