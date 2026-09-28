export interface SystemState {
  product: { id: string; name: string; stock: number };
  orders: {
    id: string;
    productId: string;
    quantity: number;
    createdAt: number;
  }[];
}
export interface ExperimentConfig {
  stock: number;
  clients: number;
  concurrency: number;
}
export interface ExperimentSummary {
  id: string;
  systemId: string;
  name: string;
  description: string;
  defaults: ExperimentConfig;
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
  finalStock: number;
  orderCount: number;
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
