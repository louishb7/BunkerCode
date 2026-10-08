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
