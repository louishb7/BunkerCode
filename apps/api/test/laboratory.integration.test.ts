import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { NestFactory, type INestApplication } from "@nestjs/core";
import type {
  Checkpoint,
  Run,
  RunDetail as GenericRunDetail,
  Workbench as GenericWorkbench,
  OrderDeskState,
} from "@backendlab/protocol";
import { AppModule } from "../src/app.module";
import { projectRoot } from "../src/paths";
import { LabRepository } from "../src/repository";
type Workbench = Omit<GenericWorkbench, "state"> & {
  state: OrderDeskState | null;
};
type RunDetail = Omit<GenericRunDetail, "run"> & {
  run: Omit<Run, "initialState" | "finalState" | "result"> & {
    initialState?: OrderDeskState;
    finalState?: OrderDeskState;
    result?: NonNullable<Run["result"]> & {
      finalStock: number;
      orderCount: number;
    };
  };
};
let app: INestApplication;
let base: string;
let root: string;
let naiveRun: RunDetail;
let atomicRun: RunDetail;
let baseline: Checkpoint;
async function boot() {
  app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  await app.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/workspaces/local/systems/orderdesk`;
}
async function get<T>(path = ""): Promise<T> {
  const response = await fetch(base + path);
  assert.equal(response.status, 200);
  return response.json() as Promise<T>;
}
async function post(path: string, body: unknown = {}) {
  return fetch(base + path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-bunkerlab-client": "local",
    },
    body: JSON.stringify(body),
  });
}
async function run(config = {}) {
  const response = await post("/experiments/overselling/runs", config);
  assert.equal(response.status, 202);
  const started = (await response.json()) as Run;
  for (let tries = 0; tries < 250; tries++) {
    const detail = await get<RunDetail>(`/runs/${started.id}`);
    if (detail.run.status !== "running") return detail;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error("Run did not finish");
}
before(async () => {
  await mkdir(join(projectRoot(), ".bunkerlab"), { recursive: true });
  root = await mkdtemp(join(projectRoot(), ".bunkerlab", "test-"));
  process.env.BUNKERLAB_DATA_DIR = root;
  await boot();
});
after(async () => {
  await app?.close();
  await rm(root, { recursive: true, force: true });
  delete process.env.BUNKERLAB_DATA_DIR;
});

test("workspace has an independent Git baseline and no started runtime", async () => {
  const bench = await get<Workbench>();
  baseline = bench.checkpoints[0]!;
  assert.equal(bench.runtime.status, "stopped");
  assert.equal(bench.workingCode.dirty, false);
  assert.ok(bench.codePath.startsWith(root));
  assert.equal(baseline.commit.length, 40);
  assert.equal(
    (await readFile(join(bench.codePath, ".git", "HEAD"), "utf8")).trim(),
    "ref: refs/heads/main",
  );
});

test("real concurrent requests expose overselling and preserve correlated database evidence", async () => {
  for (let attempt = 0; attempt < 5; attempt++) {
    naiveRun = await run();
    if (naiveRun.run.status === "failed") break;
  }
  assert.equal(naiveRun.run.status, "failed");
  assert.equal(naiveRun.requests.length, 20);
  assert.ok(naiveRun.run.result!.accepted > 5);
  assert.ok(naiveRun.run.result!.finalStock < 0);
  assert.equal(naiveRun.run.result!.errors, 0);
  assert.equal(naiveRun.run.initialState!.orders.length, 0);
  assert.equal(
    naiveRun.run.finalState!.orders.length,
    naiveRun.run.result!.accepted,
  );
  const violation = naiveRun.evidence.find(
    (event) => event.type === "invariant.violated",
  )!;
  assert.ok(violation);
  assert.ok(
    naiveRun.evidence.some(
      (event) =>
        event.type === "stock.read" && event.requestId === violation.requestId,
    ),
  );
  assert.equal(
    new Set(naiveRun.requests.map((request) => request.id)).size,
    20,
  );
  assert.deepEqual(
    naiveRun.evidence.map((event) => event.sequence),
    naiveRun.evidence.map((_, index) => index + 1),
  );
  const firstEnd = Math.min(
    ...naiveRun.requests.map(
      (request) => request.startedAt + request.durationMs,
    ),
  );
  assert.ok(
    naiveRun.requests.filter((request) => request.startedAt < firstEnd).length >
      1,
  );
});

test("editing code does not silently change the loaded runtime; restart and checkpoint enable comparison", async () => {
  const before = await get<Workbench>();
  const path = join(before.codePath, "order-store.mjs");
  await writeFile(
    path,
    await readFile(
      join(projectRoot(), "apps/api/test/fixtures/conditional-order-store.txt"),
    ),
  );
  const edited = await get<Workbench>();
  assert.notEqual(edited.runtime.code!.digest, edited.workingCode.digest);
  const saved = await post("/checkpoints", {
    message: "Atomic inventory update",
  });
  assert.equal(saved.status, 201);
  const checkpoint = (await saved.json()) as Checkpoint;
  assert.notEqual(checkpoint.commit, baseline.commit);
  assert.equal((await post("/runtime/restart")).status, 200);
  atomicRun = await run();
  assert.equal(atomicRun.run.status, "passed");
  assert.equal(atomicRun.run.result!.accepted, 5);
  assert.equal(atomicRun.run.result!.rejected, 15);
  assert.equal(atomicRun.run.result!.finalStock, 0);
  assert.equal(atomicRun.run.checkpoint!.id, checkpoint.id);
  assert.notEqual(atomicRun.run.code.digest, naiveRun.run.code.digest);
  assert.equal(
    atomicRun.evidence.filter((event) => event.type === "stock.written").length,
    5,
  );
  assert.deepEqual(await get(`/runs/${naiveRun.run.id}`), naiveRun);
});

test("reset and consecutive runs isolate runtime state while preserving all old evidence", async () => {
  const response = await post("/runtime/reset");
  assert.equal(response.status, 200);
  const bench = await get<Workbench>();
  assert.equal(bench.state!.product.stock, 5);
  assert.equal(bench.state!.orders.length, 0);
  const next = await run({ stock: 2, clients: 8, concurrency: 4 });
  assert.equal(next.run.status, "passed");
  assert.equal(next.run.result!.accepted, 2);
  const previousIds = new Set(atomicRun.requests.map((request) => request.id));
  assert.ok(next.requests.every((request) => !previousIds.has(request.id)));
  assert.deepEqual(await get(`/runs/${atomicRun.run.id}`), atomicRun);
});

test("commands are serialized across concurrent runs, resets, restarts and checkpoints", async () => {
  const responses = await Promise.all(
    Array.from({ length: 5 }, () =>
      post("/experiments/overselling/runs", { clients: 100, concurrency: 1 }),
    ),
  );
  assert.equal(
    responses.filter((response) => response.status === 202).length,
    1,
  );
  assert.equal(
    responses.filter((response) => response.status === 409).length,
    4,
  );
  const running = (await responses
    .find((response) => response.status === 202)!
    .json()) as Run;
  assert.equal((await post("/runtime/reset")).status, 409);
  assert.equal((await post("/runtime/restart")).status, 409);
  assert.equal(
    (await post("/checkpoints", { message: "Blocked" })).status,
    409,
  );
  for (let i = 0; i < 200; i++) {
    if ((await get<RunDetail>(`/runs/${running.id}`)).run.status !== "running")
      return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail("Run did not settle");
});

test("restoring a checkpoint saves dirty and new files before replacing code, without changing runtime data", async () => {
  const before = await get<Workbench>();
  await writeFile(
    join(before.codePath, "notes.txt"),
    "Uncommitted investigation",
  );
  const response = await post(`/checkpoints/${baseline.id}/restore`);
  assert.equal(response.status, 200);
  const restored = await get<Workbench>();
  assert.equal(restored.runtime.status, "stopped");
  assert.match(
    await readFile(join(restored.codePath, "inventory.mjs"), "utf8"),
    /database.call\("insertOrder", input\)/,
  );
  await assert.rejects(readFile(join(restored.codePath, "notes.txt")));
  const backup = restored.checkpoints.find((checkpoint) =>
    checkpoint.message.startsWith("Antes de restaurar:"),
  )!;
  assert.ok(backup);
  assert.equal((await post(`/checkpoints/${backup.id}/restore`)).status, 200);
  assert.equal(
    await readFile(join(restored.codePath, "notes.txt"), "utf8"),
    "Uncommitted investigation",
  );
});

test("invalid inputs and unknown scope cannot access code or mutate the experiment", async () => {
  for (const body of [
    { stock: -1 },
    { clients: 0 },
    { concurrency: 101 },
    { stock: "5" },
    { other: "bad" },
  ]) {
    assert.equal(
      (await post("/experiments/overselling/runs", body)).status,
      400,
    );
  }
  assert.equal((await post("/checkpoints", { message: "" })).status, 400);
  assert.equal((await post("/checkpoints/missing/restore")).status, 404);
  assert.equal((await fetch(base.replace("local", "missing"))).status, 404);
  assert.equal((await post("/experiments/missing/runs")).status, 404);
});

test("syntax errors and process crashes are results, not control plane crashes", async () => {
  const bench = await get<Workbench>();
  const path = join(bench.codePath, "inventory.mjs");
  const original = await readFile(path, "utf8");
  await writeFile(path, "this is not valid javascript !!!");
  const broken = await run();
  assert.equal(broken.run.status, "error");
  assert.match(broken.run.error!, /SyntaxError/);
  assert.ok((await get<Run[]>("/runs")).length > 0);
  await writeFile(
    path,
    original.replace(
      "export async function createOrder(database, input, emit) {",
      "export async function createOrder(database, input, emit) { process.exit(7);",
    ),
  );
  const crashed = await run();
  assert.equal(crashed.run.status, "error");
  assert.ok(crashed.evidence.some((event) => event.type === "runtime.exited"));
  assert.ok(crashed.requests.some((request) => request.status === null));
  await writeFile(path, original);
  assert.equal((await run()).run.status, "passed");
});

test("metadata and evidence survive API restart; runtime processes are cleaned up", async () => {
  const pid = (await get<Workbench>()).runtime.pid!;
  await app.close();
  assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
  await boot();
  assert.deepEqual(await get(`/runs/${naiveRun.run.id}`), naiveRun);
  assert.deepEqual(await get(`/runs/${atomicRun.run.id}`), atomicRun);
  const bench = await get<Workbench>();
  assert.equal(bench.runtime.status, "stopped");
  assert.ok(bench.checkpoints.length >= 5);
  assert.equal((await post("/runtime/restart")).status, 200);
  assert.equal((await get<Workbench>()).state!.orders.length, 5);
});

test("unfinished runs are recovered as interrupted and migrations are repeatable", async () => {
  await app.close();
  const repository = new LabRepository(root);
  const interrupted = repository.createRun({
    ...atomicRun.run,
    id: "interrupted-test",
    status: "running",
    completedAt: undefined,
  });
  repository.close();
  await boot();
  assert.equal(
    (await get<RunDetail>(`/runs/${interrupted.id}`)).run.status,
    "interrupted",
  );
});

test("a blocked event loop times out without blocking the control plane or the following run", async () => {
  const bench = await get<Workbench>();
  const path = join(bench.codePath, "inventory.mjs");
  const original = await readFile(path, "utf8");
  await writeFile(
    path,
    original.replace(
      "export async function createOrder(database, input, emit) {",
      "export async function createOrder(database, input, emit) { while (true) {}",
    ),
  );
  assert.equal((await post("/runtime/restart")).status, 200);
  const blocked = run({ clients: 20, concurrency: 20 });
  await new Promise((resolve) => setTimeout(resolve, 150));
  const start = performance.now();
  assert.ok((await get<Run[]>("/runs")).length > 0);
  assert.ok(performance.now() - start < 1500);
  const result = await blocked;
  assert.equal(result.run.status, "error");
  assert.equal(result.requests.length, 20);
  assert.equal((await get<Workbench>()).runtime.status, "stopped");
  await writeFile(path, original);
  assert.equal((await run()).run.status, "passed");
});

test("a system surface is served by its runtime and manual activity never becomes a Run", async () => {
  await post("/runtime/reset");
  const before = await get<Run[]>("/runs");
  const surface = await get<{ html: string }>("/surface");
  assert.match(surface.html, /Criar pedido/);
  assert.match(surface.html, /bunkerlab:request/);
  const response = await post("/activities", {
    method: "POST",
    path: "/orders",
    body: { productId: "keyboard", quantity: 1 },
  });
  assert.equal(response.status, 200);
  const activity =
    (await response.json()) as import("@backendlab/protocol").Activity;
  assert.equal(activity.status, 201);
  assert.ok(activity.durationMs! >= 0);
  const written = activity.evidence.find(
    (event) => event.type === "stock.written",
  );
  assert.equal(written!.payload.before, 5);
  assert.equal(written!.payload.stock, 4);
  assert.ok(
    activity.evidence.every(
      (event) => !event.requestId || event.requestId === activity.id,
    ),
  );
  assert.deepEqual(await get(`/activities/${activity.id}`), activity);
  const state = await post("/activities", { method: "GET", path: "/state" });
  const read = (await state.json()) as import("@backendlab/protocol").Activity;
  assert.equal((read.body as OrderDeskState).product.stock, 4);
  assert.equal((read.body as OrderDeskState).orders.length, 1);
  assert.equal(
    (read.body as OrderDeskState).orders[0]!.id,
    (activity.body as { id: string }).id,
  );
  assert.deepEqual(await get("/runs"), before);
  const list =
    await get<import("@backendlab/protocol").ActivitySummary[]>("/activities");
  assert.ok(list.some((item) => item.id === activity.id));
  assert.ok(list.every((item) => !("body" in item) && !("evidence" in item)));
  for (const operation of [
    { method: "POST", path: "/reset" },
    { method: "GET", path: "http://example.com" },
    { method: "DELETE", path: "/orders" },
  ]) {
    assert.equal((await post("/activities", operation)).status, 400);
  }
});

test("manual requests and automated tests cannot mutate the runtime at the same time", async () => {
  const response = await post("/experiments/overselling/runs", {
    clients: 100,
    concurrency: 1,
  });
  assert.equal(response.status, 202);
  const run = (await response.json()) as Run;
  assert.equal(
    (
      await post("/activities", {
        method: "POST",
        path: "/orders",
        body: { productId: "keyboard", quantity: 1 },
      })
    ).status,
    409,
  );
  for (let attempt = 0; attempt < 250; attempt++) {
    if ((await get<RunDetail>(`/runs/${run.id}`)).run.status !== "running")
      return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail("Run did not finish");
});

test("activity keeps HTTP errors and process failures inspectable without persisting Runs", async () => {
  const before = await get<Run[]>("/runs");
  const bench = await get<Workbench>();
  const path = join(bench.codePath, "inventory.mjs");
  const original = await readFile(path, "utf8");
  try {
    await writeFile(
      path,
      original.replace(
        "export async function createOrder(database, input, emit) {",
        'export async function createOrder(database, input, emit) { throw new Error("Manual request failure");',
      ),
    );
    await post("/runtime/restart");
    const response = await post("/activities", {
      method: "POST",
      path: "/orders",
      body: { productId: "keyboard", quantity: 1 },
    });
    const failed =
      (await response.json()) as import("@backendlab/protocol").Activity;
    assert.equal(failed.status, 500);
    assert.ok(failed.evidence.some((event) => event.type === "request.error"));
    assert.equal((await get<Workbench>()).runtime.status, "ready");
    await writeFile(
      path,
      original.replace(
        "export async function createOrder(database, input, emit) {",
        "export async function createOrder(database, input, emit) { process.exit(8);",
      ),
    );
    await post("/runtime/restart");
    const crashed = (await (
      await post("/activities", {
        method: "POST",
        path: "/orders",
        body: { productId: "keyboard", quantity: 1 },
      })
    ).json()) as import("@backendlab/protocol").Activity;
    assert.equal(crashed.status, null);
    assert.ok(crashed.error);
    assert.ok(
      crashed.evidence.some((event) => event.type === "runtime.exited"),
    );
    assert.deepEqual(await get(`/activities/${crashed.id}`), crashed);
    assert.deepEqual(await get("/runs"), before);
  } finally {
    await writeFile(path, original);
    await post("/runtime/restart");
  }
});

test("activities are bounded and expire at API restart; saved Runs remain", async () => {
  for (let count = 0; count < 55; count++)
    await post("/activities", { method: "GET", path: "/state" });
  const activities =
    await get<import("@backendlab/protocol").ActivitySummary[]>("/activities");
  assert.equal(activities.length, 50);
  const last = activities[0]!.id;
  const runs = await get("/runs");
  await app.close();
  await boot();
  assert.deepEqual(await get("/activities"), []);
  assert.equal((await fetch(base + `/activities/${last}`)).status, 404);
  assert.deepEqual(await get("/runs"), runs);
  assert.equal((await post("/runtime/open")).status, 200);
  assert.equal((await get<Workbench>()).runtime.status, "ready");
});

test("investigation availability and selected evidence derive exclusively from the real baseline", async () => {
  const detail = await get<RunDetail>(`/runs/${naiveRun.run.id}`);
  const view = detail.investigations![0]!;
  assert.equal(view.available, true);
  assert.equal(
    view.facts.find((item) => item.key === "orders")!.value,
    detail.run.finalState!.orders.length,
  );
  assert.doesNotMatch(
    JSON.stringify([view.title, view.observation, view.facts]),
    /race condition|transaction|atomic|solução/i,
  );
  assert.equal(view.files[0]!.path, "inventory.mjs");
  assert.equal(view.hints.length, 4);
  assert.ok(view.evidence.length > 0);
  assert.ok(
    view.evidence.some((item) => {
      const event = detail.evidence.find(
        (event) => event.sequence === item.sequence,
      )!;
      return event.type === "stock.written" && Number(event.payload.stock) < 0;
    }),
  );
  for (const item of view.evidence) {
    const event = detail.evidence.find(
      (event) => event.sequence === item.sequence,
    )!;
    assert.ok(event);
    assert.ok(
      detail.requests.some((request) => request.id === event.requestId),
    );
    assert.ok(item.label.endsWith(`= ${event.payload.stock}`));
  }
  const after = await get<RunDetail>(`/runs/${atomicRun.run.id}`);
  assert.equal(after.investigations![0]!.available, false);
  assert.match(
    after.investigations![0]!.observation,
    /Não foi observado estoque negativo/,
  );
});

test("student template contains no strategy switch or completed alternate implementation", async () => {
  for (const file of [
    "inventory.mjs",
    "database.mjs",
    "order-store.mjs",
    "README.md",
  ]) {
    const code = await readFile(
      join(projectRoot(), "templates/orderdesk", file),
      "utf8",
    );
    assert.doesNotMatch(code, /strategy\s*=|atomicOrder|stock >= \?/);
  }
  assert.match(
    await readFile(
      join(projectRoot(), "templates/orderdesk/order-store.mjs"),
      "utf8",
    ),
    /result.changes/,
  );
});
