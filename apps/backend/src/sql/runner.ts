import {
  sqlDocker,
  attachSqlDocker,
  sqlDockerMode,
  assertNoSqlContainers,
} from "./docker";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HttpException } from "@nestjs/common";
import type { SqlDataset, SqlDefinition } from "@bunkercode/content/sql";
const event = (data: Record<string, unknown>) =>
  console.info(JSON.stringify({ event: "sql_runner", ...data }));
export function sqlRunnerSuspended() {
  return disabled;
}
export const SQL_RUN_LIMITS = {
  timeoutMs: 30000,
  memoryMiB: 1024,
  cpus: 0.75,
  processes: 32,
  concurrent: 1,
  inputBytes: 300000,
  outputBytes: 2048,
} as const;
let disabled = false;
const active = new Map<
  string,
  { cancel: () => void; done: Promise<boolean> }
>();
export function sqlRunnerRevision() {
  const hash = createHash("sha256");
  for (const file of ["sql", "sql-engine", "sql-grading"])
    hash.update(readFileSync(require.resolve("@bunkercode/content/" + file)));
  hash.update(readFileSync(join(__dirname, "runner-main.cjs")));
  hash.update(
    readFileSync(
      join(
        require.resolve("@electric-sql/pglite", {
          paths: [require.resolve("@bunkercode/content/sql-engine")],
        }),
        "../../package.json",
      ),
    ),
  );
  return hash.digest("hex");
}
export async function sqlRunnerStatus() {
  if (disabled || process.env.BUNKERCODE_SQL_RUNNER_ENABLED !== "1")
    throw new HttpException(
      "Avaliação SQL indisponível. A prática local continua disponível.",
      503,
    );
  try {
    const info = await sqlDocker(
      [
        "info",
        "--format",
        "{{.OSType}}|{{.CgroupVersion}}|{{json .SecurityOptions}}|{{.CgroupDriver}}",
      ],
      4000,
      4096,
    );
    if (
      !info.stdout.startsWith("linux|2|") ||
      !info.stdout.includes("name=seccomp,profile=builtin")
    )
      throw new Error("Missing isolation");
    if (
      sqlDockerMode().mode === "rootless" &&
      (!info.stdout.includes("name=rootless") ||
        !info.stdout.trim().endsWith("|systemd"))
    )
      throw new Error("Daemon is not rootless");
    const inspect = await sqlDocker(
      [
        "image",
        "inspect",
        "bunkercode-sql:local",
        "--format",
        '{{.Id}}|{{index .Config.Labels "bunkercode.sql.revision"}}',
      ],
      4000,
      1024,
    );
    const [image, revision] = inspect.stdout.trim().split("|");
    if (
      !/^sha256:[a-f0-9]{64}$/.test(image ?? "") ||
      revision !== sqlRunnerRevision()
    )
      throw new Error("Stale image");
    try {
      await assertNoSqlContainers();
    } catch {
      disabled = true;
      event({ phase: "orphan_detected", suspended: true });
      throw new Error("Orphan detected");
    }
    return image!;
  } catch {
    throw new HttpException(
      "Runner SQL ausente, desatualizado ou sem isolamento exigido. Consulte docs/sql-practice.md.",
      503,
    );
  }
}
export async function stopSqlRuns() {
  await Promise.allSettled(
    [...active.values()].map((run) => {
      run.cancel();
      return run.done;
    }),
  );
}
export async function evaluateSql(
  definition: SqlDefinition,
  dataset: SqlDataset,
  steps: string[],
  signal?: AbortSignal,
  runId = randomUUID(),
): Promise<boolean> {
  if (signal?.aborted) throw new HttpException("Avaliação cancelada.", 409);
  if (active.size >= SQL_RUN_LIMITS.concurrent)
    throw new HttpException(
      "Runner SQL ocupado. Aguarde e tente novamente.",
      429,
    );
  const payload = JSON.stringify({ definition, dataset, steps });
  if (Buffer.byteLength(payload) > SQL_RUN_LIMITS.inputBytes)
    throw new HttpException("Avaliação SQL excede limites.", 413);
  if (!/^[a-f0-9-]{36}$/.test(runId)) throw new Error("Invalid run identity");
  const started = performance.now();
  const id = runId,
    name = "bunkercode-sql-" + id;
  let cancelled = signal?.aborted ?? false,
    terminate: (() => void) | undefined;
  const cancel = () => {
    cancelled = true;
    terminate?.();
  };
  signal?.addEventListener("abort", cancel, { once: true });
  const work = Promise.resolve().then(async () => {
    let failure: unknown;
    const timings: Record<string, unknown> = {};
    let phaseStart = performance.now();
    let passed: boolean | undefined;
    let creationAttempted = false;
    try {
      const image = await sqlRunnerStatus();
      timings.readinessMs = Math.round(performance.now() - phaseStart);
      phaseStart = performance.now();
      if (cancelled) throw new HttpException("Avaliação cancelada.", 409);
      creationAttempted = true;
      await sqlDocker(
        [
          "create",
          "--pull",
          "never",
          "--name",
          name,
          "--label",
          "bunkercode.sql.runner=1",
          "--interactive",
          "--network",
          "none",
          "--read-only",
          "--cap-drop",
          "ALL",
          "--security-opt",
          "no-new-privileges",
          "--memory",
          SQL_RUN_LIMITS.memoryMiB + "m",
          "--memory-swap",
          SQL_RUN_LIMITS.memoryMiB + "m",
          "--cpus",
          String(SQL_RUN_LIMITS.cpus),
          "--pids-limit",
          String(SQL_RUN_LIMITS.processes),
          "--ulimit",
          "nofile=64:64",
          "--user",
          "65534:65534",
          "--log-driver",
          "none",
          "--tmpfs",
          "/tmp:rw,noexec,nosuid,nodev,size=1048576",
          "--workdir",
          "/tmp",
          image,
        ],
        5000,
        2048,
      );
      timings.createMs = Math.round(performance.now() - phaseStart);
      phaseStart = performance.now();
      if (cancelled) throw new HttpException("Avaliação cancelada.", 409);
      passed = await new Promise<boolean>((resolve, reject) => {
        const process = attachSqlDocker(name);
        let output = "",
          bytes = 0,
          stopped: string | undefined;
        let killing: Promise<unknown> | undefined;
        const stop = (reason: string) => {
          stopped ??= reason;
          killing ??= sqlDocker(["kill", name], 4000, 2048)
            .catch(() => undefined)
            .finally(() => {
              // Bound the CLI connection too, even if the daemon acknowledges kill
              // without closing the attached stream. Cleanup still confirms removal.
              process.kill("SIGKILL");
            });
        };
        terminate = () => stop("cancelled");
        const timer = setTimeout(
          () => stop("timeout"),
          SQL_RUN_LIMITS.timeoutMs,
        );
        const collect = (chunk: Buffer, stdout: boolean) => {
          bytes += chunk.length;
          if (bytes > SQL_RUN_LIMITS.outputBytes) stop("output");
          else if (stdout) output += chunk.toString("utf8");
        };
        process.stdout.on("data", (c: Buffer) => collect(c, true));
        process.stderr.on("data", (c: Buffer) => collect(c, false));
        process.stdin.on("error", () => {
          /* Exit status confirms failure when input is closed. */
        });
        process.once("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
        process.once("close", (code) => {
          clearTimeout(timer);
          void (async () => {
            if (killing) await killing;
            if (stopped || cancelled)
              throw new HttpException(
                stopped === "timeout"
                  ? "Tempo limite SQL excedido. Ambiente descartado."
                  : "Avaliação interrompida. Ambiente descartado.",
                stopped === "timeout" ? 408 : 409,
              );
            if (code !== 0)
              throw new HttpException(
                "Erro SQL ou limite do runner. Nenhuma conclusão foi registrada.",
                422,
              );
            const result: unknown = JSON.parse(output);
            if (
              !result ||
              typeof result !== "object" ||
              Object.keys(result).some(
                (key) => !["passed", "metrics"].includes(key),
              ) ||
              !("passed" in result) ||
              typeof result.passed !== "boolean"
            )
              throw new Error("Invalid runner response");
            if ("metrics" in result) {
              const metrics = result.metrics;
              const allowed = [
                "referenceInitMs",
                "referencePgliteMs",
                "referenceSetupMs",
                "studentPgliteMs",
                "studentSetupMs",
                "referenceQueryMs",
                "referenceCloseMs",
                "studentInitMs",
                "studentQueryMs",
                "gradingMs",
                "studentCloseMs",
                "maxRssKiB",
              ];
              if (
                !metrics ||
                typeof metrics !== "object" ||
                Object.entries(metrics).some(
                  ([key, value]) =>
                    !allowed.includes(key) ||
                    typeof value !== "number" ||
                    !Number.isFinite(value) ||
                    value < 0,
                )
              )
                throw new Error("Invalid runner metrics");
              timings.engine = metrics;
            }
            resolve(result.passed);
          })().catch(reject);
        });
        process.stdin.end(payload);
      });
    } catch (error) {
      failure = error;
    }
    timings.executionMs = Math.round(performance.now() - phaseStart);
    phaseStart = performance.now();
    try {
      // Attempt cleanup even if docker create timed out after daemon creation.
      if (creationAttempted)
        await sqlDocker(["rm", "--force", name], 5000, 2048);
    } catch {
      // Even "No such container" cannot confirm cleanup after an uncertain create.
      // Retain the shared claim until an operator reconciles the daemon inventory.
      disabled = true;
      failure = new HttpException(
        "Falha de limpeza: runner SQL suspenso. Inspecione os containers antes de reiniciar.",
        503,
      );
    }
    timings.cleanupMs = Math.round(performance.now() - phaseStart);
    event({
      runId: id,
      phase: "finished",
      status: disabled
        ? "suspended"
        : cancelled
          ? "cancelled"
          : failure
            ? "failed"
            : "evaluated",
      ...timings,
      totalMs: Math.round(performance.now() - started),
    });
    signal?.removeEventListener("abort", cancel);
    active.delete(id);
    if (failure) throw failure;
    if (cancelled)
      throw new HttpException("Avaliação cancelada. Ambiente descartado.", 409);
    if (passed === undefined)
      throw new HttpException("Runner SQL sem confirmação.", 503);
    return passed;
  });
  active.set(id, { cancel, done: work });
  return work;
}
