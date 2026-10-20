const assert = require("node:assert/strict");
const { test } = require("node:test");
const { execFileSync } = require("node:child_process");
const { dirname } = require("node:path");
const c = require("@bunkercode/tactics-core");
const {
  oracleConditional,
  oracleStep,
  parseConditional,
} = require("./helpers.cjs");
/** @type {readonly import("../dist").ConditionalKind[]} */
const kinds = ["complete-condition", "repair-condition"];

test("conditional v1 pins zero, maximum and intermediate programs with hand-calculated results", () => {
  for (const fixture of [
    {
      seed: 0,
      preparation: ["*=", 3],
      threshold: 0,
      operator: "===",
      ifStep: ["+=", 1],
      elseStep: ["+=", 3],
      inputs: [-1, 0, 1],
      prepared: [-3, 0, 3],
      results: [0, 1, 6],
      branches: ["else", "if", "else"],
      repair: "<",
    },
    {
      seed: 1,
      preparation: ["+=", 2],
      threshold: -2,
      operator: "!==",
      ifStep: ["-=", 3],
      elseStep: ["-=", 1],
      inputs: [-4, -5, -3],
      prepared: [-2, -3, -1],
      results: [-3, -6, -4],
      branches: ["else", "if", "if"],
      repair: "<=",
    },
    {
      seed: 4812,
      preparation: ["*=", 2],
      threshold: -10,
      operator: "!==",
      ifStep: ["*=", 3],
      elseStep: ["-=", 3],
      inputs: [-4, -5, -6],
      prepared: [-8, -10, -12],
      results: [-24, -13, -36],
      branches: ["if", "else", "if"],
      repair: "<=",
    },
    {
      seed: 4294967295,
      preparation: ["-=", 2],
      threshold: -5,
      operator: "<",
      ifStep: ["-=", 2],
      elseStep: ["*=", 3],
      inputs: [-4, -3, -2],
      prepared: [-6, -5, -4],
      results: [-8, -15, -12],
      branches: ["if", "else", "else"],
      repair: "!==",
    },
  ]) {
    const program = c.generateConditionalReference(fixture.seed, 1);
    for (const key of ["preparation", "ifStep", "elseStep"]) {
      const step = Reflect.get(program, key);
      assert.deepEqual(
        [step.operator, step.operand],
        Reflect.get(fixture, key),
      );
    }
    assert.equal(program.threshold, fixture.threshold);
    assert.equal(program.operator, fixture.operator);
    assert.deepEqual(program.inputs, fixture.inputs);
    assert.deepEqual(program.results, fixture.results);
    assert.deepEqual(
      program.traces.map((trace) => trace.afterPreparation),
      fixture.prepared,
    );
    assert.deepEqual(
      program.traces.map((trace) => trace.branch),
      fixture.branches,
    );
    assert.equal(
      c.transformConditionalProgram(program, "repair-condition")
        .presentedOperator,
      fixture.repair,
    );
    assert.equal(
      c.transformConditionalProgram(program, "complete-condition")
        .presentedOperator,
      null,
    );
  }
  assert.equal(c.CONDITIONAL_GENERATOR_VERSION, 1);
});

test("all six conditional signatures have fixed boundary expectations, including both branches", () => {
  for (const fixture of [
    {
      seed: 0,
      outputs: [
        [0, 3, 4],
        [0, 1, 4],
        [-2, 3, 6],
        [-2, 1, 6],
        [0, 1, 6],
        [-2, 3, 4],
      ],
    },
    {
      seed: 4294967295,
      outputs: [
        [-18, -15, -6],
        [-18, -7, -6],
        [-8, -15, -12],
        [-8, -7, -12],
        [-18, -7, -12],
        [-8, -15, -6],
      ],
    },
  ])
    for (const kind of kinds) {
      const tactic = c.transformConditionalProgram(
        c.generateConditionalReference(fixture.seed),
        kind,
      );
      c.OPERATORS.forEach((answer, index) => {
        const result = c.evaluateConditionalAnswer(tactic, answer);
        assert.equal(result.status, "valid");
        if (result.status !== "valid")
          throw new Error("Expected a recognized comparison");
        assert.deepEqual(result.produced, fixture.outputs[index]);
        assert.deepEqual(
          result.traces.map((trace) => trace.result),
          fixture.outputs[index],
        );
        assert.equal(
          new Set(result.traces.map((trace) => trace.branch)).size,
          2,
        );
        assert.equal(result.achieved, answer === tactic.reference.operator);
      });
    }
  const result = c.evaluateConditionalAnswer(
    c.transformConditionalProgram(
      c.generateConditionalReference(0),
      "complete-condition",
    ),
    "===",
  );
  assert.deepEqual(result.traces, [
    {
      input: -1,
      afterPreparation: -3,
      comparison: false,
      branch: "else",
      afterBranch: 0,
      result: 0,
    },
    {
      input: 0,
      afterPreparation: 0,
      comparison: true,
      branch: "if",
      afterBranch: 1,
      result: 1,
    },
    {
      input: 1,
      afterPreparation: 3,
      comparison: false,
      branch: "else",
      afterBranch: 6,
      result: 6,
    },
  ]);
});

test("conditional rejects invalid seeds, versions, kinds and comparison answers without coercion", () => {
  for (const seed of [
    -1,
    0.5,
    4294967296,
    NaN,
    Infinity,
    -Infinity,
    "0",
    null,
    undefined,
    true,
    {},
    [],
    0n,
  ])
    assert.throws(() => c.generateConditionalReference(seed), /Seed/);
  for (const version of [0, 2, -1, 1.5, "1", null, NaN, {}])
    assert.throws(() => c.generateConditionalReference(0, version), /Versão/);
  const program = c.generateConditionalReference(0);
  assert.deepEqual(c.generateConditionalReference(-0), program);
  for (const kind of ["complete-step", "repair", "", null, undefined, 1, {}])
    assert.throws(
      () => c.transformConditionalProgram(program, kind),
      /Modalidade/,
    );
  const tactic = c.transformConditionalProgram(program, "complete-condition");
  for (const answer of [
    null,
    undefined,
    {},
    [],
    "==",
    "!=",
    " === ",
    1,
    true,
    ["==="],
    new String("==="),
    "value === 0",
    { toString: () => "===" },
  ])
    assert.deepEqual(c.evaluateConditionalAnswer(tactic, answer), {
      status: "invalid-answer",
      achieved: false,
      produced: null,
      expected: [0, 1, 6],
      traces: null,
    });
});

test("conditional rejects adulterated cases, branch effects, traces, source and identities", () => {
  const program = c.generateConditionalReference(0);
  const tactic = c.transformConditionalProgram(program, "repair-condition");
  const references = [
    { ...program, family: "assignment-sequence" },
    { ...program, generatorVersion: 2 },
    { ...program, generatorVersion: undefined },
    { ...program, seed: 1 },
    { ...program, preparation: { operator: "*=", operand: 0 } },
    { ...program, threshold: 1 },
    { ...program, operator: ">" },
    { ...program, ifStep: program.elseStep },
    { ...program, elseStep: program.ifStep },
    { ...program, inputs: [0, 0, 0] },
    { ...program, inputs: Array(3) },
    { ...program, inputs: [...program.inputs].reverse() },
    {
      ...program,
      traces: program.traces.map((trace) => ({
        ...trace,
        comparison: !trace.comparison,
      })),
    },
    {
      ...program,
      traces: program.traces.map((trace) => ({ ...trace, branch: "if" })),
    },
    {
      ...program,
      traces: program.traces.map((trace) => ({ ...trace, afterBranch: 42 })),
    },
    { ...program, results: [0, 1, 7] },
    { ...program, code: program.code + "calculate(0);" },
    { ...program, extra: true },
  ];
  for (const reference of references)
    assert.throws(() =>
      Reflect.apply(c.transformConditionalProgram, undefined, [
        reference,
        "complete-condition",
      ]),
    );
  const models = [
    null,
    undefined,
    {},
    c.getPublicConditionalTactic(tactic),
    ...references.map((reference) => ({ ...tactic, reference })),
    { ...tactic, identity: { ...tactic.identity, seed: 1 } },
    { ...tactic, identity: { ...tactic.identity, family: "other" } },
    {
      ...tactic,
      identity: { ...tactic.identity, generatorVersion: undefined },
    },
    { ...tactic, identity: { ...tactic.identity, kind: "complete-step" } },
    { ...tactic, presentedOperator: program.operator },
    { ...tactic, presentedOperator: null },
    { ...tactic, presentedOperator: ">" },
    { ...tactic, extra: true },
  ];
  for (const model of models) {
    assert.equal(c.verifyConditionalTactic(model).valid, false);
    for (const answer of c.OPERATORS) {
      const result = c.evaluateConditionalAnswer(model, answer);
      assert.equal(result.status, "invalid-tactic");
      assert.equal(result.achieved, false);
      assert.equal(result.expected, null);
      assert.equal(result.traces, null);
    }
    assert.throws(() =>
      Reflect.apply(c.getPublicConditionalTactic, undefined, [model]),
    );
  }
});

test("conditional public data exposes inputs and goals without the reference operator or trace", () => {
  const program = c.generateConditionalReference(0);
  const complete = c.transformConditionalProgram(program, "complete-condition");
  const repair = c.transformConditionalProgram(program, "repair-condition");
  for (const tactic of [complete, repair]) {
    const view = c.getPublicConditionalTactic(tactic);
    assert.deepEqual(Object.keys(view).sort(), [
      "allowedOperators",
      "code",
      "expectedResults",
      "identity",
      "inputs",
      "objective",
    ]);
    assert.deepEqual(view.inputs, [-1, 0, 1]);
    assert.deepEqual(view.expectedResults, [0, 1, 6]);
    assert.match(view.objective, /\[0, 1, 6\]/);
    assert.match(view.objective, /\[-1, 0, 1\]/);
    assert.deepEqual(
      c.getPublicConditionalTactic(
        c.transformConditionalProgram(
          c.generateConditionalReference(
            view.identity.seed,
            view.identity.generatorVersion,
          ),
          view.identity.kind,
        ),
      ),
      view,
    );
    assert.ok(
      Object.isFrozen(view.inputs) && Object.isFrozen(view.expectedResults),
    );
  }
  assert.deepEqual(complete.reference, repair.reference);
  assert.deepEqual(program, c.generateConditionalReference(0));
});

test("conditional reproduces both modalities and traces in independent processes", () => {
  const script = `const c=require('@bunkercode/tactics-core');process.stdout.write(JSON.stringify([0,4812,4294967295].flatMap(seed=>['complete-condition','repair-condition'].map(kind=>{const t=c.transformConditionalProgram(c.generateConditionalReference(seed,1),kind);return {t,view:c.getPublicConditionalTactic(t),evaluation:c.evaluateConditionalAnswer(t,'>=')}}))));`;
  const run = (/** @type {string} */ timezone) =>
    execFileSync(process.execPath, ["-e", script], {
      cwd: dirname(require.resolve("@bunkercode/tactics-core")),
      env: { ...process.env, TZ: timezone },
      encoding: "utf8",
    });
  assert.equal(run("UTC"), run("America/Recife"));
});

test("10,000 conditional seeds verify both modes, all paths, six signatures and structural diversity", (context) => {
  const structures = new Set();
  const permutations = new Set();
  const branchPatterns = new Set();
  const operators = new Map(c.OPERATORS.map((operator) => [operator, 0]));
  const preparationOps = new Map(
    c.STEP_OPERATORS.map((operator) => [operator, 0]),
  );
  const ifOps = new Map(c.STEP_OPERATORS.map((operator) => [operator, 0]));
  const elseOps = new Map(c.STEP_OPERATORS.map((operator) => [operator, 0]));
  let maxMagnitude = 0;
  let negativeStates = 0;
  for (let seed = 0; seed < 10000; seed++) {
    let mode = "reference";
    try {
      const program = c.generateConditionalReference(seed, 1);
      assert.deepEqual(program, c.generateConditionalReference(seed, 1));
      assert.equal(program.family, "conditional-branch");
      assert.equal(program.generatorVersion, 1);
      assert.equal(program.seed, seed);
      assert.deepEqual(parseConditional(program.code), {
        preparation: program.preparation,
        threshold: program.threshold,
        operator: program.operator,
        ifStep: program.ifStep,
        elseStep: program.elseStep,
      });
      assert.equal(program.inputs.length, 3);
      assert.equal(new Set(program.inputs).size, 3);
      assert.deepEqual(
        program.traces,
        oracleConditional(program, program.operator),
      );
      assert.deepEqual(
        program.results,
        program.traces.map((trace) => trace.result),
      );
      const signs = program.traces.map((trace) =>
        Math.sign(trace.afterPreparation - program.threshold),
      );
      assert.deepEqual([...signs].sort(), [-1, 0, 1]);
      assert.equal(
        new Set(program.traces.map((trace) => trace.branch)).size,
        2,
      );
      for (const trace of program.traces) {
        for (const value of [
          trace.input,
          trace.afterPreparation,
          trace.afterBranch,
          trace.result,
        ]) {
          assert.ok(Number.isSafeInteger(value) && Math.abs(value) <= 1000);
          if (value < 0) negativeStates++;
          maxMagnitude = Math.max(maxMagnitude, Math.abs(value));
        }
        assert.notEqual(
          oracleStep(trace.afterPreparation, program.ifStep),
          oracleStep(trace.afterPreparation, program.elseStep),
        );
        assert.notEqual(trace.afterPreparation, trace.afterBranch);
      }
      for (const step of [
        program.preparation,
        program.ifStep,
        program.elseStep,
      ]) {
        assert.ok(c.STEP_OPERATORS.includes(step.operator));
        assert.ok(
          Number.isInteger(step.operand) &&
            step.operand >= 1 &&
            step.operand <= 3,
        );
        if (step.operator === "*=") assert.ok(step.operand >= 2);
      }
      const signatures = c.OPERATORS.map((operator) =>
        oracleConditional(program, operator).map((trace) => trace.result),
      );
      assert.equal(
        new Set(signatures.map((signature) => JSON.stringify(signature))).size,
        6,
      );
      const complete = c.transformConditionalProgram(
        program,
        "complete-condition",
      );
      const repair = c.transformConditionalProgram(program, "repair-condition");
      assert.deepEqual(complete.reference, repair.reference);
      for (const tactic of [complete, repair]) {
        mode = tactic.identity.kind;
        const view = c.getPublicConditionalTactic(tactic);
        assert.deepEqual(
          tactic,
          c.transformConditionalProgram(
            c.generateConditionalReference(seed, 1),
            tactic.identity.kind,
          ),
        );
        assert.deepEqual(tactic.identity, {
          family: "conditional-branch",
          generatorVersion: 1,
          seed,
          kind: tactic.identity.kind,
        });
        assert.deepEqual(c.verifyConditionalTactic(tactic), { valid: true });
        assert.deepEqual(view.identity, tactic.identity);
        assert.deepEqual(view.inputs, program.inputs);
        assert.deepEqual(view.expectedResults, program.results);
        assert.deepEqual(view.allowedOperators, c.OPERATORS);
        if (tactic.presentedOperator === null)
          assert.equal(
            view.code,
            program.code.replace(`value ${program.operator} `, "value ___ "),
          );
        else {
          assert.notEqual(tactic.presentedOperator, program.operator);
          assert.deepEqual(parseConditional(view.code), {
            preparation: program.preparation,
            threshold: program.threshold,
            operator: tactic.presentedOperator,
            ifStep: program.ifStep,
            elseStep: program.elseStep,
          });
          const incorrect = c.evaluateConditionalAnswer(
            tactic,
            tactic.presentedOperator,
          );
          assert.equal(incorrect.status, "valid");
          assert.equal(incorrect.achieved, false);
          assert.notDeepEqual(incorrect.produced, program.results);
        }
        let approvals = 0;
        c.OPERATORS.forEach((answer, index) => {
          const result = c.evaluateConditionalAnswer(tactic, answer);
          assert.equal(result.status, "valid");
          assert.deepEqual(result.produced, signatures[index]);
          assert.deepEqual(result.expected, program.results);
          assert.deepEqual(result.traces, oracleConditional(program, answer));
          assert.equal(result.achieved, answer === program.operator);
          if (result.achieved) approvals++;
        });
        assert.equal(approvals, 1);
      }
      structures.add(
        [
          program.preparation.operator,
          program.operator,
          program.ifStep.operator,
          program.elseStep.operator,
        ].join(","),
      );
      permutations.add(signs.join(","));
      branchPatterns.add(program.traces.map((trace) => trace.branch).join(","));
      operators.set(
        program.operator,
        (operators.get(program.operator) ?? 0) + 1,
      );
      for (const { step, counts } of [
        { step: program.preparation, counts: preparationOps },
        { step: program.ifStep, counts: ifOps },
        { step: program.elseStep, counts: elseOps },
      ]) {
        counts.set(step.operator, (counts.get(step.operator) ?? 0) + 1);
      }
    } catch (error) {
      throw new Error(
        `family=conditional-branch version=1 seed=${seed} kind=${mode}`,
        { cause: error },
      );
    }
  }
  assert.equal(permutations.size, 6);
  assert.equal(branchPatterns.size, 6);
  for (const map of [operators, preparationOps, ifOps, elseOps])
    for (const count of map.values()) assert.ok(count > 0);
  assert.ok(negativeStates > 0);
  context.diagnostic(
    JSON.stringify({
      family: "conditional-branch",
      seeds: 10000,
      tactics: 20000,
      structures: structures.size,
      permutations: permutations.size,
      branchPatterns: branchPatterns.size,
      operators: Object.fromEntries(operators),
      preparationOps: Object.fromEntries(preparationOps),
      ifOps: Object.fromEntries(ifOps),
      elseOps: Object.fromEntries(elseOps),
      totalArithmeticSteps: 30000,
      negativeStates,
      maxMagnitude,
    }),
  );
});
