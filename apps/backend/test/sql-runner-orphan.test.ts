// Dedicated process: orphan detection intentionally suspends its runner permanently.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { SqlContent } from "../src/sql/content";
import {
  evaluateSql,
  sqlRunnerStatus,
  sqlRunnerSuspended,
} from "../src/sql/runner";
import { SqlAdmission } from "../src/sql/admission";
const exec = promisify(execFile);
test(
  "SQL restart refuses an orphan without deleting it and recovery requires an empty daemon",
  { skip: process.env.BUNKERCODE_SQL_RUNNER_ENABLED !== "1" },
  async () => {
    const name = "bunkercode-sql-orphan-test-" + randomUUID(),
      admission = new SqlAdmission();
    const store = new SqlContent(resolve("../../content/sql")),
      definition = store.definition("store-select-columns", 1),
      dataset = store.dataset("store", 1);
    await sqlRunnerStatus();
    const owner = await admission.claim();
    let container: string | undefined;
    try {
      container = (
        await exec("docker", [
          "create",
          "--name",
          name,
          "--label",
          "bunkercode.sql.runner=1",
          "--network",
          "none",
          "bunkercode-sql:local",
        ])
      ).stdout.trim();
      await assert.rejects(
        evaluateSql(definition, dataset, definition.assessment.reference),
        { status: 503 },
      );
      assert.equal(
        (
          await exec("docker", ["inspect", "--format", "{{.Id}}", name])
        ).stdout.trim(),
        container,
      );
      await assert.rejects(
        exec(process.execPath, [
          "--import",
          "tsx",
          "src/sql/recover.ts",
          owner,
          "--consumers-stopped",
        ]),
      );
      await exec("docker", ["rm", container]);
      container = undefined;
      assert.equal(sqlRunnerSuspended(), true);
      // Removing the orphan does not silently unsuspend this process.
      await assert.rejects(
        evaluateSql(definition, dataset, definition.assessment.reference),
        { status: 503 },
      );
      await exec(process.execPath, [
        "--import",
        "tsx",
        "src/sql/recover.ts",
        owner,
        "--consumers-stopped",
      ]);
    } finally {
      if (container) await exec("docker", ["rm", "--force", container]);
      // The local test owns this exact claim; no other metadata is reset.
      await admission.finish(owner, false).catch(() => undefined);
      await admission.close();
    }
  },
);
