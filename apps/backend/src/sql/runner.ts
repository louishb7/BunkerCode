import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HttpException } from "@nestjs/common";
import type { SqlDataset, SqlDefinition } from "@bunkercode/content/sql";
const exec = promisify(execFile);
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
    const info = await exec(
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
      throw new Error("Missing isolation");
    const inspect = await exec(
      "docker",
      [
        "image",
        "inspect",
        "bunkercode-sql:local",
        "--format",
        '{{.Id}}|{{index .Config.Labels "bunkercode.sql.revision"}}',
      ],
      { timeout: 4000, maxBuffer: 1024 },
    );
    const [image, revision] = inspect.stdout.trim().split("|");
    if (
      !/^sha256:[a-f0-9]{64}$/.test(image ?? "") ||
      revision !== sqlRunnerRevision()
    )
      throw new Error("Stale image");
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
): Promise<boolean> {
  if (active.size >= SQL_RUN_LIMITS.concurrent)
    throw new HttpException(
      "Runner SQL ocupado. Aguarde e tente novamente.",
      429,
    );
  const payload = JSON.stringify({ definition, dataset, steps });
  if (Buffer.byteLength(payload) > SQL_RUN_LIMITS.inputBytes)
    throw new HttpException("Avaliação SQL excede limites.", 413);
  const id = randomUUID(),
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
    let passed: boolean | undefined;
    let created = false;
    try {
      const image = await sqlRunnerStatus();
      if (cancelled) throw new HttpException("Avaliação cancelada.", 409);
      await exec(
        "docker",
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
        { timeout: 5000, maxBuffer: 2048 },
      );
      created = true;
      if (cancelled) throw new HttpException("Avaliação cancelada.", 409);
      passed = await new Promise<boolean>((resolve, reject) => {
        const process = spawn(
          "docker",
          ["start", "--attach", "--interactive", name],
          { stdio: ["pipe", "pipe", "pipe"] },
        );
        let output = "",
          bytes = 0,
          stopped: string | undefined;
        let killing: Promise<unknown> | undefined;
        const stop = (reason: string) => {
          stopped ??= reason;
          killing ??= exec("docker", ["kill", name], {
            timeout: 4000,
            maxBuffer: 2048,
          }).catch(() => process.kill("SIGKILL"));
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
              Object.keys(result).length !== 1 ||
              !("passed" in result) ||
              typeof result.passed !== "boolean"
            )
              throw new Error("Invalid runner response");
            resolve(result.passed);
          })().catch(reject);
        });
        process.stdin.end(payload);
      });
    } catch (error) {
      failure = error;
    }
    try {
      // Attempt cleanup even if docker create timed out after daemon creation.
      await exec("docker", ["rm", "--force", name], {
        timeout: 5000,
        maxBuffer: 2048,
      });
    } catch (error) {
      if (
        created ||
        !(error instanceof Error && error.message.includes("No such container"))
      ) {
        disabled = true;
        failure = new HttpException(
          "Falha de limpeza: runner SQL suspenso. Inspecione os containers antes de reiniciar.",
          503,
        );
      }
    }
    signal?.removeEventListener("abort", cancel);
    active.delete(id);
    if (failure) throw failure;
    if (passed === undefined)
      throw new HttpException("Runner SQL sem confirmação.", 503);
    return passed;
  });
  active.set(id, { cancel, done: work });
  return work;
}
