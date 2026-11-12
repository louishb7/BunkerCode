// This file owns a process because cleanup failure permanently disables its runner.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { SqlContent } from "../src/sql/content";
import { evaluateSql, sqlRunnerRevision } from "../src/sql/runner";

test("SQL runner fails closed before creation and remains suspended after injected cleanup failure", async () => {
  const root = mkdtempSync(join(tmpdir(), "bunkercode-sql-cli-fault-"));
  const calls = join(root, "calls.jsonl"),
    fault = join(root, "fault");
  writeFileSync(calls, "");
  writeFileSync(fault, "stale");
  writeFileSync(
    join(root, "docker"),
    `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2), fault = fs.readFileSync(${JSON.stringify(fault)}, 'utf8');
fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify(args[0]) + '\\n');
if (args[0] === 'info') console.log('linux|2|["name=seccomp,profile=builtin"]');
else if (args[0] === 'image') console.log('sha256:${"a".repeat(64)}|' + (fault === 'stale' ? 'stale' : '${sqlRunnerRevision()}'));
else if (args[0] === 'create' && fault === 'create') { console.error('Injected create failure'); process.exitCode = 1; }
else if (args[0] === 'start') { process.stdin.resume(); process.stdin.on('end', () => console.log('{"passed":true}')); }
else if (args[0] === 'rm' && fault === 'cleanup') { console.error('Injected removal failure'); process.exitCode = 1; }
`,
    { mode: 0o700 },
  );
  const previousPath = process.env.PATH,
    enabled = process.env.BUNKERCODE_SQL_RUNNER_ENABLED;
  process.env.PATH = root + delimiter + previousPath;
  const store = new SqlContent(resolve("../../content/sql"));
  const definition = store.definition("store-select-columns", 1),
    dataset = store.dataset("store", 1);
  const commands = () =>
    readFileSync(calls, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line: string): unknown => JSON.parse(line));
  try {
    delete process.env.BUNKERCODE_SQL_RUNNER_ENABLED;
    await assert.rejects(evaluateSql(definition, dataset, ["SELECT 1"]), {
      status: 503,
    });
    assert.deepEqual(commands(), []);
    process.env.BUNKERCODE_SQL_RUNNER_ENABLED = "1";
    await assert.rejects(
      evaluateSql(definition, dataset, ["SELECT 1"], AbortSignal.abort()),
      { status: 409 },
    );
    assert.deepEqual(commands(), []);
    await assert.rejects(evaluateSql(definition, dataset, ["SELECT 1"]), {
      status: 503,
    });
    assert.deepEqual(commands(), ["info", "image"]);
    writeFileSync(fault, "create");
    await assert.rejects(
      evaluateSql(definition, dataset, ["SELECT 1"]),
      /Injected create failure/,
    );
    assert.deepEqual(commands().slice(2), ["info", "image", "create", "rm"]);
    writeFileSync(fault, "cleanup");
    await assert.rejects(
      evaluateSql(definition, dataset, ["SELECT 1"]),
      /Falha de limpeza/,
    );
    assert.deepEqual(commands().slice(6), [
      "info",
      "image",
      "create",
      "start",
      "rm",
    ]);
    const before = commands();
    writeFileSync(fault, "none");
    await assert.rejects(evaluateSql(definition, dataset, ["SELECT 1"]), {
      status: 503,
    });
    assert.deepEqual(commands(), before);
  } finally {
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
    if (enabled === undefined) delete process.env.BUNKERCODE_SQL_RUNNER_ENABLED;
    else process.env.BUNKERCODE_SQL_RUNNER_ENABLED = enabled;
  }
});
