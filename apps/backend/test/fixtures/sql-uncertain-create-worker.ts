// Separate process because suspension must survive all subsequent calls in it.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { SqlContent } from "../../src/sql/content";
import { evaluateSql, sqlRunnerSuspended } from "../../src/sql/runner";
async function main() {
  const store = new SqlContent(resolve("../../content/sql"));
  const definition = store.definition("store-select-columns", 1),
    dataset = store.dataset("store", 1);
  await assert.rejects(evaluateSql(definition, dataset, ["SELECT 1"]), {
    status: 503,
  });
  assert.equal(sqlRunnerSuspended(), true);
  await assert.rejects(evaluateSql(definition, dataset, ["SELECT 1"]), {
    status: 503,
  });
}
void main().catch(() => {
  process.exitCode = 1;
});
