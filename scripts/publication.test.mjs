import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

test("publication CLI validates selection bytes, copies only selected payloads and refuses reuse", () => {
  const root = mkdtempSync(join(tmpdir(), "bunkercode-public-cli-"));
  const source = join(root, "source");
  const path = join(source, "courses/open/lessons/first");
  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, "lesson.md"), "# First\n\nPublic CLI fixture.\n");
  writeFileSync(
    join(source, "courses/open/course.json"),
    JSON.stringify({
      id: "open",
      title: "Open",
      description: "CLI fixture",
      lessons: [{ slug: "first", title: "First" }],
    }),
  );
  writeFileSync(join(source, "internal.txt"), "Must not be published");
  const selection = join(root, "selection.json");
  const snapshot = join(root, "snapshot");
  const command = (...args) =>
    spawnSync(
      process.execPath,
      [resolve("scripts/prepare-publication.mjs"), ...args],
      { encoding: "utf8" },
    );
  function restore(path) {
    const directory = lstatSync(path).isDirectory();
    chmodSync(path, directory ? 0o700 : 0o600);
    if (directory)
      for (const name of readdirSync(path)) restore(join(path, name));
  }
  try {
    assert.notEqual(command().status, 0);
    writeFileSync(selection, Buffer.from([0xff]));
    assert.notEqual(command(snapshot, selection, source).status, 0);
    writeFileSync(selection, '{"courses":["open","open"]}');
    assert.notEqual(command(snapshot, selection, source).status, 0);
    writeFileSync(selection, '{"courses":["open"]}');
    const prepared = command(snapshot, selection, source);
    assert.equal(prepared.status, 0, prepared.stderr);
    assert.deepEqual(readdirSync(snapshot), ["courses", "publication.json"]);
    assert.equal(
      readFileSync(
        join(snapshot, "courses/open/lessons/first/lesson.md"),
        "utf8",
      ),
      "# First\n\nPublic CLI fixture.\n",
    );
    assert.equal(lstatSync(snapshot).mode & 0o222, 0);
    assert.notEqual(command(snapshot, selection, source).status, 0);
    // The default snapshot follows the explicit owner selection; fixture courses never leak.
    const selected = join(root, "selected");
    const defaults = command(selected);
    assert.equal(defaults.status, 0, defaults.stderr);
    const owner = JSON.parse(
      readFileSync(resolve("config/publication.json"), "utf8"),
    );
    assert.deepEqual(
      JSON.parse(readFileSync(join(selected, "publication.json"), "utf8")),
      owner,
    );
    assert.deepEqual(
      readdirSync(join(selected, "courses")).sort(),
      owner.courses
        .map((course) => (typeof course === "string" ? course : course.id))
        .sort(),
    );
    assert.equal(
      readdirSync(join(selected, "courses")).includes("open"),
      false,
    );
  } finally {
    restore(root);
    rmSync(root, { recursive: true });
  }
});
