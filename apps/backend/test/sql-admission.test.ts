import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Pool } from "pg";
import { SqlAdmission } from "../src/sql/admission";
const exec = promisify(execFile);
const worker = async (operation: string, user = "", action = "check") => {
  const result = await exec(process.execPath, [
    "--import",
    "tsx",
    "test/fixtures/sql-admission-worker.ts",
    operation,
    user,
    action,
  ]);
  return JSON.parse(result.stdout) as { status: number; owner?: string };
};
test("SQL quotas share budgets across processes and reserve authentication and Submit policies", async () => {
  const db = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const admission = new SqlAdmission(),
    other = new SqlAdmission(),
    user = randomUUID();
  try {
    const before = (await db.query('SELECT count(*) FROM "AuthThrottle"'))
      .rows[0];
    for (let i = 0; i < 3; i++) await admission.consume(user, "check");
    for (let i = 0; i < 3; i++)
      assert.equal((await worker("consume", user)).status, 200);
    await assert.rejects(other.consume(user, "check"), { status: 429 });
    await other.consume(user, "submit");
    await other.consume(user, "authoring");
    assert.deepEqual(
      (await db.query('SELECT count(*) FROM "AuthThrottle"')).rows[0],
      before,
    );
    // Database clock, not process Date.now(), decides expiration.
    await db.query(
      'UPDATE "SqlQuota" SET "expiresAt"=clock_timestamp()-interval \'1 second\' WHERE "key" IN (SELECT "key" FROM "SqlQuota" WHERE "count"=6)',
    );
    await admission.consume(user, "check");
    const rows = await db.query('SELECT "key" FROM "SqlQuota"');
    assert.ok(
      rows.rows.every((row: { key: string }) => /^[a-f0-9]{64}$/.test(row.key)),
    );
  } finally {
    await admission.close();
    await other.close();
    await db.end();
  }
});
test("SQL singleton claim races across real processes, survives exit, and suspends without automatic expiry", async () => {
  const admission = new SqlAdmission(),
    db = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  let owner: string | undefined;
  try {
    const results = await Promise.all([worker("claim"), worker("claim")]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 429]);
    owner = results.find((r) => r.owner)?.owner;
    assert.ok(owner);
    await assert.rejects(admission.claim(), { status: 429 });
    await db.query(
      'UPDATE "SqlRunnerSlot" SET "claimedAt"=clock_timestamp()-interval \'91 seconds\' WHERE "owner"=$1',
      [owner],
    );
    await assert.rejects(admission.claim(), { status: 503 });
    await admission.finish(owner, true);
    assert.equal((await worker("claim")).status, 503);
    // Explicit maintenance tool refuses the wrong claim, then recovers an empty daemon.
    if (process.env.BUNKERCODE_SQL_RUNNER_ENABLED === "1") {
      await assert.rejects(
        exec(process.execPath, [
          "dist/sql/recover.js",
          randomUUID(),
          "--consumers-stopped",
        ]),
      );
      const recovered = await exec(process.execPath, [
        "dist/sql/recover.js",
        owner,
        "--consumers-stopped",
      ]);
      assert.match(recovered.stdout, /sql_runner_recovered/);
      owner = await admission.claim();
    }
    await admission.finish(owner, false);
    owner = undefined;
  } finally {
    if (owner) await admission.finish(owner, false);
    await admission.close();
    await db.end();
  }
});
test("SQL admission fails fast under lock contention and bounds its pool without consuming auth locks", async () => {
  const admission = new SqlAdmission(),
    db = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const lock = await db.connect();
  try {
    await lock.query("SELECT pg_advisory_lock(1699007722)");
    const start = performance.now();
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => admission.claim()),
    );
    assert.ok(
      results.every((r) => r.status === "rejected" && r.reason.status === 429),
    );
    assert.ok(performance.now() - start < 1500);
    assert.equal(
      (await lock.query("SELECT pg_try_advisory_lock(1699007721) AS locked"))
        .rows[0].locked,
      true,
    );
    await lock.query("SELECT pg_advisory_unlock(1699007721)");
  } finally {
    await lock.query("SELECT pg_advisory_unlock(1699007722)");
    lock.release();
    await admission.close();
    await db.end();
  }
});

test("SQL quota bounds retained keys and installation traffic while preserving known budgets", async () => {
  const admission = new SqlAdmission(),
    db = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const user = randomUUID(),
    prefix = randomUUID();
  const keys: string[] = [];
  try {
    await admission.consume(user, "check");
    const count = Number(
      (await db.query('SELECT count(*) FROM "SqlQuota"')).rows[0].count,
    );
    for (let i = 0; i < 4096 - count; i++)
      keys.push(
        (await import("node:crypto"))
          .createHash("sha256")
          .update(prefix + ":" + i)
          .digest("hex"),
      );
    await db.query(
      `INSERT INTO "SqlQuota" ("key","count","expiresAt") SELECT value,1,clock_timestamp()+interval '60 seconds' FROM unnest($1::text[]) AS value`,
      [keys],
    );
    await assert.rejects(admission.consume(randomUUID(), "check"), {
      status: 429,
    });
    await admission.consume(user, "check");
    await db.query('DELETE FROM "SqlQuota" WHERE "key"=ANY($1::text[])', [
      keys,
    ]);
    const { createHmac } = await import("node:crypto");
    const { authConfig } = await import("../src/auth/config");
    const globalKey = createHmac("sha256", authConfig().secret)
      .update("bunkercode-sql-limit-v1\0installation")
      .digest("hex");
    await db.query('UPDATE "SqlQuota" SET "count"=60 WHERE "key"=$1', [
      globalKey,
    ]);
    await assert.rejects(admission.consume(randomUUID(), "submit"), {
      status: 429,
    });
    // Expiration is bounded cleanup of quota metadata, never account data.
    await db.query(
      'UPDATE "SqlQuota" SET "expiresAt"=clock_timestamp()-interval \'1 second\' WHERE "key"=$1',
      [globalKey],
    );
    await admission.consume(randomUUID(), "submit");
  } finally {
    await db.query('DELETE FROM "SqlQuota" WHERE "key"=ANY($1::text[])', [
      keys,
    ]);
    await admission.close();
    await db.end();
  }
});
