import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type {
  Checkpoint,
  Evidence,
  RequestResult,
  Run,
  RunDetail,
} from "@backendlab/protocol";
import { projectRoot } from "./paths";
import { systems, experiments } from "./catalog";

type Row = Record<string, string | number | null>;
const decode = <T>(value: unknown): T | undefined =>
  typeof value === "string" ? (JSON.parse(value) as T) : undefined;
export class LabRepository {
  private db: DatabaseSync;
  private closed = false;
  constructor(root: string) {
    mkdirSync(root, { recursive: true });
    this.db = new DatabaseSync(join(root, "lab.sqlite"));
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY)",
    );
    const directory = join(projectRoot(), "apps/api/migrations");
    for (const name of readdirSync(directory)
      .filter((name) => name.endsWith(".sql"))
      .sort()) {
      if (this.db.prepare("SELECT name FROM migrations WHERE name=?").get(name))
        continue;
      this.transaction(() => {
        this.db.exec(readFileSync(join(directory, name), "utf8"));
        this.db.prepare("INSERT INTO migrations VALUES (?)").run(name);
      });
    }
    this.db
      .prepare("INSERT OR IGNORE INTO workspaces VALUES (?, ?)")
      .run("local", "Workspace local");
    for (const system of systems)
      this.db
        .prepare("INSERT OR IGNORE INTO systems VALUES (?, ?, ?)")
        .run(system.id, "local", system.name);
    for (const experiment of experiments)
      this.db
        .prepare("INSERT OR REPLACE INTO experiments VALUES (?, ?, ?)")
        .run(
          experiment.id,
          experiment.systemId,
          JSON.stringify(experiment.summary),
        );
  }
  recover() {
    this.db
      .prepare(
        "UPDATE runs SET status='interrupted', completed_at=?, error='O control plane foi encerrado antes de concluir esta Run.' WHERE status='running'",
      )
      .run(Date.now());
  }
  close() {
    if (!this.closed) {
      this.db.close();
      this.closed = true;
    }
  }
  private transaction(action: () => void) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      action();
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  checkpoints(workspaceId: string, systemId: string): Checkpoint[] {
    return (
      this.db
        .prepare(
          "SELECT * FROM checkpoints WHERE workspace_id=? AND system_id=? ORDER BY created_at DESC, rowid DESC",
        )
        .all(workspaceId, systemId) as Row[]
    ).map((row) => this.checkpoint(row));
  }
  private checkpoint(row: Row): Checkpoint {
    return {
      kind: row.kind as Checkpoint["kind"],
      id: String(row.id),
      systemId: String(row.system_id),
      commit: String(row.commit_hash),
      digest: String(row.digest),
      message: String(row.message),
      createdAt: Number(row.created_at),
    };
  }
  saveCheckpoint(workspaceId: string, value: Checkpoint) {
    this.db
      .prepare(
        "INSERT INTO checkpoints (id, workspace_id, system_id, commit_hash, digest, message, created_at, kind) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        value.id,
        workspaceId,
        value.systemId,
        value.commit,
        value.digest,
        value.message,
        value.createdAt,
        value.kind ?? "user",
      );
  }
  createRun(run: Omit<Run, "number">): Run {
    const result = this.db
      .prepare(
        "INSERT INTO runs (id, workspace_id, system_id, experiment_id, status, created_at, config, code, checkpoint_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        run.id,
        run.workspaceId,
        run.systemId,
        run.experimentId,
        run.status,
        run.createdAt,
        JSON.stringify(run.config),
        JSON.stringify(run.code),
        run.checkpoint?.id ?? null,
      );
    return { ...run, number: Number(result.lastInsertRowid) };
  }
  updateRun(run: Run) {
    this.db
      .prepare(
        "UPDATE runs SET status=?, completed_at=?, duration_ms=?, initial_state=?, final_state=?, result=?, error=? WHERE id=?",
      )
      .run(
        run.status,
        run.completedAt ?? null,
        run.durationMs ?? null,
        JSON.stringify(run.initialState) ?? null,
        JSON.stringify(run.finalState) ?? null,
        JSON.stringify(run.result) ?? null,
        run.error ?? null,
        run.id,
      );
  }
  appendEvidence(runId: string, event: Evidence) {
    this.db
      .prepare("INSERT INTO evidence VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(
        runId,
        event.sequence,
        event.timestamp,
        event.source,
        event.type,
        event.requestId ?? null,
        JSON.stringify(event.payload),
      );
  }
  saveRequest(runId: string, request: RequestResult) {
    this.db
      .prepare("INSERT INTO requests VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(
        runId,
        request.id,
        request.startedAt,
        request.durationMs,
        request.status,
        JSON.stringify(request.body),
        request.error ?? null,
      );
  }
  listRuns(
    workspaceId: string,
    systemId: string,
    limit = 100,
    before = Number.MAX_SAFE_INTEGER,
  ): Run[] {
    return (
      this.db
        .prepare(
          "SELECT * FROM runs WHERE workspace_id=? AND system_id=? AND number<? ORDER BY number DESC LIMIT ?",
        )
        .all(workspaceId, systemId, before, limit) as Row[]
    ).map((row) => this.run(row));
  }
  private run(row: Row): Run {
    const checkpointRow = row.checkpoint_id
      ? (this.db
          .prepare("SELECT * FROM checkpoints WHERE id=?")
          .get(row.checkpoint_id) as Row)
      : undefined;
    return {
      id: String(row.id),
      number: Number(row.number),
      workspaceId: String(row.workspace_id),
      systemId: String(row.system_id),
      experimentId: String(row.experiment_id),
      status: row.status as Run["status"],
      createdAt: Number(row.created_at),
      ...(row.completed_at !== null
        ? {
            completedAt: Number(row.completed_at),
            durationMs: Number(row.duration_ms),
          }
        : {}),
      config: decode<Run["config"]>(row.config)!,
      code: decode<Run["code"]>(row.code)!,
      checkpoint: checkpointRow ? this.checkpoint(checkpointRow) : undefined,
      initialState: decode(row.initial_state),
      finalState: decode(row.final_state),
      result: decode(row.result),
      error: row.error ? String(row.error) : undefined,
    };
  }
  detail(workspaceId: string, systemId: string, id: string): RunDetail | null {
    const row = this.db
      .prepare(
        "SELECT * FROM runs WHERE id=? AND workspace_id=? AND system_id=?",
      )
      .get(id, workspaceId, systemId) as Row | undefined;
    if (!row) return null;
    const evidence = (
      this.db
        .prepare("SELECT * FROM evidence WHERE run_id=? ORDER BY sequence")
        .all(id) as Row[]
    ).map((event): Evidence => ({
      sequence: Number(event.sequence),
      timestamp: Number(event.timestamp),
      source: event.source as Evidence["source"],
      type: String(event.type),
      requestId: event.request_id ? String(event.request_id) : undefined,
      payload: decode(event.payload)!,
    }));
    const requests = (
      this.db
        .prepare(
          "SELECT * FROM requests WHERE run_id=? ORDER BY started_at, rowid",
        )
        .all(id) as Row[]
    ).map((request): RequestResult => ({
      id: String(request.id),
      startedAt: Number(request.started_at),
      durationMs: Number(request.duration_ms),
      status: request.status === null ? null : Number(request.status),
      body: decode(request.body),
      error: request.error ? String(request.error) : undefined,
    }));
    return { run: this.run(row), requests, evidence };
  }
}
