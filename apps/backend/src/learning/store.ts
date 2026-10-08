import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { ConflictException, NotFoundException } from "@nestjs/common";
import type { Attempt, Draft, Feedback, Submission } from "./models";
import type { ExecutionResult, ProcessOutcome } from "../execution/results";
import { activity } from "../content/activities";
interface AttemptRow {
  id: string;
  activity_id: string;
  activity_version: number;
  status: Attempt["status"];
  revision: number;
  draft_json: string;
  reflection: string;
}
interface SubmissionRow {
  input_json: string;
  result_json: string | null;
  feedback_json: string | null;
}
export class LearningStore {
  private readonly db: DatabaseSync;
  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
    );
    this.claimOwnership();
    try {
      this.initialize();
    } catch (error) {
      this.close();
      throw error;
    }
  }
  private readonly ownerToken = randomUUID();
  private closed = false;
  private claimOwnership() {
    // Recovery must never interrupt another live API using the same database.
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS learning_owner (id INTEGER PRIMARY KEY CHECK(id=1), pid INTEGER NOT NULL, token TEXT NOT NULL)",
    );
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const owner = this.db
        .prepare("SELECT pid FROM learning_owner WHERE id=1")
        .get();
      if (owner) {
        let alive = true;
        try {
          process.kill(Number(owner.pid), 0);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ESRCH") alive = false;
          else throw error;
        }
        if (alive)
          throw new ConflictException(
            "O banco de aprendizagem já está aberto em outra API.",
          );
      }
      this.db
        .prepare("INSERT OR REPLACE INTO learning_owner VALUES (1,?,?)")
        .run(process.pid, this.ownerToken);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      this.db.close();
      throw error;
    }
  }
  private initialize() {
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS learning_migrations (version INTEGER PRIMARY KEY)",
    );
    if (
      !this.db
        .prepare("SELECT version FROM learning_migrations WHERE version=1")
        .get()
    ) {
      this.db.exec("BEGIN IMMEDIATE");
      try {
        this.db.exec(
          readFileSync(
            resolve(__dirname, "../..", "migrations/learning/001-attempts.sql"),
            "utf8",
          ),
        );
        this.db.exec("INSERT INTO learning_migrations VALUES (1); COMMIT");
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    }
    const interrupted: ProcessOutcome = {
      status: "interrupted",
      diagnostics: [
        {
          message:
            "A API reiniciou antes de confirmar o término. Submeta novamente.",
        },
      ],
      stdout: "",
      stderr: "",
      truncated: false,
      exitCode: null,
      durationMs: null,
      nodeVersion: "not recorded",
      typescriptVersion: "not recorded",
    };
    // Do not reexecute frozen inputs on recovery. The technical kind remains faithful.
    for (const row of this.db
      .prepare(
        "SELECT s.id, a.activity_id FROM submissions s JOIN attempts a ON a.id=s.attempt_id WHERE s.result_json IS NULL",
      )
      .all()) {
      const result: ExecutionResult =
        row.activity_id === "order-acceptance"
          ? { ...interrupted, kind: "order", observation: null }
          : { ...interrupted, kind: "tests", cases: [] };
      this.db
        .prepare("UPDATE submissions SET result_json=? WHERE id=?")
        .run(JSON.stringify(result), String(row.id));
    }
  }
  create(activityId: string): Attempt {
    const definition = activity(activityId);
    const id = randomUUID();
    const draft: Draft = {
      source: definition.starter,
      prediction: null,
      justification: "",
    };
    this.db
      .prepare(
        "INSERT INTO attempts(id,activity_id,activity_version,status,revision,draft_json) VALUES (?,?,?,?,?,?)",
      )
      .run(
        id,
        activityId,
        definition.version,
        "open",
        0,
        JSON.stringify(draft),
      );
    return this.get(id);
  }
  get(id: string): Attempt {
    const row = this.db
      .prepare("SELECT * FROM attempts WHERE id=?")
      .get(id) as unknown as AttemptRow | undefined;
    if (!row) throw new NotFoundException("Tentativa não encontrada.");
    const submissions = (
      this.db
        .prepare("SELECT * FROM submissions WHERE attempt_id=? ORDER BY number")
        .all(id) as unknown as SubmissionRow[]
    ).map(
      (item) =>
        ({
          ...JSON.parse(item.input_json),
          result: item.result_json ? JSON.parse(item.result_json) : null,
          feedback: item.feedback_json ? JSON.parse(item.feedback_json) : null,
        }) as Submission,
    );
    return {
      id: row.id,
      activityId: row.activity_id,
      activityVersion: row.activity_version,
      status: row.status,
      revision: row.revision,
      draft: JSON.parse(row.draft_json) as Draft,
      reflection: row.reflection,
      submissions,
    };
  }
  save(id: string, revision: number, draft: Draft): Attempt {
    const result = this.db
      .prepare(
        "UPDATE attempts SET draft_json=?, revision=revision+1 WHERE id=? AND revision=? AND status='open'",
      )
      .run(JSON.stringify(draft), id, revision);
    if (!result.changes) {
      this.get(id);
      throw new ConflictException(
        "Rascunho alterado em outra aba ou tentativa concluída. Recarregue antes de salvar.",
      );
    }
    return this.get(id);
  }
  freeze(
    id: string,
    revision: number,
    input: Omit<Submission, "number" | "result" | "feedback">,
  ): Submission {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const attempt = this.get(id);
      if (attempt.revision !== revision || attempt.status !== "open")
        throw new ConflictException("Revisão obsoleta ou tentativa concluída.");
      if (attempt.submissions.length >= 100)
        throw new ConflictException(
          "Limite de 100 submissões nesta tentativa. Abra uma nova tentativa.",
        );
      if (attempt.submissions.some((item) => !item.result))
        throw new ConflictException("Uma submissão ainda está executando.");
      const submission: Submission = {
        ...input,
        number: attempt.submissions.length + 1,
        result: null,
        feedback: null,
      };
      this.db
        .prepare(
          "INSERT INTO submissions(id,attempt_id,number,input_json) VALUES (?,?,?,?)",
        )
        .run(input.id, id, submission.number, JSON.stringify(submission));
      this.db.exec("COMMIT");
      return submission;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  finish(id: string, result: ExecutionResult, feedback: Feedback) {
    if (
      !this.db
        .prepare(
          "UPDATE submissions SET result_json=?,feedback_json=? WHERE id=? AND result_json IS NULL",
        )
        .run(JSON.stringify(result), JSON.stringify(feedback), id).changes
    ) {
      throw new ConflictException("Resultado já confirmado.");
    }
  }
  complete(id: string, revision: number, reflection: string): Attempt {
    const attempt = this.get(id);
    const usable = attempt.submissions.some(
      (s) =>
        s.result?.status === "completed" &&
        (s.result.kind === "order" ||
          (s.result.cases.length === 3 &&
            s.result.cases.every((c) => c.passed))),
    );
    if (attempt.submissions.some((s) => !s.result) || !usable)
      throw new ConflictException(
        "Conclua uma execução válida antes da reflexão final.",
      );
    if (
      !this.db
        .prepare(
          "UPDATE attempts SET status='completed',reflection=?,revision=revision+1 WHERE id=? AND revision=? AND status='open'",
        )
        .run(reflection, id, revision).changes
    )
      throw new ConflictException("Revisão obsoleta ou tentativa concluída.");
    return this.get(id);
  }
  close() {
    if (this.closed) return;
    this.db
      .prepare("DELETE FROM learning_owner WHERE token=?")
      .run(this.ownerToken);
    this.db.close();
    this.closed = true;
  }
}
