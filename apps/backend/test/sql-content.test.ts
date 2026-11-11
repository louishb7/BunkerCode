import { saveLesson } from "../src/content/studio";
import { markdownVersion } from "../src/content/markdown-file";
import { preparePublication } from "../src/publication-preparation";
import { validatePublication } from "../src/publication";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  cpSync,
  readdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SqlContent, sqlPublicationFiles } from "../src/sql/content";
import {
  parseSqlDataset,
  parseSqlDefinition,
  publicSqlExercise,
  parsePublicSqlExercise,
} from "@bunkercode/content/sql";
const canonical = new SqlContent(resolve("../../content/sql"));
test("canonical SQL has six immutable definitions, reusable typed dataset and strict private/public projections", () => {
  const list = canonical.list();
  assert.equal(list.length, 6);
  const dataset = canonical.dataset("store", 1);
  assert.equal(dataset.tables.length, 2);
  for (const entry of list) {
    const definition = canonical.definition(entry.id, entry.version);
    assert.deepEqual(
      parsePublicSqlExercise(publicSqlExercise(definition, dataset)),
      entry,
    );
    assert.ok(!("assessment" in entry));
    assert.ok(!("reference" in entry));
  }
  for (const [path, text] of sqlPublicationFiles(resolve("../../content"))) {
    assert.match(path, /^sql\/public\//);
    assert.ok(!text.includes('"assessment"'));
    parsePublicSqlExercise(JSON.parse(text));
  }
  assert.throws(() =>
    parseSqlDefinition({
      ...canonical.definition("store-select-columns", 1),
      passed: true,
    }),
  );
  assert.throws(() =>
    parsePublicSqlExercise({
      ...list[0],
      assessment: { reference: ["secret"] },
    }),
  );
  const invalid = structuredClone(dataset);
  invalid.tables[1]!.rows[0]![1] = 999;
  assert.throws(() => parseSqlDataset(invalid));
});
test("SQL authoring saves bytes, rejects stale drafts, publishes without overwrite and isolates new versions", () => {
  const root = mkdtempSync(join(tmpdir(), "bunkercode-sql-content-"));
  const store = new SqlContent(join(root, "sql"));
  store.saveDataset(canonical.dataset("store", 1));
  const definition = {
    ...canonical.definition("store-select-columns", 1),
    id: "created-through-authoring",
    status: "draft" as const,
  };
  const saved = store.saveDraft(definition, null);
  assert.equal(store.draft(definition.id).revision, saved.revision);
  assert.throws(() =>
    store.saveDraft({ ...definition, title: "Lost edit" }, "wrong"),
  );
  store.publish(definition.id, saved.revision);
  assert.equal(store.public(definition.id, 1).title, definition.title);
  assert.throws(() => store.publish(definition.id, saved.revision));
  const second = store.saveDraft(
    { ...definition, version: 2, title: "New title" },
    saved.revision,
  );
  assert.equal(store.public(definition.id, 1).title, definition.title);
  store.publish(definition.id, second.revision);
  assert.equal(store.public(definition.id, 2).title, "New title");
  assert.throws(() => store.definition(definition.id, 3));
  assert.throws(() => store.public("../outside", 1));
  const outside = join(root, "outside");
  mkdirSync(outside);
  symlinkSync(outside, join(store.root, "exercises", "linked"));
  assert.throws(() => store.public("linked", 1));
  const file = join(store.root, "exercises", definition.id, "1.json");
  const bytes = readFileSync(file, "utf8");
  assert.equal(JSON.parse(bytes).status, "published");
  writeFileSync(file, bytes); // external editing is a documented Git review responsibility.
});

test("Studio and publication resolve SQL references and refuse mixed JavaScript sidecars without leaking private files", () => {
  const root = mkdtempSync(join(tmpdir(), "bunkercode-sql-publication-")),
    source = join(root, "content"),
    courses = join(source, "courses");
  cpSync(canonical.root, join(source, "sql"), { recursive: true });
  const directory = join(courses, "demo/lessons/first");
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(courses, "demo/course.json"),
    JSON.stringify({
      id: "demo",
      title: "Demo",
      description: "Fixture",
      lessons: [{ slug: "first", title: "First" }],
    }),
  );
  const file = join(directory, "lesson.md"),
    initial = "# First\n";
  writeFileSync(file, initial);
  const markdown =
    '# First\n```bunker-sql\n{"kind":"sql","exerciseId":"store-select-columns","version":1}\n```';
  const saved = saveLesson(
    "demo",
    "first",
    { markdown, version: markdownVersion(initial) },
    courses,
  );
  assert.equal(readFileSync(file, "utf8"), markdown);
  assert.throws(() =>
    saveLesson(
      "demo",
      "first",
      {
        markdown: markdown.replace("store-select-columns", "missing"),
        version: saved.version,
      },
      courses,
    ),
  );
  const snapshot = join(root, "snapshot");
  preparePublication(source, { courses: ["demo"] }, snapshot);
  validatePublication(snapshot);
  assert.deepEqual(readdirSync(join(snapshot, "sql")), ["public"]);
  assert.ok(
    !readFileSync(
      join(snapshot, "sql/public/store-select-columns/1.json"),
      "utf8",
    ).includes("assessment"),
  );
  writeFileSync(
    join(directory, "exercise.json"),
    JSON.stringify({
      id: "code",
      title: "Code",
      objective: "Print",
      instructions: "Print",
      language: "javascript",
      starterCode: "",
      expected: "ok",
      tests: { kind: "stdout", expected: "ok\n" },
    }),
  );
  assert.throws(
    () =>
      saveLesson(
        "demo",
        "first",
        { markdown, version: saved.version },
        courses,
      ),
    /misturar/,
  );
  assert.throws(
    () =>
      preparePublication(source, { courses: ["demo"] }, join(root, "mixed")),
    /mix SQL/,
  );
  assert.equal(readFileSync(file, "utf8"), markdown);
});
