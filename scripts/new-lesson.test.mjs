import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
  symlinkSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const command = fileURLToPath(new URL("./new-lesson.mjs", import.meta.url));
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "bunkercode-authoring-"));
  const course = join(root, "courses/typescript");
  mkdirSync(course, { recursive: true });
  writeFileSync(
    join(course, "course.json"),
    JSON.stringify({
      id: "typescript",
      title: "TypeScript",
      description: "Authoring test",
      lessons: [],
    }),
  );
  return { root, course };
}
function run(root, slug = "union-types") {
  return spawnSync(
    process.execPath,
    [
      command,
      "--course",
      "typescript",
      "--slug",
      slug,
      "--title",
      "Union Types",
    ],
    { encoding: "utf8", env: { ...process.env, BUNKERCODE_CONTENT_DIR: root } },
  );
}
test("authoring creates a standalone Markdown and appends one manifest entry; duplicate never overwrites", () => {
  const { root, course } = fixture();
  try {
    assert.equal(run(root).status, 0);
    const file = join(course, "lessons/union-types/lesson.md");
    assert.match(readFileSync(file, "utf8"), /^# Union Types/);
    const manifest = readFileSync(join(course, "course.json"), "utf8");
    assert.deepEqual(JSON.parse(manifest).lessons, [
      { slug: "union-types", title: "Union Types" },
    ]);
    writeFileSync(file, "My existing notes.");
    assert.equal(run(root).status, 1);
    assert.equal(readFileSync(file, "utf8"), "My existing notes.");
    assert.equal(readFileSync(join(course, "course.json"), "utf8"), manifest);
    assert.equal(existsSync(join(course, ".lesson-new.lock")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test("authoring refuses invalid slugs and unlisted existing files without changing the manifest", () => {
  const { root, course } = fixture();
  try {
    const before = readFileSync(join(course, "course.json"), "utf8");
    assert.equal(run(root, "../escape").status, 1);
    const path = join(course, "lessons/union-types");
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, "lesson.md"), "Unlisted notes.");
    assert.equal(run(root).status, 1);
    assert.equal(
      readFileSync(join(path, "lesson.md"), "utf8"),
      "Unlisted notes.",
    );
    assert.equal(readFileSync(join(course, "course.json"), "utf8"), before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test("authoring refuses symlink directories and an existing authoring lock", () => {
  const { root, course } = fixture();
  try {
    const outside = join(root, "outside");
    mkdirSync(outside);
    symlinkSync(outside, join(course, "lessons"));
    assert.equal(run(root).status, 1);
    assert.equal(existsSync(join(outside, "union-types")), false);
    rmSync(join(course, "lessons"));
    writeFileSync(join(course, ".lesson-new.lock"), "existing");
    assert.equal(run(root).status, 1);
    assert.equal(
      readFileSync(join(course, ".lesson-new.lock"), "utf8"),
      "existing",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a failed manifest update rolls back only the new lesson and releases the lock", () => {
  const { root, course } = fixture();
  try {
    const manifest = {
      id: "typescript",
      title: "TypeScript",
      description: "Authoring",
      lessons: Array.from({ length: 340 }, (_, index) => ({
        slug: "topic-" + index,
        title: "x".repeat(150),
      })),
    };
    const original = JSON.stringify(manifest);
    assert.ok(Buffer.byteLength(original) < 65536);
    assert.ok(Buffer.byteLength(JSON.stringify(manifest, null, 2)) > 65536);
    writeFileSync(join(course, "course.json"), original);
    assert.equal(run(root).status, 1);
    assert.equal(
      readFileSync(join(course, "course.json"), "utf8"),
      original,
    );
    assert.equal(existsSync(join(course, "lessons/union-types")), false);
    assert.equal(existsSync(join(course, ".lesson-new.lock")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
