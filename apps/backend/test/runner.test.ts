import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import {
  runnerStatus,
  runCode,
  cancelRun,
  stopRuns,
} from "../src/practice/runner";
const execute = promisify(execFile);
const enabled = runnerStatus();
async function isolated(t: import("node:test").TestContext, code: string) {
  const status = await enabled;
  if (!status.available) {
    t.skip(status.reason);
    return;
  }
  return runCode(randomUUID(), code, code);
}
test("real Node container captures output, exceptions and leaves no state between runs", async (t) => {
  const success = await isolated(
    t,
    'console.log("real 🧱"); console.error("stderr");',
  );
  if (!success) return;
  assert.equal(success.state, "success");
  assert.match(success.stdout, /real 🧱/);
  assert.match(success.stderr, /stderr/);
  const error = await isolated(t, 'throw new Error("actual failure");');
  assert.equal(error!.state, "error");
  assert.match(error!.stderr, /actual failure/);
  await isolated(t, 'globalThis.marker = "private";');
  assert.match(
    (await isolated(t, "console.log(typeof globalThis.marker);"))!.stdout,
    /undefined/,
  );
});
test("resource controls, network denial, read-only filesystem and server secret isolation are enforced", async (t) => {
  process.env.BUNKERCODE_TEST_SECRET = "server-secret-must-not-appear";
  const result = await isolated(
    t,
    `
    import fs from "node:fs";
    console.log("uid", process.getuid());
    const status = fs.readFileSync("/proc/self/status", "utf8");
    console.log(status.match(/NoNewPrivs:\\s*(\\d+)/)[0]);
    console.log(status.match(/CapEff:\\s*([0-9a-f]+)/)[0]);
    for (const file of ["memory.max", "cpu.max", "pids.max"]) console.log(file, fs.readFileSync("/sys/fs/cgroup/" + file,"utf8").trim());
    console.log("secret", process.env.BUNKERCODE_TEST_SECRET);
    for (const path of ["/home/henrique/Projetos/BunkerCode/content", "/var/run/docker.sock"]) console.log("host",fs.existsSync(path));
    try { fs.writeFileSync("/readonly-test", "x"); } catch(error) { console.log("readonly",error.code); }
    try { fs.writeFileSync("/tmp/oversized", Buffer.alloc(2 * 1024 * 1024)); } catch(error) { console.log("tmp",error.code); }
    try { await fetch("http://1.1.1.1",{ signal: AbortSignal.timeout(500) }); console.log("UNSAFE NETWORK"); } catch { console.log("network denied"); }
  `,
  );
  if (!result) return;
  assert.equal(result.state, "success");
  assert.match(result.stdout, /uid 65534/);
  assert.match(result.stdout, /NoNewPrivs:\s*1/);
  assert.match(result.stdout, /CapEff:\s*0+/);
  assert.match(result.stdout, /memory.max 100663296/);
  assert.match(result.stdout, /cpu.max 50000 100000/);
  assert.match(result.stdout, /pids.max 32/);
  assert.match(result.stdout, /secret undefined/);
  assert.doesNotMatch(
    result.stdout,
    /server-secret-must-not-appear|UNSAFE NETWORK/,
  );
  assert.match(result.stdout, /host false/);
  assert.match(result.stdout, /readonly (EROFS|EACCES)/);
  assert.match(result.stdout, /tmp ENOSPC/);
  assert.match(result.stdout, /network denied/);
  delete process.env.BUNKERCODE_TEST_SECRET;
});
test("output flood and infinite loop are bounded and containers are removed", async (t) => {
  const flood = await isolated(t, 'while(true) console.log("x".repeat(1000));');
  if (!flood) return;
  assert.equal(flood.state, "output-limit");
  assert.ok(Buffer.byteLength(flood.stdout + flood.stderr) <= 32768);
  const loop = await isolated(t, "while(true) {}");
  assert.equal(loop!.state, "timeout");
  const containers = await execute("docker", [
    "ps",
    "-a",
    "--filter",
    "label=bunkercode.runner=refinement01",
    "--format",
    "{{.Names}}",
  ]);
  assert.equal(containers.stdout.trim(), "");
});
test("cancellation, disconnect signal, concurrency and size restrictions keep the runner bounded", async (t) => {
  if (!(await enabled).available) {
    t.skip("Docker isolation unavailable");
    return;
  }
  const firstId = randomUUID(),
    secondId = randomUUID();
  const first = runCode(firstId, "while(true) {}", "while(true) {}");
  const second = runCode(secondId, "while(true) {}", "while(true) {}");
  // Let both calls reserve their slots, without waiting for container startup.
  await new Promise<void>((resolve) => setImmediate(resolve));
  await assert.rejects(runCode(randomUUID(), "", ""), /Limite de execuções/);
  await Promise.all([cancelRun(firstId), cancelRun(secondId)]);
  assert.equal((await first).state, "cancelled");
  assert.equal((await second).state, "cancelled");
  const abort = new AbortController();
  const pending = runCode(
    randomUUID(),
    "while(true) {}",
    "while(true) {}",
    abort.signal,
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  abort.abort();
  assert.equal((await pending).state, "cancelled");
  await assert.rejects(
    runCode(randomUUID(), "x".repeat(65537), ""),
    /inválido/,
  );
  await stopRuns();
});
test("memory exhaustion and detached descendants cannot outlive the disposable container", async (t) => {
  const exhausted = await isolated(
    t,
    "const buffers = []; while (true) buffers.push(Buffer.alloc(8 * 1024 * 1024, 1));",
  );
  if (!exhausted) return;
  assert.equal(exhausted.state, "error");
  assert.notEqual(exhausted.exitCode, 0);
  const parent = await isolated(
    t,
    'import { spawn } from "node:child_process"; const child = spawn(process.execPath, ["-e", "while(true) {}"], { detached: true, stdio: "ignore" }); child.unref(); console.log("parent ended");',
  );
  assert.equal(parent!.state, "success");
  const clean = await isolated(t, 'console.log("healthy runtime");');
  assert.match(clean!.stdout, /healthy runtime/);
});
