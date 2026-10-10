import type { FormattedCode } from "./formatter.worker";
import type { Compilation } from "./compiler";
function job<T>(
  worker: Worker,
  code: string,
  language: "typescript" | "javascript",
  signal: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const stop = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      worker.terminate();
    };
    const abort = () => {
      stop();
      reject(new Error("Operação cancelada."));
    };
    const timer = window.setTimeout(() => {
      stop();
      reject(new Error("Tempo limite de análise excedido (15 s)."));
    }, 15000);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    worker.onmessage = (event: MessageEvent<{ result: T; error?: string }>) => {
      stop();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.result);
    };
    worker.onerror = () => {
      stop();
      reject(new Error("Não foi possível carregar a ferramenta de código."));
    };
    worker.postMessage({ code, language });
  });
}
export function compile(
  code: string,
  language: "typescript" | "javascript",
  signal: AbortSignal,
) {
  return job<Compilation>(
    new Worker(new URL("./compiler.worker.ts", import.meta.url), {
      type: "module",
    }),
    code,
    language,
    signal,
  );
}
export function formatCode(
  code: string,
  language: "typescript" | "javascript",
  signal: AbortSignal,
) {
  return job<FormattedCode>(
    new Worker(new URL("./formatter.worker.ts", import.meta.url), {
      type: "module",
    }),
    code,
    language,
    signal,
  );
}
