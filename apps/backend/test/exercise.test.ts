import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadExercise } from "../src/content/exercise";
const definition = {
  id: "values",
  title: "Values",
  objective: "Types",
  instructions: "Write inert code",
  language: "typescript",
  starterCode: "const x = 1;",
  expected: "A typed value",
};
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "bunkercode-exercise-"));
  const lesson = join(root, "typescript/lessons/values");
  mkdirSync(lesson, { recursive: true });
  writeFileSync(
    join(root, "typescript/course.json"),
    JSON.stringify({
      id: "typescript",
      title: "TypeScript",
      description: "Fixture",
      lessons: [{ slug: "values", title: "Values" }],
    }),
  );
  writeFileSync(join(lesson, "lesson.md"), "# Values");
  return { root, file: join(lesson, "exercise.json") };
}
test("optional exercise has stable identity and content revision without changing lesson files", () => {
  const { root, file } = fixture();
  assert.equal(loadExercise("typescript", "values", root), null);
  writeFileSync(file, JSON.stringify(definition));
  const first = loadExercise("typescript", "values", root)!;
  assert.equal(first.id, "values");
  assert.match(first.revision, /^[a-f0-9]{64}$/);
  writeFileSync(
    file,
    JSON.stringify({ ...definition, starterCode: "// New starter" }),
  );
  const next = loadExercise("typescript", "values", root)!;
  assert.equal(next.id, first.id);
  assert.notEqual(next.revision, first.revision);
  assert.throws(() => loadExercise("typescript", "../values", root));
  assert.throws(() => loadExercise("typescript", "unknown", root));
});
test("exercise rejects malformed fields, oversized bytes, unsafe paths and non-UTF8 without interpreting code", () => {
  const { root, file } = fixture();
  for (const value of [
    null,
    { ...definition, language: "shell" },
    { ...definition, id: "../escape" },
    { ...definition, command: "touch /tmp/unsafe" },
    { ...definition, starterCode: "x".repeat(32769) },
    { ...definition, objective: "" },
  ]) {
    writeFileSync(file, JSON.stringify(value));
    assert.throws(() => loadExercise("typescript", "values", root));
  }
  writeFileSync(file, " ".repeat(65537));
  assert.throws(() => loadExercise("typescript", "values", root));
  writeFileSync(file, Buffer.from([0xff]));
  assert.throws(() => loadExercise("typescript", "values", root));
  unlinkSync(file);
  symlinkSync(join(root, "typescript/course.json"), file);
  assert.throws(() => loadExercise("typescript", "values", root));
  unlinkSync(file);
  writeFileSync(
    file,
    JSON.stringify({
      ...definition,
      starterCode: "globalThis.__executed = true; <script>alert(1)</script>",
    }),
  );
  assert.match(
    loadExercise("typescript", "values", root)!.starterCode,
    /<script>/,
  );
});
