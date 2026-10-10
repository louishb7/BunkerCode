import { localDatabase } from "../product/local-database";
import { activityChanged, activityRecord } from "../product/activity-store";
import { draftScope, MAX_DRAFT_BYTES } from "./draft-store";
export interface Submission {
  schema: 1;
  id: string;
  scope: string;
  course: string;
  lesson: string;
  exercise: string;
  revision: string;
  code: string;
  at: number;
  state: "unassessed";
}
export async function submitSolution(
  course: string,
  lesson: string,
  exercise: string,
  revision: string,
  code: string,
): Promise<Submission> {
  if (new TextEncoder().encode(code).length > MAX_DRAFT_BYTES)
    throw new Error("A solução excede 64 KiB. Seu código foi preservado.");
  const scope = draftScope(course, lesson, exercise);
  const value: Submission = {
    schema: 1,
    id: crypto.randomUUID(),
    scope,
    course,
    lesson,
    exercise,
    revision,
    code,
    at: Date.now(),
    state: "unassessed",
  };
  const db = await localDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["submissions", "activity"], "readwrite");
    tx.objectStore("submissions").add(value);
    tx.objectStore("activity").add(
      activityRecord("submit", scope, value.at, value.id),
    );
    tx.oncomplete = () => {
      db.close();
      activityChanged();
      resolve(value);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Não foi possível registrar a solução."));
    };
  });
}
function valid(value: unknown): value is Submission {
  if (!value || typeof value !== "object") return false;
  const s = value as Partial<Submission>;
  return (
    s.schema === 1 &&
    typeof s.id === "string" &&
    typeof s.course === "string" &&
    typeof s.lesson === "string" &&
    typeof s.exercise === "string" &&
    typeof s.revision === "string" &&
    /^[a-f0-9]{64}$/.test(s.revision) &&
    typeof s.code === "string" &&
    new TextEncoder().encode(s.code).length <= MAX_DRAFT_BYTES &&
    typeof s.at === "number" &&
    Number.isFinite(s.at) &&
    s.state === "unassessed" &&
    s.scope === draftScope(s.course, s.lesson, s.exercise)
  );
}
export async function readSubmissions(scope: string): Promise<Submission[]> {
  const db = await localDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("submissions");
    const request = tx.objectStore("submissions").index("scope").getAll(scope);
    tx.oncomplete = () => {
      db.close();
      const values: unknown[] = request.result;
      if (!values.every(valid))
        reject(
          new Error(
            "Histórico local incompatível. Os registros foram preservados.",
          ),
        );
      else resolve(values.sort((a, b) => b.at - a.at));
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Falha ao ler envios locais."));
    };
  });
}
