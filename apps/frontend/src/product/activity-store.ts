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
export function activityChanged() {
  window.dispatchEvent(new Event("bunkercode:activity"));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel("bunkercode-activity");
    channel.postMessage("changed");
    channel.close();
  }
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
      activityChanged();
      resolve();
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Atividade não pôde ser registrada."));
    };
  });
}
function valid(value: unknown): value is Activity {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Activity>;
  return (
    item.schema === 1 &&
    typeof item.key === "string" &&
    typeof item.scope === "string" &&
    typeof item.day === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(item.day) &&
    (item.kind === "visit" || item.kind === "edit" || item.kind === "submit") &&
    typeof item.at === "number" &&
    Number.isFinite(item.at) &&
    typeof item.timezone === "string"
  );
}
export async function readActivity(): Promise<Activity[]> {
  const db = await localDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("activity");
    const request = tx.objectStore("activity").getAll();
    tx.oncomplete = () => {
      db.close();
      const records: unknown[] = request.result;
      if (!records.every(valid))
        reject(
          new Error(
            "Há atividade local incompatível. Os registros foram preservados.",
          ),
        );
      else resolve(records);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Não foi possível ler atividade local."));
    };
  });
}
export function calendarDays(now = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end);
  start.setDate(start.getDate() - 364);
  const first = new Date(start);
  first.setDate(first.getDate() - first.getDay());
  const days: (string | null)[] = [];
  for (
    const date = new Date(first);
    date <= end;
    date.setDate(date.getDate() + 1)
  )
    days.push(date < start ? null : localDay(date));
  while (days.length % 7) days.push(null);
  return { days, start: localDay(start), end: localDay(end) };
}
