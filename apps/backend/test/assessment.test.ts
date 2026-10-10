import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import { createApplication } from "../src/application";
import { runnerStatus } from "../src/practice/runner";
let app: INestApplication, base: string, revision: string;
const headers = {
  "content-type": "application/json",
  "x-bunkercode-client": "local",
  origin: "http://127.0.0.1:5173",
};
before(async () => {
  const root = await mkdtemp(join(tmpdir(), "bunkercode-assessment-"));
  const dir = join(root, "courses/example/lessons/output");
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(root, "courses/example/course.json"),
    JSON.stringify({
      id: "example",
      title: "Example",
      description: "Fixture",
      lessons: [{ slug: "output", title: "Output" }],
    }),
  );
  await writeFile(join(dir, "lesson.md"), "# Output");
  await writeFile(
    join(dir, "exercise.json"),
    JSON.stringify({
      id: "output",
      title: "Output",
      objective: "Print a value",
      instructions: "Print 42",
      language: "typescript",
      starterCode: "",
      expected: "42 followed by a line break",
      tests: { kind: "stdout", expected: "42\n" },
    }),
  );
  process.env.BUNKERCODE_CONTENT_DIR = root;
  app = await createApplication(true);
  await app.listen(0, "127.0.0.1");
  base =
    "http://127.0.0.1:" + (app.getHttpServer().address() as AddressInfo).port;
  const data = (await (
    await fetch(base + "/content/courses/example/lessons/output/exercise")
  ).json()) as { exercise: { revision: string } };
  revision = data.exercise.revision;
});
after(async () => {
  await app?.close();
  delete process.env.BUNKERCODE_CONTENT_DIR;
});
async function run(source: string, javascript = "console.log(42);") {
  return fetch(base + "/practice/runs", {
    method: "POST",
    headers,
    body: JSON.stringify({
      id: randomUUID(),
      course: "example",
      lesson: "output",
      exercise: "output",
      revision,
      source,
      javascript,
    }),
  });
}
test("server rejects semantic errors and never trusts supplied emitted JavaScript", async (t) => {
  const invalid = await run("const value: string = 42;");
  assert.equal(invalid.status, 422);
  const status = await runnerStatus();
  if (!status.available) {
    t.skip(status.reason);
    return;
  }
  const wrong = await run("console.log(41);");
  assert.equal(wrong.status, 201);
  assert.equal(
    ((await wrong.json()) as { assessment: string }).assessment,
    "failed",
  );
  const correct = await run(
    "const value: number = 42; console.log(value);",
    'throw new Error("client tampering");',
  );
  assert.equal(correct.status, 201);
  assert.equal(
    ((await correct.json()) as { assessment: string }).assessment,
    "passed",
  );
  const empty = await run("const value = 42;");
  assert.equal(
    ((await empty.json()) as { assessment: string }).assessment,
    "failed",
  );
});
