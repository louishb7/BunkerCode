import assert from "node:assert/strict";
import { test, after, before } from "node:test";
import { mkdtemp, rm, readdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import { LearningStore } from "../src/learning/store";
import { createApplication } from "../src/application";
import { activity, digest } from "../src/content/activities";
import { executeOrderRequest } from "../src/execution/order-request";
import { testStockFunction } from "../src/execution/stock-function-tests";
import type { Attempt, Draft, Submission } from "../src/learning/models";
let root: string;
let app: INestApplication;
let base: string;
const orderSource = activity("order-acceptance").starter;
const solution =
  "export function reserveStock(stock: number, quantity: number) { if (quantity > stock) return { accepted: false, stock }; return { accepted: true, stock: stock - quantity }; }";
async function boot() {
  app = await createApplication(true);
  await app.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/learning`;
}
async function post(path: string, body: unknown) {
  return fetch(base + path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-bunkercode-client": "local",
    },
    body: JSON.stringify(body),
  });
}
async function create(id = "order-acceptance") {
  const response = await post("/attempts", { activityId: id });
  assert.equal(response.status, 201);
  return (await response.json()) as Attempt;
}
async function save(attempt: Attempt, changes: Partial<Draft>) {
  const response = await post(`/attempts/${attempt.id}/draft`, {
    revision: attempt.revision,
    draft: { ...attempt.draft, ...changes },
  });
  assert.equal(response.status, 200);
  return (await response.json()) as Attempt;
}
async function get(id: string) {
  return (await (await fetch(`${base}/attempts/${id}`)).json()) as Attempt;
}
function killIfRunning(pid: number) {
  try {
    process.kill(pid, "SIGKILL");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}
const listExecutions = async () =>
  (await readdir(tmpdir()))
    .filter((n) => n.startsWith("bunkercode-execution-"))
    .sort();
before(async () => {
  root = await mkdtemp(join(tmpdir(), "bunkercode-test-"));
  process.env.BUNKERCODE_DATA_DIR = root;
  await boot();
});
after(async () => {
  await app?.close();
  delete process.env.BUNKERCODE_DATA_DIR;
  await rm(root, { recursive: true, force: true });
});

test("attempts save without execution, reject stale revisions and survive API/database reopen", async () => {
  let attempt = await create();
  const old = attempt;
  attempt = await save(attempt, {
    prediction: { status: 409, stock: 1, orders: 0 },
    justification: "Penso que a igualdade recusará o pedido.",
  });
  assert.equal(attempt.submissions.length, 0);
  assert.equal(
    (
      await post(`/attempts/${attempt.id}/draft`, {
        revision: old.revision,
        draft: old.draft,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await post(`/attempts/${attempt.id}/draft`, {
        revision: attempt.revision,
        draft: { ...attempt.draft, path: "../secret" },
      })
    ).status,
    400,
  );
  await app.close();
  await boot();
  assert.deepEqual(await get(attempt.id), attempt);
  assert.equal(
    (
      await post(`/attempts/${attempt.id}/completion`, {
        revision: attempt.revision,
        reflection: "Nenhuma execução.",
      })
    ).status,
    409,
  );
});

test("submission is persisted before HTTP starts, source/result remain paired while draft changes, completion survives reopen", async () => {
  let attempt = await create();
  const source = orderSource.replace(
    "  if (stock",
    "  const end = Date.now() + 700; while (Date.now() < end) {}\n  if (stock",
  );
  attempt = await save(attempt, {
    source,
    prediction: { status: 409, stock: 1, orders: 0 },
    justification: "Previsão intencionalmente errada.",
  });
  const pending = post(`/attempts/${attempt.id}/submissions`, {
    revision: attempt.revision,
  });
  let frozen: Attempt;
  const deadline = Date.now() + 4000;
  do {
    frozen = await get(attempt.id);
    if (frozen.submissions.length) break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  } while (Date.now() < deadline);
  assert.equal(frozen.submissions.length, 1);
  assert.equal(frozen.submissions[0]!.result, null);
  assert.equal(frozen.submissions[0]!.digest, digest(source));
  assert.equal(
    (
      await post(`/attempts/${attempt.id}/submissions`, {
        revision: attempt.revision,
      })
    ).status,
    409,
  );
  const edited = await save(frozen, {
    source: orderSource.replace("stock < quantity", "stock <= quantity"),
    prediction: { status: 409, stock: 1, orders: 0 },
    justification: "Agora a condição rejeita a igualdade.",
  });
  const completed = await pending;
  assert.equal(completed.status, 200);
  const first = (await completed.json()) as Attempt;
  const firstSubmission = first.submissions[0]!;
  assert.equal(first.draft.source, edited.draft.source);
  assert.equal(firstSubmission.source, source);
  assert.equal(firstSubmission.result?.status, "completed");
  assert.equal(
    firstSubmission.result?.kind === "order" &&
      firstSubmission.result.observation?.response.status,
    201,
  );
  assert.equal(firstSubmission.feedback?.comparisons[0]!.matches, false);
  const secondResponse = await post(`/attempts/${first.id}/submissions`, {
    revision: first.revision,
  });
  const second = (await secondResponse.json()) as Attempt;
  assert.equal(second.submissions.length, 2);
  assert.deepEqual(second.submissions[0], firstSubmission);
  assert.notEqual(second.submissions[1]!.digest, firstSubmission.digest);
  assert.equal(
    second.submissions[1]!.result?.kind === "order" &&
      second.submissions[1]!.result.observation?.finalState.orders,
    0,
  );
  const response = await post(`/attempts/${second.id}/completion`, {
    revision: second.revision,
    reflection: "A comparação de igualdade mudou minha previsão.",
  });
  assert.equal(response.status, 200);
  const finished = (await response.json()) as Attempt;
  await app.close();
  await boot();
  assert.deepEqual(await get(finished.id), finished);
});

test("server owns commands and enforces prediction before submission", async () => {
  const attempt = await create();
  assert.equal(
    (await post(`/attempts/${attempt.id}/submissions`, { revision: 0 })).status,
    400,
  );
  assert.equal(
    (
      await post(`/attempts/${attempt.id}/submissions`, {
        revision: 0,
        command: "node anything",
      })
    ).status,
    400,
  );
  assert.equal(
    (await post("/attempts", { activityId: "../reserve-stock" })).status,
    404,
  );
  const response = await fetch(`${base}/attempts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: '{"activityId":"reserve-stock"}',
  });
  assert.equal(response.status, 403);
});

test("pending submissions recover as interrupted without rerun; migrations repeat safely", async () => {
  const path = join(root, "recovery.sqlite");
  let store = new LearningStore(path);
  const attempt = store.create("order-acceptance");
  const input: Omit<Submission, "number" | "result" | "feedback"> = {
    id: "pending",
    source: orderSource,
    digest: digest(orderSource),
    draftRevision: 0,
    prediction: { status: 201, stock: 0, orders: 1 },
    justification: "Inicial",
    activityVersion: 1,
    harnessDigest: "test",
    conditions: { initialStock: 1 },
    createdAt: new Date().toISOString(),
  };
  store.freeze(attempt.id, 0, input);
  store.close();
  store = new LearningStore(path);
  assert.equal(
    store.get(attempt.id).submissions[0]!.result?.status,
    "interrupted",
  );
  assert.equal(store.get(attempt.id).submissions[0]!.result?.kind, "order");
  assert.equal("cases" in store.get(attempt.id).submissions[0]!.result!, false);
  store.close();
});

test("a second live database owner cannot interrupt pending submissions", () => {
  const path = join(root, "ownership.sqlite");
  const store = new LearningStore(path);
  try {
    const attempt = store.create("reserve-stock");
    store.freeze(attempt.id, 0, {
      id: "live-pending",
      source: attempt.draft.source,
      digest: digest(attempt.draft.source),
      draftRevision: 0,
      prediction: null,
      justification: "",
      activityVersion: 1,
      harnessDigest: "test",
      conditions: { caseCount: 3 },
      createdAt: new Date().toISOString(),
    });
    assert.throws(() => new LearningStore(path), /outra API/);
    assert.equal(store.get(attempt.id).submissions[0]!.result, null);
  } finally {
    store.close();
  }
  const reopened = new LearningStore(path);
  reopened.close();
});

test("HTTP executes exactly one real order request and every execution starts from clean state", async () => {
  const before = await listExecutions();
  for (let i = 0; i < 2; i++) {
    const result = await executeOrderRequest(orderSource);
    assert.equal(result.status, "completed", JSON.stringify(result));
    assert.deepEqual(result.observation?.initialState, { stock: 1, orders: 0 });
    assert.deepEqual(result.observation?.finalState, { stock: 0, orders: 1 });
    assert.deepEqual(result.observation?.response, {
      status: 201,
      body: { accepted: true },
    });
  }
  assert.deepEqual(await listExecutions(), before);
});

test("execution output is bounded and truncation is explicit", async () => {
  const result = await executeOrderRequest(
    orderSource.replace(
      "  if (stock",
      '  console.error("x".repeat(20000));\n  if (stock',
    ),
  );
  assert.equal(result.status, "completed");
  assert.equal(result.truncated, true);
  assert.ok(Buffer.byteLength(result.stderr) <= 8192);
});

test("HTTP compile error, startup crash and operation crash do not terminate the API", async () => {
  assert.equal(
    (await executeOrderRequest("not valid TypeScript !!!")).status,
    "compilation_error",
  );
  assert.equal(
    (
      await executeOrderRequest(
        "process.exit(7); export function createOrder() {}",
      )
    ).status,
    "runtime_error",
  );
  assert.equal(
    (
      await executeOrderRequest(
        "export function createOrder() { process.exit(7); }",
      )
    ).status,
    "runtime_error",
  );
  assert.equal((await executeOrderRequest(orderSource)).status, "completed");
  assert.equal((await fetch(`${base}/activities`)).status, 200);
});

test("timeout kills the old execution before its delayed side effect and the next execution is isolated", async () => {
  const marker = join(root, "late-mutation.txt");
  const pidFile = join(root, "late-worker.pid");
  const source = `import { writeFileSync } from 'node:fs'; export async function createOrder(stock: number, quantity: number) { writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); await new Promise(r => setTimeout(r, 8000)); writeFileSync(${JSON.stringify(marker)}, 'late'); return {accepted:true, stock:stock-quantity}; }`;
  const before = await listExecutions();
  const timed = await executeOrderRequest(source, { timeoutMs: 3000 });
  assert.equal(timed.status, "timeout");
  const pid = Number(await readFile(pidFile, "utf8"));
  try {
    assert.match(await readFile(`/proc/${pid}/stat`, "utf8"), /\) Z /);
  } catch (error) {
    // procfs may lose a task after opening stat but before reading it (ESRCH).
    if (
      !["ENOENT", "ESRCH"].includes((error as NodeJS.ErrnoException).code ?? "")
    )
      throw error;
  }
  const clean = await executeOrderRequest(orderSource);
  assert.equal(clean.status, "completed");
  assert.deepEqual(clean.observation?.finalState, { stock: 0, orders: 1 });
  await assert.rejects(readFile(marker), { code: "ENOENT" });
  assert.deepEqual(await listExecutions(), before);
});

test(
  "an unresponsive learner process dies when its supervisor loses the parent",
  { skip: process.platform !== "linux" },
  async () => {
    const directory = await mkdtemp(join(root, "orphan-"));
    const pidFile = join(directory, "worker.pid");
    await writeFile(
      join(directory, "harness.cjs"),
      `require('node:fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); while (true) {}`,
    );
    const parentScript = join(directory, "parent.cjs");
    const supervisor = join(process.cwd(), "src/execution/supervisor.cjs");
    await writeFile(
      parentScript,
      `const {spawn}=require('node:child_process');spawn(process.execPath,[${JSON.stringify(supervisor)},'harness.cjs'],{cwd:${JSON.stringify(directory)},detached:true,stdio:['ignore','ignore','ignore','ipc']});`,
    );
    const parent = spawn(process.execPath, [parentScript]);
    const exit = new Promise((resolve) => parent.once("close", resolve));
    let pid = 0;
    try {
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        try {
          pid = Number(await readFile(pidFile, "utf8"));
          break;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.ok(pid > 0);
      parent.kill("SIGKILL");
      await exit;
      const deadline2 = Date.now() + 2000;
      let alive = true;
      while (Date.now() < deadline2) {
        try {
          const stat = await readFile(`/proc/${pid}/stat`, "utf8");
          alive = !/\) Z /.test(stat);
        } catch (error) {
          if (
            ["ENOENT", "ESRCH"].includes(
              (error as NodeJS.ErrnoException).code ?? "",
            )
          )
            alive = false;
          else throw error;
        }
        if (!alive) break;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.equal(alive, false);
    } finally {
      parent.kill("SIGKILL");
      if (pid) killIfRunning(pid);
    }
  },
);

test("stock tests report actual passing and failing cases without HTTP or a system", async () => {
  const before = await listExecutions();
  const failed = await testStockFunction(
    solution.replace("quantity > stock", "quantity >= stock"),
  );
  assert.equal(failed.status, "completed", JSON.stringify(failed));
  assert.equal(failed.exitCode, 1);
  assert.deepEqual(
    failed.cases.map((c) => c.passed),
    [true, false, true],
  );
  assert.equal(failed.cases[1]!.expected, '{"accepted":true,"stock":0}');
  const passed = await testStockFunction(solution);
  assert.equal(passed.exitCode, 0);
  assert.equal(passed.status, "completed");
  assert.deepEqual(
    passed.cases.map((c) => c.passed),
    [true, true, true],
  );
  assert.deepEqual(await listExecutions(), before);
});

test("stock compile diagnostics, crash and timeout are distinct from assertion failures and clean up", async () => {
  const before = await listExecutions();
  const compile = await testStockFunction(
    'export function reserveStock(stock: number) { const n: number = "bad"; return n; }',
  );
  assert.equal(compile.status, "compilation_error");
  assert.equal(compile.cases.length, 0);
  assert.ok(compile.diagnostics[0]!.line);
  assert.equal(
    (
      await testStockFunction(
        "export function reserveStock() { process.exit(9); }",
      )
    ).status,
    "runtime_error",
  );
  assert.equal(
    (
      await testStockFunction(
        "export function reserveStock() { while (true) {} }",
        { timeoutMs: 3000 },
      )
    ).status,
    "timeout",
  );
  assert.equal((await testStockFunction(solution)).status, "completed");
  assert.deepEqual(await listExecutions(), before);
});

test("stock attempts persist repeated code submissions and require passing declared cases for completion", async () => {
  let attempt = await create("reserve-stock");
  attempt = await save(attempt, {
    source: solution.replace("quantity > stock", "quantity >= stock"),
  });
  attempt = (await (
    await post(`/attempts/${attempt.id}/submissions`, {
      revision: attempt.revision,
    })
  ).json()) as Attempt;
  assert.equal(
    (
      await post(`/attempts/${attempt.id}/completion`, {
        revision: attempt.revision,
        reflection: "Ainda falta um caso.",
      })
    ).status,
    409,
  );
  attempt = await save(attempt, { source: solution });
  attempt = (await (
    await post(`/attempts/${attempt.id}/submissions`, {
      revision: attempt.revision,
    })
  ).json()) as Attempt;
  assert.equal(attempt.submissions.length, 2);
  assert.equal(attempt.submissions[0]!.source.includes(">="), true);
  assert.equal(
    (
      await post(`/attempts/${attempt.id}/completion`, {
        revision: attempt.revision,
        reflection: "Agora consigo explicar a igualdade.",
      })
    ).status,
    200,
  );
});
