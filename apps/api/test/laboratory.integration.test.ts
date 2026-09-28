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
  RunDetail,
  Workbench,
} from "@backendlab/protocol";
import { AppModule } from "../src/app.module";
import { projectRoot } from "../src/paths";
import { LabRepository } from "../src/repository";
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
  const path = join(before.codePath, "inventory.mjs");
  await writeFile(
    path,
    (await readFile(path, "utf8")).replace(
      /strategy = ["']naive["']/,
      'strategy = "atomic"',
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
    /strategy = ['"]naive['"]/,
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
