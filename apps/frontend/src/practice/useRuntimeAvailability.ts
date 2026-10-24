import { capabilities } from "../capabilities";
import { useCallback, useEffect, useRef, useState } from "react";
import { runtimeStatus, type RuntimeStatus } from "./runtime-api";

type RuntimeDecision =
  | { state: "available"; status: RuntimeStatus }
  | { state: "unavailable"; status: RuntimeStatus }
  | { state: "error"; message: string };
export type RuntimeAvailability =
  { state: "unknown" | "pending" } | RuntimeDecision;
type RuntimeCheck = {
  controller: AbortController;
  promise: Promise<RuntimeDecision>;
  result?: RuntimeDecision;
};

// One query per mounted practice panel; operations await its promise rather
// than a render's snapshot. A cancelled/failed query can be retried explicitly.
export function useRuntimeAvailability() {
  const [availability, setAvailability] = useState<RuntimeAvailability>({
    state: "unknown",
  });
  const request = useRef<RuntimeCheck>(undefined);
  const mounted = useRef(false);
  const check = useCallback(() => {
    if (!capabilities.remoteExecution)
      return Promise.resolve<RuntimeDecision>({
        state: "unavailable",
        status: {
          available: false,
          reason:
            "Execução remota indisponível no ambiente público. O rascunho fica neste navegador.",
        },
      });
    const previous = request.current;
    if (
      previous &&
      !previous.controller.signal.aborted &&
      previous.result?.state !== "error"
    )
      return previous.promise;
    const controller = new AbortController();
    const promise = runtimeStatus(controller.signal)
      .then<RuntimeDecision>((status) =>
        status.available
          ? { state: "available", status }
          : { state: "unavailable", status },
      )
      .catch((error: unknown): RuntimeDecision => ({
        state: "error",
        message:
          error instanceof Error
            ? error.message
            : "Falha ao consultar a disponibilidade de Run.",
      }));
    const current: RuntimeCheck = { controller, promise };
    request.current = current;
    setAvailability({ state: "pending" });
    void promise.then((value) => {
      current.result = value;
      if (
        mounted.current &&
        request.current === current &&
        !controller.signal.aborted
      )
        setAvailability(value);
    });
    return promise;
  }, []);
  const cancelPending = useCallback(() => {
    const current = request.current;
    if (current && !current.result) {
      current.controller.abort();
      request.current = undefined;
      if (mounted.current) setAvailability({ state: "unknown" });
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    if (capabilities.remoteExecution) void check();
    return () => {
      mounted.current = false;
      request.current?.controller.abort();
      request.current = undefined;
    };
  }, [check]);
  return { availability, check, cancelPending };
}
