const assert = require("node:assert/strict");
const { test } = require("node:test");
const { execFileSync } = require("node:child_process");
const { dirname } = require("node:path");
const c = require("@bunkercode/tactics-core");
const { oracleAssignment, parseAssignment } = require("./helpers.cjs");
/** @type {readonly import("../dist").AssignmentKind[]} */
const kinds = ["complete-step", "repair-step"];

test("assignment v1 pins zero, maximum and intermediate seeds with hand-calculated states", () => {
  for (const fixture of [
    {
      seed: 0,
      initial: -6,
      steps: [
        ["+=", 1],
        ["-=", 2],
        ["-=", 2],
      ],
      states: [-5, -7, -9],
      gap: 0,
    },
    {
      seed: 1,
      initial: -7,
      steps: [
        ["-=", 1],
        ["-=", 3],
      ],
      states: [-8, -11],
      gap: 1,
    },
    {
      seed: 4812,
      initial: 8,
      steps: [
        ["-=", 1],
        ["*=", 3],
        ["*=", 2],
      ],
      states: [7, 21, 42],
      gap: 2,
    },
    {
      seed: 4294967295,
      initial: 9,
      steps: [
        ["+=", 1],
        ["-=", 2],
        ["*=", 3],
        ["*=", 3],
      ],
      states: [10, 8, 24, 72],
      gap: 0,
    },
  ]) {
    const program = c.generateAssignmentReference(fixture.seed, 1);
    assert.equal(program.initial, fixture.initial);
    assert.deepEqual(
      program.steps.map((step) => [step.operator, step.operand]),
      fixture.steps,
    );
    assert.deepEqual(
      program.trace.transitions.map((transition) => transition.after),
      fixture.states,
    );
    assert.equal(program.trace.result, fixture.states.at(-1));
    for (const kind of kinds)
      assert.equal(
        c.transformAssignmentProgram(program, kind).stepIndex,
        fixture.gap,
      );
  }
  assert.equal(c.ASSIGNMENT_GENERATOR_VERSION, 1);
  assert.deepEqual(c.STEP_OPERATORS, ["+=", "-=", "*="]);
});

test("assignment evaluates the entire suffix and returns the selected answer's complete trace", () => {
  const program = c.generateAssignmentReference(4294967295);
  const tactic = c.transformAssignmentProgram(program, "repair-step");
  assert.deepEqual(tactic.alternatives, [
    { operator: "*=", operand: 3 },
    { operator: "+=", operand: 1 },
    { operator: "+=", operand: 2 },
  ]);
  const states = [
    [27, 25, 75, 225],
    [10, 8, 24, 72],
    [11, 9, 27, 81],
  ];
  tactic.alternatives.forEach((step, index) => {
    const result = c.evaluateAssignmentAnswer(tactic, step);
    assert.equal(result.status, "valid");
    if (result.status !== "valid")
      throw new Error("Expected a recognized instruction");
    assert.deepEqual(
      result.trace.transitions.map((transition) => transition.after),
      states[index],
    );
    assert.equal(result.produced, states[index]?.at(-1));
    assert.equal(result.expected, 72);
    assert.equal(result.achieved, index === 1);
  });
});

test("assignment rejects invalid seeds, versions, kinds and incompatible or unavailable instructions", () => {
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
    assert.throws(() => c.generateAssignmentReference(seed), /Seed/);
  for (const version of [0, 2, -1, 1.5, "1", null, NaN, {}])
    assert.throws(() => c.generateAssignmentReference(0, version), /Versão/);
  const reference = c.generateAssignmentReference(0);
  for (const kind of [
    "complete-condition",
    "repair",
    "",
    null,
    undefined,
    1,
    {},
  ])
    assert.throws(
      () => c.transformAssignmentProgram(reference, kind),
      /Modalidade/,
    );
  assert.deepEqual(c.generateAssignmentReference(-0), reference);
  const tactic = c.transformAssignmentProgram(reference, "complete-step");
  for (const answer of [
    null,
    undefined,
    {},
    [],
    "+= 1",
    1,
    true,
    { operator: "*=", operand: 0 },
    { operator: "*=", operand: 1 },
    { operator: "/=", operand: 1 },
    { operator: "+=", operand: "1" },
    { operator: "+=", operand: NaN },
    { operator: "+=", operand: 1, extra: true },
    { operator: "*=", operand: 2 },
    Object.create({ operator: "+=", operand: 1 }),
  ]) {
    assert.deepEqual(c.evaluateAssignmentAnswer(tactic, answer), {
      status: "invalid-answer",
      achieved: false,
      produced: null,
      expected: -9,
      trace: null,
    });
  }
});

test("assignment refuses every tampered reference field, identity, options and trace", () => {
  const program = c.generateAssignmentReference(0);
  const tactic = c.transformAssignmentProgram(program, "repair-step");
  const references = [
    { ...program, family: "conditional-branch" },
    { ...program, generatorVersion: 2 },
    { ...program, generatorVersion: undefined },
    { ...program, seed: 1 },
    { ...program, initial: 0 },
    { ...program, steps: [] },
    { ...program, steps: Array(3) },
    {
      ...program,
      steps: [{ operator: "*=", operand: 0 }, ...program.steps.slice(1)],
    },
    { ...program, trace: { ...program.trace, result: 1 } },
    {
      ...program,
      trace: {
        ...program.trace,
        transitions: program.trace.transitions.map((item) => ({
          ...item,
          after: 0,
        })),
      },
    },
    { ...program, code: program.code + "value += 100;" },
    { ...program, extra: true },
  ];
  for (const reference of references)
    assert.throws(() =>
      Reflect.apply(c.transformAssignmentProgram, undefined, [
        reference,
        "complete-step",
      ]),
    );
  const models = [
    null,
    undefined,
    {},
    c.getPublicAssignmentTactic(tactic),
    ...references.map((reference) => ({ ...tactic, reference })),
    { ...tactic, identity: { ...tactic.identity, seed: 1 } },
    { ...tactic, identity: { ...tactic.identity, kind: "complete-condition" } },
    {
      ...tactic,
      identity: { ...tactic.identity, generatorVersion: undefined },
    },
    { ...tactic, identity: { ...tactic.identity, family: "other" } },
    { ...tactic, stepIndex: 2 },
    { ...tactic, alternatives: [...tactic.alternatives].reverse() },
    {
      ...tactic,
      alternatives: [
        tactic.alternatives[0],
        tactic.alternatives[0],
        tactic.alternatives[0],
      ],
    },
    { ...tactic, presentedStep: program.steps[tactic.stepIndex] },
    { ...tactic, presentedStep: null },
    { ...tactic, extra: true },
  ];
  for (const model of models) {
    assert.equal(c.verifyAssignmentTactic(model).valid, false);
    for (const answer of tactic.alternatives) {
      const evaluation = c.evaluateAssignmentAnswer(model, answer);
      assert.equal(evaluation.status, "invalid-tactic");
      assert.equal(evaluation.achieved, false);
      assert.equal(evaluation.expected, null);
      assert.equal(evaluation.trace, null);
    }
    assert.throws(() =>
      Reflect.apply(c.getPublicAssignmentTactic, undefined, [model]),
    );
  }
});

test("assignment public representation has options and goal without revealing reference trace", () => {
  const program = c.generateAssignmentReference(0);
  const complete = c.transformAssignmentProgram(program, "complete-step");
  const repair = c.transformAssignmentProgram(program, "repair-step");
  for (const tactic of [complete, repair]) {
    const view = c.getPublicAssignmentTactic(tactic);
    assert.deepEqual(Object.keys(view).sort(), [
      "alternatives",
      "code",
      "expectedResult",
      "identity",
      "objective",
      "stepIndex",
    ]);
    assert.equal(view.expectedResult, -9);
    assert.equal(view.stepIndex, 0);
    assert.match(view.objective, /-9/);
    assert.deepEqual(
      c.getPublicAssignmentTactic(
        c.transformAssignmentProgram(
          c.generateAssignmentReference(
            view.identity.seed,
            view.identity.generatorVersion,
          ),
          view.identity.kind,
        ),
      ),
      view,
    );
    assert.ok(
      Object.isFrozen(view.alternatives) &&
        Object.isFrozen(view.alternatives[0]),
    );
  }
  assert.deepEqual(complete.reference, repair.reference);
  assert.deepEqual(complete.alternatives, repair.alternatives);
  assert.deepEqual(program, c.generateAssignmentReference(0));
});

test("assignment reproduces references, options and evaluations in independent processes", () => {
  const script = `const c=require('@bunkercode/tactics-core');process.stdout.write(JSON.stringify([0,4812,4294967295].flatMap(seed=>['complete-step','repair-step'].map(kind=>{const t=c.transformAssignmentProgram(c.generateAssignmentReference(seed,1),kind);return {t,view:c.getPublicAssignmentTactic(t),evaluation:c.evaluateAssignmentAnswer(t,t.alternatives[0])}}))));`;
  const run = (/** @type {string} */ timezone) =>
    execFileSync(process.execPath, ["-e", script], {
      cwd: dirname(require.resolve("@bunkercode/tactics-core")),
      env: { ...process.env, TZ: timezone },
      encoding: "utf8",
    });
  assert.equal(run("UTC"), run("America/Recife"));
});

test("10,000 assignment seeds verify both modes, full traces, unique answers and structural diversity", (context) => {
  const lengths = new Map();
  const positions = new Map();
  const structures = new Set();
  const gapStructures = new Set();
  const operators = new Map(c.STEP_OPERATORS.map((operator) => [operator, 0]));
  const operands = new Set();
  const initialValues = new Set();
  let negativeStates = 0;
  let totalSteps = 0;
  let maxMagnitude = 0;
  for (let seed = 0; seed < 10000; seed++) {
    let mode = "reference";
    try {
      const program = c.generateAssignmentReference(seed, 1);
      assert.deepEqual(program, c.generateAssignmentReference(seed, 1));
      assert.equal(program.family, "assignment-sequence");
      assert.equal(program.generatorVersion, 1);
      assert.equal(program.seed, seed);
      assert.ok(program.steps.length >= 2 && program.steps.length <= 4);
      assert.deepEqual(
        program.trace,
        oracleAssignment(program.initial, program.steps),
      );
      assert.deepEqual(parseAssignment(program.code), {
        initial: program.initial,
        steps: program.steps,
      });
      assert.ok(program.initial >= -9 && program.initial <= 9);
      for (const transition of program.trace.transitions) {
        assert.notEqual(transition.before, transition.after);
        assert.ok(
          Number.isSafeInteger(transition.after) &&
            Math.abs(transition.after) <= 1000,
        );
        assert.ok(c.STEP_OPERATORS.includes(transition.step.operator));
        assert.ok(
          Number.isInteger(transition.step.operand) &&
            transition.step.operand >= 1 &&
            transition.step.operand <= 3,
        );
        if (transition.step.operator === "*=")
          assert.ok(transition.step.operand >= 2);
        if (transition.after < 0) negativeStates++;
        maxMagnitude = Math.max(maxMagnitude, Math.abs(transition.after));
      }
      const complete = c.transformAssignmentProgram(program, "complete-step");
      const repair = c.transformAssignmentProgram(program, "repair-step");
      assert.deepEqual(complete.reference, repair.reference);
      assert.deepEqual(complete.alternatives, repair.alternatives);
      assert.equal(complete.stepIndex, repair.stepIndex);
      for (const tactic of [complete, repair]) {
        mode = tactic.identity.kind;
        const view = c.getPublicAssignmentTactic(tactic);
        assert.deepEqual(
          tactic,
          c.transformAssignmentProgram(
            c.generateAssignmentReference(seed, 1),
            tactic.identity.kind,
          ),
        );
        assert.deepEqual(tactic.identity, {
          family: "assignment-sequence",
          generatorVersion: 1,
          seed,
          kind: tactic.identity.kind,
        });
        assert.deepEqual(c.verifyAssignmentTactic(tactic), { valid: true });
        assert.deepEqual(view.identity, tactic.identity);
        assert.equal(view.stepIndex, tactic.stepIndex);
        assert.equal(view.expectedResult, program.trace.result);
        assert.deepEqual(view.alternatives, tactic.alternatives);
        assert.equal(tactic.alternatives.length, 3);
        assert.ok(
          tactic.stepIndex >= 0 && tactic.stepIndex < program.steps.length,
        );
        const sourceLines = program.code.split("\n");
        const presentedLines = view.code.split("\n");
        assert.equal(sourceLines.length, presentedLines.length);
        sourceLines.forEach((line, index) => {
          if (index !== 2 + tactic.stepIndex)
            assert.equal(presentedLines[index], line);
        });
        if (tactic.presentedStep === null)
          assert.equal(presentedLines[2 + tactic.stepIndex], "___;");
        else {
          const parsed = parseAssignment(view.code);
          assert.deepEqual(
            parsed.steps[tactic.stepIndex],
            tactic.presentedStep,
          );
          assert.notDeepEqual(
            tactic.presentedStep,
            program.steps[tactic.stepIndex],
          );
          const wrong = c.evaluateAssignmentAnswer(
            tactic,
            tactic.presentedStep,
          );
          assert.equal(wrong.status, "valid");
          assert.equal(wrong.achieved, false);
        }
        const outputs = [];
        let approvals = 0;
        for (const answer of view.alternatives) {
          const chosen = program.steps.map((step, index) =>
            index === tactic.stepIndex ? answer : step,
          );
          const expectedTrace = oracleAssignment(program.initial, chosen);
          const result = c.evaluateAssignmentAnswer(tactic, answer);
          assert.equal(result.status, "valid");
          assert.deepEqual(result.trace, expectedTrace);
          assert.equal(result.produced, expectedTrace.result);
          assert.equal(result.expected, program.trace.result);
          assert.equal(
            result.achieved,
            expectedTrace.result === program.trace.result,
          );
          for (const transition of expectedTrace.transitions)
            assert.ok(
              Number.isSafeInteger(transition.after) &&
                Math.abs(transition.after) <= 1000,
            );
          outputs.push(result.produced);
          if (result.achieved) approvals++;
        }
        assert.equal(approvals, 1);
        assert.equal(new Set(outputs).size, 3);
      }
      const shape = program.steps.map((step) => step.operator).join(",");
      structures.add(shape);
      gapStructures.add(`${shape}@${complete.stepIndex}`);
      lengths.set(
        program.steps.length,
        (lengths.get(program.steps.length) ?? 0) + 1,
      );
      const position = `${program.steps.length}:${complete.stepIndex}`;
      positions.set(position, (positions.get(position) ?? 0) + 1);
      for (const step of program.steps) {
        operators.set(step.operator, (operators.get(step.operator) ?? 0) + 1);
        operands.add(`${step.operator}${step.operand}`);
      }
      initialValues.add(program.initial);
      totalSteps += program.steps.length;
    } catch (error) {
      throw new Error(
        `family=assignment-sequence version=1 seed=${seed} kind=${mode}`,
        { cause: error },
      );
    }
  }
  assert.deepEqual([...lengths.keys()].sort(), [2, 3, 4]);
  for (const length of [2, 3, 4])
    for (let position = 0; position < length; position++)
      assert.ok(positions.has(`${length}:${position}`));
  assert.equal(initialValues.size, 19);
  assert.equal(operands.size, 8);
  assert.ok(negativeStates > 0);
  for (const count of operators.values()) assert.ok(count > 0);
  // Each length must vary its operation order; this is not a textual uniqueness quota.
  for (const length of [2, 3, 4])
    assert.ok(
      [...structures].filter((shape) => shape.split(",").length === length)
        .length > 1,
    );
  context.diagnostic(
    JSON.stringify({
      family: "assignment-sequence",
      seeds: 10000,
      tactics: 20000,
      structures: structures.size,
      gapStructures: gapStructures.size,
      lengths: Object.fromEntries(lengths),
      positions: Object.fromEntries(positions),
      operators: Object.fromEntries(operators),
      instructionVariants: operands.size,
      totalSteps,
      initialValues: initialValues.size,
      negativeStates,
      maxMagnitude,
    }),
  );
});
