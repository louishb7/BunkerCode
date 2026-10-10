import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createApplication } from "../src/application";
import { loadExercise } from "../src/content/exercise";
const headers = {
  "content-type": "application/json",
  origin: "http://127.0.0.1:5173",
  "x-bunkercode-client": "local",
  "sec-fetch-site": "same-origin",
};
test("practice HTTP commands preserve origin, identity, revision and byte boundaries without editorial writes", async () => {
  const root = mkdtempSync(join(tmpdir(), "bunkercode-run-http-"));
  const folder = join(root, "courses/demo/lessons/first");
  mkdirSync(folder, { recursive: true });
  writeFileSync(
    join(root, "courses/demo/course.json"),
    JSON.stringify({
      id: "demo",
      title: "Demo",
      description: "Fixture",
      lessons: [{ slug: "first", title: "First" }],
    }),
  );
  writeFileSync(join(folder, "lesson.md"), "# First\n\nCanonical content.");
  writeFileSync(
    join(folder, "exercise.json"),
    JSON.stringify({
      id: "first",
      title: "First",
      objective: "Write",
      instructions: "Write",
      language: "javascript",
      starterCode: "",
      expected: "Observe",
    }),
  );
  const previous = process.env.BUNKERCODE_CONTENT_DIR;
  process.env.BUNKERCODE_CONTENT_DIR = root;
  const app = await createApplication(true);
  await app.listen(0, "127.0.0.1");
  const base = await app.getUrl();
  const definition = loadExercise("demo", "first")!;
  const payload = {
    id: randomUUID(),
    course: "demo",
    lesson: "first",
    exercise: "first",
    revision: definition.revision,
    source: 'console.log("real HTTP");',
    javascript: 'console.log("real HTTP");',
  };
  const before = readFileSync(join(folder, "lesson.md"));
  try {
    const command = (
      value: unknown,
      custom: Record<string, string> = headers,
    ) =>
      fetch(base + "/practice/runs", {
        method: "POST",
        headers: custom,
        body: JSON.stringify(value),
      });
    assert.equal((await command(payload, {})).status, 403);
    assert.equal(
      (
        await command(payload, {
          ...headers,
          origin: "https://foreign.example",
        })
      ).status,
      403,
    );
    assert.equal(
      (await command(payload, { ...headers, "sec-fetch-site": "cross-site" }))
        .status,
      403,
    );
    assert.equal(
      (await command(payload, { ...headers, "content-type": "text/plain" }))
        .status,
      415,
    );
    assert.equal(
      (await command({ ...payload, command: "unsafe" })).status,
      400,
    );
    assert.equal(
      (await command({ ...payload, course: "../demo" })).status,
      400,
    );
    assert.equal(
      (await command({ ...payload, revision: "a".repeat(64) })).status,
      409,
    );
    assert.equal((await command({ ...payload, id: "../escape" })).status, 400);
    const status = (await (await fetch(base + "/practice/runtime")).json()) as {
      available: boolean;
    };
    if (status.available) {
      assert.equal(
        (await command({ ...payload, source: "x".repeat(65537) })).status,
        400,
      );
      const response = await command(payload);
      assert.equal(response.status, 201);
      const result = (await response.json()) as {
        state: string;
        stdout: string;
        id: string;
      };
      assert.equal(result.state, "success");
      assert.equal(result.id, payload.id);
      assert.match(result.stdout, /real HTTP/);
    }
    assert.equal(
      (
        await fetch(base + "/practice/runs/" + randomUUID(), {
          method: "DELETE",
          headers: {},
          body: "{}",
        })
      ).status,
      403,
    );
    assert.deepEqual(readFileSync(join(folder, "lesson.md")), before);
  } finally {
    await app.close();
    if (previous === undefined) delete process.env.BUNKERCODE_CONTENT_DIR;
    else process.env.BUNKERCODE_CONTENT_DIR = previous;
  }
});
