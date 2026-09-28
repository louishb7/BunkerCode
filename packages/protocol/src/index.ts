export type { OrderDeskState } from "./orderdesk";
export type SystemState = unknown;
export interface ExperimentConfig {
  clients: number;
  concurrency: number;
  [parameter: string]: number;
}
export interface Observation {
  key: string;
  label: string;
  value: string | number;
  before?: string | number;
  note?: string;
}
export interface ExperimentSummary {
  id: string;
  systemId: string;
  name: string;
  description: string;
  defaults: ExperimentConfig;
  operationLabel?: string;
  fields?: {
    key: keyof ExperimentConfig;
    label: string;
    min: number;
    max: number;
  }[];
}
export interface CodeVersion {
  commit: string;
  digest: string;
  dirty: boolean;
  snapshot: string;
}
export interface Checkpoint {
  id: string;
  systemId: string;
  commit: string;
  message: string;
  createdAt: number;
  digest: string;
}
export interface Evidence {
  sequence: number;
  timestamp: number;
  source: "runner" | "system" | "runtime";
  type: string;
  requestId?: string;
  payload: Record<string, unknown>;
}
export interface RequestResult {
  id: string;
  startedAt: number;
  durationMs: number;
  status: number | null;
  body: unknown;
  error?: string;
}
export interface Assertion {
  name: string;
  passed: boolean;
  expected: unknown;
  actual: unknown;
}
export interface ExperimentResult {
  accepted: number;
  rejected: number;
  errors: number;
  observations?: Observation[];
  [measurement: string]: unknown;
  assertions: Assertion[];
}
export interface Run {
  id: string;
  number: number;
  workspaceId: string;
  systemId: string;
  experimentId: string;
  status: "running" | "passed" | "failed" | "error" | "interrupted";
  createdAt: number;
  completedAt?: number;
  durationMs?: number;
  config: ExperimentConfig;
  code: CodeVersion;
  checkpoint?: Checkpoint;
  initialState?: SystemState;
  finalState?: SystemState;
  result?: ExperimentResult;
  error?: string;
}
export interface RunDetail {
  run: Run;
  requests: RequestResult[];
  evidence: Evidence[];
}
export interface SystemSummary {
  surface?: SurfaceDefinition;
  id: string;
  name: string;
  description: string;
}
export interface RuntimeStatus {
  status: "stopped" | "starting" | "ready" | "crashed";
  pid?: number;
  port?: number;
  code?: CodeVersion;
  error?: string;
  logs: string[];
}
export interface Workbench {
  workspace: { id: string; name: string };
  system: SystemSummary;
  experiments: ExperimentSummary[];
  runtime: RuntimeStatus;
  codePath: string;
  workingCode: Omit<CodeVersion, "snapshot">;
  state: SystemState | null;
  busy: string | null;
  checkpoints: Checkpoint[];
}

export interface SurfaceDefinition {
  title: string;
  path: string;
  operations: { method: "GET" | "POST"; path: string }[];
}
export interface Activity {
  id: string;
  systemId: string;
  method: "GET" | "POST";
  path: string;
  requestBody: unknown;
  startedAt: number;
  durationMs?: number;
  status: number | null;
  body: unknown;
  error?: string;
  code?: CodeVersion;
  evidence: Evidence[];
  truncated?: boolean;
}
export type ActivitySummary = Omit<
  Activity,
  "evidence" | "requestBody" | "body"
>;
