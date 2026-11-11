import type {
  SqlExercise,
  SqlRequest,
  SqlResponse,
  SqlResult,
} from "./exercise";

export interface SqlWorker {
  postMessage(message: SqlRequest): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<SqlResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
}

export class SqlRuntimeError extends Error {
  constructor(
    message: string,
    readonly discarded: boolean,
    readonly code?: string,
  ) {
    super(message);
  }
}

export class SqlRuntime {
  private worker: SqlWorker | null = null;
  private sequence = 0;
  private operation: symbol | null = null;
  private pending: {
    id: number;
    resolve: (response: SqlResponse) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;

  constructor(
    private readonly exercise: SqlExercise,
    private readonly createWorker: () => SqlWorker = () =>
      new Worker(new URL("./sql.worker.ts", import.meta.url), {
        type: "module",
      }),
  ) {}

  // Reset, cancel and unmount share disposal; the UI explains each intention.
  dispose() {
    this.worker?.terminate();
    this.worker = null;
    this.operation = null;
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(new SqlRuntimeError("Ambiente descartado.", true));
      this.pending = null;
    }
  }

  private request(message: SqlRequest, timeout: number): Promise<SqlResponse> {
    return new Promise((resolve, reject) => {
      this.pending = {
        id: message.id,
        resolve,
        reject,
        timer: setTimeout(() => {
          reject(
            new SqlRuntimeError(
              "O tempo limite terminou. O ambiente foi descartado; tente uma consulta menor.",
              true,
            ),
          );
          this.dispose();
        }, timeout),
      };
      try {
        this.worker!.postMessage(message);
      } catch (error) {
        reject(
          new SqlRuntimeError(
            error instanceof Error ? error.message : String(error),
            true,
          ),
        );
        this.dispose();
      }
    });
  }

  execute(sql: string, verify = false): Promise<SqlResult> {
    return this.perform({ type: "query", sql, verify });
  }

  preview(table: string): Promise<SqlResult> {
    return this.perform({ type: "preview", table });
  }

  verifyState(): Promise<SqlResult> {
    return this.perform({ type: "verify-state" });
  }

  private async perform(
    action:
      | { type: "query"; sql: string; verify: boolean }
      | { type: "preview"; table: string }
      | { type: "verify-state" },
  ): Promise<SqlResult> {
    if (this.operation)
      throw new SqlRuntimeError("Já existe uma consulta em execução.", false);
    const operation = Symbol();
    this.operation = operation;
    try {
      if (!this.worker) {
        const worker = this.createWorker();
        this.worker = worker;
        worker.onmessage = ({ data }) => {
          if (this.worker !== worker || data.id !== this.pending?.id) return;
          clearTimeout(this.pending.timer);
          this.pending.resolve(data);
          this.pending = null;
        };
        const fail = () => {
          if (this.worker !== worker) return;
          this.pending?.reject(
            new SqlRuntimeError(
              "O laboratório falhou. O ambiente foi descartado; tente novamente.",
              true,
            ),
          );
          this.dispose();
        };
        worker.onerror = fail;
        worker.onmessageerror = fail;
        const ready = await this.request(
          { type: "initialize", id: ++this.sequence, exercise: this.exercise },
          this.exercise.limits.initializationMs,
        );
        if (this.operation !== operation)
          throw new SqlRuntimeError("Ambiente descartado.", true);
        if (ready.type !== "ready") {
          this.dispose();
          throw new SqlRuntimeError(
            ready.type === "error"
              ? `Não foi possível preparar o banco: ${ready.error.message}. Ambiente descartado; tente novamente.`
              : "Resposta de inicialização inválida. Ambiente descartado.",
            true,
          );
        }
      }
      if (this.operation !== operation)
        throw new SqlRuntimeError("Ambiente descartado.", true);
      const response = await this.request(
        { ...action, id: ++this.sequence },
        this.exercise.limits.queryMs,
      );
      if (response.type === "error")
        throw new SqlRuntimeError(
          response.error.message,
          false,
          response.error.code,
        );
      if (response.type !== "result") {
        this.dispose();
        throw new SqlRuntimeError(
          "Resposta SQL inválida. Ambiente descartado.",
          true,
        );
      }
      return response.result;
    } catch (error) {
      if (!(error instanceof SqlRuntimeError)) {
        this.dispose();
        throw new SqlRuntimeError(
          "Não foi possível iniciar o laboratório. Ambiente descartado; tente novamente.",
          true,
        );
      }
      throw error;
    } finally {
      if (this.operation === operation) this.operation = null;
    }
  }
}
