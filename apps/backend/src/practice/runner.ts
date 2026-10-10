import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { HttpException } from "@nestjs/common";
const execute = promisify(execFile);
export const RUNNER_IMAGE =
  "node@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1";
export const RUN_LIMITS = {
  timeoutMs: 5000,
  outputBytes: 32768,
  codeBytes: 65536,
  memoryMiB: 96,
  cpus: 0.5,
  processes: 32,
  concurrent: 2,
};
interface Active {
  cancel: () => void;
  done: Promise<RunResult>;
}
export interface RunResult {
  id: string;
  sourceHash: string;
  state: "success" | "error" | "timeout" | "cancelled" | "output-limit";
  stdout: string;
  stderr: string;
  exitCode: number | null;
}
const active = new Map<string, Active>();
const recent: number[] = [];
let readiness: Promise<{ available: boolean; reason: string }> | undefined;
let checkedAt = 0;
async function available() {
  if (process.env.BUNKERCODE_RUNNER_ENABLED === "0")
    return {
      available: false,
      reason:
        "Run desativado nesta instalação. Compilação e Submit permanecem disponíveis.",
    };
  try {
    const info = await execute(
      "docker",
      [
        "info",
        "--format",
        "{{.OSType}}|{{.CgroupVersion}}|{{json .SecurityOptions}}",
      ],
      { timeout: 4000, maxBuffer: 4096 },
    );
    if (
      !info.stdout.startsWith("linux|2|") ||
      !info.stdout.includes("name=seccomp,profile=builtin")
    )
      throw new Error("Linux/cgroup v2/seccomp required");
    await execute(
      "docker",
      ["image", "inspect", RUNNER_IMAGE, "--format", "{{.Id}}"],
      { timeout: 4000, maxBuffer: 1024 },
    );
    return {
      available: true,
      reason:
        "Node.js isolado em container descartável, sem rede ou volumes do produto.",
    };
  } catch {
    return {
      available: false,
      reason:
        "Run indisponível: requer Docker Linux com cgroup v2, seccomp e a imagem Node.js documentada. Use Compilar; consulte a configuração no README.",
    };
  }
}
export function runnerStatus() {
  if (!readiness || Date.now() - checkedAt > 15000) {
    checkedAt = Date.now();
    readiness = available();
  }
  return readiness;
}
export async function cancelRun(id: string) {
  const run = active.get(id);
  if (run) {
    run.cancel();
    await run.done;
  }
  return { cancelled: !!run };
}
export async function stopRuns() {
  await Promise.all(
    [...active.values()].map((run) => {
      run.cancel();
      return run.done;
    }),
  );
}
export async function runCode(
  id: string,
  source: string,
  javascript: string,
  signal?: AbortSignal,
): Promise<RunResult> {
  if (!(await runnerStatus()).available)
    throw new HttpException("Execução isolada indisponível.", 503);
  if (
    !/^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(id) ||
    [source, javascript].some(
      (text) => Buffer.byteLength(text, "utf8") > RUN_LIMITS.codeBytes,
    )
  )
    throw new HttpException("Identidade ou tamanho de código inválido.", 400);
  if (signal?.aborted)
    throw new HttpException("Execução cancelada antes de iniciar.", 409);
  if (active.has(id)) throw new HttpException("Execução já registrada.", 409);
  const now = Date.now();
  while (recent.length && recent[0]! < now - 60000) recent.shift();
  if (active.size >= RUN_LIMITS.concurrent || recent.length >= 60)
    throw new HttpException(
      "Limite de execuções. Aguarde e tente novamente.",
      429,
    );
  recent.push(now);
  const name = "bunkercode-run-" + id;
  let cancelled = false;
  let terminate: (() => void) | undefined;
  const cancel = () => {
    cancelled = true;
    terminate?.();
  };
  // Reserve a slot before asynchronous container creation, preventing concurrency races.
  const work = Promise.resolve().then(async (): Promise<RunResult> => {
    let cleanupFailure = false;
    const executeContainer = async (): Promise<RunResult> => {
      await execute(
        "docker",
        [
          "create",
          "--pull",
          "never",
          "--name",
          name,
          "--label",
          "bunkercode.runner=refinement01",
          "--interactive",
          "--network",
          "none",
          "--read-only",
          "--cap-drop",
          "ALL",
          "--security-opt",
          "no-new-privileges",
          "--memory",
          `${RUN_LIMITS.memoryMiB}m`,
          "--memory-swap",
          `${RUN_LIMITS.memoryMiB}m`,
          "--cpus",
          String(RUN_LIMITS.cpus),
          "--pids-limit",
          String(RUN_LIMITS.processes),
          "--ulimit",
          "nofile=64:64",
          "--user",
          "65534:65534",
          "--log-driver",
          "none",
          "--tmpfs",
          "/tmp:rw,noexec,nosuid,size=1048576",
          "--workdir",
          "/tmp",
          RUNNER_IMAGE,
          "node",
          "--input-type=module",
          "-",
        ],
        { timeout: 5000, maxBuffer: 4096 },
      );
      if (cancelled)
        return {
          id,
          sourceHash: createHash("sha256").update(source).digest("hex"),
          state: "cancelled",
          stdout: "",
          stderr: "",
          exitCode: null,
        };
      return await new Promise<RunResult>((resolve, reject) => {
        const process = spawn(
          "docker",
          ["start", "--attach", "--interactive", name],
          { stdio: ["pipe", "pipe", "pipe"] },
        );
        let bytes = 0,
          stdout = "",
          stderr = "",
          state: RunResult["state"] = "success";
        let stopping: Promise<void> | undefined;
        const stop = () => {
          stopping ??= execute("docker", ["kill", name], {
            timeout: 4000,
            maxBuffer: 4096,
          })
            .then(() => undefined)
            .catch(() => {
              process.kill("SIGKILL");
            });
        };
        terminate = () => {
          state = "cancelled";
          stop();
        };
        const timer = setTimeout(() => {
          state = "timeout";
          stop();
        }, RUN_LIMITS.timeoutMs);
        const collect = (chunk: Buffer, target: "stdout" | "stderr") => {
          const remaining = Math.max(0, RUN_LIMITS.outputBytes - bytes);
          const text = chunk.subarray(0, remaining).toString("utf8");
          if (target === "stdout") stdout += text;
          else stderr += text;
          bytes += chunk.length;
          if (bytes > RUN_LIMITS.outputBytes && state === "success") {
            state = "output-limit";
            stop();
          }
        };
        process.stdout.on("data", (chunk: Buffer) => collect(chunk, "stdout"));
        process.stderr.on("data", (chunk: Buffer) => collect(chunk, "stderr"));
        process.stdin.on("error", () => {
          /* Closed input is reported through the container's exit status. */
        });
        process.once("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
        process.once("close", () => {
          clearTimeout(timer);
          void (async () => {
            if (stopping) await stopping;
            const inspect = await execute(
              "docker",
              ["inspect", name, "--format", "{{.State.ExitCode}}"],
              { timeout: 4000, maxBuffer: 1024 },
            );
            const exitCode = Number(inspect.stdout.trim());
            resolve({
              id,
              sourceHash: createHash("sha256").update(source).digest("hex"),
              state: state === "success" && exitCode !== 0 ? "error" : state,
              stdout,
              stderr,
              exitCode,
            });
          })().catch(reject);
        });
        process.stdin.end(javascript);
      });
    };
    let result: RunResult | undefined;
    let executionFailure: unknown;
    try {
      result = await executeContainer();
    } catch (error) {
      executionFailure = error;
    }
    try {
      await execute("docker", ["rm", "--force", name], {
        timeout: 5000,
        maxBuffer: 4096,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      if (!detail.includes("No such container")) cleanupFailure = true;
    }
    signal?.removeEventListener("abort", cancel);
    active.delete(id);
    if (cleanupFailure) {
      readiness = Promise.resolve({
        available: false,
        reason:
          "Run suspenso: falha ao encerrar container. Verifique Docker antes de continuar.",
      });
      checkedAt = Number.MAX_SAFE_INTEGER;
      throw new HttpException(
        "Falha ao remover container; Run foi suspenso.",
        503,
      );
    }
    if (executionFailure) throw executionFailure;
    if (!result) throw new HttpException("Execução sem resultado.", 503);
    return result;
  });
  active.set(id, { cancel, done: work });
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  return work;
}
