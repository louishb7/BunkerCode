import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  parseCourse as parseCanonical,
  parseNewLesson,
} from "@bunkercode/content";
import { createLesson } from "@bunkercode/content/authoring";
import { parseCourse as parseBackend } from "../../backend/src/content/courses";
import { parseCourse as parseFrontend, parseLesson } from "../src/courses/api";

const alpha = { slug: "alpha", title: "Alpha" };
const beta = { slug: "beta", title: "Beta" };
const legacy = {
  id: "legacy",
  title: "Legacy",
  description: "Curso sem módulos.",
  lessons: [beta, alpha],
};
const fundamentals = {
  id: "fundamentals",
  title: "Fundamentos",
  description: "Base do curso.",
};
const application = { id: "application", title: "Aplicação" };
const modular = {
  id: "modular",
  title: "Modular",
  description: "Curso com módulos.",
  shortDescription: "Módulos e ordem global.",
  modules: [fundamentals, application],
  lessons: [
    { ...beta, moduleId: "fundamentals" },
    { ...alpha, moduleId: "fundamentals" },
    { slug: "gamma", title: "Gamma", moduleId: "application" },
    { slug: "delta", title: "Delta", moduleId: "application" },
  ],
};

function courseId(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return "fixture-course";
  const id = (value as Record<string, unknown>).id;
  return typeof id === "string" ? id : "fixture-course";
}

const canonical = (value: unknown) => parseCanonical(value, courseId(value));
const backend = (value: unknown) => parseBackend(value, courseId(value));
const frontend = (value: unknown) => parseFrontend(value);

const accepted: { name: string; value: unknown }[] = [
  { name: "legacy course without modules", value: legacy },
  {
    name: "single module",
    value: {
      ...legacy,
      modules: [{ id: "only", title: "Único" }],
      lessons: legacy.lessons.map((lesson) => ({
        ...lesson,
        moduleId: "only",
      })),
    },
  },
  { name: "multiple modules in global lesson order", value: modular },
  {
    name: "optional module description",
    value: {
      ...modular,
      modules: [
        { id: "fundamentals", title: "Fundamentos" },
        { id: "application", title: "Aplicação", description: "Prática." },
      ],
    },
  },
  {
    name: "optional short description",
    value: { ...legacy, shortDescription: "Resumo curto." },
  },
  {
    name: "course without lessons",
    value: { ...legacy, lessons: [] },
  },
];

const rejected: { name: string; value: unknown }[] = [
  {
    name: "legacy course with a module reference",
    value: { ...legacy, lessons: [{ ...alpha, moduleId: "fundamentals" }] },
  },
  {
    name: "modular course with a lesson outside modules",
    value: {
      ...modular,
      lessons: [{ ...modular.lessons[0], moduleId: undefined }],
    },
  },
  {
    name: "duplicate lesson slugs",
    value: { ...legacy, lessons: [alpha, alpha] },
  },
  {
    name: "duplicate lesson slugs across modules",
    value: {
      ...modular,
      lessons: [
        { ...modular.lessons[0] },
        { ...modular.lessons[2], slug: "beta" },
        modular.lessons[2],
        modular.lessons[3],
      ],
    },
  },
  {
    name: "duplicate module identities",
    value: { ...modular, modules: [fundamentals, fundamentals] },
  },
  {
    name: "lesson in an unknown module",
    value: {
      ...modular,
      lessons: [{ ...modular.lessons[0], moduleId: "missing" }],
    },
  },
  { name: "empty modules list", value: { ...modular, modules: [] } },
  {
    name: "module without lessons",
    value: {
      ...modular,
      modules: [...modular.modules, { id: "extra", title: "Extra" }],
    },
  },
  {
    name: "non-contiguous module lessons",
    value: {
      ...modular,
      lessons: [
        modular.lessons[0],
        modular.lessons[2],
        modular.lessons[1],
        modular.lessons[3],
      ],
    },
  },
  {
    name: "module declaration order mismatch",
    value: { ...modular, modules: [application, fundamentals] },
  },
  {
    name: "invalid module identity",
    value: {
      ...modular,
      modules: [{ id: "Fundamentos", title: "Fundamentos" }, application],
    },
  },
  {
    name: "empty module description",
    value: {
      ...modular,
      modules: [{ ...fundamentals, description: "" }, application],
    },
  },
  {
    name: "unknown module field",
    value: {
      ...modular,
      modules: [{ ...fundamentals, order: 1 }, application],
    },
  },
  {
    name: "unknown lesson field",
    value: { ...legacy, lessons: [{ ...alpha, activityId: "old" }] },
  },
  { name: "unknown course field", value: { ...legacy, retired: true } },
  {
    name: "missing course identity",
    value: {
      title: legacy.title,
      description: legacy.description,
      lessons: legacy.lessons,
    },
  },
  { name: "missing course title", value: { ...legacy, title: undefined } },
  {
    name: "missing course description",
    value: { ...legacy, description: undefined },
  },
  { name: "missing lessons list", value: { ...legacy, lessons: undefined } },
  { name: "lessons not a list", value: { ...legacy, lessons: { alpha } } },
  { name: "lesson not an object", value: { ...legacy, lessons: [null] } },
  { name: "lesson as text", value: { ...legacy, lessons: ["alpha"] } },
  {
    name: "modules not a list",
    value: { ...legacy, modules: { only: "Único" } },
  },
  {
    name: "module not an object",
    value: { ...modular, modules: [null, application] },
  },
  {
    name: "null short description",
    value: { ...legacy, shortDescription: null },
  },
  {
    name: "empty short description",
    value: { ...legacy, shortDescription: "" },
  },
  {
    name: "whitespace short description",
    value: { ...legacy, shortDescription: "   " },
  },
  {
    name: "oversized short description",
    value: { ...legacy, shortDescription: "x".repeat(161) },
  },
  {
    name: "oversized course title",
    value: { ...legacy, title: "x".repeat(161) },
  },
  {
    name: "oversized course description",
    value: { ...legacy, description: "x".repeat(801) },
  },
  { name: "invalid course identity", value: { ...legacy, id: "Legacy" } },
  {
    name: "invalid lesson identity",
    value: { ...legacy, lessons: [{ slug: "../secret", title: "Bad" }] },
  },
  {
    name: "oversized lesson title",
    value: { ...legacy, lessons: [{ ...alpha, title: "x".repeat(161) }] },
  },
  {
    name: "oversized module title",
    value: {
      ...modular,
      modules: [{ ...fundamentals, title: "x".repeat(161) }, application],
    },
  },
  {
    name: "oversized module description",
    value: {
      ...modular,
      modules: [{ ...fundamentals, description: "x".repeat(401) }, application],
    },
  },
];

for (const fixture of accepted)
  test(`content parity accepts ${fixture.name}`, () => {
    assert.doesNotThrow(() => canonical(fixture.value));
    assert.doesNotThrow(() => backend(fixture.value));
    assert.doesNotThrow(() => frontend(fixture.value));
    const expected = canonical(structuredClone(fixture.value));
    assert.deepEqual(backend(structuredClone(fixture.value)), expected);
    assert.deepEqual(frontend(structuredClone(fixture.value)), expected);
  });

for (const fixture of rejected)
  test(`content parity rejects ${fixture.name}`, () => {
    assert.throws(() => canonical(fixture.value));
    assert.throws(() => backend(fixture.value));
    assert.throws(() => frontend(fixture.value));
  });

test("route identity is enforced by page scope, not by the transport parser", () => {
  const value = { ...legacy, id: "other" };
  assert.throws(() => parseCanonical(value, "legacy"));
  assert.throws(() => parseBackend(value, "legacy"));
  assert.equal(frontend(value).id, "other");
});

test("lesson transport validation keeps its own fields while enforcing the manifest contract", () => {
  const lesson = {
    slug: "beta",
    title: "Beta",
    course: legacy,
    markdown: "# Beta",
    version: "a".repeat(64),
    previous: null,
    next: alpha,
  };
  assert.doesNotThrow(() => parseLesson(lesson));
  assert.throws(() => parseLesson({ ...lesson, retired: true }));
  assert.throws(() =>
    parseLesson({
      ...lesson,
      course: { ...legacy, retired: true },
    }),
  );
});

test("authoring output remains accepted by every manifest parser", async () => {
  const root = await mkdtemp(join(tmpdir(), "bunkercode-parity-"));
  try {
    for (const [folder, manifest, moduleId] of [
      ["legacy", legacy, undefined],
      ["modular", modular, "application"],
    ] as const) {
      const directory = join(root, folder);
      await mkdir(directory);
      await writeFile(
        join(directory, "course.json"),
        JSON.stringify(manifest, null, 2),
      );
      const file = createLesson(
        folder,
        { slug: "created", title: "  Lição criada  " },
        root,
      );
      assert.equal(await readFile(file, "utf8"), "");
      const written: unknown = JSON.parse(
        await readFile(join(directory, "course.json"), "utf8"),
      );
      assert.doesNotThrow(() => canonical(written));
      assert.doesNotThrow(() => backend(written));
      assert.doesNotThrow(() => frontend(written));
      const lessons = (written as { lessons: Record<string, string>[] })
        .lessons;
      assert.deepEqual(lessons.at(-1), {
        slug: "created",
        title: "Lição criada",
        ...(moduleId ? { moduleId } : {}),
      });
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("authoring rejects the same lesson payloads as parseNewLesson", async () => {
  const root = await mkdtemp(join(tmpdir(), "bunkercode-parity-"));
  try {
    const directory = join(root, "legacy");
    await mkdir(directory);
    const original = JSON.stringify(legacy, null, 2);
    await writeFile(join(directory, "course.json"), original);
    for (const value of [
      { title: "Sem slug" },
      { slug: "UPPER", title: "Maiúsculas" },
      { slug: "empty-title", title: "   " },
      { slug: "two-lines", title: "Duas\nlinhas" },
      { slug: "oversized", title: "x".repeat(161) },
      { slug: "extra", title: "Extra", retired: true },
    ]) {
      assert.throws(() => parseNewLesson(value));
      assert.throws(() => createLesson("legacy", value, root));
    }
    assert.equal(
      await readFile(join(directory, "course.json"), "utf8"),
      original,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
