import { localDatabase } from "../product/local-database";
export const MAX_DRAFT_BYTES = 64 * 1024;
export interface Draft {
  schema: 1;
  key: string;
  scope: string;
  revision: string;
  code: string;
  version: number;
  updatedAt: number;
}
export class DraftConflict extends Error {
  constructor(public readonly current: Draft) {
    super("Outra aba salvou uma versão diferente. Revise antes de substituir.");
  }
}
export const draftScope = (course: string, lesson: string, exercise: string) =>
  JSON.stringify(["bunkercode", course, lesson, exercise]);
export const draftKey = (scope: string, revision: string) =>
  JSON.stringify([scope, revision]);
function valid(value: unknown): value is Draft {
  if (!value || typeof value !== "object") return false;
  const d = value as Partial<Draft>;
  return (
    d.schema === 1 &&
    typeof d.scope === "string" &&
    typeof d.revision === "string" &&
    /^[a-f0-9]{64}$/.test(d.revision) &&
    d.key === draftKey(d.scope, d.revision) &&
    typeof d.code === "string" &&
    new TextEncoder().encode(d.code).length <= MAX_DRAFT_BYTES &&
    Number.isSafeInteger(d.version) &&
    (d.version ?? 0) > 0 &&
    typeof d.updatedAt === "number" &&
    Number.isFinite(d.updatedAt)
  );
}
export async function loadDraft(
  scope: string,
  revision: string,
): Promise<{ current?: Draft; previous?: Draft }> {
  const db = await localDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("drafts", "readonly");
    const request = tx.objectStore("drafts").index("scope").getAll(scope);
    tx.oncomplete = () => {
      db.close();
      const values: unknown[] = request.result;
      if (!values.every(valid)) {
        reject(
          new Error(
            "Rascunho local incompatível. Os dados existentes foram preservados.",
          ),
        );
        return;
      }
      resolve({
        current: values.find((item) => item.revision === revision),
        previous: values
          .filter((item) => item.revision !== revision)
          .sort((a, b) => b.updatedAt - a.updatedAt)[0],
      });
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Falha ao ler rascunho local."));
    };
  });
}
export async function saveDraft(
  scope: string,
  revision: string,
  code: string,
  expected: number | null,
): Promise<Draft> {
  if (new TextEncoder().encode(code).length > MAX_DRAFT_BYTES)
    throw new Error(
      "O rascunho excede 64 KiB. O texto continua no editor; copie ou baixe antes de sair.",
    );
  const db = await localDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("drafts", "readwrite");
    const store = tx.objectStore("drafts");
    const key = draftKey(scope, revision);
    const request = store.get(key);
    let result: Draft;
    let failure: Error | undefined;
    request.onsuccess = () => {
      const current: unknown = request.result;
      if (current !== undefined && !valid(current)) {
        failure = new Error(
          "Rascunho local incompatível. Nenhum dado foi substituído.",
        );
        tx.abort();
        return;
      }
      if ((current?.version ?? null) !== expected) {
        failure = current
          ? new DraftConflict(current)
          : new Error(
              "O rascunho mudou fora desta aba. Copie seu texto e recarregue para revisar.",
            );
        tx.abort();
        return;
      }
      result = {
        schema: 1,
        key,
        scope,
        revision,
        code,
        version: (expected ?? 0) + 1,
        updatedAt: Date.now(),
      };
      try {
        store.put(result);
      } catch (error) {
        failure =
          error instanceof Error ? error : new Error("Falha de gravação.");
        tx.abort();
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(
        failure ??
          tx.error ??
          new Error("Não foi possível salvar o rascunho local."),
      );
    };
  });
}
