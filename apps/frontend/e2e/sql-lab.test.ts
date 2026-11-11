import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createSqlEngine, equivalentResults } from "../src/sql-lab/sql-engine";
import { storeExercise } from "../src/sql-lab/store-exercise";
import {
  SqlRuntime,
  SqlRuntimeError,
  type SqlWorker,
} from "../src/sql-lab/sql-runtime";
import {
  sqlSessionKey,
  type SqlRequest,
  type SqlResponse,
} from "../src/sql-lab/exercise";

let engine: Awaited<ReturnType<typeof createSqlEngine>>;
before(async () => {
  engine = await createSqlEngine(storeExercise);
});
after(async () => {
  await engine?.close();
});

test("real SQL engine initializes deterministically and supports select, filter, order, join and aggregation", async () => {
  const all = await engine.execute("SELECT * FROM customers;", false);
  assert.equal(all.rows.length, 4);
  assert.deepEqual(all.fields, ["id", "name", "city"]);
  const filter = await engine.execute(
    "SELECT name FROM customers WHERE city = 'Recife' ORDER BY name DESC",
    false,
  );
  assert.deepEqual(filter.rows, [["Carla Souza"], ["Ana Lima"]]);
  const join = await engine.execute(
    "SELECT c.name, count(*)::int AS purchases FROM customers c JOIN orders o ON c.id = o.customer_id GROUP BY c.id, c.name ORDER BY c.id",
    false,
  );
  assert.deepEqual(join.rows, [
    ["Ana Lima", 2],
    ["Bruno Alves", 1],
    ["Carla Souza", 1],
  ]);
  assert.equal(all.correct, undefined);
});

test("empty schemas, nulls, duplicate column names and large results preserve metadata", async () => {
  const empty = await engine.execute(
    "SELECT id, name FROM customers WHERE false",
    false,
  );
  assert.deepEqual(empty, {
    fields: ["id", "name"],
    rows: [],
    truncated: false,
  });
  assert.deepEqual(
    (await engine.execute("SELECT note FROM orders WHERE id = 102", false))
      .rows,
    [[null]],
  );
  assert.deepEqual(
    (await engine.execute("SELECT 1 AS a, 2 AS a", false)).rows,
    [[1, 2]],
  );
  const large = await engine.execute(
    "SELECT * FROM generate_series(1, 1000)",
    false,
  );
  assert.equal(large.rows.length, 100);
  assert.equal(large.truncated, true);
});

test("wrapper rejects malformed SQL, multiple statements, mutations and non-embeddable commands, then recovers", async () => {
  for (const sql of [
    "SELECT missing FROM customers",
    "SELECT FROM",
    "SELECT 1; SELECT 2",
    "DELETE FROM customers",
    "EXPLAIN SELECT * FROM customers",
  ]) {
    await assert.rejects(engine.execute(sql, true));
    assert.equal(
      (await engine.execute("SELECT * FROM customers", false)).rows.length,
      4,
    );
  }
  assert.deepEqual(
    (await engine.execute("-- comment\nSELECT 1 AS n;", false)).rows,
    [[1]],
  );
});

test("verification accepts equivalent queries and rejects missing, extra, wrong and duplicate rows, incorrect columns and truncation", async () => {
  for (const sql of [
    "SELECT * FROM customers WHERE city = 'Recife'",
    "SELECT id, name, city FROM customers WHERE city IN ('Recife') ORDER BY id DESC",
  ]) {
    assert.equal((await engine.execute(sql, true)).correct, true);
  }
  for (const sql of [
    "SELECT * FROM customers WHERE id = 1",
    "SELECT * FROM customers",
    "SELECT * FROM customers WHERE city = 'Olinda'",
    "SELECT name, id, city FROM customers WHERE city = 'Recife'",
    "SELECT id, name FROM customers WHERE city = 'Recife'",
    "SELECT * FROM customers WHERE city = 'Recife' UNION ALL SELECT * FROM customers WHERE id = 1",
    "SELECT c.* FROM customers c CROSS JOIN generate_series(1, 100) WHERE c.city = 'Recife'",
  ])
    assert.equal((await engine.execute(sql, true)).correct, false, sql);
  const rows = { fields: ["n"], rows: [[1], [1]], truncated: false };
  assert.equal(equivalentResults(rows, { ...rows, rows: [[1]] }), false);
  assert.equal(equivalentResults(rows, { ...rows, truncated: true }), false);
});

class FakeWorker implements SqlWorker {
  onmessage: SqlWorker["onmessage"] = null;
  onerror: SqlWorker["onerror"] = null;
  onmessageerror: SqlWorker["onmessageerror"] = null;
  requests: SqlRequest[] = [];
  terminated = false;
  postMessage(message: SqlRequest) {
    this.requests.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  reply(response: SqlResponse) {
    this.onmessage?.(new MessageEvent("message", { data: response }));
  }
  ready() {
    this.reply({ type: "ready", id: this.requests.at(-1)!.id });
  }
  result() {
    this.reply({
      type: "result",
      id: this.requests.at(-1)!.id,
      result: { fields: ["n"], rows: [[1]], truncated: false },
    });
  }
}
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

test("runtime rejects duplicate execution, disposes pending work, ignores old workers and can restart", async () => {
  const workers: FakeWorker[] = [];
  const runtime = new SqlRuntime(storeExercise, () => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker;
  });
  const first = runtime.execute("SELECT 1");
  await assert.rejects(runtime.execute("SELECT 2"), /Já existe/);
  workers[0]!.ready();
  await tick();
  const rejected = assert.rejects(first, /descartado/);
  runtime.dispose();
  await rejected;
  assert.equal(workers[0]!.terminated, true);
  const second = runtime.execute("SELECT 1");
  workers[0]!.result();
  workers[1]!.ready();
  await tick();
  workers[1]!.result();
  assert.deepEqual((await second).rows, [[1]]);
  runtime.dispose();
});

test("runtime handles construction failure, worker error and query timeout without becoming stuck", async () => {
  const failed = new SqlRuntime(storeExercise, () => {
    throw new Error("construction failed");
  });
  await assert.rejects(failed.execute("SELECT 1"), SqlRuntimeError);
  const worker = new FakeWorker();
  const runtime = new SqlRuntime(
    { ...storeExercise, limits: { ...storeExercise.limits, queryMs: 10 } },
    () => worker,
  );
  const first = runtime.execute("SELECT 1");
  const rejection = assert.rejects(first, /laboratório falhou/);
  worker.onerror?.({} as ErrorEvent);
  await rejection;
  const second = runtime.execute("SELECT 1");
  const timeout = assert.rejects(second, /tempo limite/);
  worker.ready();
  await timeout;
  assert.equal(worker.terminated, true);
  runtime.dispose();
});

test("runtime rejects initialization errors, message errors and initialization timeout and permits recovery", async () => {
  const workers: FakeWorker[] = [];
  const runtime = new SqlRuntime(
    {
      ...storeExercise,
      limits: { ...storeExercise.limits, initializationMs: 15 },
    },
    () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
  );
  const first = runtime.execute("SELECT 1");
  const failed = assert.rejects(first, /seed error/);
  workers[0]!.reply({
    type: "error",
    id: workers[0]!.requests[0]!.id,
    error: { message: "seed error" },
  });
  await failed;
  assert.equal(workers[0]!.terminated, true);
  const second = runtime.execute("SELECT 1");
  const invalid = assert.rejects(second, /laboratório falhou/);
  workers[1]!.onmessageerror?.(new MessageEvent("messageerror"));
  await invalid;
  await assert.rejects(runtime.execute("SELECT 1"), /tempo limite/);
  const recovery = runtime.execute("SELECT 1");
  workers[3]!.ready();
  await tick();
  workers[3]!.result();
  await recovery;
  runtime.dispose();
});

test("runtime does not resume an old initialization into a replacement worker", async () => {
  const workers: FakeWorker[] = [];
  const runtime = new SqlRuntime(storeExercise, () => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker;
  });
  const first = runtime.execute("SELECT 1");
  const old = assert.rejects(first, /descartado/);
  workers[0]!.ready();
  runtime.dispose();
  const second = runtime.execute("SELECT 2");
  await tick();
  assert.equal(workers[1]!.requests.length, 1);
  workers[1]!.ready();
  await tick();
  workers[1]!.result();
  await old;
  await second;
  runtime.dispose();
});

test("the same SQL engine accepts a different lesson definition without the store dataset", async () => {
  const configured = await createSqlEngine({
    ...storeExercise,
    id: "lesson-example",
    setupSql:
      "CREATE TABLE sample(value integer); INSERT INTO sample VALUES (42);",
    expectedQuery: "SELECT value FROM sample",
  });
  try {
    const result = await configured.execute("SELECT value FROM sample", true);
    assert.deepEqual(result.fields, ["value"]);
    assert.deepEqual(result.rows, [[42]]);
    assert.equal(result.correct, true);
    await assert.rejects(configured.execute("SELECT * FROM customers", false));
  } finally {
    await configured.close();
  }
});

test("session identity ignores object references and changes for exercise or version", () => {
  assert.equal(
    sqlSessionKey(storeExercise),
    sqlSessionKey({ ...storeExercise }),
  );
  assert.notEqual(
    sqlSessionKey(storeExercise),
    sqlSessionKey({ ...storeExercise, version: 2 }),
  );
  assert.notEqual(
    sqlSessionKey(storeExercise),
    sqlSessionKey({ ...storeExercise, id: "other" }),
  );
});

test("table exploration reads actual records, is allowlisted and preserves grading", async () => {
  const preview = await engine.preview("orders");
  assert.deepEqual(preview.fields, ["id", "customer_id", "total", "note"]);
  assert.equal(preview.rows.length, 4);
  assert.equal(preview.rows[1]![3], null);
  await assert.rejects(
    engine.preview("pg_catalog.pg_authid"),
    /não disponível/,
  );
  await assert.rejects(
    engine.preview('customers"; DELETE FROM customers;--'),
    /não disponível/,
  );
  assert.equal(
    (await engine.execute(storeExercise.expectedQuery, true)).correct,
    true,
  );
  const other = await createSqlEngine({
    ...storeExercise,
    schema: [{ name: "sample", columns: [{ name: "value", type: "integer" }] }],
    setupSql: "CREATE TABLE sample(value integer);",
    expectedQuery: "SELECT value FROM sample",
  });
  try {
    assert.deepEqual(await other.preview("sample"), {
      fields: ["value"],
      rows: [],
      truncated: false,
    });
  } finally {
    await other.close();
  }
});

test("lesson SQL references reject invalid, duplicate and mixed activities", async () => {
  const { parseSqlPlacement, lessonSqlPlacement, validateEditorial } =
    await import("@bunkercode/content");
  const block =
    '```bunker-sql\n{"kind":"sql","exerciseId":"store-customers-recife","version":1}\n```';
  assert.deepEqual(lessonSqlPlacement(block), {
    kind: "sql",
    exerciseId: storeExercise.id,
    version: 1,
  });
  assert.equal(lessonSqlPlacement("```sql\nSELECT 1;\n```"), null);
  for (const reference of [
    null,
    { kind: "sql", exerciseId: "../bad", version: 1 },
    { kind: "sql", exerciseId: "valid", version: 0 },
    { kind: "sql", exerciseId: "valid", version: 1, setupSql: "untrusted" },
  ])
    assert.throws(() => parseSqlPlacement(reference));
  assert.throws(() => validateEditorial(block + "\n\n" + block), /duplicada/);
  assert.throws(
    () =>
      validateEditorial(
        block + '\n\n```bunker-exercise\n{"kind":"exercise"}\n```',
      ),
    /misturar/,
  );
});

test("mutation grading checks independent whole-table state without replay and resets deterministically", async () => {
  const { updateExercise } = await import("../src/sql-lab/update-exercise");
  let mutation = await createSqlEngine(updateExercise);
  try {
    assert.equal((await mutation.verifyState()).correct, false);
    await mutation.execute("UPDATE customers SET city = 'Recife' WHERE id = 2");
    const changed = await mutation.preview("customers");
    assert.equal((await engine.preview("customers")).rows[1]![2], "Olinda");
    assert.equal(changed.rows[1]![2], "Recife");
    assert.equal((await mutation.verifyState()).correct, true);
    assert.equal((await mutation.verifyState()).correct, true);
    assert.deepEqual(await mutation.preview("customers"), changed);
    await mutation.execute("UPDATE customers SET city = 'Recife'");
    assert.equal((await mutation.verifyState()).correct, false);
    await mutation.execute("UPDATE customers SET city = 'Natal' WHERE id = 4");
    assert.equal((await mutation.verifyState()).correct, true);
    await mutation.execute(
      "UPDATE orders SET total = total + 1 WHERE id = 101",
    );
    assert.equal((await mutation.verifyState()).correct, false);
    for (const sql of [
      "COMMIT",
      "ROLLBACK",
      "BEGIN",
      "SET ROLE postgres",
      "UPDATE customers SET city = 'Natal'; DELETE FROM orders",
      "CREATE TABLE unexpected AS SELECT 1 AS id",
      "UPDATE customers SET missing = 1",
    ]) {
      await assert.rejects(mutation.execute(sql), sql);
    }
    await mutation.close();
    mutation = await createSqlEngine(updateExercise);
    assert.equal((await mutation.preview("customers")).rows[1]![2], "Olinda");
    assert.equal((await mutation.verifyState()).correct, false);
  } finally {
    await mutation.close();
  }
});

test("INSERT and DELETE use real SQL, preserve duplicates, nulls and typed values, and reject unintended changes", async () => {
  const { updateExercise } = await import("../src/sql-lab/update-exercise");
  const mutation = await createSqlEngine({
    ...updateExercise,
    schema: [
      {
        name: "sample",
        columns: [
          { name: "value", type: "integer" },
          { name: "note", type: "text" },
          { name: "amount", type: "numeric" },
          { name: "active", type: "boolean" },
        ],
      },
    ],
    setupSql:
      "CREATE TABLE sample(value integer, note text, amount numeric(8,2), active boolean); INSERT INTO sample VALUES (1,NULL,2.50,true),(1,NULL,2.50,true),(2,'keep',8.00,false);",
    expectedSql:
      "INSERT INTO sample VALUES (3,NULL,4.75,true); DELETE FROM sample WHERE value = 2;",
  });
  try {
    await assert.rejects(
      mutation.execute("INSERT INTO sample VALUES ('bad',NULL,1,true)"),
    );
    assert.equal((await mutation.verifyState()).correct, false);
    await mutation.execute("INSERT INTO sample VALUES (3,NULL,4.75,true)");
    await mutation.execute("DELETE FROM sample WHERE value = 2");
    assert.equal((await mutation.verifyState()).correct, true);
    const before = await mutation.preview("sample");
    await mutation.verifyState();
    assert.deepEqual(await mutation.preview("sample"), before);
    await mutation.execute("INSERT INTO sample VALUES (3,NULL,4.75,true)");
    assert.equal((await mutation.verifyState()).correct, false);
    await assert.rejects(
      mutation.execute("DELETE FROM sample", true),
      /separadamente/,
    );
  } finally {
    await mutation.close();
  }
});

test("mutation configurations must cover all tables and fit complete expected state", async () => {
  const { updateExercise } = await import("../src/sql-lab/update-exercise");
  await assert.rejects(
    createSqlEngine({ ...updateExercise, schema: [updateExercise.schema[0]!] }),
    /todas as tabelas/,
  );
  await assert.rejects(
    createSqlEngine({
      ...updateExercise,
      limits: { ...updateExercise.limits, maxRows: 1 },
    }),
    /limite de linhas/,
  );
});

test("comparison distinguishes SQL NULL, non-finite floats, text and numeric values", async () => {
  const nullResult = await engine.execute("SELECT NULL::float8 AS value");
  const nanResult = await engine.execute("SELECT 'NaN'::float8 AS value");
  const infinityResult = await engine.execute(
    "SELECT 'Infinity'::float8 AS value",
  );
  assert.equal(equivalentResults(nanResult, nullResult), false);
  assert.equal(equivalentResults(infinityResult, nullResult), false);
  assert.equal(equivalentResults(nanResult, nanResult), true);
  assert.equal(
    equivalentResults(
      { fields: ["v"], rows: [[1]], truncated: false },
      { fields: ["v"], rows: [["1"]], truncated: false },
    ),
    false,
  );
  assert.equal(
    equivalentResults(
      { fields: ["v"], rows: [[{ a: 1, b: 2 }]], truncated: false },
      { fields: ["v"], rows: [[{ b: 2, a: 1 }]], truncated: false },
    ),
    true,
  );
});

test("separate runtime instances keep requests and disposal independent", async () => {
  const a = new FakeWorker(),
    b = new FakeWorker();
  const first = new SqlRuntime(storeExercise, () => a);
  const second = new SqlRuntime(storeExercise, () => b);
  const runA = first.preview("customers");
  const runB = second.execute("SELECT 1");
  a.ready();
  b.ready();
  await tick();
  assert.equal(a.requests.at(-1)?.type, "preview");
  assert.equal(b.requests.at(-1)?.type, "query");
  const discarded = assert.rejects(runA, /descartado/);
  first.dispose();
  b.result();
  await discarded;
  assert.deepEqual((await runB).rows, [[1]]);
  assert.equal(b.terminated, false);
  second.dispose();
});

test("catalog exercises share the engine and reject incorrect results including wrong ordering", async () => {
  const { sqlExercises, resolveSqlExercise } =
    await import("../src/sql-lab/exercise-catalog");
  assert.equal(
    new Set(sqlExercises.map((exercise) => exercise.id)).size,
    sqlExercises.length,
  );
  assert.throws(
    () =>
      resolveSqlExercise({
        kind: "sql",
        exerciseId: storeExercise.id,
        version: 99,
      }),
    /não disponível/,
  );
  for (const exercise of sqlExercises) {
    assert.equal(
      resolveSqlExercise({
        kind: "sql",
        exerciseId: exercise.id,
        version: exercise.version,
      }),
      exercise,
    );
    assert.ok(exercise.objective);
    if (exercise.mode !== "query") continue;
    const instance = await createSqlEngine(exercise);
    try {
      assert.equal(
        (await instance.execute(exercise.expectedQuery, true)).correct,
        true,
        exercise.id,
      );
      assert.equal(
        (await instance.execute("SELECT 0 AS wrong", true)).correct,
        false,
        exercise.id,
      );
      if (exercise.orderMatters)
        assert.equal(
          (
            await instance.execute(
              exercise.expectedQuery.replace("DESC", "ASC"),
              true,
            )
          ).correct,
          false,
        );
      const preview = await instance.preview("customers");
      assert.equal(preview.rows.length, 4);
    } finally {
      await instance.close();
    }
  }
});

test("preview limits real rows while keeping empty-table fields", async () => {
  const instance = await createSqlEngine({
    ...storeExercise,
    schema: [
      { name: "sample", columns: [{ name: "value", type: "integer" }] },
      { name: "empty_sample", columns: [{ name: "name", type: "text" }] },
    ],
    setupSql:
      "CREATE TABLE sample(value integer); INSERT INTO sample SELECT generate_series(1,15); CREATE TABLE empty_sample(name text);",
    expectedQuery: "SELECT value FROM sample",
  });
  try {
    const preview = await instance.preview("sample");
    assert.equal(preview.rows.length, 10);
    assert.equal(preview.truncated, true);
    assert.deepEqual(await instance.preview("empty_sample"), {
      fields: ["name"],
      rows: [],
      truncated: false,
    });
  } finally {
    await instance.close();
  }
});
