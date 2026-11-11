import { createSqlEngine } from "./sql-engine";
import type { SqlRequest, SqlResponse } from "./exercise";

let engine: Awaited<ReturnType<typeof createSqlEngine>> | undefined;
const reply = (response: SqlResponse) => self.postMessage(response);
self.onmessage = async (event: MessageEvent<SqlRequest>) => {
  const request = event.data;
  try {
    if (request.type === "initialize") {
      if (engine) throw new Error("SQL engine already initialized");
      engine = await createSqlEngine(request.exercise);
      reply({ type: "ready", id: request.id });
    } else {
      if (!engine) throw new Error("SQL engine is not initialized");
      reply({
        type: "result",
        id: request.id,
        result: await engine.execute(request.sql, request.verify),
      });
    }
  } catch (error: unknown) {
    reply({
      type: "error",
      id: request.id,
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
