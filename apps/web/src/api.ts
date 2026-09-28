import type {
  Run,
  RunDetail,
  Workbench,
  ExperimentConfig,
} from "@backendlab/protocol";
const base = "/api/workspaces/local/systems/orderdesk";
async function json<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    base + path,
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
  workbench: () => json<Workbench>(""),
  runs: (before?: number) =>
    json<Run[]>(`/runs${before ? `?before=${before}` : ""}`),
  run: (id: string) => json<RunDetail>(`/runs/${encodeURIComponent(id)}`),
  start: (id: string, config: ExperimentConfig) =>
    json<Run>(`/experiments/${encodeURIComponent(id)}/runs`, config),
  restart: () => json("/runtime/restart", {}),
  reset: () => json("/runtime/reset", {}),
  checkpoint: (message: string) => json("/checkpoints", { message }),
  restore: (id: string) =>
    json(`/checkpoints/${encodeURIComponent(id)}/restore`, {}),
};
