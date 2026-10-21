const assert = require("node:assert/strict");
const { test } = require("node:test");
const ts = require("typescript");
const c = require("@bunkercode/tactics-core");

/** Independent declarative oracle, including each mutation's actual operation.
 * @param {import('../dist').IterationProgram} p
 * @param {readonly import('../dist').IterationInstruction[]} instructions
 * @param {number} [end] */
function oracle(p, instructions, end = p.records.length) {
  const predicate = instructions.find(
    (i) => i.operation.type === "condition",
  )?.operation;
  assert.ok(predicate?.type === "condition");
  const selected = p.records
    .slice(0, end)
    .filter((r) =>
      predicate.inverted
        ? r[predicate.predicate.property] !== predicate.predicate.equals
        : r[predicate.predicate.property] === predicate.predicate.equals,
    );
  const project = instructions.find((i) =>
    ["append", "assign"].includes(i.operation.type),
  )?.operation;
  if (p.pattern === "count-matching") {
    const counter = instructions.find(
      (i) => i.operation.type === "count",
    )?.operation;
    assert.ok(counter?.type === "count");
    return selected.length === 0 ? 0 : selected.length * counter.delta;
  }
  assert.ok(
    project && (project.type === "append" || project.type === "assign"),
  );
  if (p.pattern === "collect-matching")
    return selected.map((r) => r[project.property]);
  if (p.pattern === "first-match")
    return selected[0]?.[project.property] ?? null;
  /** @type {{matching: string[], other: string[]}} */
  const result = { matching: [], other: [] };
  for (const r of p.records.slice(0, end)) {
    const action = instructions.find(
      (i) =>
        i.id === (selected.includes(r) ? "append-matching" : "append-other"),
    )?.operation;
    assert.ok(action?.type === "append" && action.destination !== "selected");
    result[action.destination].push(r[action.property]);
  }
  return result;
}
/** @param {string} code */
function parse(code) {
  const file = ts.createSourceFile(
    "/iteration.js",
    code,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.JS,
  );
  /** @type {import('typescript').CompilerHost} */
  const host = {
    getSourceFile: () => file,
    getDefaultLibFileName: () => "",
    writeFile: () => assert.fail("No emit"),
    getCurrentDirectory: () => "/",
    getDirectories: () => [],
    fileExists: () => true,
    readFile: () => code,
    getCanonicalFileName: (p) => p,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
  };
  assert.deepEqual(
    ts
      .createProgram(
        ["/iteration.js"],
        { allowJs: true, noLib: true, noResolve: true, types: [] },
        host,
      )
      .getSyntacticDiagnostics(file),
    [],
  );
  const loops = file.statements.filter(ts.isForOfStatement);
  assert.equal(loops.length, 1);
  assert.equal(loops[0]?.expression.getText(file), "items");
  assert.ok(!/\b(eval|Function|while)\b/.test(code));
}
/** @param {import('../dist').IterationProgram} p @param {import('../dist').IterationTrace} trace @param {readonly import('../dist').IterationInstruction[]} instructions */
function checkTrace(p, trace, instructions) {
  assert.ok(trace.iterations <= p.records.length && trace.events.length <= 28);
  const ids = new Set(instructions.map((i) => i.id));
  assert.equal(trace.events[0]?.instructionId, "initialize");
  assert.equal(trace.events.at(-1)?.instructionId, "finish");
  let before = trace.events[0]?.before;
  for (const event of trace.events) {
    assert.ok(ids.has(event.instructionId));
    assert.deepEqual(event.before, before);
    if (event.iteration !== null) {
      assert.deepEqual(event.record, p.records[event.iteration]);
      assert.ok(event.iteration >= 0 && event.iteration < p.records.length);
      const end =
        event.iteration +
        (["iterate", "condition"].includes(event.instructionId) ? 0 : 1);
      assert.deepEqual(event.after, oracle(p, instructions, end));
    }
    before = event.after;
  }
  assert.deepEqual(trace.result, oracle(p, instructions));
  assert.deepEqual(trace.events.at(-1)?.after, trace.result);
  assert.equal(
    trace.events.filter((e) => e.instructionId === "iterate").length,
    trace.iterations,
  );
}

test("10,000 seeds across four iteration patterns: independent results, traces, syntax, deterministic single-instruction faults", () => {
  const defects = new Set(),
    patterns = new Set(),
    lengths = new Set(),
    objectives = new Set(),
    programs = new Set();
  let absent = 0,
    early = 0;
  for (let seed = 0; seed < 10000; seed++) {
    const pattern = c.ITERATION_PATTERNS[seed % 4];
    const p = c.generateIterationReference(seed, 1, pattern);
    const t = c.transformIterationProgram(p);
    const view = c.getPublicIterationTactic(t);
    assert.deepEqual(p, c.generateIterationReference(seed, 1, pattern));
    assert.deepEqual(t, c.transformIterationProgram(p));
    assert.equal(c.verifyIterationTactic(t).valid, true);
    assert.ok(
      Object.isFrozen(p.records[0]) &&
        Object.isFrozen(t.trace.events[0]?.after),
    );
    assert.ok(p.records.length >= 3 && p.records.length <= 6);
    assert.deepEqual(p.expectedResult, oracle(p, p.instructions));
    assert.notDeepEqual(t.trace.result, p.expectedResult);
    const differences = p.instructions.filter(
      (i, index) => JSON.stringify(i) !== JSON.stringify(t.instructions[index]),
    );
    assert.deepEqual(
      differences.map((i) => i.id),
      [t.faultId],
    );
    assert.equal(
      p.lines.filter((l) => l.instructionId !== null).length,
      p.instructions.length,
    );
    parse(p.code);
    parse(t.code);
    checkTrace(p, p.trace, p.instructions);
    checkTrace(p, t.trace, t.instructions);
    assert.deepEqual(c.getIterationTrace(t), t.trace);
    assert.equal("faultId" in view, false);
    assert.equal("reference" in view, false);
    assert.equal("defect" in view, false);
    for (const id of view.instructionIds) {
      const result = c.evaluateIterationAnswer(t, id);
      assert.equal(result.status, "valid");
      assert.equal(result.achieved, id === t.faultId);
      if (result.status === "valid")
        assert.equal(result.correctedCode !== null, id === t.faultId);
    }
    if (p.pattern === "first-match") {
      absent += Number(p.expectedResult === null);
      early += Number(p.trace.iterations < p.records.length);
    }
    defects.add(t.defect);
    patterns.add(pattern);
    lengths.add(p.records.length);
    objectives.add(p.objective);
    programs.add(p.code);
  }
  assert.equal(patterns.size, 4);
  assert.equal(defects.size, 4);
  assert.equal(lengths.size, 4);
  assert.ok(
    objectives.size >= 20 &&
      programs.size > 9000 &&
      absent > 200 &&
      early > 500,
  );
});

test("iteration rejects invalid versions, seeds, patterns, forged models and invalid instruction answers", () => {
  for (const seed of [-1, 4294967296, NaN, 1.5, "0", null])
    assert.throws(() => c.generateIterationReference(seed));
  for (const seed of [0, 4294967295])
    for (const pattern of c.ITERATION_PATTERNS) {
      const p = c.generateIterationReference(seed, 1, pattern),
        t = c.transformIterationProgram(p);
      assert.deepEqual(c.generateIterationReference(seed, 1, pattern), p);
      for (const answer of [
        null,
        undefined,
        {},
        [],
        1,
        "",
        "unknown",
        " condition",
      ])
        assert.equal(
          c.evaluateIterationAnswer(t, answer).status,
          "invalid-answer",
        );
      for (const forged of [
        { ...t, faultId: "finish" },
        { ...t, extra: 1 },
        { ...t, trace: { ...t.trace, result: "wrong" } },
        { ...t, identity: { ...t.identity, generatorVersion: 2 } },
      ]) {
        assert.equal(c.verifyIterationTactic(forged).valid, false);
        assert.equal(
          c.evaluateIterationAnswer(forged, t.faultId).status,
          "invalid-tactic",
        );
        assert.throws(() => c.getPublicIterationTactic(forged));
      }
      assert.throws(() => c.transformIterationProgram({ ...p, records: [] }));
      assert.throws(() => c.transformIterationProgram(p, "order-program"));
    }
  for (const version of [0, 2, undefined, "1"]) {
    if (version !== undefined)
      assert.throws(() => c.generateIterationReference(0, version));
  }
  assert.throws(() => c.generateIterationReference(0, 1, "unknown"));
  // Explicit no-match and early-stop fixtures are pinned separately from properties.
  const absent = c.generateIterationReference(2, 1, "first-match");
  assert.equal(absent.expectedResult, null);
  assert.equal(absent.trace.iterations, absent.records.length);
});

test("manual seed-zero fixtures cover all four semantics and an early first-match", () => {
  const expected = [
    ["azul"],
    1,
    "azul",
    { matching: ["verde", "azul", "verde"], other: ["azul", "verde", "âmbar"] },
  ];
  c.ITERATION_PATTERNS.forEach((pattern, index) =>
    assert.deepEqual(
      c.generateIterationReference(0, 1, pattern).expectedResult,
      expected[index],
    ),
  );
  assert.equal(
    c.generateIterationReference(0, 1, "first-match").trace.iterations,
    1,
  );
});
