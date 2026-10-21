const assert = require("node:assert/strict");
const { test } = require("node:test");
const { execFileSync } = require("node:child_process");
const ts = require("typescript");
const { dirname } = require("node:path");
const c = require("@bunkercode/tactics-core");

/** @template T @param {readonly T[]} items @returns {T[][]} */
function permutations(items) {
  if (items.length === 0) return [[]];
  return items.flatMap((item, i) =>
    permutations(items.filter((_other, j) => j !== i)).map((rest) => [
      item,
      ...rest,
    ]),
  );
}
/** Parse, never execute. Extract actual binding references from the rendered JS.
 * @param {import('../dist').CollectionProgram} program */
function syntaxAndDependencies(program) {
  const path = "/collection.js";
  const file = ts.createSourceFile(
    path,
    program.code,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.JS,
  );
  /** @type {import('typescript').CompilerHost} */
  const host = {
    getSourceFile: (name) => (name === path ? file : undefined),
    getDefaultLibFileName: () => "",
    writeFile: () => assert.fail("No emit"),
    getCurrentDirectory: () => "/",
    getDirectories: () => [],
    fileExists: (name) => name === path,
    readFile: (name) => (name === path ? program.code : undefined),
    getCanonicalFileName: (name) => name,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
  };
  assert.deepEqual(
    ts
      .createProgram(
        [path],
        { allowJs: true, noLib: true, noResolve: true, types: [] },
        host,
      )
      .getSyntacticDiagnostics(file),
    [],
  );
  assert.equal(file.statements.length, program.blocks.length + 1);
  const bindings = new Set([
    "users",
    ...program.blocks.flatMap((block) =>
      block.declares ? [block.declares] : [],
    ),
  ]);
  return program.blocks.map((block, i) => {
    const statement = file.statements[i + 1];
    assert.ok(statement);
    assert.equal(statement.getText(file), block.code);
    /** @type {Set<string>} */
    const refs = new Set();
    /** @param {import('typescript').Node} node */
    const visit = (node) => {
      if (
        ts.isIdentifier(node) &&
        bindings.has(node.text) &&
        !(ts.isVariableDeclaration(node.parent) && node.parent.name === node) &&
        !(
          ts.isPropertyAccessExpression(node.parent) &&
          node.parent.name === node
        )
      )
        refs.add(node.text);
      ts.forEachChild(node, visit);
    };
    visit(statement);
    assert.deepEqual([...refs].sort(), [...block.requires].sort());
    if (block.declares) {
      assert.ok(ts.isVariableStatement(statement));
      assert.equal(
        statement.declarationList.declarations[0]?.name.getText(file),
        block.declares,
      );
    } else assert.ok(ts.isExpressionStatement(statement));
    return refs;
  });
}

test("collection v1 exposes four structural compositions, immutable data and nonnumeric objectives", () => {
  assert.equal(c.COLLECTION_GENERATOR_VERSION, 1);
  assert.ok(Object.isFrozen(c.COLLECTION_STRUCTURES));
  for (const structure of c.COLLECTION_STRUCTURES) {
    const program = c.generateCollectionReference(0, 1, structure);
    const tactic = c.transformCollectionProgram(program);
    const view = c.getPublicCollectionTactic(tactic);
    assert.equal(view.identity.structure, structure);
    assert.equal(view.identity.kind, "order-program");
    assert.equal(typeof view.expectedResult, "string");
    assert.ok(
      Object.isFrozen(program) &&
        Object.isFrozen(program.users[0]) &&
        Object.isFrozen(view.blocks[0]?.requires),
    );
    assert.equal(Object.hasOwn(view, "reference"), false);
    assert.equal(Object.hasOwn(view, "initialOrder"), false);
    assert.deepEqual(
      c.getPublicCollectionTactic(
        c.transformCollectionProgram(
          c.generateCollectionReference(
            view.identity.seed,
            view.identity.generatorVersion,
            view.identity.structure,
          ),
        ),
      ),
      view,
    );
  }
});

test("collection rejects incompatible answers, sparse arrays and tampered models without throwing", () => {
  const program = c.generateCollectionReference(0, 1, "filter-map-join");
  const tactic = c.transformCollectionProgram(program);
  const order = program.blocks.map((block) => block.id);
  const sparse = Object.assign(Array(3), {
    0: "filter",
    1: "map",
    extra: "join",
  });
  for (const answer of [
    null,
    undefined,
    1,
    "filter,map,join",
    {},
    [],
    ["filter"],
    ["filter", "map", "filter"],
    ["filter", "map", "unknown"],
    Array(3),
    sparse,
    Object.assign([...order], { extra: true }),
  ]) {
    assert.equal(
      c.evaluateCollectionAnswer(tactic, answer).status,
      "invalid-answer",
    );
  }
  for (const model of [
    null,
    {},
    c.getPublicCollectionTactic(tactic),
    { ...tactic, extra: true },
    { ...tactic, initialOrder: order },
    { ...tactic, identity: { ...tactic.identity, structure: "other" } },
    { ...tactic, reference: { ...program, expectedResult: "tampered" } },
    { ...tactic, reference: { ...program, code: "alert(1)" } },
    {
      ...tactic,
      reference: {
        ...program,
        blocks: [
          { ...program.blocks[0], requires: [] },
          ...program.blocks.slice(1),
        ],
      },
    },
  ]) {
    assert.equal(c.verifyCollectionTactic(model).valid, false);
    assert.equal(
      c.evaluateCollectionAnswer(model, order).status,
      "invalid-tactic",
    );
    assert.throws(() =>
      Reflect.apply(c.getPublicCollectionTactic, undefined, [model]),
    );
  }
  for (const seed of [-1, 0.5, 4294967296, NaN, Infinity, "0", null, {}, 0n])
    assert.throws(() => c.generateCollectionReference(seed));
  for (const version of [0, 2, "1", null])
    assert.throws(() => c.generateCollectionReference(0, version));
  for (const structure of [null, "other", 0, {}])
    assert.throws(() => c.generateCollectionReference(0, 1, structure));
  assert.throws(() => c.transformCollectionProgram(program, "repair-operator"));
  assert.deepEqual(
    c.generateCollectionReference(-0),
    c.generateCollectionReference(0),
  );
});

test("collection accepts independent declaration orders and distinguishes mutation after result from a dependency error", () => {
  const independent = c.transformCollectionProgram(
    c.generateCollectionReference(4812, 1, "declare-find-fallback-uppercase"),
  );
  for (const order of [
    ["target", "fallback", "find", "resolve", "uppercase"],
    ["fallback", "target", "find", "resolve", "uppercase"],
    ["target", "find", "fallback", "resolve", "uppercase"],
  ])
    assert.equal(c.evaluateCollectionAnswer(independent, order).achieved, true);
  const present = c.transformCollectionProgram(
    c.generateCollectionReference(
      4294967295,
      1,
      "declare-find-fallback-uppercase",
    ),
  );
  const lateFallback = ["target", "find", "resolve", "uppercase", "fallback"];
  assert.equal(
    c.evaluateCollectionAnswer(present, lateFallback).achieved,
    true,
  );
  assert.equal(
    c.evaluateCollectionAnswer(independent, lateFallback).status,
    "invalid-order",
  );
  const mutation = c.transformCollectionProgram(
    c.generateCollectionReference(4812, 1, "filter-map-reverse-join"),
  );
  const incorrect = c.evaluateCollectionAnswer(mutation, [
    "filter",
    "map",
    "join",
    "reverse",
  ]);
  assert.equal(incorrect.status, "valid");
  assert.equal(incorrect.achieved, false);
  assert.notEqual(incorrect.produced, incorrect.expected);
  const invalid = c.evaluateCollectionAnswer(mutation, [
    "map",
    "filter",
    "reverse",
    "join",
  ]);
  assert.equal(invalid.status, "invalid-order");
  if (invalid.status !== "invalid-order")
    assert.fail("Expected dependency feedback");
  assert.deepEqual(invalid.missing, ["selected"]);
  assert.deepEqual(invalid.trace, []);
});

test("collection reproduces across processes and timezones, including zero and maximum seed", () => {
  const script = `const c=require('@bunkercode/tactics-core');console.log(JSON.stringify([0,4812,4294967295].flatMap(seed=>c.COLLECTION_STRUCTURES.map(shape=>{const t=c.transformCollectionProgram(c.generateCollectionReference(seed,1,shape));return {t,v:c.getPublicCollectionTactic(t),e:c.evaluateCollectionAnswer(t,t.reference.blocks.map(b=>b.id))}}))))`;
  const run = (/** @type {string} */ timezone) =>
    execFileSync(process.execPath, ["-e", script], {
      cwd: dirname(require.resolve("@bunkercode/tactics-core")),
      env: { ...process.env, TZ: timezone },
      encoding: "utf8",
    });
  assert.equal(run("UTC"), run("America/Recife"));
});

test("10,000 collection seeds verify syntax, actual dependencies and every permutation against an independent behavioral oracle", (context) => {
  /** @type {Map<string, number>} */
  const structures = new Map();
  /** @type {Map<string, Set<string>>} */
  const initialOrders = new Map();
  let equivalent = 0,
    wrongValid = 0,
    invalid = 0,
    permutationsChecked = 0,
    nonAdjacent = 0;
  let present = 0,
    absent = 0;
  for (let seed = 0; seed < 10000; seed++) {
    try {
      const program = c.generateCollectionReference(seed);
      assert.deepEqual(program, c.generateCollectionReference(seed));
      const tactic = c.transformCollectionProgram(program);
      assert.deepEqual(c.verifyCollectionTactic(tactic), { valid: true });
      assert.deepEqual(
        tactic,
        c.transformCollectionProgram(
          c.generateCollectionReference(seed, 1, program.structure),
        ),
      );
      assert.ok(program.blocks.length >= 3 && program.blocks.length <= 5);
      assert.ok(program.users.length >= 3 && program.users.length <= 5);
      assert.equal(
        new Set(program.users.map((user) => user.name)).size,
        program.users.length,
      );
      assert.ok(
        program.users.every((user) => typeof user.active === "boolean"),
      );
      const names = program.users
        .filter((user) => user.active === program.active)
        .map((user) => user.name);
      assert.ok(names.length >= 2);
      const found = program.users.find((user) => user.name === program.target);
      if (found) present++;
      else absent++;
      const expected =
        program.pattern === "select-transform"
          ? (program.structure === "filter-map-reverse-join"
              ? [...names].reverse()
              : names
            ).join(program.separator)
          : (found ? found.name : program.fallback).toUpperCase();
      assert.equal(program.expectedResult, expected);
      const deps = syntaxAndDependencies(program);
      /** @type {string[]} */
      const ids = program.blocks.map((block) => block.id);
      assert.notDeepEqual(tactic.initialOrder, ids);
      assert.equal(
        c.evaluateCollectionAnswer(tactic, tactic.initialOrder).achieved,
        false,
      );
      assert.equal(c.evaluateCollectionAnswer(tactic, ids).achieved, true);
      if (
        tactic.initialOrder.some((id, i) => Math.abs(ids.indexOf(id) - i) > 1)
      )
        nonAdjacent++;
      let approvals = 0;
      for (const order of permutations(ids)) {
        const seen = new Set(["users"]);
        let failedAt = -1;
        for (let i = 0; i < order.length; i++) {
          const id = order[i];
          assert.ok(id);
          const position = ids.indexOf(id);
          const dependencies = deps[position];
          assert.ok(dependencies);
          if (
            [...dependencies].some((binding) => {
              // JavaScript's conditional expression does not read an unused arm.
              const unusedArm =
                order[i] === "resolve" &&
                binding === "fallback" &&
                found !== undefined;
              return !unusedArm && !seen.has(binding);
            })
          ) {
            failedAt = i;
            break;
          }
          const binding = program.blocks[position]?.declares;
          if (binding) seen.add(binding);
        }
        const evaluation = c.evaluateCollectionAnswer(tactic, order);
        permutationsChecked++;
        if (failedAt >= 0) {
          assert.equal(evaluation.status, "invalid-order");
          assert.equal(evaluation.achieved, false);
          assert.equal(evaluation.produced, null);
          assert.equal(evaluation.trace.length, failedAt);
          invalid++;
        } else {
          assert.equal(evaluation.status, "valid");
          const produced =
            program.structure === "filter-map-reverse-join" &&
            order.indexOf("join") < order.indexOf("reverse")
              ? names.join(program.separator)
              : expected;
          assert.equal(evaluation.produced, produced);
          assert.equal(evaluation.achieved, produced === expected);
          assert.equal(evaluation.expected, expected);
          assert.deepEqual(
            evaluation.trace.map((step) => step.blockId),
            order,
          );
          assert.equal(
            evaluation.trace.find(
              (step) => step.blockId === "join" || step.blockId === "uppercase",
            )?.value,
            produced,
          );
          if (evaluation.achieved) approvals++;
          else wrongValid++;
        }
      }
      assert.equal(
        approvals,
        program.structure === "declare-find-fallback-uppercase"
          ? found
            ? 5
            : 3
          : 1,
      );
      if (approvals > 1) equivalent++;
      structures.set(
        program.structure,
        (structures.get(program.structure) ?? 0) + 1,
      );
      const shapes = initialOrders.get(program.structure) ?? new Set();
      shapes.add(tactic.initialOrder.join(","));
      initialOrders.set(program.structure, shapes);
    } catch (error) {
      throw new Error(`collection v1 seed=${seed}`, { cause: error });
    }
  }
  assert.equal(structures.size, 4);
  assert.ok(
    present > 1000 &&
      absent > 1000 &&
      wrongValid > 1000 &&
      equivalent > 1000 &&
      invalid > 10000 &&
      nonAdjacent > 5000,
  );
  for (const shapes of initialOrders.values()) assert.ok(shapes.size >= 5);
  context.diagnostic(
    JSON.stringify({
      seeds: 10000,
      structures: Object.fromEntries(structures),
      initialOrders: Object.fromEntries(
        [...initialOrders].map(([key, value]) => [key, value.size]),
      ),
      permutationsChecked,
      equivalent,
      wrongValid,
      invalid,
      nonAdjacent,
      present,
      absent,
    }),
  );
});
