import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { SqlContent } from "../src/sql/content";
import {
  evaluateSql,
  SQL_RUN_LIMITS,
  sqlRunnerStatus,
} from "../src/sql/runner";
const exec = promisify(execFile);
const store = new SqlContent(resolve("../../content/sql"));
const dataset = store.dataset("store", 1);
const query = store.definition("store-customers-recife", 1);
const mutation = store.definition("store-update-city", 1);
const enabled = process.env.BUNKERCODE_SQL_RUNNER_ENABLED === "1";
test(
  "isolated SQL runner grades independently and rejects unrelated or privileged operations",
  { skip: !enabled },
  async () => {
    await sqlRunnerStatus();
    assert.equal(
      await evaluateSql(query, dataset, [query.assessment.reference[0]!]),
      true,
    );
    assert.equal(
      await evaluateSql(query, dataset, [
        "SELECT id,name,city FROM customers WHERE city IN ('Recife') ORDER BY id DESC",
      ]),
      true,
    );
    assert.equal(
      await evaluateSql(query, dataset, ["SELECT * FROM customers"]),
      false,
    );
    for (const sql of [
      "SELECT pg_read_file('/proc/self/environ')",
      "SELECT set_config('session_authorization','postgres',false)",
      'SELECT * FROM "User"',
      "SELECT 1; SELECT 2",
    ]) {
      await assert.rejects(evaluateSql(query, dataset, [sql]));
    }
    assert.equal(
      await evaluateSql(mutation, dataset, mutation.assessment.reference),
      true,
    );
    assert.equal(
      await evaluateSql(mutation, dataset, [
        "UPDATE customers SET city='Natal' WHERE id=1",
      ]),
      false,
    );
    await assert.rejects(
      evaluateSql(mutation, dataset, ["CREATE TABLE unexpected AS SELECT 1"]),
    );
    const remaining = await exec("docker", [
      "ps",
      "--all",
      "--filter",
      "label=bunkercode.sql.runner=1",
      "--format",
      "{{.Names}}",
    ]);
    assert.equal(remaining.stdout.trim(), "");
  },
);
test(
  "SQL container enforces kernel boundaries, concurrency, cancellation and timeout, then recovers",
  { skip: !enabled, timeout: 120000 },
  async () => {
    const abort = new AbortController();
    const pending = evaluateSql(
      query,
      dataset,
      ["SELECT pg_sleep(90)"],
      abort.signal,
    );
    const rejected = assert.rejects(pending, /interrompida/);
    let name = "";
    for (let i = 0; i < 50 && !name; i++) {
      const found = await exec("docker", [
        "ps",
        "--filter",
        "label=bunkercode.sql.runner=1",
        "--format",
        "{{.Names}}",
      ]);
      name = found.stdout.trim();
      if (!name) await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(name);
    const { stdout } = await exec("docker", ["inspect", name]);
    const container = JSON.parse(stdout)[0];
    const h = container.HostConfig;
    assert.equal(h.NetworkMode, "none");
    assert.equal(h.ReadonlyRootfs, true);
    assert.deepEqual(h.CapDrop, ["ALL"]);
    assert.ok(h.SecurityOpt.includes("no-new-privileges"));
    assert.equal(h.Memory, SQL_RUN_LIMITS.memoryMiB * 1024 * 1024);
    assert.equal(h.MemorySwap, h.Memory);
    assert.equal(h.PidsLimit, 32);
    assert.equal(h.NanoCpus, 750000000);
    assert.equal(container.Config.User, "65534:65534");
    assert.deepEqual(container.Mounts, []);
    assert.ok(!JSON.stringify(container.Config.Env).includes("DATABASE_URL"));
    assert.ok(!JSON.stringify(container.Config.Env).includes("JWT"));
    const [kernel] = await Promise.all([
      exec("docker", [
        "exec",
        name,
        "sh",
        "-c",
        "cat /proc/self/status; cat /sys/fs/cgroup/memory.max; cat /sys/fs/cgroup/pids.max; cat /sys/fs/cgroup/cpu.max; test ! -w /app/main.cjs; test ! -e /var/run/docker.sock",
      ]),
      assert.rejects(evaluateSql(query, dataset, ["SELECT 1"]), /ocupado/),
    ]);
    assert.match(kernel.stdout, /NoNewPrivs:\s+1/);
    assert.match(kernel.stdout, /Seccomp:\s+2/);
    assert.match(kernel.stdout, /1073741824/);
    console.log(
      "Kernel restrictions verified:",
      kernel.stdout.replace(/.*(?:Groups|Mems_allowed|Cpus_allowed).*\n/g, ""),
    );
    abort.abort();
    await rejected;
    await assert.rejects(
      evaluateSql(query, dataset, ["SELECT pg_sleep(90)"]),
      /Tempo limite/,
    );
    assert.equal(
      await evaluateSql(query, dataset, query.assessment.reference),
      true,
    );
    assert.equal(
      (
        await exec("docker", [
          "ps",
          "--all",
          "--filter",
          "label=bunkercode.sql.runner=1",
          "--format",
          "{{.Names}}",
        ])
      ).stdout.trim(),
      "",
    );
  },
);
