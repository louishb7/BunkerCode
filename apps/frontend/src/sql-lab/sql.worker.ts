import { createPracticeEngine as createSqlEngine } from "@bunkercode/content/sql-engine";
import { matchesFormative } from "@bunkercode/content/sql-comparison";
import type { SqlExercise, SqlRequest, SqlResponse } from "./exercise";

let engine: Awaited<ReturnType<typeof createSqlEngine>> | undefined;
let exercise: SqlExercise | undefined;
const reply = (response: SqlResponse) => self.postMessage(response);
self.onmessage = async (event: MessageEvent<SqlRequest>) => {
  const request = event.data;
  const timings: Record<string, number> = {};
  const started = performance.now();
  try {
    if (request.type === "initialize") {
      if (engine) throw new Error("SQL engine already initialized");
      exercise = request.exercise;
      engine = await createSqlEngine(
        exercise,
        request.measure
          ? (phase, ms) => {
              timings[phase] = ms;
            }
          : undefined,
      );
      if (request.measure) {
        for (const entry of performance.getEntriesByType("resource")) {
          if (/pglite.*\.wasm/.test(entry.name))
            timings.wasmFetchMs = entry.duration;
          if (/pglite.*\.data/.test(entry.name))
            timings.dataFetchMs = entry.duration;
        }
      }
      reply({
        type: "ready",
        id: request.id,
        ...(request.measure
          ? {
              diagnostics: {
                ...timings,
                totalMs: performance.now() - started,
                sentAt: performance.timeOrigin + performance.now(),
              },
            }
          : {}),
      });
    } else {
      if (!engine) throw new Error("SQL engine is not initialized");
      let result =
        request.type === "preview"
          ? await engine.preview(request.table)
          : await engine.execute(request.sql);
      timings.executionMs = performance.now() - started;
      const comparison = performance.now();
      if (
        request.type === "query" &&
        exercise?.mode === "query" &&
        exercise.formative
      )
        result = {
          ...result,
          correct: matchesFormative(result, exercise.formative),
        };
      timings.comparisonMs = performance.now() - comparison;
      if (request.measure) {
        const clone = performance.now();
        structuredClone(result);
        timings.cloneMs = performance.now() - clone;
      }
      reply({
        type: "result",
        id: request.id,
        result,
        ...(request.measure
          ? {
              diagnostics: {
                ...timings,
                sentAt: performance.timeOrigin + performance.now(),
              },
            }
          : {}),
      });
    }
  } catch (error: unknown) {
    reply({
      type: "error",
      id: request.id,
      ...(request.measure
        ? {
            diagnostics: {
              executionMs: performance.now() - started,
              sentAt: performance.timeOrigin + performance.now(),
            },
          }
        : {}),
      error: {
        message: error instanceof Error ? error.message : String(error),
        ...(error &&
        typeof error === "object" &&
        "code" in error &&
        typeof error.code === "string"
          ? { code: error.code }
          : {}),
      },
    });
  }
};
