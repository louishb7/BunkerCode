import { fork, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type {
  CodeVersion,
  Evidence,
  RuntimeStatus,
} from "@backendlab/protocol";

type RuntimeMessage = {
  kind: string;
  port?: number;
  runId?: string;
  requestId?: string;
  timestamp?: number;
  type?: string;
  payload?: Record<string, unknown>;
  sequence?: number;
  id?: string;
};
export class RuntimeManager {
  private child?: ChildProcess;
  private token = "";
  private current: RuntimeStatus = { status: "stopped", logs: [] };
  private sink?: (event: Omit<Evidence, "sequence">, runId?: string) => void;
  constructor(
    private root: string,
    private workspaceId: string,
    private systemId: string,
  ) {}
  status(): RuntimeStatus {
    return { ...this.current, logs: [...this.current.logs] };
  }
  observe(sink?: RuntimeManager["sink"]) {
    this.sink = sink;
  }
  private log(text: string) {
    const clean = text.slice(0, 4000).replaceAll(this.token, "[redacted]");
    this.current.logs.push(clean);
    this.current.logs = this.current.logs.slice(-40);
    this.sink?.({
      timestamp: Date.now(),
      source: "runtime",
      type: "runtime.log",
      payload: { text: clean },
    });
  }
  async start(code: CodeVersion) {
    await this.stop();
    this.token = randomUUID();
    this.current = { status: "starting", logs: [], code };
    const directory = join(
      this.root,
      "runtime",
      this.workspaceId,
      this.systemId,
    );
    await mkdir(directory, { recursive: true });
    const child = fork(join(this.root, code.snapshot, "server.mjs"), [], {
      cwd: join(this.root, code.snapshot),
      detached: process.platform !== "win32",
      execArgv: [],
      env: {
        PATH: process.env.PATH,
        RUNTIME_DATABASE: join(directory, "state.sqlite"),
        RUNTIME_TOKEN: this.token,
      },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
    this.child = child;
    this.current.pid = child.pid;
    child.stdout?.on("data", (chunk: Buffer) => this.log(chunk.toString()));
    child.stderr?.on("data", (chunk: Buffer) => this.log(chunk.toString()));
    child.on("message", (message: RuntimeMessage) => {
      if (
        message.kind === "evidence" &&
        typeof message.type === "string" &&
        typeof message.timestamp === "number"
      ) {
        this.sink?.(
          {
            timestamp: message.timestamp,
            source: "system",
            type: message.type,
            requestId: message.requestId,
            payload: { ...message.payload, systemSequence: message.sequence },
          },
          message.runId,
        );
      }
    });
    child.on("exit", (code, signal) => {
      if (this.child !== child) return;
      this.current.status = "crashed";
      this.current.error = `OrderDesk encerrou (code=${code}, signal=${signal}).`;
      this.sink?.({
        timestamp: Date.now(),
        source: "runtime",
        type: "runtime.exited",
        payload: { code, signal },
      });
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => done(new Error("Runtime não ficou pronto em 5 segundos.")),
          5000,
        );
        const onMessage = (message: RuntimeMessage) => {
          if (
            message.kind === "ready" &&
            Number.isInteger(message.port) &&
            message.port! > 0 &&
            message.port! <= 65535
          ) {
            this.current.port = message.port;
            this.current.status = "ready";
            done();
          }
        };
        const onExit = () =>
          done(
            new Error(
              this.current.logs.join("\n") ||
                "Runtime encerrou antes de iniciar.",
            ),
          );
        const onError = (error: Error) => done(error);
        const done = (error?: Error) => {
          clearTimeout(timer);
          child.off("message", onMessage);
          child.off("exit", onExit);
          child.off("error", onError);
          if (error) reject(error);
          else resolve();
        };
        child.on("message", onMessage);
        child.once("exit", onExit);
        child.once("error", onError);
      });
    } catch (error) {
      await this.stop();
      this.current.status = "crashed";
      this.current.error =
        error instanceof Error ? error.message : String(error);
      throw error;
    }
  }
  async request(
    path: string,
    body?: unknown,
    context?: { runId: string; requestId?: string },
    signal?: AbortSignal,
  ) {
    if (this.current.status !== "ready")
      throw new Error("Runtime indisponível. Reinicie o sistema.");
    const response = await fetch(
      `http://127.0.0.1:${this.current.port}${path}`,
      {
        method: body === undefined ? "GET" : "POST",
        signal: signal
          ? AbortSignal.any([AbortSignal.timeout(3000), signal])
          : AbortSignal.timeout(3000),
        headers: {
          authorization: `Bearer ${this.token}`,
          "content-type": "application/json",
          ...(context
            ? {
                "x-run-id": context.runId,
                ...(context.requestId
                  ? { "x-request-id": context.requestId }
                  : {}),
              }
            : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
    );
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 1024 * 1024) {
          await reader.cancel();
          throw new Error("Resposta excede o limite de 1 MiB.");
        }
        chunks.push(chunk.value);
      }
    }
    const text = Buffer.concat(chunks).toString("utf8");
    return { status: response.status, body: JSON.parse(text) as unknown };
  }
  async flush() {
    const child = this.child;
    if (!child?.connected) return;
    await new Promise<void>((resolve, reject) => {
      const id = randomUUID();
      const timer = setTimeout(
        () => finish(new Error("Runtime não confirmou o flush de evidências.")),
        1000,
      );
      const onMessage = (message: RuntimeMessage) => {
        if (message.kind === "flushed" && message.id === id) finish();
      };
      const finish = (error?: Error) => {
        clearTimeout(timer);
        child.off("message", onMessage);
        if (error) reject(error);
        else resolve();
      };
      child.on("message", onMessage);
      child.send({ kind: "flush", id }, (error) => {
        if (error) finish(error);
      });
    });
  }
  async stop() {
    const child = this.child;
    if (!child) {
      this.current.status = "stopped";
      return;
    }
    this.child = undefined;
    const kill = (signal: NodeJS.Signals) => {
      try {
        if (process.platform !== "win32" && child.pid)
          process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
    };
    if (child.exitCode === null && child.signalCode === null) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => kill("SIGKILL"), 1000);
        child.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
        kill("SIGTERM");
      });
    }
    // Também elimina descendentes que sobreviveram ao processo principal.
    kill("SIGKILL");
    this.current.status = "stopped";
    this.current.pid = undefined;
    this.current.port = undefined;
  }
}
