import { useEffect, useState } from "react";
import {
  parsePublicSqlExercise,
  type PublicSqlExercise,
} from "@bunkercode/content/sql";
import { apiFetch } from "../auth/session";
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
export function useSqlExercise(
  reference: { exerciseId: string; version: number } | null,
) {
  const key = reference ? reference.exerciseId + "/" + reference.version : "";
  const [state, setState] = useState<{
    key: string;
    data?: PublicSqlExercise;
    error?: string;
  }>({ key: "" });
  useEffect(() => {
    if (!key) return;
    const abort = new AbortController();
    void sqlRequest("/exercises/" + key, "GET", undefined, abort.signal)
      .then((value) => setState({ key, data: parsePublicSqlExercise(value) }))
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
