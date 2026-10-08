import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  symlink,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import { DatabaseSync } from "node:sqlite";
import { createApplication } from "../src/application";
import type { Course, Lesson } from "../src/content/courses";

let root: string, courses: string, base: string, app: INestApplication;
const manifest = {
  id: "typescript",
  title: "TypeScript",
  description: "Conteúdo de teste",
  lessons: [
    { slug: "second", title: "Second" },
    { slug: "first", title: "First" },
  ],
};
async function publish(value: unknown) {
  await writeFile(
    join(courses, "typescript/course.json"),
    JSON.stringify(value),
  );
}
async function get(path: string) {
  return fetch(base + path);
}
before(async () => {
  root = await mkdtemp(join(tmpdir(), "bunkercode-content-"));
  courses = join(root, "content/courses");
  for (const slug of ["first", "second"]) {
    const path = join(courses, "typescript/lessons", slug);
    await mkdir(path, { recursive: true });
    await writeFile(join(path, "lesson.md"), "# " + slug + "\n\nExemplo.");
  }
  await publish(manifest);
  process.env.BUNKERCODE_CONTENT_DIR = join(root, "content");
  process.env.BUNKERCODE_DATA_DIR = join(root, "data");
  app = await createApplication(true);
  await app.listen(0, "127.0.0.1");
  base =
    "http://127.0.0.1:" +
    (app.getHttpServer().address() as AddressInfo).port +
    "/content/courses";
});
after(async () => {
  await app?.close();
  delete process.env.BUNKERCODE_CONTENT_DIR;
  delete process.env.BUNKERCODE_DATA_DIR;
  await rm(root, { recursive: true, force: true });
});

test("content is ordered by one manifest, reload observes edits and new lessons/courses without execution", async () => {
  const response = await get("/typescript");
  assert.equal(response.headers.get("cache-control"), "no-store");
  const course = (await response.json()) as Course;
  assert.deepEqual(
    course.lessons.map((entry) => entry.slug),
    ["second", "first"],
  );
  const first = (await (
    await get("/typescript/lessons/second")
  ).json()) as Lesson;
  assert.equal(first.previous, null);
  assert.equal(first.next?.slug, "first");
  const last = (await (
    await get("/typescript/lessons/first")
  ).json()) as Lesson;
  assert.equal(last.previous?.slug, "second");
  assert.equal(last.next, null);
  const marker = join(root, "should-not-execute");
  await writeFile(
    join(courses, "typescript/lessons/first/lesson.md"),
    "# First\n\nSaved revision\n\n~~~javascript\nrequire('node:fs').writeFileSync(" +
      JSON.stringify(marker) +
      ", 'bad');\n~~~",
  );
  assert.match(
    ((await (await get("/typescript/lessons/first")).json()) as Lesson)
      .markdown,
    /Saved revision/,
  );
  await assert.rejects(readFile(marker), { code: "ENOENT" });
  await mkdir(join(courses, "typescript/lessons/third"));
  await writeFile(
    join(courses, "typescript/lessons/third/lesson.md"),
    "# Third\n\nOnly content.",
  );
  await publish({
    ...manifest,
    lessons: [...manifest.lessons, { slug: "third", title: "Third" }],
  });
  assert.equal(
    ((await (await get("/typescript/lessons/first")).json()) as Lesson).next
      ?.slug,
    "third",
  );
  await mkdir(join(courses, "architecture"));
  await writeFile(
    join(courses, "architecture/course.json"),
    JSON.stringify({
      id: "architecture",
      title: "Architecture",
      description: "Another course",
      lessons: [],
    }),
  );
  assert.deepEqual(
    ((await (await get("")).json()) as Course[]).map((entry) => entry.id),
    ["architecture", "typescript"],
  );
  const db = new DatabaseSync(join(root, "data/learning.sqlite"));
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM attempts").get()!.count,
    0,
  );
  db.close();
  await publish(manifest);
});

test("content rejects unknown scope, traversal, malformed manifests and missing lesson files with explicit errors", async () => {
  assert.equal((await get("/unknown")).status, 404);
  assert.equal((await get("/typescript/lessons/unknown")).status, 404);
  assert.equal((await get("/%2e%2e%2fsecret")).status, 400);
  assert.equal((await get("/typescript/lessons/%2e%2e%2fsecret")).status, 400);
  for (const value of [
    null,
    { ...manifest, id: "other" },
    { ...manifest, lessons: [...manifest.lessons, manifest.lessons[0]] },
    { ...manifest, lessons: [{ slug: "../secret", title: "Bad" }] },
  ]) {
    await publish(value);
    assert.equal((await get("/typescript")).status, 422);
  }
  await writeFile(join(courses, "typescript/course.json"), "{ broken JSON");
  assert.equal((await get("/typescript")).status, 422);
  await publish({
    ...manifest,
    lessons: [{ slug: "missing", title: "Missing" }],
  });
  assert.equal((await get("/typescript/lessons/missing")).status, 422);
  await publish(manifest);
});

test("symlinks cannot expose other files through a course, manifest, lesson directory or Markdown file", async () => {
  const manifestPath = join(courses, "typescript/course.json");
  const markdown = join(courses, "typescript/lessons/first/lesson.md");
  const outside = join(root, "private.txt");
  await writeFile(outside, "PRIVATE SENTINEL");
  await rm(markdown);
  await symlink(outside, markdown);
  const response = await get("/typescript/lessons/first");
  assert.equal(response.status, 422);
  assert.doesNotMatch(await response.text(), /PRIVATE SENTINEL/);
  await rm(markdown);
  await writeFile(markdown, "# First");
  await rm(manifestPath);
  await symlink(outside, manifestPath);
  assert.equal((await get("/typescript")).status, 422);
  await rm(manifestPath);
  await publish(manifest);
  const alias = join(courses, "alias");
  await symlink(join(courses, "typescript"), alias);
  assert.equal((await get("/alias")).status, 422);
  assert.equal((await get("")).status, 422);
  await rm(alias);
  const link = join(courses, "typescript/lessons/linked");
  await symlink(join(courses, "typescript/lessons/first"), link);
  await publish({
    ...manifest,
    lessons: [{ slug: "linked", title: "Linked" }],
  });
  assert.equal((await get("/typescript/lessons/linked")).status, 422);
  await publish(manifest);
});

test("oversized lesson content is refused rather than truncated into misleading text", async () => {
  const path = join(courses, "typescript/lessons/first/lesson.md");
  await writeFile(path, "x".repeat(262145));
  assert.equal((await get("/typescript/lessons/first")).status, 422);
  await writeFile(path, "# First\n\nWithin the limit.");
  assert.equal((await get("/typescript/lessons/first")).status, 200);
});
