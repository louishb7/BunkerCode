import type {
  Checkpoint,
  Activity,
  ActivitySummary,
  SystemSummary,
  RuntimeStatus,
  Run,
  RunDetail,
  Workbench,
  ExperimentConfig,
} from "@backendlab/protocol";
let selectedSystem = "orderdesk";
export function selectSystem(id: string) {
  selectedSystem = id;
}
const base = () =>
  `/api/workspaces/local/systems/${encodeURIComponent(selectedSystem)}`;
async function json<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    base() + path,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-bunkerlab-client": "local",
          },
          body: JSON.stringify(body),
        },
  );
  const value = await response.json();
  if (!response.ok) throw new Error(value.message ?? `HTTP ${response.status}`);
  return value as T;
}
export const api = {
  systems: async () => {
    const response = await fetch("/api/workspaces/local/systems");
    if (!response.ok) throw new Error("Não foi possível listar os sistemas.");
    return response.json() as Promise<
      (SystemSummary & { runtime: RuntimeStatus["status"] })[]
    >;
  },
  open: () => json("/runtime/open", {}),
  surface: () => json<{ html: string }>("/surface"),
  activities: () => json<ActivitySummary[]>("/activities"),
  activity: (id: string) =>
    json<Activity>(`/activities/${encodeURIComponent(id)}`),
  interact: (operation: { method: string; path: string; body?: unknown }) =>
    json<Activity>("/activities", operation),
  workbench: () => json<Workbench>(""),
  runs: (before?: number) =>
    json<Run[]>(`/runs${before ? `?before=${before}` : ""}`),
  run: (id: string) => json<RunDetail>(`/runs/${encodeURIComponent(id)}`),
  start: (id: string, config: ExperimentConfig) =>
    json<Run>(`/experiments/${encodeURIComponent(id)}/runs`, config),
  restart: () => json("/runtime/restart", {}),
  reset: () => json("/runtime/reset", {}),
  checkpoint: (message: string) =>
    json<Checkpoint>("/checkpoints", { message }),
  restore: (id: string) =>
    json(`/checkpoints/${encodeURIComponent(id)}/restore`, {}),
};
