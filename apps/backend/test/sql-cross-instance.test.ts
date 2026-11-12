import { test } from "node:test";
import assert from "node:assert/strict";
import { fork, execFile } from "node:child_process";
import { promisify } from "node:util";
import { Pool } from "pg";
import { adminToken } from "./auth-fixture";
async function server() {
  const child = fork("test/fixtures/sql-http-worker.ts", [], {
    execArgv: ["--import", "tsx"],
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  child.stdout?.on("data", (chunk) => process.stdout.write(chunk));
  // Do not serialize arbitrary startup errors or credentials from a child.
  child.stderr?.resume();
  const url = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("SQL HTTP worker startup timed out"));
    }, 15000);
    child.once("message", (message: unknown) => {
      clearTimeout(timer);
      if (
        !message ||
        typeof message !== "object" ||
        !("url" in message) ||
        typeof message.url !== "string"
      )
        reject(new Error("Invalid worker readiness"));
      else resolve(message.url);
    });
    child.once("exit", () => {
      clearTimeout(timer);
      reject(new Error("SQL HTTP worker exited before readiness"));
    });
  });
  return {
    url,
    child,
    stop: () =>
      new Promise<void>((resolve) => {
        if (child.exitCode !== null || child.signalCode !== null) {
          resolve();
          return;
        }
        const timer = setTimeout(() => child.kill("SIGKILL"), 12000);
        child.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
        child.send("shutdown");
      }),
  };
}
test(
  "two NestJS processes share one SQL execution slot and Check persists no completion",
  { skip: process.env.BUNKERCODE_SQL_RUNNER_ENABLED !== "1", timeout: 90000 },
  async () => {
    const first = await server();
    let second: Awaited<ReturnType<typeof server>> | undefined;
    try {
      second = await server();
      const requests = await Promise.all(
        [first, second].map(async (instance) => {
          const token = await adminToken(instance.url);
          return () =>
            fetch(instance.url + "/sql/check", {
              method: "POST",
              headers: {
                Origin: "http://127.0.0.1:5173",
                "Content-Type": "application/json",
                "X-Bunkercode-Client": "local",
                Authorization: "Bearer " + token,
              },
              body: JSON.stringify({
                exerciseId: "store-select-columns",
                version: 1,
                steps: ["SELECT id,name FROM customers"],
              }),
            });
        }),
      );
      const token = await adminToken(first.url);
      const me = await fetch(first.url + "/auth/me", {
        headers: { Authorization: "Bearer " + token },
      });
      const identity = (await me.json()) as { user: { id: string } };
      assert.match(identity.user.id, /^[a-f0-9-]{36}$/);
      const responses = await Promise.all(requests.map((request) => request()));
      assert.deepEqual(responses.map((r) => r.status).sort(), [201, 429]);
      const success = responses.find((r) => r.status === 201)!;
      assert.deepEqual(await success.json(), { passed: true });
      assert.ok(
        Number(
          responses.find((r) => r.status === 429)!.headers.get("Retry-After"),
        ) > 0,
      );
      const db = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 1,
      });
      try {
        for (const table of ["LessonCompletion", "ApprovedSolution"])
          assert.equal(
            Number(
              (
                await db.query(
                  'SELECT count(*) FROM "' + table + '" WHERE "userId"=$1',
                  [identity.user.id],
                )
              ).rows[0].count,
            ),
            0,
          );
      } finally {
        await db.end();
      }
    } finally {
      if (second) await second.stop();
      await first.stop();
    }
  },
);

test(
  "an actual HTTP process crash retains admission and requires owned-container recovery before reassessment",
  { skip: process.env.BUNKERCODE_SQL_RUNNER_ENABLED !== "1", timeout: 120000 },
  async () => {
    const exec = promisify(execFile),
      crashed = await server(),
      db = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    const abort = new AbortController();
    let running = false;
    let replacement: Awaited<ReturnType<typeof server>> | undefined,
      owner: string | undefined,
      container: string | undefined;
    const request = async (instance: typeof crashed, steps: string[]) =>
      fetch(instance.url + "/sql/check", {
        method: "POST",
        signal: abort.signal,
        headers: {
          Origin: "http://127.0.0.1:5173",
          "Content-Type": "application/json",
          "X-Bunkercode-Client": "local",
          Authorization: "Bearer " + (await adminToken(instance.url)),
        },
        body: JSON.stringify({
          exerciseId: "store-select-columns",
          version: 1,
          steps,
        }),
      });
    try {
      const token = await adminToken(crashed.url);
      const identity = (await (
        await fetch(crashed.url + "/auth/me", {
          headers: { Authorization: "Bearer " + token },
        })
      ).json()) as { user: { id: string } };
      const pending = request(crashed, ["SELECT pg_sleep(90)"]).then(
        (r) => r.status,
        () => 0,
      );
      for (let i = 0; i < 100; i++) {
        owner =
          (await db.query('SELECT "owner" FROM "SqlRunnerSlot" WHERE "id"=1'))
            .rows[0]?.owner ?? undefined;
        if (owner) {
          const inspected = await exec("docker", [
            "inspect",
            "--format",
            '{{.Id}}|{{.State.Running}}|{{index .Config.Labels "bunkercode.sql.runner"}}',
            "bunkercode-sql-" + owner,
          ]).catch(() => undefined);
          const parts = inspected?.stdout.trim().split("|");
          if (parts?.[2] === "1" && /^[a-f0-9]{64}$/.test(parts[0]!)) {
            container = parts[0];
            if (parts[1] === "true") {
              running = true;
              break;
            }
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      assert.ok(
        owner && container && running,
        "The test must own an active runner before crashing its HTTP process",
      );
      const exited = new Promise<void>((resolve) =>
        crashed.child.once("exit", () => resolve()),
      );
      crashed.child.kill("SIGKILL");
      await exited;
      assert.equal(await pending, 0);
      assert.equal(
        (await db.query('SELECT "owner" FROM "SqlRunnerSlot" WHERE "id"=1'))
          .rows[0].owner,
        owner,
      );
      replacement = await server();
      const busy = await request(replacement, [
        "SELECT id,name FROM customers",
      ]);
      assert.equal(busy.status, 429);
      await replacement.stop();
      replacement = undefined;
      await exec("docker", ["rm", "--force", container]);
      container = undefined;
      await exec(process.execPath, [
        "dist/sql/recover.js",
        owner,
        "--consumers-stopped",
      ]);
      replacement = await server();
      const recovered = await request(replacement, [
        "SELECT id,name FROM customers",
      ]);
      assert.equal(recovered.status, 201);
      assert.deepEqual(await recovered.json(), { passed: true });
      for (const table of ["LessonCompletion", "ApprovedSolution"])
        assert.equal(
          Number(
            (
              await db.query(
                'SELECT count(*) FROM "' + table + '" WHERE "userId"=$1',
                [identity.user.id],
              )
            ).rows[0].count,
          ),
          0,
        );
    } finally {
      abort.abort();
      if (replacement) await replacement.stop();
      await crashed.stop();
      if (container)
        await exec("docker", ["rm", "--force", container]).catch(
          () => undefined,
        );
      if (
        owner &&
        (await db.query('SELECT "owner" FROM "SqlRunnerSlot" WHERE "id"=1'))
          .rows[0]?.owner === owner
      )
        await exec(process.execPath, [
          "dist/sql/recover.js",
          owner,
          "--consumers-stopped",
        ]);
      await db.end();
    }
  },
);
