import { spawn, type ChildProcess } from "node:child_process";
import { writeFile, mkdtemp, rm, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import type { ProcessOutcome } from "./results";
import ts from "typescript";
const OUTPUT_LIMIT = 8192;
export class ExecutionFailure extends Error {
  constructor(
    readonly status: "timeout" | "runtime_error" | "cleanup_error",
    message: string,
  ) {
    super(message);
  }
}
export interface ChildSession {
  child: ChildProcess;
  closed: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  output: { stdout: string; stderr: string; truncated: boolean };
}
function groupSignal(child: ChildProcess, signal: NodeJS.Signals) {
  if (!child.pid) return;
  try {
    if (process.platform !== "win32") process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}
export function startChild(
  script: string,
  args: string[],
  directory: string,
  signal: AbortSignal,
  onMessage?: (message: unknown) => void,
): ChildSession {
  const child = spawn(process.execPath, [script, ...args], {
    cwd: directory,
    detached: process.platform !== "win32",
    env: { PATH: process.env.PATH ?? "" },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  const output = { stdout: "", stderr: "", truncated: false };
  for (const stream of ["stdout", "stderr"] as const)
    child[stream]?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      if (Buffer.byteLength(output[stream] + text) > OUTPUT_LIMIT)
        output.truncated = true;
      output[stream] = Buffer.from(output[stream] + text)
        .subarray(0, OUTPUT_LIMIT)
        .toString("utf8");
    });
  child.on("message", (message) => onMessage?.(message));
  const stop = () => groupSignal(child, "SIGKILL");
  signal.addEventListener("abort", stop, { once: true });
  const closed = new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolveClosed, reject) => {
    child.once("error", reject);
    child.once("close", (code, exitSignal) => {
      signal.removeEventListener("abort", stop);
      resolveClosed({ code, signal: exitSignal });
    });
  });
  // Attach a rejection handler immediately; caller still observes the original failure.
  void closed.catch(() => undefined);
  if (signal.aborted) stop();
  return { child, closed, output };
}
export async function stopChild(session: ChildSession) {
  groupSignal(session.child, "SIGTERM");
  const force = setTimeout(() => groupSignal(session.child, "SIGKILL"), 250);
  try {
    await session.closed;
    // Also terminate descendants if the leader exited first.
    groupSignal(session.child, "SIGKILL");
  } finally {
    clearTimeout(force);
  }
}
export async function withSource<T extends ProcessOutcome>(
  source: string,
  initial: T,
  operation: (
    directory: string,
    signal: AbortSignal,
    result: T,
  ) => Promise<void>,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<T> {
  const started = performance.now();
  const deadline = AbortSignal.timeout(options.timeoutMs ?? 8000);
  const signal = options.signal
    ? AbortSignal.any([deadline, options.signal])
    : deadline;
  const result = {
    ...initial,
    nodeVersion: process.version,
    typescriptVersion: ts.version,
  };
  let directory: string | undefined;
  try {
    directory = await mkdtemp(join(tmpdir(), "bunkercode-execution-"));
    await writeFile(join(directory, "solution.ts"), source, { flag: "wx" });
    await writeFile(
      join(directory, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          skipLibCheck: true,
          target: "ES2022",
          module: "CommonJS",
          noEmitOnError: true,
          types: ["node"],
          typeRoots: [
            resolve(require.resolve("@types/node/package.json"), "../.."),
          ],
        },
        files: ["solution.ts"],
      }),
    );
    const compiler = startChild(
      require.resolve("typescript/bin/tsc"),
      ["--project", "tsconfig.json", "--pretty", "false"],
      directory,
      signal,
    );
    let compilation;
    try {
      compilation = await compiler.closed;
    } finally {
      await stopChild(compiler);
    }
    Object.assign(result, compiler.output, { exitCode: compilation.code });
    if (signal.aborted)
      throw new ExecutionFailure(
        deadline.aborted ? "timeout" : "runtime_error",
        "Execução encerrada antes de concluir.",
      );
    if (compilation.code !== 0) {
      result.status = "compilation_error";
      result.diagnostics = compiler.output.stdout
        .trim()
        .split("\n")
        .filter(Boolean)
        .slice(0, 20)
        .map((message) => {
          const match = /solution\.ts\((\d+),(\d+)\): (.*)/.exec(message);
          return match
            ? {
                line: Number(match[1]),
                column: Number(match[2]),
                message: match[3]!,
              }
            : { message };
        });
      return result;
    }
    await operation(directory, signal, result);
  } catch (error) {
    result.status = signal.aborted
      ? deadline.aborted
        ? "timeout"
        : "interrupted"
      : error instanceof ExecutionFailure
        ? error.status
        : "runtime_error";
    result.diagnostics = [
      { message: error instanceof Error ? error.message : String(error) },
    ];
  } finally {
    try {
      if (directory) await rm(directory, { recursive: true, force: true });
    } catch (error) {
      result.status = "cleanup_error";
      result.diagnostics.push({
        message: `Falha no cleanup: ${String(error)}`,
      });
    }
    result.durationMs = Math.round(performance.now() - started);
  }
  return result;
}
export const emptyOutcome = (): ProcessOutcome => ({
  status: "completed",
  diagnostics: [],
  stdout: "",
  stderr: "",
  truncated: false,
  exitCode: null,
  durationMs: 0,
  nodeVersion: process.version,
  typescriptVersion: ts.version,
});
export async function startHarness(
  directory: string,
  path: string,
  signal: AbortSignal,
  onMessage: (message: unknown) => void,
) {
  await copyFile(path, join(directory, "harness.cjs"));
  // .cjs resources live next to the TS source in dev and are copied by the build script.
  await copyFile(
    resolve(__dirname, "supervisor.cjs"),
    join(directory, "supervisor.cjs"),
  );
  return startChild(
    join(directory, "supervisor.cjs"),
    ["harness.cjs"],
    directory,
    signal,
    onMessage,
  );
}
