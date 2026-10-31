import { localDatabase } from "./local-database";
export type ActivityKind = "visit" | "edit" | "submit";
export interface Activity {
  schema: 1;
  key: string;
  kind: ActivityKind;
  scope: string;
  day: string;
  at: number;
  timezone: string;
}
export function localDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function activityRecord(
  kind: ActivityKind,
  scope: string,
  at = Date.now(),
  identity = "",
): Activity {
  const day = localDay(new Date(at));
  return {
    schema: 1,
    key: JSON.stringify([day, kind, scope, identity]),
    kind,
    scope,
    day,
    at,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}
export async function recordActivity(kind: "visit" | "edit", scope: string) {
  const db = await localDatabase();
  const record = activityRecord(kind, scope);
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("activity", "readwrite");
    const store = tx.objectStore("activity");
    const read = store.get(record.key);
    read.onsuccess = () => {
      if (read.result === undefined) store.add(record);
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Atividade não pôde ser registrada."));
    };
  });
}
