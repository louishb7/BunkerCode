export type LabMode = 'observe' | 'experiment' | 'modify';
export type LabStatus = 'available' | 'planned';
export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'abandoned';

export interface LabSummary {
  id: string;
  number: string;
  title: string;
  area: string;
  mode: LabMode;
  status: LabStatus;
}

export interface LabDefinition extends LabSummary {
  question: string;
  description: string;
  concept: string;
}

export interface LabRun {
  id: string;
  labId: string;
  status: RunStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  httpStatus?: number;
  durationMs?: number;
  error?: string;
  eventCount: number;
}

export interface LabEvent {
  id: string;
  labId: string;
  runId: string;
  traceId?: string;
  timestamp: number;
  source: string;
  type: string;
  payload?: Record<string, unknown>;
}

export interface RunDetail {
  run: LabRun;
  events: LabEvent[];
}
