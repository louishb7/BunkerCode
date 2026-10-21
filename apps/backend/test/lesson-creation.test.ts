import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import fs from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import { createApplication } from "../src/application";
let root: string, course: string, base: string, app: INestApplication;
const headers = {
  "content-type": "application/json",
  "x-bunkercode-client": "local",
  origin: "http://127.0.0.1:5173",
};
const manifest = () => fs.readFileSync(join(course, "course.json"), "utf8");
const post = (
  slug: string,
  body: unknown = { slug, title: "Nova lição" },
  extra = {},
) =>
  fetch(base + "/typescript/lessons", {
    method: "POST",
    headers: { ...headers, ...extra },
    body: JSON.stringify(body),
  });
before(async () => {
  root = fs.mkdtempSync(join(tmpdir(), "bunkercode-create-"));
  course = join(root, "courses/typescript");
  fs.mkdirSync(join(course, "lessons/existing"), { recursive: true });
  fs.writeFileSync(
    join(course, "lessons/existing/lesson.md"),
    "Notas existentes.",
  );
  fs.writeFileSync(
    join(course, "course.json"),
    JSON.stringify({
      id: "typescript",
      title: "TypeScript",
      description: "Fixture",
      shortDescription: "Resumo editorial preservado na criação.",
      lessons: [{ slug: "existing", title: "Existente" }],
    }),
  );
  process.env.BUNKERCODE_CONTENT_DIR = root;
  app = await createApplication(true);
  await app.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/content/courses`;
});
after(async () => {
  await app?.close();
  delete process.env.BUNKERCODE_CONTENT_DIR;
  fs.rmSync(root, { recursive: true, force: true });
});
test("POST creates an empty Markdown, appends in order and returns a directly readable lesson", async () => {
  const response = await post("new-lesson");
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const result = (await response.json()) as { slug: string; markdown: string };
  assert.equal(result.slug, "new-lesson");
  assert.equal(
    JSON.parse(manifest()).shortDescription,
    "Resumo editorial preservado na criação.",
  );
  assert.equal(JSON.parse(manifest()).description, "Fixture");
  assert.equal(result.markdown, "");
  assert.equal(
    fs.readFileSync(join(course, "lessons/new-lesson/lesson.md"), "utf8"),
    "",
  );
  assert.deepEqual(
    JSON.parse(manifest()).lessons.map((entry: { slug: string }) => entry.slug),
    ["existing", "new-lesson"],
  );
  assert.equal(
    (await fetch(base + "/typescript/lessons/new-lesson")).status,
    200,
  );
  assert.equal(fs.existsSync(join(course, ".lesson-new.lock")), false);
});
test("creation rejects malformed payload, duplicate and missing scope without overwriting existing files", async () => {
  const before = manifest();
  for (const body of [
    null,
    [],
    {},
    { title: "Title", slug: "../escape" },
    { title: " ", slug: "valid" },
    { title: "bad\nheading", slug: "valid" },
    { title: "bad\ud800", slug: "valid" },
    { title: "x".repeat(161), slug: "valid" },
    { title: "Title", slug: "valid", path: "/tmp/escape" },
  ])
    assert.equal((await post("unused", body)).status, 400);
  assert.equal((await post("existing")).status, 409);
  const target = join(course, "lessons/unlisted");
  fs.mkdirSync(target);
  fs.writeFileSync(join(target, "lesson.md"), "Unlisted author text.");
  assert.equal((await post("unlisted")).status, 409);
  assert.equal(
    fs.readFileSync(join(target, "lesson.md"), "utf8"),
    "Unlisted author text.",
  );
  assert.equal(
    (
      await fetch(base + "/absent/lessons", {
        method: "POST",
        headers,
        body: JSON.stringify({ slug: "valid", title: "Valid" }),
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await fetch(base + "/%2e%2e%2fprivate/lessons", {
        method: "POST",
        headers,
        body: JSON.stringify({ slug: "valid", title: "Valid" }),
      })
    ).status,
    400,
  );
  assert.equal(manifest(), before);
  assert.equal(
    fs.readFileSync(join(course, "lessons/existing/lesson.md"), "utf8"),
    "Notas existentes.",
  );
});
test("creation uses the complete canonical manifest validation and refuses symlinks including ancestors", async () => {
  const before = manifest();
  fs.writeFileSync(
    join(course, "course.json"),
    JSON.stringify({ ...JSON.parse(before), unknown: true }),
  );
  assert.equal((await post("bad-manifest")).status, 422);
  fs.writeFileSync(join(course, "course.json"), before);
  const outside = join(root, "outside");
  fs.mkdirSync(outside);
  fs.symlinkSync(outside, join(course, "lessons/symlink"));
  assert.equal((await post("symlink")).status, 409);
  assert.deepEqual(fs.readdirSync(outside), []);
  const moved = join(root, "courses-real");
  fs.renameSync(join(root, "courses"), moved);
  fs.symlinkSync(moved, join(root, "courses"));
  try {
    assert.equal((await post("symlink-root")).status, 422);
  } finally {
    fs.unlinkSync(join(root, "courses"));
    fs.renameSync(moved, join(root, "courses"));
  }
  assert.equal(manifest(), before);
});
test("POST enforces local Origin, Host metadata, JSON and client command with no mutation", async () => {
  const before = manifest();
  for (const extra of [
    { origin: "" },
    { origin: "null" },
    { origin: "https://attacker.example" },
    { "sec-fetch-site": "cross-site" },
    { "x-bunkercode-client": "" },
  ])
    assert.equal((await post("unauthorized", undefined, extra)).status, 403);
  assert.equal(
    (await post("unauthorized", undefined, { "content-type": "text/plain" }))
      .status,
    415,
  );
  assert.equal(
    (
      await fetch(
        base.toUpperCase().replace("HTTP", "http") + "/typescript/lessons",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        },
      )
    ).status,
    403,
  );
  assert.equal(manifest(), before);
});
test("simultaneous requests keep both different slugs and exactly one duplicate; existing locks remain intact", async () => {
  const replies = await Promise.all([
    post("parallel-one"),
    post("parallel-two"),
    post("parallel-one"),
  ]);
  assert.deepEqual(replies.map((r) => r.status).sort(), [201, 201, 409]);
  const slugs = JSON.parse(manifest()).lessons.map(
    (entry: { slug: string }) => entry.slug,
  );
  assert.equal(
    slugs.filter((slug: string) => slug === "parallel-one").length,
    1,
  );
  assert.ok(slugs.includes("parallel-two"));
  const lock = join(course, ".lesson-new.lock");
  fs.writeFileSync(lock, "Other author operation");
  try {
    assert.equal((await post("locked")).status, 409);
    assert.equal(fs.readFileSync(lock, "utf8"), "Other author operation");
  } finally {
    fs.unlinkSync(lock);
  }
});
test("flush and manifest replacement failures clean only owned files and allow a real retry", async (context) => {
  const before = manifest();
  const sync = fs.fsyncSync;
  let calls = 0;
  const fault = context.mock.method(fs, "fsyncSync", (fd: number) => {
    if (++calls === 2) throw new Error("Injected lesson flush failure");
    sync(fd);
  });
  assert.equal((await post("flush-fault")).status, 500);
  fault.mock.restore();
  assert.equal(manifest(), before);
  assert.equal(fs.existsSync(join(course, "lessons/flush-fault")), false);
  const replace = context.mock.method(fs, "renameSync", () => {
    throw new Error("Injected manifest publication failure");
  });
  assert.equal((await post("rename-fault")).status, 500);
  replace.mock.restore();
  assert.equal(manifest(), before);
  assert.equal(fs.existsSync(join(course, "lessons/rename-fault")), false);
  assert.equal(fs.existsSync(join(course, ".lesson-new.lock")), false);
  assert.equal(
    fs.readdirSync(course).filter((name) => name.startsWith(".course-")).length,
    0,
  );
  assert.equal((await post("rename-fault")).status, 201);
});
test("external manifest edits are detected and externally edited new content is preserved with its journal", async (context) => {
  const before = manifest();
  const sync = fs.fsyncSync;
  let calls = 0;
  const external = before + "\n ";
  const hook = context.mock.method(fs, "fsyncSync", (fd: number) => {
    sync(fd);
    if (++calls === 3) fs.writeFileSync(join(course, "course.json"), external);
  });
  assert.equal((await post("manifest-race")).status, 409);
  hook.mock.restore();
  assert.equal(manifest(), external);
  assert.equal(fs.existsSync(join(course, "lessons/manifest-race")), false);
  const editedFile = join(course, "lessons/author-race/lesson.md");
  const replace = context.mock.method(fs, "renameSync", () => {
    fs.writeFileSync(editedFile, "Externally written author content.");
    throw new Error("Publication interrupted");
  });
  assert.equal((await post("author-race")).status, 500);
  replace.mock.restore();
  assert.equal(
    fs.readFileSync(editedFile, "utf8"),
    "Externally written author content.",
  );
  const lock = join(course, ".lesson-new.lock");
  assert.equal(JSON.parse(fs.readFileSync(lock, "utf8")).slug, "author-race");
  assert.equal((await post("blocked-after-race")).status, 409);
  fs.unlinkSync(lock); // Explicit recovery of disposable test fixture only.
});
test("process death before and after manifest publication leaves an inspectable lock and never publishes a missing file", async () => {
  const modulePath = resolve(require.resolve("@bunkercode/content/authoring"));
  for (const phase of ["before", "after"]) {
    const slug = `crash-${phase}`;
    const child = spawnSync(
      process.execPath,
      [
        "-e",
        `
      const fs = require('node:fs');
      const { createLesson } = require(${JSON.stringify(modulePath)});
      const rename = fs.renameSync;
      fs.renameSync = (...args) => { ${phase === "after" ? "rename(...args);" : ""} process.exit(75); };
      createLesson('typescript', { slug: ${JSON.stringify(slug)}, title: 'Crash fixture' }, ${JSON.stringify(join(root, "courses"))});
    `,
      ],
      { encoding: "utf8" },
    );
    assert.equal(child.status, 75, child.stderr);
    const file = join(course, `lessons/${slug}/lesson.md`);
    assert.equal(fs.readFileSync(file, "utf8"), "");
    const journal = JSON.parse(
      fs.readFileSync(join(course, ".lesson-new.lock"), "utf8"),
    );
    assert.equal(journal.slug, slug);
    const listed = JSON.parse(manifest()).lessons.some(
      (entry: { slug: string }) => entry.slug === slug,
    );
    assert.equal(listed, phase === "after");
    assert.equal((await post("blocked-by-interruption")).status, 409);
    assert.equal(fs.existsSync(file), true);
    fs.unlinkSync(join(course, ".lesson-new.lock"));
  }
});

test("an uncertain publication keeps referenced content and requires inspection before retry", async (context) => {
  const rename = fs.renameSync;
  const fault = context.mock.method(
    fs,
    "renameSync",
    (...args: Parameters<typeof fs.renameSync>) => {
      rename(...args);
      throw new Error("Injected failure after publication");
    },
  );
  assert.equal((await post("uncertain-publication")).status, 500);
  fault.mock.restore();
  assert.ok(
    JSON.parse(manifest()).lessons.some(
      (entry: { slug: string }) => entry.slug === "uncertain-publication",
    ),
  );
  assert.equal(
    fs.readFileSync(
      join(course, "lessons/uncertain-publication/lesson.md"),
      "utf8",
    ),
    "",
  );
  assert.equal(
    JSON.parse(fs.readFileSync(join(course, ".lesson-new.lock"), "utf8")).slug,
    "uncertain-publication",
  );
  assert.equal((await post("after-uncertain")).status, 409);
  fs.unlinkSync(join(course, ".lesson-new.lock"));
});
