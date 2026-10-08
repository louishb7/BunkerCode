import { harnessPath } from "../content/activities";
import {
  emptyOutcome,
  ExecutionFailure,
  startHarness,
  stopChild,
  withSource,
} from "./process";
import type { OrderResult } from "./results";
async function boundedJson(response: Response): Promise<unknown> {
  if (!response.body)
    throw new ExecutionFailure("runtime_error", "Resposta vazia.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 8192)
        throw new ExecutionFailure("runtime_error", "Resposta excedeu 8 KiB.");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } finally {
    await reader.cancel();
  }
}

function state(value: unknown): { stock: number; orders: number } {
  if (
    !value ||
    typeof value !== "object" ||
    !("stock" in value) ||
    !("orders" in value) ||
    typeof value.stock !== "number" ||
    !Number.isFinite(value.stock) ||
    typeof value.orders !== "number" ||
    !Number.isInteger(value.orders)
  )
    throw new ExecutionFailure(
      "runtime_error",
      "Estado inválido recebido do exercício.",
    );
  return { stock: value.stock, orders: value.orders };
}
export function executeOrderRequest(
  source: string,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<OrderResult> {
  return withSource(
    source,
    { ...emptyOutcome(), kind: "order", observation: null } as OrderResult,
    async (directory, signal, result) => {
      let resolveReady!: (port: number) => void;
      const ready = new Promise<number>((resolve) => {
        resolveReady = resolve;
      });
      const session = await startHarness(
        directory,
        harnessPath("order-acceptance"),
        signal,
        (message) => {
          if (
            message &&
            typeof message === "object" &&
            "kind" in message &&
            message.kind === "ready" &&
            "port" in message &&
            typeof message.port === "number" &&
            Number.isInteger(message.port) &&
            message.port > 0 &&
            message.port <= 65535
          )
            resolveReady(message.port);
        },
      );
      try {
        const port = await Promise.race([
          ready,
          session.closed.then(() => {
            throw new ExecutionFailure(
              "runtime_error",
              "O programa encerrou antes de iniciar o HTTP.",
            );
          }),
        ]);
        const url = `http://127.0.0.1:${port}`;
        const initialState = state(
          await boundedJson(await fetch(`${url}/state`, { signal })),
        );
        if (initialState.stock !== 1 || initialState.orders !== 0)
          throw new ExecutionFailure(
            "runtime_error",
            "Estado inicial não corresponde ao enunciado.",
          );
        const request = {
          method: "POST" as const,
          path: "/orders" as const,
          body: { quantity: 1 },
        };
        const response = await fetch(`${url}/orders`, {
          method: "POST",
          signal,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(request.body),
        });
        const body = await boundedJson(response);
        const finalState = state(
          await boundedJson(await fetch(`${url}/state`, { signal })),
        );
        result.observation = {
          request,
          response: { status: response.status, body },
          initialState,
          finalState,
        };
      } finally {
        await stopChild(session);
        Object.assign(result, session.output, {
          exitCode: (await session.closed).code,
        });
      }
    },
    options,
  );
}
