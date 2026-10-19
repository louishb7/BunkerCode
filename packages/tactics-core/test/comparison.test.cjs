const assert = require("node:assert/strict");
const { test } = require("node:test");
const { execFileSync } = require("node:child_process");
const { dirname } = require("node:path");
const ts = require("typescript");
// Self-reference exercises the package's actual exports, not a source-only alias.
const {
  OPERATORS,
  GENERATOR_VERSION,
  generateReference,
  transformProgram,
  getPublicTactic,
  evaluateAnswer,
  verifyTactic,
} = require("@bunkercode/tactics-core");
const { nextRandom } = require("../dist/random.js");

/** @type {readonly import("../dist").TacticKind[]} */
const kinds = ["complete-operator", "repair-operator"];

/** Parse only: the generated source is never executed, including in tests.
 * @param {string} code */
function parseProgram(code) {
  const filename = "/generated.js";
  const file = ts.createSourceFile(
    filename,
    code,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.JS,
  );
  const options = { allowJs: true, noLib: true, noResolve: true, types: [] };
  /** @type {import("typescript").CompilerHost} */
  const host = {
    getSourceFile: (name) => (name === filename ? file : undefined),
    getDefaultLibFileName: () => "",
    writeFile: () => {
      throw new Error("Parsing must not emit code");
    },
    getCurrentDirectory: () => "/",
    getDirectories: () => [],
    fileExists: (name) => name === filename,
    readFile: (name) => (name === filename ? code : undefined),
    getCanonicalFileName: (name) => name,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
  };
  const program = ts.createProgram([filename], options, host);
  assert.deepEqual(
    program.getSyntacticDiagnostics(file).map((item) => item.messageText),
    [],
  );
  return file;
}

/** @param {import("typescript").Expression} expression */
function numericValue(expression) {
  if (ts.isNumericLiteral(expression)) return Number(expression.text);
  assert.ok(ts.isPrefixUnaryExpression(expression));
  assert.equal(expression.operator, ts.SyntaxKind.MinusToken);
  assert.ok(ts.isNumericLiteral(expression.operand));
  return -Number(expression.operand.text);
}

/** Inspect the actual AST to catch valid-but-wrong rendering.
 * @param {string} code
 * @param {import("../dist").ComparisonProgram} reference
 * @param {import("../dist").Operator} operator */
function assertProgram(code, reference, operator) {
  const file = parseProgram(code);
  assert.equal(file.statements.length, 2);
  const [valuesStatement, resultStatement] = file.statements;
  assert.ok(valuesStatement && ts.isVariableStatement(valuesStatement));
  assert.ok(resultStatement && ts.isVariableStatement(resultStatement));
  assert.equal(
    valuesStatement.declarationList.flags & ts.NodeFlags.Const,
    ts.NodeFlags.Const,
  );
  assert.equal(
    resultStatement.declarationList.flags & ts.NodeFlags.Const,
    ts.NodeFlags.Const,
  );
  const values = valuesStatement.declarationList.declarations[0];
  const result = resultStatement.declarationList.declarations[0];
  assert.ok(values && result);
  assert.equal(values.name.getText(file), "values");
  assert.equal(result.name.getText(file), "result");
  assert.ok(
    values.initializer && ts.isArrayLiteralExpression(values.initializer),
  );
  assert.deepEqual(
    values.initializer.elements.map(numericValue),
    reference.values,
  );
  const call = result.initializer;
  assert.ok(call && ts.isCallExpression(call));
  assert.equal(call.expression.getText(file), "values.filter");
  assert.equal(call.arguments.length, 1);
  const arrow = call.arguments[0];
  assert.ok(arrow && ts.isArrowFunction(arrow));
  assert.equal(arrow.parameters.length, 1);
  assert.equal(arrow.parameters[0]?.name.getText(file), "value");
  const body = arrow.body;
  assert.ok(ts.isBinaryExpression(body));
  assert.equal(body.left.getText(file), "value");
  assert.equal(body.operatorToken.getText(file), operator);
  assert.equal(numericValue(body.right), reference.threshold);
}

test("Mulberry32 uint32 sequence is pinned for zero and maximum seeds", () => {
  for (const { seed, expected } of [
    {
      seed: 0,
      expected: [
        1144304738, 1416247, 958946056, 627933444, 2007157716, 2340967985,
      ],
    },
    {
      seed: 4294967295,
      expected: [
        3850105811, 813802916, 3073704848, 4054706436, 3630262831, 2315588663,
      ],
    },
  ]) {
    assert.equal(typeof seed, "number");
    assert.ok(Array.isArray(expected));
    let state = seed;
    const actual = [];
    for (let index = 0; index < expected.length; index++) {
      const next = nextRandom(state);
      state = next[0];
      actual.push(next[1]);
    }
    assert.deepEqual(actual, expected);
  }
});

test("fixed reference and transformation fixtures preserve generator version 1", () => {
  for (const fixture of [
    {
      seed: 0,
      values: [9, 7, 4],
      threshold: 7,
      operator: ">",
      result: [9],
      repair: "!==",
    },
    {
      seed: 1,
      values: [3, 6, -1],
      threshold: 3,
      operator: "!==",
      result: [6, -1],
      repair: "<=",
    },
    {
      seed: 4812,
      values: [3, 1, 5],
      threshold: 3,
      operator: ">=",
      result: [3, 5],
      repair: "<",
    },
    {
      seed: 4294967295,
      values: [8, 14, 10],
      threshold: 10,
      operator: ">",
      result: [14],
      repair: "<=",
    },
  ]) {
    const reference = generateReference(fixture.seed, 1);
    assert.deepEqual(reference, {
      family: "comparison-boundaries",
      generatorVersion: 1,
      seed: fixture.seed,
      values: fixture.values,
      threshold: fixture.threshold,
      operator: fixture.operator,
      result: fixture.result,
      code: `const values = [${fixture.values.join(", ")}];\n\nconst result = values.filter(\n  value => value ${fixture.operator} ${fixture.threshold}\n);\n`,
    });
    assert.equal(
      transformProgram(reference, "repair-operator").presentedOperator,
      fixture.repair,
    );
    assert.equal(
      transformProgram(reference, "complete-operator").presentedOperator,
      null,
    );
  }
  assert.equal(GENERATOR_VERSION, 1);
});

test("hand-calculated boundary outputs cover all six operators and keep input order", () => {
  for (const { seed, outputs } of [
    { seed: 0, outputs: [[9], [9, 7], [4], [7, 4], [7], [9, 4]] },
    {
      seed: 4294967295,
      outputs: [[14], [14, 10], [8], [8, 10], [10], [8, 14]],
    },
  ]) {
    assert.equal(typeof seed, "number");
    assert.ok(Array.isArray(outputs));
    for (const kind of kinds) {
      const tactic = transformProgram(generateReference(seed), kind);
      OPERATORS.forEach((operator, index) => {
        const evaluation = evaluateAnswer(tactic, operator);
        assert.equal(evaluation.status, "valid");
        assert.deepEqual(evaluation.produced, outputs[index]);
        assert.deepEqual(evaluation.expected, [seed === 0 ? 9 : 14]);
        assert.equal(evaluation.achieved, operator === ">");
      });
    }
  }
});

test("invalid seeds, versions and kinds are refused without coercion", () => {
  for (const seed of [
    -1,
    0.5,
    4294967296,
    Number.MAX_SAFE_INTEGER,
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
    assert.throws(() => generateReference(seed), /Seed/);
  for (const version of [0, 2, -1, 1.5, "1", null, NaN, Infinity, {}])
    assert.throws(() => generateReference(0, version), /Versão/);
  for (const kind of ["repair", "", null, undefined, 1, {}])
    assert.throws(
      () => transformProgram(generateReference(0), kind),
      /Modalidade/,
    );
  assert.deepEqual(generateReference(-0), generateReference(0));
  for (const seed of [0, 4294967295, 2147483648, 305419896, 3735928559])
    assert.equal(generateReference(seed).seed, seed);
});

test("incompatible answers never approve, including code, boxed strings and coercible objects", () => {
  const tactic = transformProgram(generateReference(0), "complete-operator");
  for (const answer of [
    null,
    undefined,
    true,
    0,
    {},
    [],
    [">"],
    "",
    "==",
    "!=",
    " > ",
    "value > 7",
    ">; globalThis.x = 1",
    new String(">"),
    { toString: () => ">" },
  ]) {
    assert.deepEqual(evaluateAnswer(tactic, answer), {
      status: "invalid-answer",
      achieved: false,
      produced: null,
      expected: [9],
    });
  }
});

test("tampered references, identities and transformations fail closed", () => {
  const reference = generateReference(0);
  const tactic = transformProgram(reference, "repair-operator");
  const references = [
    { ...reference, family: "other" },
    { ...reference, generatorVersion: 2 },
    { ...reference, generatorVersion: undefined },
    { ...reference, seed: 1 },
    { ...reference, values: [9, 7, 7] },
    { ...reference, values: Array(3) },
    { ...reference, threshold: 8 },
    { ...reference, operator: "==" },
    { ...reference, result: [] },
    { ...reference, code: reference.code + "globalThis.x = 1;" },
    { ...reference, extra: true },
  ];
  for (const changed of references) {
    assert.throws(() =>
      Reflect.apply(transformProgram, undefined, [
        changed,
        "complete-operator",
      ]),
    );
  }
  const invalid = [
    null,
    undefined,
    {},
    getPublicTactic(tactic),
    ...references.map((changed) => ({ ...tactic, reference: changed })),
    { ...tactic, identity: { ...tactic.identity, kind: "other" } },
    { ...tactic, identity: { ...tactic.identity, family: "other" } },
    { ...tactic, identity: { ...tactic.identity, generatorVersion: 2 } },
    { ...tactic, identity: { ...tactic.identity, seed: 1 } },
    { ...tactic, presentedOperator: reference.operator },
    { ...tactic, presentedOperator: "<" },
    { ...tactic, presentedOperator: null },
    { ...tactic, extra: true },
  ];
  for (const changed of invalid) {
    assert.equal(verifyTactic(changed).valid, false);
    for (const operator of OPERATORS) {
      const result = evaluateAnswer(changed, operator);
      assert.equal(result.status, "invalid-tactic");
      assert.equal(result.achieved, false);
      assert.equal(result.expected, null);
    }
  }
});

test("public payloads omit the reference and can be reproduced by their identity", () => {
  const reference = generateReference(4812);
  for (const kind of kinds) {
    const tactic = transformProgram(reference, kind);
    const view = getPublicTactic(tactic);
    assert.deepEqual(Object.keys(view).sort(), [
      "allowedOperators",
      "code",
      "expectedResult",
      "identity",
      "objective",
    ]);
    assert.deepEqual(view.expectedResult, [3, 5]);
    assert.deepEqual(view.allowedOperators, [
      ">",
      ">=",
      "<",
      "<=",
      "===",
      "!==",
    ]);
    assert.match(view.objective, /\[3, 5\]/);
    const replay = transformProgram(
      generateReference(view.identity.seed, view.identity.generatorVersion),
      view.identity.kind,
    );
    assert.deepEqual(getPublicTactic(replay), view);
    assert.ok(Object.isFrozen(reference.values));
    assert.ok(Object.isFrozen(view.allowedOperators));
    assert.ok(Object.isFrozen(tactic.identity));
  }
});

test("independent processes, timezones and intervening calls reproduce identical exercises", () => {
  const script = `const c = require('@bunkercode/tactics-core');
    const seeds = [0, 1, 4812, 4294967295];
    process.stdout.write(JSON.stringify(seeds.flatMap(seed =>
      ['complete-operator', 'repair-operator'].map(kind =>
        c.getPublicTactic(c.transformProgram(c.generateReference(seed, 1), kind))))));`;
  const run = (/** @type {string} */ timezone) =>
    execFileSync(process.execPath, ["-e", script], {
      cwd: dirname(require.resolve("@bunkercode/tactics-core")),
      env: { ...process.env, TZ: timezone },
      encoding: "utf8",
    });
  const before = generateReference(4812);
  for (let seed = 10; seed < 100; seed++)
    transformProgram(generateReference(seed), "repair-operator");
  assert.deepEqual(generateReference(4812), before);
  assert.equal(run("UTC"), run("America/Recife"));
  assert.equal(run("UTC"), run("Asia/Tokyo"));
});

// Independent category oracle: allowed signs, instead of reimplementing comparisons.
const categorySets = [[1], [0, 1], [-1], [-1, 0], [0], [-1, 1]];
for (const kind of kinds) {
  test(`10,000 deterministic seeds preserve integrity, uniqueness and diversity: ${kind}`, (context) => {
    const texts = new Set();
    const numericValues = new Set();
    const thresholds = new Set();
    const permutations = new Set();
    const operators = new Map(OPERATORS.map((operator) => [operator, 0]));
    for (let seed = 0; seed < 10000; seed++) {
      try {
        const reference = generateReference(seed, 1);
        const tactic = transformProgram(reference, kind);
        const view = getPublicTactic(tactic);
        assert.deepEqual(tactic.identity, {
          family: "comparison-boundaries",
          generatorVersion: 1,
          seed,
          kind,
        });
        assert.deepEqual(reference, generateReference(seed, 1));
        assert.deepEqual(
          tactic,
          transformProgram(generateReference(seed, 1), kind),
        );
        assert.deepEqual(
          transformProgram(
            reference,
            kind === "complete-operator"
              ? "repair-operator"
              : "complete-operator",
          ).reference,
          reference,
        );
        assert.equal(reference.values.length, 3);
        assert.equal(new Set(reference.values).size, 3);
        assert.ok(
          Number.isInteger(reference.threshold) &&
            reference.threshold >= -10 &&
            reference.threshold <= 10,
        );
        assert.ok(
          reference.values.every(
            (number) =>
              Number.isInteger(number) && number >= -15 && number <= 15,
          ),
        );
        const signs = reference.values.map((number) =>
          Math.sign(number - reference.threshold),
        );
        assert.deepEqual([...signs].sort(), [-1, 0, 1]);
        const outputs = categorySets.map((categories) =>
          reference.values.filter((_number, index) =>
            categories.includes(signs[index] ?? NaN),
          ),
        );
        assert.equal(
          new Set(outputs.map((output) => JSON.stringify(output))).size,
          6,
        );
        assert.deepEqual(
          reference.result,
          outputs[OPERATORS.indexOf(reference.operator)],
        );
        assertProgram(reference.code, reference, reference.operator);
        assert.deepEqual(verifyTactic(tactic), { valid: true });
        assert.deepEqual(view.identity, tactic.identity);
        assert.deepEqual(view.allowedOperators, OPERATORS);
        assert.deepEqual(view.expectedResult, reference.result);
        assert.ok(view.objective.includes(`[${reference.result.join(", ")}]`));
        if (kind === "complete-operator") {
          assert.equal(
            view.code,
            reference.code.replace(
              `value ${reference.operator} `,
              "value ___ ",
            ),
          );
        } else {
          assert.ok(tactic.presentedOperator !== null);
          assert.notEqual(tactic.presentedOperator, reference.operator);
          assertProgram(view.code, reference, tactic.presentedOperator);
          assert.notDeepEqual(
            outputs[OPERATORS.indexOf(tactic.presentedOperator)],
            reference.result,
          );
        }
        let accepted = 0;
        OPERATORS.forEach((operator, index) => {
          const evaluation = evaluateAnswer(tactic, operator);
          assert.equal(evaluation.status, "valid");
          assert.deepEqual(evaluation.produced, outputs[index]);
          assert.deepEqual(evaluation.expected, reference.result);
          assert.equal(evaluation.achieved, operator === reference.operator);
          if (evaluation.achieved) accepted++;
        });
        assert.equal(accepted, 1);
        texts.add(reference.code);
        reference.values.forEach((value) => numericValues.add(value));
        thresholds.add(reference.threshold);
        permutations.add(signs.join(","));
        operators.set(
          reference.operator,
          (operators.get(reference.operator) ?? 0) + 1,
        );
      } catch (error) {
        throw new Error(
          `family=comparison-boundaries version=1 seed=${seed} kind=${kind}`,
          { cause: error },
        );
      }
    }
    assert.equal(numericValues.size, 31);
    assert.equal(thresholds.size, 21);
    assert.equal(permutations.size, 6);
    assert.ok(
      texts.size >= 1000,
      `Degenerate generator: only ${texts.size} distinct programs`,
    );
    for (const count of operators.values()) assert.ok(count > 100);
    context.diagnostic(
      JSON.stringify({
        kind,
        seeds: 10000,
        uniquePrograms: texts.size,
        numericValues: numericValues.size,
        thresholds: thresholds.size,
        permutations: permutations.size,
        operators: Object.fromEntries(operators),
      }),
    );
  });
}
