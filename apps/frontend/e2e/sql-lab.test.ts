import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createSqlEngine, equivalentResults } from "../src/sql-lab/sql-engine";
import { storeExercise } from "../src/sql-lab/store-exercise";
import {
  SqlRuntime,
  SqlRuntimeError,
  type SqlWorker,
} from "../src/sql-lab/sql-runtime";
import type { SqlRequest, SqlResponse } from "../src/sql-lab/exercise";

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
