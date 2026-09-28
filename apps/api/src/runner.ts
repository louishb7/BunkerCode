import { randomUUID } from "node:crypto";
import type { Evidence, RequestResult, Run } from "@backendlab/protocol";
import { LabRepository } from "./repository";
import { RuntimeManager } from "./runtime";
import type { ExperimentDefinition } from "./experiments/definition";

export class ExperimentRunner {
  constructor(
    private repository: LabRepository,
    private runtime: RuntimeManager,
  ) {}
  async execute(run: Run, definition: ExperimentDefinition) {
    const deadline = new AbortController();
    const deadlineTimer = setTimeout(
      () =>
        deadline.abort(
          new Error("Experimento excedeu o limite de 15 segundos."),
        ),
      15000,
    );
    let sequence = 0;
    const emit = (event: Omit<Evidence, "sequence">) =>
      this.repository.appendEvidence(run.id, {
        ...event,
        sequence: ++sequence,
      });
    const phase = (name: string, payload: Record<string, unknown> = {}) =>
      emit({ source: "runner", timestamp: Date.now(), type: name, payload });
    let eventCount = 0;
    let collectionError: unknown;
    this.runtime.observe((event, runId) => {
      if (runId && runId !== run.id) return;
      try {
        if (++eventCount <= 10000) emit(event);
        else if (eventCount === 10001)
          phase("evidence.truncated", { limit: 10000 });
      } catch (error) {
        collectionError = error;
      }
    });
    const requests: RequestResult[] = [];
    try {
      phase("setup.started", { config: run.config, code: run.code });
      const setup = definition.setup(run.config);
      const initial = await this.runtime.request(setup.path, setup.body, {
        runId: run.id,
      });
      if (initial.status !== 200)
        throw new Error(`Setup retornou HTTP ${initial.status}`);
      run.initialState = definition.validateState(initial.body);
      this.repository.updateRun(run);
      definition.validateInitial(run.config, run.initialState);
      phase("setup.completed", { state: run.initialState });
      phase("workload.started", {
        clients: run.config.clients,
        concurrency: run.config.concurrency,
      });
      let next = 0;
      const workload = await Promise.allSettled(
        Array.from(
          { length: Math.min(run.config.concurrency, run.config.clients) },
          async () => {
            while (next < run.config.clients && !deadline.signal.aborted) {
              const index = next++;
              const id = randomUUID();
              const start = performance.now();
              const startedAt = Date.now();
              const operation = definition.operation(index);
              phase("request.dispatched", { requestId: id, ...operation });
              let result: RequestResult;
              try {
                const response = await this.runtime.request(
                  operation.path,
                  operation.body,
                  { runId: run.id, requestId: id },
                  deadline.signal,
                );
                result = {
                  id,
                  startedAt,
                  durationMs: performance.now() - start,
                  ...response,
                };
              } catch (error) {
                result = {
                  id,
                  startedAt,
                  durationMs: performance.now() - start,
                  status: null,
                  body: null,
                  error: error instanceof Error ? error.message : String(error),
                };
              }
              requests.push(result);
              this.repository.saveRequest(run.id, result);
              emit({
                timestamp: Date.now(),
                source: "runner",
                type: "request.completed",
                requestId: id,
                payload: {
                  status: result.status,
                  durationMs: result.durationMs,
                  error: result.error,
                },
              });
            }
          },
        ),
      );
      const rejectedWorker = workload.find(
        (result) => result.status === "rejected",
      );
      if (rejectedWorker?.status === "rejected") throw rejectedWorker.reason;
      if (deadline.signal.aborted) throw deadline.signal.reason;
      phase("workload.completed");
      if (requests.some((request) => request.status === null))
        throw new Error(
          "Workload teve falha de transporte ou timeout; runtime encerrado para impedir mutações tardias.",
        );
      const final = await this.runtime.request(
        definition.statePath,
        undefined,
        {
          runId: run.id,
        },
      );
      if (final.status !== 200)
        throw new Error(`Inspeção final retornou HTTP ${final.status}`);
      run.finalState = definition.validateState(final.body);
      await this.runtime.flush();
      if (collectionError) throw collectionError;
      run.result = definition.assert(
        run.config,
        run.initialState,
        run.finalState,
        requests,
        this.repository.detail(run.workspaceId, run.systemId, run.id)!.evidence,
      );
      run.result.observations = definition.observations(
        run.initialState,
        run.result,
      );
      run.status =
        run.result.errors > 0
          ? "error"
          : run.result.assertions.every((assertion) => assertion.passed)
            ? "passed"
            : "failed";
      phase("assertions.completed", { assertions: run.result.assertions });
    } catch (error) {
      run.status = "error";
      run.error = error instanceof Error ? error.message : String(error);
      phase("experiment.error", { message: run.error });
      // Timeout não cancela uma operação no servidor. Encerrar o runtime impede mutações tardias na próxima run.
      await this.runtime.stop();
    } finally {
      clearTimeout(deadlineTimer);
      this.runtime.observe();
      phase("teardown.completed", {
        runtimeStatePreserved: true,
        runtimeStopped: this.runtime.status().status !== "ready",
      });
      run.completedAt = Date.now();
      run.durationMs = run.completedAt - run.createdAt;
      phase("run.completed", {
        status: run.status,
        durationMs: run.durationMs,
      });
      this.runtime.observe();
      this.repository.updateRun(run);
    }
  }
}
