import type { LabDefinition, LabRun, LabSummary, RunDetail } from '@backendlab/protocol';

async function getJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, options);
  if (!response.ok) {
    const message = response.status === 409 ? 'Uma execução ainda está ativa. Tente novamente em instantes.' : `API retornou HTTP ${response.status}`;
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export const api = {
  labs: () => getJson<LabSummary[]>('/labs'),
  lab: (id: string) => getJson<LabDefinition>(`/labs/${id}`),
  createRun: (id: string) => getJson<LabRun>(`/labs/${id}/runs`, { method: 'POST' }),
  startRun: (labId: string, runId: string) => getJson<LabRun>(`/labs/${labId}/runs/${runId}/start`, { method: 'POST' }),
  abandonRun: (labId: string, runId: string) => getJson<LabRun>(`/labs/${labId}/runs/${runId}/abandon`, { method: 'POST' }),
  run: (labId: string, runId: string) => getJson<RunDetail>(`/labs/${labId}/runs/${runId}`),
  eventsUrl: (labId: string, runId: string) => `/api/labs/${labId}/runs/${runId}/events`,
};
