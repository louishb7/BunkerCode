import { harnessPath } from "../content/activities";
import {
  emptyOutcome,
  ExecutionFailure,
  startHarness,
  stopChild,
  withSource,
} from "./process";
import type { StockTestResult, TestCase } from "./results";
function testCases(message: unknown): TestCase[] | null {
  if (
    !message ||
    typeof message !== "object" ||
    !("kind" in message) ||
    message.kind !== "tests" ||
    !("cases" in message) ||
    !Array.isArray(message.cases) ||
    message.cases.length !== 3
  )
    return null;
  const names = [
    "quantity below stock",
    "quantity equal to stock",
    "quantity above stock",
  ];
  const cases: TestCase[] = [];
  for (const [index, item] of message.cases.entries()) {
    if (
      !item ||
      typeof item !== "object" ||
      item.name !== names[index] ||
      typeof item.passed !== "boolean"
    )
      return null;
    cases.push({
      name: names[index]!,
      passed: item.passed,
      ...(typeof item.expected === "string"
        ? { expected: item.expected.slice(0, 1000) }
        : {}),
      ...(typeof item.received === "string"
        ? { received: item.received.slice(0, 1000) }
        : {}),
      ...(typeof item.message === "string"
        ? { message: item.message.slice(0, 1000) }
        : {}),
    });
  }
  return cases;
}
export function testStockFunction(
  source: string,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<StockTestResult> {
  return withSource(
    source,
    { ...emptyOutcome(), kind: "tests", cases: [] } as StockTestResult,
    async (directory, signal, result) => {
      let reported: TestCase[] | null = null;
      const session = await startHarness(
        directory,
        harnessPath("reserve-stock"),
        signal,
        (message) => {
          reported = testCases(message) ?? reported;
        },
      );
      try {
        const closed = await session.closed;
        Object.assign(result, session.output, { exitCode: closed.code });
        if (signal.aborted)
          throw new ExecutionFailure("timeout", "Prazo dos testes excedido.");
        if (!reported)
          throw new ExecutionFailure(
            "runtime_error",
            "O runner encerrou sem relatório completo de casos.",
          );
        const passing = (reported as TestCase[]).every((item) => item.passed);
        if ((passing && closed.code !== 0) || (!passing && closed.code !== 1))
          throw new ExecutionFailure(
            "runtime_error",
            "Exit code não corresponde ao relatório dos casos.",
          );
        result.cases = reported;
      } finally {
        await stopChild(session);
      }
    },
    options,
  );
}
