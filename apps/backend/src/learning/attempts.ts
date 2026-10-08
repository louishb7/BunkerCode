import {
  Injectable,
  BadRequestException,
  ConflictException,
  type OnModuleDestroy,
} from "@nestjs/common";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { LearningStore } from "./store";
import { activity, digest, harnessDigest } from "../content/activities";
import { executeOrderRequest } from "../execution/order-request";
import { testStockFunction } from "../execution/stock-function-tests";
import { feedbackFor } from "./feedback";
import type { Draft, Prediction } from "./models";
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new BadRequestException("Objeto inválido.");
  return value as Record<string, unknown>;
}
function text(value: unknown, limit: number) {
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > limit)
    throw new BadRequestException(
      `Texto inválido ou maior que ${limit} bytes.`,
    );
  return value;
}
export function revisionOf(body: Record<string, unknown>): number {
  if (!Number.isSafeInteger(body.revision) || Number(body.revision) < 0)
    throw new BadRequestException("Revisão inválida.");
  return Number(body.revision);
}
export function draftOf(value: unknown): Draft {
  const input = record(value);
  if (
    Object.keys(input).some(
      (key) => !["source", "prediction", "justification"].includes(key),
    )
  )
    throw new BadRequestException("Campo de rascunho desconhecido.");
  let prediction: Partial<Prediction> | null = null;
  if (input.prediction !== null) {
    const fields = record(input.prediction);
    if (
      Object.keys(fields).some(
        (key) => !["status", "stock", "orders"].includes(key),
      ) ||
      !Object.values(fields).every(
        (v) => typeof v === "number" && Number.isSafeInteger(v),
      )
    )
      throw new BadRequestException("Previsão inválida.");
    prediction = fields as Partial<Prediction>;
  }
  return {
    source: text(input.source, 16384),
    prediction,
    justification: text(input.justification, 2000),
  };
}
@Injectable()
export class Attempts implements OnModuleDestroy {
  readonly store = new LearningStore(
    resolve(
      process.env.BUNKERCODE_DATA_DIR ??
        resolve(__dirname, "../../../..", ".bunkercode"),
      "learning.sqlite",
    ),
  );
  private readonly tasks = new Set<Promise<unknown>>();
  private readonly shutdown = new AbortController();
  private readonly failedCleanup = new Set<string>();
  create(value: unknown) {
    return this.store.create(text(record(value).activityId, 100));
  }
  get(id: string) {
    return this.store.get(id);
  }
  save(id: string, value: unknown) {
    const body = record(value);
    return this.store.save(id, revisionOf(body), draftOf(body.draft));
  }
  complete(id: string, value: unknown) {
    const body = record(value);
    const reflection = text(body.reflection, 2000).trim();
    if (!reflection)
      throw new BadRequestException(
        "Escreva uma reflexão curta antes de concluir.",
      );
    return this.store.complete(id, revisionOf(body), reflection);
  }
  async submit(id: string, value: unknown) {
    const body = record(value);
    if (Object.keys(body).some((key) => key !== "revision"))
      throw new BadRequestException(
        "A execução recebe somente a revisão salva.",
      );
    if (this.shutdown.signal.aborted || this.failedCleanup.has(id))
      throw new ConflictException(
        "Execução indisponível: encerramento pendente.",
      );
    const attempt = this.store.get(id);
    if (attempt.revision !== revisionOf(body))
      throw new ConflictException("Revisão obsoleta.");
    const definition = activity(attempt.activityId);
    if (definition.version !== attempt.activityVersion)
      throw new ConflictException(
        "Conteúdo atualizado. Abra uma nova tentativa.",
      );
    const predicted = attempt.draft.prediction;
    let prediction: Prediction | null = null;
    if (definition.kind === "prediction") {
      if (
        !predicted ||
        typeof predicted.status !== "number" ||
        predicted.status < 100 ||
        predicted.status > 599 ||
        typeof predicted.stock !== "number" ||
        typeof predicted.orders !== "number" ||
        predicted.orders < 0 ||
        !attempt.draft.justification.trim()
      )
        throw new BadRequestException(
          "Preencha previsão e justificativa antes de executar.",
        );
      prediction = {
        status: predicted.status,
        stock: predicted.stock,
        orders: predicted.orders,
      };
    }
    const instrumentDigest = harnessDigest(attempt.activityId);
    const submission = this.store.freeze(id, revisionOf(body), {
      id: randomUUID(),
      source: attempt.draft.source,
      digest: digest(attempt.draft.source),
      draftRevision: attempt.revision,
      prediction,
      justification: attempt.draft.justification,
      activityVersion: attempt.activityVersion,
      harnessDigest: instrumentDigest,
      conditions:
        definition.kind === "prediction"
          ? { initialStock: 1, initialOrders: 0, quantity: 1 }
          : { caseCount: 3 },
      createdAt: new Date().toISOString(),
    });
    const task = (async () => {
      const result =
        definition.kind === "prediction"
          ? await executeOrderRequest(submission.source, {
              signal: this.shutdown.signal,
            })
          : await testStockFunction(submission.source, {
              signal: this.shutdown.signal,
            });
      if (result.status === "cleanup_error") this.failedCleanup.add(id);
      // Retain cases/facts plus a small diagnostic excerpt, not complete process logs.
      if (
        result.stderr.length > 2000 ||
        (result.status !== "completed" && result.stdout.length > 2000)
      )
        result.truncated = true;
      result.stdout =
        result.status === "completed" ? "" : result.stdout.slice(0, 2000);
      result.stderr = result.stderr.slice(0, 2000);
      this.store.finish(submission.id, result, feedbackFor(submission, result));
      return this.store.get(id);
    })();
    this.tasks.add(task);
    try {
      return await task;
    } finally {
      this.tasks.delete(task);
    }
  }
  async onModuleDestroy() {
    this.shutdown.abort();
    await Promise.allSettled(this.tasks);
    this.store.close();
  }
}
