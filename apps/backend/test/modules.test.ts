import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import { createLesson } from "@bunkercode/content/authoring";
import { createApplication } from "../src/application";
import type { Course, Lesson } from "../src/content/courses";

let root: string, courses: string, base: string, app: INestApplication;
const legacy = {
  id: "modular",
  title: "Curso modular",
  description: "Contrato de módulos.",
  lessons: [
    { slug: "second", title: "Second" },
    { slug: "first", title: "First" },
  ],
};
const fundamentals = {
  id: "fundamentos",
  title: "Fundamentos",
  description: "Base do curso.",
};
const application = { id: "aplicacao", title: "Aplicação" };
const modular = {
  ...legacy,
  modules: [fundamentals, application],
  lessons: [
    { slug: "second", title: "Second", moduleId: "fundamentos" },
    { slug: "first", title: "First", moduleId: "fundamentos" },
    { slug: "third", title: "Third", moduleId: "aplicacao" },
    { slug: "fourth", title: "Fourth", moduleId: "aplicacao" },
  ],
};
async function publish(value: unknown) {
  await writeFile(
    join(courses, "modular/course.json"),
    JSON.stringify(value),
  );
}
async function get(path: string) {
  return fetch(base + path);
}
before(async () => {
  root = await mkdtemp(join(tmpdir(), "bunkercode-modules-"));
  courses = join(root, "content/courses");
  for (const slug of ["first", "second", "third", "fourth"]) {
    const path = join(courses, "modular/lessons", slug);
    await mkdir(path, { recursive: true });
    await writeFile(join(path, "lesson.md"), `# ${slug}\n\nExemplo.`);
  }
  await publish(legacy);
  process.env.BUNKERCODE_CONTENT_DIR = join(root, "content");
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
  await rm(root, { recursive: true, force: true });
});

test("legacy courses keep the flat lesson list while one module normalizes the same contract", async () => {
  const beforeModules = (await (await get("/modular")).json()) as Course;
  assert.equal(beforeModules.modules, undefined);
  assert.deepEqual(
    beforeModules.lessons.map((lesson) => lesson.slug),
    ["second", "first"],
  );

  await publish({
    ...legacy,
    modules: [{ id: "unico", title: "Único" }],
    lessons: [
      { slug: "second", title: "Second", moduleId: "unico" },
      { slug: "first", title: "First", moduleId: "unico" },
    ],
  });
  const response = await get("/modular");
  assert.equal(response.status, 200);
  const course = (await response.json()) as Course;
  assert.deepEqual(course.modules, [{ id: "unico", title: "Único" }]);
  assert.deepEqual(course.lessons, [
    { slug: "second", title: "Second", moduleId: "unico" },
    { slug: "first", title: "First", moduleId: "unico" },
  ]);
  await publish(legacy);
});

test("multiple modules preserve global lesson order and navigation crosses module boundaries", async () => {
  await publish(modular);
  try {
    const response = await get("/modular");
    assert.equal(response.status, 200);
    const course = (await response.json()) as Course;
    assert.deepEqual(course.modules, [fundamentals, application]);
    assert.deepEqual(
      course.lessons.map((lesson) => [lesson.slug, lesson.moduleId]),
      [
        ["second", "fundamentos"],
        ["first", "fundamentos"],
        ["third", "aplicacao"],
        ["fourth", "aplicacao"],
      ],
    );

    const second = (await (
      await get("/modular/lessons/second")
    ).json()) as Lesson;
    assert.equal(second.previous, null);
    assert.equal(second.next?.slug, "first");
    const first = (await (await get("/modular/lessons/first")).json()) as Lesson;
    assert.equal(first.previous?.moduleId, "fundamentos");
    assert.equal(first.next?.moduleId, "aplicacao");
    assert.equal(first.next?.slug, "third");
    const third = (await (await get("/modular/lessons/third")).json()) as Lesson;
    assert.equal(third.previous?.slug, "first");
    assert.equal(third.previous?.moduleId, "fundamentos");
    const fourth = (await (
      await get("/modular/lessons/fourth")
    ).json()) as Lesson;
    assert.equal(fourth.next, null);
  } finally {
    await publish(legacy);
  }
});

test("module manifests reject duplicate modules, dangling lessons, empty modules and ambiguous order", async () => {
  const invalid: unknown[] = [
    { ...modular, modules: [fundamentals, fundamentals] },
    {
      ...modular,
      lessons: [
        { ...modular.lessons[0], moduleId: "ausente" },
        modular.lessons[1],
        modular.lessons[2],
        modular.lessons[3],
      ],
    },
    { ...modular, modules: [fundamentals, application, { id: "extra", title: "Extra" }] },
    {
      ...modular,
      lessons: [
        modular.lessons[0],
        modular.lessons[2],
        modular.lessons[1],
        modular.lessons[3],
      ],
    },
    { ...modular, modules: [application, fundamentals] },
    { ...modular, modules: [] },
    { ...modular, modules: [{ ...fundamentals, id: "Fundamentos" }] },
    { ...modular, modules: [{ ...fundamentals, description: "" }] },
    { ...modular, modules: [{ ...fundamentals, order: 1 }] },
    {
      ...legacy,
      lessons: [{ slug: "second", title: "Second", moduleId: "fundamentos" }],
    },
    {
      ...modular,
      lessons: [
        modular.lessons[0],
        modular.lessons[1],
        modular.lessons[2],
        { ...modular.lessons[3], slug: "second" },
      ],
    },
  ];
  try {
    for (const value of invalid) {
      await publish(value);
      const response = await get("/modular");
      assert.equal(response.status, 422, JSON.stringify(value));
      assert.match(await response.text(), /Conteúdo inválido/);
    }
    await publish({
      ...modular,
      modules: [{ ...fundamentals, title: "Fundamentos" }],
      lessons: [
        { ...modular.lessons[0] },
        { ...modular.lessons[1] },
        { ...modular.lessons[2], moduleId: "fundamentos" },
        { ...modular.lessons[3], moduleId: "fundamentos" },
      ],
    });
    assert.equal((await get("/modular")).status, 200);
  } finally {
    await publish(legacy);
  }
});

test("authoring appends a lesson to the last module and preserves module order", async () => {
  await publish(modular);
  try {
    const file = createLesson(
      "modular",
      { slug: "fifth", title: "Fifth" },
      courses,
    );
    assert.equal(await readFile(file, "utf8"), "");
    const manifest = JSON.parse(
      await readFile(join(courses, "modular/course.json"), "utf8"),
    ) as Course;
    assert.deepEqual(manifest.modules, [fundamentals, application]);
    assert.deepEqual(manifest.lessons.at(-1), {
      slug: "fifth",
      title: "Fifth",
      moduleId: "aplicacao",
    });
    const response = await get("/modular/lessons/fifth");
    assert.equal(response.status, 200);
    const lesson = (await response.json()) as Lesson;
    assert.equal(lesson.moduleId, "aplicacao");
    assert.equal(lesson.previous?.slug, "fourth");
  } finally {
    await publish(legacy);
  }
});
