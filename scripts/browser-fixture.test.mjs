import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  symlinkSync,
  existsSync,
  rmSync,
} from "node:fs";
import { withBrowserFixture } from "./browser-fixture.mjs";

const owned = () => {
  const path = join(tmpdir(), `bunkercode-browser-content-${randomUUID()}`);
  return {
    BUNKERCODE_BROWSER_CONTENT_DIR: path,
    BUNKERCODE_BROWSER_OWNED_CONTENT_DIR: path,
  };
};
test("browser fixture cleans success and controlled failure without touching another run or symlink targets", async () => {
  const source = mkdtempSync(join(tmpdir(), "browser-source-"));
  const outside = mkdtempSync(join(tmpdir(), "browser-outside-"));
  writeFileSync(join(source, "lesson.md"), "canonical");
  writeFileSync(join(outside, "keep.md"), "evidence");
  try {
    for (const profile of ["authoring", "public"]) {
      for (const failure of [false, true]) {
        const env = { ...owned(), BUNKERCODE_PROFILE: profile };
        const other = owned();
        mkdirSync(other.BUNKERCODE_BROWSER_CONTENT_DIR);
        const promise = withBrowserFixture(env, source, async (path) => {
          assert.equal(
            readFileSync(join(path, "lesson.md"), "utf8"),
            "canonical",
          );
          symlinkSync(outside, join(path, "link"));
          if (failure) throw new Error("controlled failure");
        });
        if (failure) await assert.rejects(promise, /controlled failure/);
        else await promise;
        assert.equal(existsSync(env.BUNKERCODE_BROWSER_CONTENT_DIR), false);
        assert.equal(existsSync(other.BUNKERCODE_BROWSER_CONTENT_DIR), true);
        assert.equal(
          readFileSync(join(outside, "keep.md"), "utf8"),
          "evidence",
        );
        rmSync(other.BUNKERCODE_BROWSER_CONTENT_DIR, { recursive: true });
      }
    }
    await withBrowserFixture(
      { BUNKERCODE_BROWSER_CONTENT_DIR: outside },
      source,
      async (path) => assert.equal(path, outside),
    );
    assert.equal(readFileSync(join(outside, "keep.md"), "utf8"), "evidence");
    assert.equal(existsSync(join(outside, "lesson.md")), false);
    await assert.rejects(
      withBrowserFixture(
        { BUNKERCODE_BROWSER_CONTENT_DIR: source },
        source,
        async () =>
          assert.fail("Canonical content must not become a writable fixture"),
      ),
      /canonical content/,
    );
    const occupied = owned();
    mkdirSync(occupied.BUNKERCODE_BROWSER_CONTENT_DIR);
    await assert.rejects(
      withBrowserFixture(occupied, source, async () => {}),
      /EEXIST/,
    );
    assert.equal(existsSync(occupied.BUNKERCODE_BROWSER_CONTENT_DIR), true);
    rmSync(occupied.BUNKERCODE_BROWSER_CONTENT_DIR, { recursive: true });
    symlinkSync(outside, join(source, "unexpected"));
    const invalid = owned();
    await assert.rejects(
      withBrowserFixture(invalid, source, async () => {}),
      /Symlink/,
    );
    assert.equal(existsSync(invalid.BUNKERCODE_BROWSER_CONTENT_DIR), false);
  } finally {
    rmSync(source, { recursive: true });
    rmSync(outside, { recursive: true });
  }
});
