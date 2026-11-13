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
  rmSync,
  chmodSync,
  lstatSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SqlContent, sqlPublicationFiles } from "../src/sql/content";
import {
  parseSqlDataset,
  parseSqlDefinition,
  publicSqlExercise,
  parsePublicSqlExercise,
  validateSqlSequenceExercises,
} from "@bunkercode/content/sql";
import {
  parseSqlPlacement,
  lessonSqlPlacement,
  setLessonSqlPlacement,
} from "@bunkercode/content";
import { loadLesson } from "../src/content/courses";
const canonical = new SqlContent(resolve("../../content/sql"));
test("canonical SQL has six curated exercises and immutable versions, reusable typed dataset and strict private/public projections", () => {
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
    if (path === "sql/laboratory.json") {
      assert.deepEqual(JSON.parse(text).exercises, canonical.laboratory());
      continue;
    }
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
  assert.throws(() => store.public(definition.id, 1));
  assert.throws(() =>
    store.saveDraft({ ...definition, title: "Lost edit" }, "wrong"),
  );
  store.publish(definition.id, saved.revision);
  assert.equal(store.public(definition.id, 1).title, definition.title);
  assert.deepEqual(store.list(), []);
  assert.ok(store.versions().some((entry) => entry.id === definition.id));
  writeFileSync(
    join(store.root, "laboratory.json"),
    JSON.stringify({ exercises: [{ id: definition.id, version: 1 }] }),
  );
  assert.deepEqual(
    store.list().map((entry) => entry.id),
    [definition.id],
  );
  assert.throws(() => store.publish(definition.id, saved.revision));
  const second = store.saveDraft(
    { ...definition, version: 2, title: "New title" },
    saved.revision,
  );
  assert.equal(store.public(definition.id, 1).title, definition.title);
  store.publish(definition.id, second.revision);
  assert.equal(store.public(definition.id, 2).title, "New title");
  assert.equal(store.list()[0]!.version, 1);
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

test("SQL laboratory selection fails closed for duplicate, unknown and draft references", () => {
  const root = mkdtempSync(join(tmpdir(), "bunkercode-sql-curation-"));
  cpSync(canonical.root, root, { recursive: true });
  const store = new SqlContent(root);
  store.saveDraft(
    {
      ...canonical.definition("store-select-columns", 1),
      id: "draft-only",
      status: "draft",
    },
    null,
  );
  for (const exercises of [
    [
      { id: "store-select-columns", version: 1 },
      { id: "store-select-columns", version: 1 },
    ],
    [{ id: "store-select-columns", version: 99 }],
    [{ id: "draft-only", version: 1 }],
    [{ id: "../outside", version: 1 }],
  ]) {
    writeFileSync(join(root, "laboratory.json"), JSON.stringify({ exercises }));
    assert.throws(() => store.list());
  }
});

test("Studio and publication resolve SQL references and refuse mixed JavaScript sidecars without leaking private files", () => {
  const root = mkdtempSync(join(tmpdir(), "bunkercode-sql-publication-")),
    source = join(root, "content"),
    courses = join(source, "courses");
  cpSync(canonical.root, join(source, "sql"), { recursive: true });
  const sql = new SqlContent(join(source, "sql"));
  const draft = sql.saveDraft(
    {
      ...canonical.definition("store-select-columns", 1),
      id: "lesson-only",
      status: "draft",
    },
    null,
  );
  sql.publish("lesson-only", draft.revision);
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
    '# First\n```bunker-sql\n{"kind":"sql","exerciseId":"lesson-only","version":1}\n```';
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
        markdown: markdown.replace("lesson-only", "missing"),
        version: saved.version,
      },
      courses,
    ),
  );
  const snapshot = join(root, "snapshot");
  preparePublication(source, { courses: ["demo"] }, snapshot);
  validatePublication(snapshot);
  assert.deepEqual(readdirSync(join(snapshot, "sql")), [
    "laboratory.json",
    "public",
  ]);
  const published = new SqlContent(join(snapshot, "sql"));
  assert.equal(published.public("lesson-only", 1).id, "lesson-only");
  assert.ok(!published.list().some((entry) => entry.id === "lesson-only"));
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

test("opt-in public oracle is bounded, version-bound, derived and cannot be reused by edited drafts", async () => {
  const { generateFormativeOracle } =
    await import("@bunkercode/content/sql-grading");
  const root = mkdtempSync(join(tmpdir(), "bunkercode-sql-formative-"));
  const store = new SqlContent(root);
  const dataset = canonical.dataset("store", 1);
  store.saveDataset(dataset);
  const definition = parseSqlDefinition({
    ...canonical.definition("store-select-columns", 1),
    id: "public-material",
    status: "draft",
    formative: { kind: "public-result" },
  });
  const saved = store.saveDraft(definition, null);
  const oracle = await generateFormativeOracle(definition, dataset);
  for (const reference of [
    "SELECT random() AS value",
    "SELECT * FROM generate_series(1,101)",
    "SELECT repeat('x',70000) AS value",
  ]) {
    await assert.rejects(
      generateFormativeOracle(
        {
          ...definition,
          assessment: { reference: [reference], orderMatters: false },
        },
        dataset,
      ),
    );
  }
  await assert.rejects(
    generateFormativeOracle({ ...definition, formative: undefined }, dataset),
  );

  assert.throws(() => store.publish(definition.id, saved.revision));
  assert.throws(() =>
    store.publish(definition.id, saved.revision, {
      ...oracle,
      exercise: { ...oracle.exercise, version: 2 },
    }),
  );
  store.publish(definition.id, saved.revision, oracle);
  const payload = store.public(definition.id, 1);
  assert.deepEqual(
    parsePublicSqlExercise(JSON.parse(JSON.stringify(payload))),
    payload,
  );
  assert.ok(
    !JSON.stringify(payload).includes(definition.assessment.reference[0]!),
  );
  assert.equal(payload.formative?.expected.rows.length, 4);
  for (const changed of [
    { ...payload, version: 2 },
    { ...payload, dataset: { ...payload.dataset, version: 2 } },
    { ...payload, mode: "mutation" },
    { ...payload, formative: { ...oracle, privateCases: ["secret"] } },
    {
      ...payload,
      formative: {
        ...oracle,
        expected: { ...oracle.expected, truncated: true },
      },
    },
    {
      ...payload,
      formative: {
        ...oracle,
        expected: {
          ...oracle.expected,
          rows: Array(101).fill(oracle.expected.rows[0]),
        },
      },
    },
    {
      ...payload,
      formative: {
        ...oracle,
        expected: {
          ...oracle.expected,
          rows: ['[["string","' + "x".repeat(65536) + '"]]'],
        },
      },
    },
  ])
    assert.throws(() => parsePublicSqlExercise(changed));
  assert.throws(() =>
    parseSqlDefinition({
      ...definition,
      formative: { kind: "public-result", oracle },
    }),
  );
  assert.throws(() => parseSqlDefinition({ ...definition, mode: "mutation" }));
  const second = store.saveDraft(
    {
      ...definition,
      version: 2,
      assessment: {
        ...definition.assessment,
        reference: ["SELECT name FROM customers"],
      },
    },
    saved.revision,
  );
  assert.equal(store.public(definition.id, 1).formative?.exercise.version, 1);
  assert.throws(() =>
    store.publish(definition.id, second.revision, {
      ...oracle,
      exercise: { ...oracle.exercise, version: 2 },
    }),
  );
  const file = join(root, "exercises", definition.id, "1.json");
  const published = JSON.parse(readFileSync(file, "utf8"));
  published.assessment.reference = ["SELECT name FROM customers"];
  writeFileSync(file, JSON.stringify(published));
  assert.throws(() => store.public(definition.id, 1), /desatualizado/);
});

test("SQL task references preserve stable identities and reject malformed, repeated and unsupported sequences", () => {
  const tasks = [
    {
      taskId: "choose-columns",
      exerciseId: "store-select-columns",
      version: 2,
    },
    {
      taskId: "choose-customers",
      exerciseId: "store-customers-recife",
      version: 2,
    },
    { taskId: "combine-concepts", exerciseId: "store-filter-sort", version: 2 },
  ];
  const sequence = { kind: "sql-task-sequence", tasks };
  const markdown = setLessonSqlPlacement(
    "# Lesson\r\n\r\nKeep this text.\r\n",
    parseSqlPlacement(sequence),
  );
  assert.deepEqual(lessonSqlPlacement(markdown), sequence);
  const reordered = { ...sequence, tasks: [tasks[2]!, tasks[0]!, tasks[1]!] };
  assert.deepEqual(
    lessonSqlPlacement(
      setLessonSqlPlacement(markdown, parseSqlPlacement(reordered)),
    ),
    reordered,
  );
  assert.match(markdown, /^# Lesson\r\n\r\nKeep this text\.\r\n/);
  for (const value of [
    { ...sequence, tasks: [] },
    {
      ...sequence,
      tasks: Array.from({ length: 13 }, (_, i) => ({
        taskId: `task-${i}`,
        exerciseId: `exercise-${i}`,
        version: 1,
      })),
    },
    {
      ...sequence,
      tasks: [tasks[0], { ...tasks[1], taskId: tasks[0]!.taskId }],
    },
    { ...sequence, tasks: [tasks[0], { ...tasks[0], taskId: "different-id" }] },
    { ...sequence, tasks: [{ ...tasks[0], version: 0 }] },
    { ...sequence, tasks: [{ ...tasks[0], version: 1000001 }] },
    { ...sequence, tasks: [{ ...tasks[0], exerciseId: "../outside" }] },
    { ...sequence, tasks: [{ ...tasks[0], taskId: "invalid id" }] },
    { ...sequence, tasks: [{ ...tasks[0], passed: true }] },
    { ...sequence, tasks: "not-an-array" },
    { ...sequence, dataset: "parallel-registry" },
    { kind: "mutation-task-sequence", tasks },
  ])
    assert.throws(() => parseSqlPlacement(value));
  const exercises = canonical.resolvePlacement(parseSqlPlacement(sequence));
  validateSqlSequenceExercises(exercises);
  assert.throws(
    () =>
      validateSqlSequenceExercises([
        exercises[0]!,
        { ...exercises[1]!, dataset: { id: "different", version: 1 } },
      ]),
    /mesmo dataset/,
  );
  assert.throws(
    () =>
      validateSqlSequenceExercises([
        exercises[0]!,
        { ...exercises[1]!, setupSql: "different preparation" },
      ]),
    /mesmo dataset/,
  );
  assert.throws(
    () =>
      canonical.resolvePlacement(
        parseSqlPlacement({
          ...sequence,
          tasks: [
            {
              taskId: "unsupported",
              exerciseId: "store-update-city",
              version: 1,
            },
          ],
        }),
      ),
    /SELECT/,
  );
  assert.throws(
    () =>
      canonical.resolvePlacement(
        parseSqlPlacement({
          ...sequence,
          tasks: [{ ...tasks[0], version: 1 }],
        }),
      ),
    /formativo/,
  );
});

test("Studio saves and reorders SQL sequences, rejects unresolved references and publishes public tasks without changing course navigation", () => {
  const root = mkdtempSync(join(tmpdir(), "bunkercode-sql-sequence-"));
  try {
    const source = join(root, "content"),
      courses = join(source, "courses");
    cpSync(canonical.root, join(source, "sql"), { recursive: true });
    new SqlContent(join(source, "sql")).saveDraft(
      {
        ...canonical.definition("store-select-columns", 1),
        id: "draft-only",
        status: "draft",
      },
      null,
    );
    for (const slug of ["first", "second"]) {
      mkdirSync(join(courses, "demo/lessons", slug), { recursive: true });
      writeFileSync(
        join(courses, "demo/lessons", slug, "lesson.md"),
        `# ${slug}\n`,
      );
    }
    writeFileSync(
      join(courses, "demo/course.json"),
      JSON.stringify({
        id: "demo",
        title: "Demo",
        description: "Sequence fixture",
        lessons: [
          { slug: "first", title: "First" },
          { slug: "second", title: "Second" },
        ],
      }),
    );
    const tasks = [
      { taskId: "columns", exerciseId: "store-select-columns", version: 2 },
      { taskId: "customers", exerciseId: "store-customers-recife", version: 2 },
      { taskId: "filtered-order", exerciseId: "store-filter-sort", version: 2 },
    ];
    const placement = parseSqlPlacement({ kind: "sql-task-sequence", tasks });
    const markdown = setLessonSqlPlacement("# first\n", placement);
    const saved = saveLesson(
      "demo",
      "first",
      { markdown, version: markdownVersion("# first\n") },
      courses,
    );
    assert.deepEqual(
      lessonSqlPlacement(loadLesson("demo", "first", courses).markdown),
      placement,
    );
    assert.equal(loadLesson("demo", "first", courses).next?.slug, "second");
    const version = saved.version;
    for (const exerciseId of ["missing", "draft-only"])
      assert.throws(() =>
        saveLesson(
          "demo",
          "first",
          {
            version,
            markdown: setLessonSqlPlacement(markdown, {
              kind: "sql-task-sequence",
              tasks: [{ taskId: "unresolved", exerciseId, version: 1 }],
            }),
          },
          courses,
        ),
      );
    assert.throws(() =>
      saveLesson(
        "demo",
        "first",
        {
          version,
          markdown: setLessonSqlPlacement(markdown, {
            kind: "sql-task-sequence",
            tasks: [{ ...tasks[0]!, version: 999 }],
          }),
        },
        courses,
      ),
    );
    assert.equal(
      readFileSync(join(courses, "demo/lessons/first/lesson.md"), "utf8"),
      markdown,
    );
    const reordered = setLessonSqlPlacement(markdown, {
      kind: "sql-task-sequence",
      tasks: [...tasks].reverse(),
    });
    saveLesson("demo", "first", { version, markdown: reordered }, courses);
    assert.throws(
      () => saveLesson("demo", "first", { version, markdown }, courses),
      /mudou/,
    );
    const snapshot = join(root, "snapshot");
    preparePublication(source, { courses: ["demo"] }, snapshot);
    validatePublication(snapshot);
    const published = new SqlContent(join(snapshot, "sql"));
    const references = lessonSqlPlacement(
      loadLesson("demo", "first", join(snapshot, "courses")).markdown,
    )!;
    const exercises = published.resolvePlacement(references);
    assert.deepEqual(
      exercises.map((exercise) => exercise.id),
      [...tasks].reverse().map((task) => task.exerciseId),
    );
    for (const exercise of exercises) {
      assert.equal("assessment" in exercise, false);
      assert.equal("reference" in exercise, false);
      assert.equal(exercise.formative?.kind, "public-result");
    }
  } finally {
    const snapshot = join(root, "snapshot");
    const writable = (path: string) => {
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw new Error("Unexpected fixture symlink");
      chmodSync(path, stat.isDirectory() ? 0o700 : 0o600);
      if (stat.isDirectory())
        for (const name of readdirSync(path)) writable(join(path, name));
    };
    if (existsSync(snapshot)) writable(snapshot);
    rmSync(root, { recursive: true, force: true });
  }
});

test("canonical second lesson versions resolve as public projections without private assessment", () => {
  const placement = lessonSqlPlacement(
    readFileSync(
      resolve(
        "../../content/courses/sql-na-pratica/lessons/encontrando-o-que-importa/lesson.md",
      ),
      "utf8",
    ),
  );
  assert.ok(placement && placement.kind === "sql-task-sequence");
  const exercises = canonical.resolvePlacement(placement);
  assert.deepEqual(
    exercises.map(({ id, version, dataset }) => [id, version, dataset.version]),
    [
      ["store-customers-recife", 3, 2],
      ["store-sort-customers", 2, 2],
      ["store-filter-sort", 3, 2],
    ],
  );
  const publicFiles = new Map(sqlPublicationFiles(resolve("../../content")));
  for (const exercise of exercises) {
    assert.equal("assessment" in exercise, false);
    const text = publicFiles.get(
      `sql/public/${exercise.id}/${exercise.version}.json`,
    );
    assert.ok(text);
    assert.deepEqual(parsePublicSqlExercise(JSON.parse(text)), exercise);
    assert.doesNotMatch(text, /"assessment"|"reference"/);
  }
});
