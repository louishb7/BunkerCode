import { Worker } from "node:worker_threads";
import { join } from "node:path";
import { HttpException } from "@nestjs/common";
let active = 0;
export function compileAssessment(
  source: string,
  language: "typescript" | "javascript",
  signal: AbortSignal,
): Promise<string> {
  if (Buffer.byteLength(source) > 65536)
    throw new HttpException("Código excede 64 KiB.", 400);
  if (active >= 2)
    throw new HttpException("Aguarde a verificação em andamento.", 429);
  if (signal.aborted) throw new HttpException("Operação cancelada.", 409);
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      join(
        __dirname,
        __filename.endsWith(".ts")
          ? "../../dist/practice/assessment-worker.js"
          : "assessment-worker.js",
      ),
      {
        workerData: { source, language },
        resourceLimits: { maxOldGenerationSizeMb: 128 },
      },
    );
    active++;
    let done = false;
    const finish = (error?: Error, javascript?: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      void worker.terminate().finally(() => {
        active--;
      });
      if (error) reject(error);
      else resolve(javascript!);
    };
    const abort = () => finish(new HttpException("Operação cancelada.", 409));
    const timer = setTimeout(
      () => finish(new HttpException("Tempo de compilação excedido.", 422)),
      15000,
    );
    signal.addEventListener("abort", abort, { once: true });
    worker.once(
      "message",
      (value: { diagnostics: { message: string }[]; javascript: string }) => {
        if (value.diagnostics.length)
          finish(
            new HttpException(
              "Compilação recusada: " + value.diagnostics[0]!.message,
              422,
            ),
          );
        else finish(undefined, value.javascript);
      },
    );
    worker.once("error", (error) => finish(error));
    worker.once("exit", (code) => {
      if (!done)
        finish(new Error(`Compilador encerrado sem resultado (${code}).`));
    });
  });
}
