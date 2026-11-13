import { useEffect, useState } from "react";
import {
  parsePublicSqlExercise,
  validateSqlSequenceExercises,
  type PublicSqlExercise,
} from "@bunkercode/content/sql";
import { apiFetch } from "../auth/session";
import {
  parseSqlPlacement,
  sqlExerciseReferences,
  type SqlLessonPlacement,
} from "@bunkercode/content";
import type { SqlLessonTask } from "./exercise";
export async function sqlRequest(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await apiFetch("/api/content/sql" + path, {
    method,
    signal: signal ?? AbortSignal.timeout(30000),
    headers: {
      "Content-Type": "application/json",
      "X-Bunkercode-Client": "local",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const value: unknown = await response.json();
  if (!response.ok)
    throw new Error(
      value &&
        typeof value === "object" &&
        "message" in value &&
        typeof value.message === "string"
        ? value.message
        : "Serviço SQL indisponível. Tente novamente.",
    );
  return value;
}
export function useSqlActivity(reference: SqlLessonPlacement | null) {
  const key = reference ? JSON.stringify(reference) : "";
  const [state, setState] = useState<{
    key: string;
    data?: { exercise: PublicSqlExercise; tasks?: SqlLessonTask[] };
    error?: string;
  }>({ key: "" });
  useEffect(() => {
    if (!key) return;
    const abort = new AbortController();
    const placement = parseSqlPlacement(JSON.parse(key));
    const references = sqlExerciseReferences(placement);
    void Promise.all(
      references.map(async (reference) => {
        const value = parsePublicSqlExercise(
          await sqlRequest(
            `/exercises/${reference.exerciseId}/${reference.version}`,
            "GET",
            undefined,
            abort.signal,
          ),
        );
        if (
          value.id !== reference.exerciseId ||
          value.version !== reference.version
        )
          throw new Error(
            "A resposta SQL não corresponde à referência da tarefa.",
          );
        return value;
      }),
    )
      .then((exercises) => {
        if (abort.signal.aborted) return;
        if (placement.kind === "sql-task-sequence")
          validateSqlSequenceExercises(exercises);
        setState({
          key,
          data: {
            exercise: exercises[0]!,
            ...(placement.kind === "sql-task-sequence"
              ? {
                  tasks: placement.tasks.map((task, index) => ({
                    taskId: task.taskId,
                    exercise: exercises[index]!,
                  })),
                }
              : {}),
          },
        });
      })
      .catch((error: unknown) => {
        if (!abort.signal.aborted)
          setState({
            key,
            error:
              error instanceof Error
                ? error.message
                : "Atividade SQL inválida.",
          });
      });
    return () => abort.abort();
  }, [key]);
  return state.key === key ? state : { key };
}
