import { randomBytes } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { FunctionTests, TestReport } from "@bunkercode/content";
import type { RunResult } from "./runner";

/** The entire program, including the VM, executes only inside the existing Docker runner.
 * VM separates test bookkeeping from ordinary learner globals; Docker is the security boundary. */
export function prepareFunctionTests(javascript: string, tests: FunctionTests) {
  const marker = "bunkercode-tests-" + randomBytes(24).toString("hex") + ":";
  const program = `
import { Script, createContext } from 'node:vm';
const source = ${JSON.stringify(javascript)};
const cases = ${JSON.stringify(tests.cases.map((item) => item.args))};
const context = createContext({ console });
let setupError;
try { new Script(source, { filename: 'solucao.js' }).runInContext(context); }
catch (error) { setupError = String(error).slice(0, 1000); }
const results = [];
for (const args of cases) {
  if (setupError) { results.push({ error: setupError }); continue; }
  try {
    context.__bunkercodeArgs = args;
    const value = new Script(${JSON.stringify(`(() => {
      if (typeof ${tests.function} !== 'function') throw new Error('Função ${tests.function} não encontrada.');
      return ${tests.function}(...__bunkercodeArgs);
    })()`)}).runInContext(context);
    if (value && typeof value.then === 'function') throw new Error('Use uma função síncrona.');
    let nodes = 0;
    const serialized = JSON.stringify(value, (_key, item) => {
      if (++nodes > 2000 || typeof item === 'undefined' || typeof item === 'function' || typeof item === 'symbol' || (typeof item === 'number' && !Number.isFinite(item))) throw new Error('A função precisa retornar valores JSON finitos.');
      return item;
    });
    if (serialized === undefined) throw new Error('A função precisa retornar um valor JSON.');
    if (serialized.length > 16000) throw new Error('Retorno excede o limite de tamanho.');
    results.push({ actual: JSON.parse(serialized) });
  } catch (error) { results.push({ error: String(error).slice(0, 1000) }); }
}
process.stdout.write('\\n' + ${JSON.stringify(marker)} + JSON.stringify(results) + '\\n');
`;
  function assess(run: RunResult): {
    stdout: string;
    testReport: TestReport;
    assessment: "passed" | "failed";
  } {
    const lines = run.stdout.split("\n");
    const protocol = lines.filter((line) => line.startsWith(marker));
    let values: unknown[] = [];
    if (run.state === "success" && protocol.length === 1) {
      try {
        const parsed: unknown = JSON.parse(protocol[0]!.slice(marker.length));
        if (Array.isArray(parsed) && parsed.length === tests.cases.length)
          values = parsed;
      } catch {
        /* Malformed or interrupted protocol fails every missing case. */
      }
    }
    const cases = tests.cases.map((item, index) => {
      const value = values[index];
      const record =
        value && typeof value === "object"
          ? (value as Record<string, unknown>)
          : {};
      const actual =
        "actual" in record
          ? JSON.stringify(record.actual).slice(0, 16000)
          : undefined;
      const error =
        typeof record.error === "string"
          ? record.error.slice(0, 1000)
          : actual === undefined
            ? "Não foi possível concluir este caso."
            : undefined;
      return {
        name: item.name,
        passed: !error && isDeepStrictEqual(record.actual, item.expected),
        expected: JSON.stringify(item.expected),
        ...(actual === undefined ? {} : { actual }),
        ...(error ? { error } : {}),
      };
    });
    const passed = cases.filter((item) => item.passed).length;
    return {
      stdout: lines
        .filter((line) => !line.startsWith(marker))
        .join("\n")
        .replace(/\n$/, ""),
      testReport: { passed, total: cases.length, cases },
      assessment:
        passed === cases.length && run.state === "success"
          ? "passed"
          : "failed",
    };
  }
  return { program, assess };
}
