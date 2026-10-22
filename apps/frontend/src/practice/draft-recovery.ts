import { draftKey } from "./draft-store";

const PREFIX = "bunkercode:practice-recovery:v1:";
export interface DraftRecovery {
  schema: 1;
  scope: string;
  revision: string;
  code: string;
  updatedAt: number;
  previousRevisions?: string[];
}
export const recoveryKey = (scope: string, revision: string) =>
  PREFIX + draftKey(scope, revision);

// sessionStorage belongs to this tab and survives reload; it never confirms an
// IndexedDB write or changes the revision expected by another tab.
export function readRecovery(scope: string, revision: string) {
  const values: DraftRecovery[] = [];
  for (let index = 0; index < sessionStorage.length; index++) {
    const key = sessionStorage.key(index);
    if (!key?.startsWith(PREFIX)) continue;
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (!value || typeof value !== "object")
      throw new Error(
        "Cópia de recuperação incompatível; os dados foram preservados.",
      );
    const record = value as Partial<DraftRecovery>;
    if (
      record.schema !== 1 ||
      typeof record.scope !== "string" ||
      typeof record.revision !== "string" ||
      !/^[a-f0-9]{64}$/.test(record.revision) ||
      typeof record.code !== "string" ||
      typeof record.updatedAt !== "number" ||
      !Number.isFinite(record.updatedAt) ||
      key !== recoveryKey(record.scope, record.revision) ||
      (record.previousRevisions !== undefined &&
        (!Array.isArray(record.previousRevisions) ||
          !record.previousRevisions.every(
            (revision: unknown) =>
              typeof revision === "string" && /^[a-f0-9]{64}$/.test(revision),
          )))
    )
      throw new Error(
        "Cópia de recuperação incompatível; os dados foram preservados.",
      );
    if (record.scope === scope) values.push(record as DraftRecovery);
  }
  return (
    values.find((value) => value.revision === revision) ??
    values.sort((a, b) => b.updatedAt - a.updatedAt)[0]
  );
}
export function writeRecovery(
  scope: string,
  revision: string,
  code: string,
  previousRevisions: string[],
) {
  const value: DraftRecovery = {
    schema: 1,
    scope,
    revision,
    code,
    updatedAt: Date.now(),
    previousRevisions: previousRevisions.filter((value) => value !== revision),
  };
  sessionStorage.setItem(recoveryKey(scope, revision), JSON.stringify(value));
}
export function removeRecovery(key: string) {
  sessionStorage.removeItem(key);
}
