import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { parseExerciseTests } from "@bunkercode/content";
import { compileAssessment } from "../src/practice/assessment";
import { prepareFunctionTests } from "../src/practice/function-tests";
import { runCode, runnerStatus } from "../src/practice/runner";
const suite = parseExerciseTests({
  kind: "function",
  version: 1,
  function: "isAvailable",
  cases: [
    { name: "positive", args: [3], expected: true },
    { name: "zero", args: [0], expected: false },
    { name: "negative", args: [-1], expected: false },
  ],
});
test("public cases validate version, bounds, JSON values, unique names and identifiers", () => {
  assert.equal(suite.kind, "function");
  for (const change of [
    { version: 2 },
    { function: "f(); process.exit()" },
    { cases: [] },
    { cases: [{ name: "x", args: [NaN], expected: false }] },
    {
      cases: [
        { name: "x", args: [], expected: false },
        { name: "x", args: [], expected: true },
      ],
    },
  ])
    assert.throws(() => parseExerciseTests({ ...suite, ...change }));
  assert.deepEqual(parseExerciseTests({ kind: "stdout", expected: "42\n" }), {
    kind: "stdout",
    expected: "42\n",
  });
});
test("Docker calls the actual compiled function, rejects printed answers, reports cases and contains infinite execution", async (t) => {
  const status = await runnerStatus();
  if (!status.available) {
    t.skip(status.reason);
    return;
  }
  if (suite.kind !== "function") throw new Error("Wrong fixture");
  const functionSuite = suite;
  async function assess(source: string) {
    const javascript = await compileAssessment(
      source,
      "typescript",
      new AbortController().signal,
    );
    const prepared = prepareFunctionTests(javascript, functionSuite);
    const run = await runCode(randomUUID(), source, prepared.program);
    return { run, result: prepared.assess(run) };
  }
  const printed = await assess('console.log("true false false");');
  assert.equal(printed.result.assessment, "failed");
  assert.match(printed.result.testReport.cases[0]!.error!, /não encontrada/);
  const partial = await assess(
    "function isAvailable(stock: number): boolean { return stock >= 0; }",
  );
  assert.equal(partial.result.testReport.passed, 2);
  assert.equal(partial.result.testReport.cases[1]!.passed, false);
  const correct = await assess(
    "function isAvailable(stock: number): boolean { return stock > 0; }",
  );
  assert.equal(correct.result.assessment, "passed");
  assert.equal(correct.result.testReport.passed, 3);
  assert.doesNotMatch(correct.result.stdout, /bunkercode-tests-/);
  const thrown = await assess(
    'function isAvailable(stock: number): boolean { throw new Error("bad input"); }',
  );
  assert.match(thrown.result.testReport.cases[0]!.error!, /bad input/);
  const timeout = await assess(
    "function isAvailable(stock: number): boolean { while (true) {} }",
  );
  assert.equal(timeout.run.state, "timeout");
  assert.equal(timeout.result.assessment, "failed");
});

test("function returns preserve structured JSON and do not turn NaN into an approved null", async (t) => {
  const status = await runnerStatus();
  if (!status.available) {
    t.skip(status.reason);
    return;
  }
  for (const [source, expected, state] of [
    [
      'function result() { return { b: [1, false], a: "ok" }; }',
      { a: "ok", b: [1, false] },
      "passed",
    ],
    ["function result() { return NaN; }", null, "failed"],
  ] as const) {
    const tests = parseExerciseTests({
      kind: "function",
      version: 1,
      function: "result",
      cases: [{ name: "JSON return", args: [], expected }],
    });
    if (tests.kind !== "function") throw new Error("Wrong fixture");
    const javascript = await compileAssessment(
      source,
      "typescript",
      new AbortController().signal,
    );
    const prepared = prepareFunctionTests(javascript, tests);
    const run = await runCode(randomUUID(), source, prepared.program);
    assert.equal(prepared.assess(run).assessment, state);
  }
});
