// Small HTTP data contract, independent of the legacy protocol and server runtime.
export interface Diagnostic {
  message: string;
  line?: number;
  column?: number;
}
export interface ProcessOutcome {
  status:
    | "completed"
    | "compilation_error"
    | "runtime_error"
    | "timeout"
    | "interrupted"
    | "cleanup_error";
  diagnostics: Diagnostic[];
  stdout: string;
  stderr: string;
  truncated: boolean;
  exitCode: number | null;
  durationMs: number | null;
  nodeVersion: string;
  typescriptVersion: string;
}
export interface OrderResult extends ProcessOutcome {
  kind: "order";
  observation: {
    request: { method: "POST"; path: "/orders"; body: { quantity: number } };
    response: { status: number; body: unknown };
    initialState: { stock: number; orders: number };
    finalState: { stock: number; orders: number };
  } | null;
}
export interface TestCase {
  name: string;
  passed: boolean;
  expected?: string;
  received?: string;
  message?: string;
}
export interface StockTestResult extends ProcessOutcome {
  kind: "tests";
  cases: TestCase[];
}
export type ExecutionResult = OrderResult | StockTestResult;

export interface LearningActivity {
  id: string;
  version: number;
  kind: "prediction" | "code";
  title: string;
  context: string;
  task: string;
  rules: string[];
  starter: string;
  harnessExcerpt: string;
}
export interface Prediction {
  status: number;
  stock: number;
  orders: number;
}
export interface Draft {
  source: string;
  prediction: Partial<Prediction> | null;
  justification: string;
}
export interface Feedback {
  message: string;
  comparisons: {
    label: string;
    expected: number;
    actual: number;
    matches: boolean;
  }[];
}
export interface Submission {
  id: string;
  number: number;
  source: string;
  digest: string;
  draftRevision: number;
  prediction: Prediction | null;
  justification: string;
  activityVersion: number;
  harnessDigest: string;
  conditions: Record<string, number>;
  createdAt: string;
  result: ExecutionResult | null;
  feedback: Feedback | null;
}
export interface Attempt {
  id: string;
  activityId: string;
  activityVersion: number;
  status: "open" | "completed";
  revision: number;
  draft: Draft;
  reflection: string;
  submissions: Submission[];
}
