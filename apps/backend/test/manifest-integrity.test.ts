import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import fs from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import { MAX_MANIFEST_BYTES } from "@bunkercode/content/manifest";
import { createApplication } from "../src/application";
import {
  listCourses,
  loadCourse,
  type Course,
  type Lesson,
} from "../src/content/courses";

let root: string, courses: string, base: string, app: INestApplication;
const headers = {
  "content-type": "application/json",
  "x-bunkercode-client": "local",
  origin: "http://127.0.0.1:5173",
};
const legacy = {
  id: "typescript",
  title: "TypeScript",
  description: "Fixture editorial.",
  lessons: [{ slug: "existing", title: "Existente" }],
};
const modular = {
  id: "modular",
  title: "Curso modular",
  description: "Contrato modular.",
  shortDescription: "Resumo modular.",
  modules: [
    { id: "fundamentos", title: "Fundamentos" },
    { id: "aplicacao", title: "Aplicação" },
  ],
  lessons: [
    { slug: "first", title: "Primeira", moduleId: "fundamentos" },
    { slug: "second", title: "Segunda", moduleId: "fundamentos" },
    { slug: "third", title: "Terceira", moduleId: "aplicacao" },
  ],
};
const typescript = () => join(courses, "typescript");
const manifestPath = () => join(typescript(), "course.json");
const modularManifest = () => join(courses, "modular/course.json");
function encoded(value: unknown, crlf = false): Buffer {
  const text = JSON.stringify(value, null, crlf ? 2 : undefined);
  return Buffer.from(
    crlf ? text.replaceAll("\n", "\r\n") + "\r\n" : text,
    "utf8",
  );
}
function publish(value: unknown, crlf = false) {
  fs.writeFileSync(manifestPath(), encoded(value, crlf));
}
function publishModular(value: unknown, crlf = false) {
  fs.writeFileSync(modularManifest(), encoded(value, crlf));
}
function replaceAsciiZ(value: unknown, bytes: number[]): Buffer {
  const raw = encoded(value);
  const at = raw.indexOf(0x5a);
  assert.ok(at >= 0, "fixture must contain an ASCII Z marker");
  return Buffer.concat([raw.subarray(0, at), Buffer.from(bytes), raw.subarray(at + 1)]);
}
async function get(path: string) {
  return fetch(base + path);
}
async function post(slug: string, title = "Nova lição") {
  return fetch(base + "/typescript/lessons", {
    method: "POST",
    headers,
    body: JSON.stringify({ slug, title }),
  });
}
before(async () => {
  root = fs.mkdtempSync(join(tmpdir(), "bunkercode-manifest-"));
  courses = join(root, "content/courses");
  for (const [course, slugs] of [
    ["typescript", ["existing"]],
    ["modular", ["first", "second", "third"]],
  ] as const) {
    for (const slug of slugs) {
      const directory = join(courses, course, "lessons", slug);
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(
        join(directory, "lesson.md"),
        course === "typescript" ? "Notas existentes." : `# ${slug}`,
      );
    }
  }
  publish(legacy);
  publishModular(modular);
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
  fs.rmSync(root, { recursive: true, force: true });
});

test("invalid UTF-8 is refused before JSON parsing and authoring never rewrites or publishes", async () => {
  const original = encoded(legacy);
  try {
    for (const invalid of [[0xff], [0xc3], [0xed, 0xa0, 0x80]]) {
      const bytes = replaceAsciiZ(
        {
          ...legacy,
          title: "Curso Z",
          lessons: [{ slug: "existing", title: "Existente" }],
        },
        invalid,
      );
      fs.writeFileSync(manifestPath(), bytes);
      const course = await get("/typescript");
      assert.equal(course.status, 422);
      assert.match(await course.text(), /UTF-8/);
      assert.equal((await get("")).status, 422);
      const created = await post("nova");
      assert.equal(created.status, 422);
      assert.match(await created.text(), /UTF-8/);
      assert.deepEqual(fs.readFileSync(manifestPath()), bytes);
      assert.equal(fs.existsSync(join(typescript(), "lessons/nova")), false);
      assert.equal(
        fs.existsSync(join(typescript(), ".lesson-new.lock")),
        false,
      );
      assert.equal(
        fs
          .readdirSync(typescript())
          .filter((name) => name.startsWith(".course-")).length,
        0,
      );
      assert.equal(
        fs.readFileSync(join(typescript(), "lessons/existing/lesson.md"), "utf8"),
        "Notas existentes.",
      );
    }
  } finally {
    fs.writeFileSync(manifestPath(), original);
  }
});

test("valid Unicode, the replacement character and CRLF remain readable and authorable", async () => {
  const unicode = {
    ...legacy,
    title: "Acentuação válida \uFFFD — 日本語",
    description: "Descrição com ç, ã e símbolos próprios.",
    shortDescription: "Resumo \uFFFD válido.",
    lessons: [{ slug: "existing", title: "Existente ção" }],
  };
  try {
    const bytes = encoded(unicode, true);
    assert.ok(bytes.includes(Buffer.from("\uFFFD", "utf8")));
    fs.writeFileSync(manifestPath(), bytes);
    const response = await get("/typescript");
    assert.equal(response.status, 200);
    const loaded = (await response.json()) as Course;
    assert.equal(loaded.title, unicode.title);
    assert.equal(loaded.shortDescription, unicode.shortDescription);
    assert.equal(loaded.lessons[0]?.title, unicode.lessons[0]?.title);
    assert.equal((await get("/typescript/lessons/existing")).status, 200);
    const created = await post("acentuada", "Nova ção");
    assert.equal(created.status, 201);
    const listed = JSON.parse(
      fs.readFileSync(manifestPath(), "utf8"),
    ) as Course;
    assert.deepEqual(listed.lessons.at(-1), {
      slug: "acentuada",
      title: "Nova ção",
    });
    assert.equal(listed.title, unicode.title);
    assert.equal((await get("/typescript/lessons/acentuada")).status, 200);
  } finally {
    fs.rmSync(join(typescript(), "lessons/acentuada"), {
      recursive: true,
      force: true,
    });
    fs.writeFileSync(manifestPath(), encoded(legacy));
  }
});

test("modular manifests with CRLF and accented Unicode remain readable", async () => {
  const unicode = {
    ...modular,
    title: "Curso modular ção",
    modules: [
      { id: "fundamentos", title: "Fundamentos ção" },
      { id: "aplicacao", title: "Aplicação 🚀" },
    ],
    lessons: modular.lessons.map((lesson) => ({
      ...lesson,
      title: `${lesson.title} ção`,
    })),
  };
  try {
    publishModular(unicode, true);
    const response = await get("/modular");
    assert.equal(response.status, 200);
    const loaded = (await response.json()) as Course;
    assert.equal(loaded.title, unicode.title);
    assert.deepEqual(loaded.modules, unicode.modules);
    assert.deepEqual(loaded.lessons, unicode.lessons);
    const lesson = (await (await get("/modular/lessons/second")).json()) as Lesson;
    assert.equal(lesson.title, "Segunda ção");
    assert.equal(lesson.moduleId, "fundamentos");
  } finally {
    publishModular(modular);
  }
});

test("the manifest limit applies to bytes actually read when the file grows after stat", async (context) => {
  const baseBytes = encoded(legacy);
  const exact = Buffer.concat([
    baseBytes,
    Buffer.alloc(MAX_MANIFEST_BYTES - baseBytes.length, 0x20),
  ]);
  fs.writeFileSync(manifestPath(), exact);
  assert.equal((await get("/typescript")).status, 200);
  fs.writeFileSync(manifestPath(), Buffer.concat([exact, Buffer.from(" ")]));
  const oversized = await get("/typescript");
  assert.equal(oversized.status, 422);
  assert.match(await oversized.text(), /limite/);
  fs.writeFileSync(manifestPath(), exact);
  const read = fs.readSync;
  let grown = false;
  const hook = context.mock.method(
    fs,
    "readSync",
    (
      descriptor: number,
      buffer: NodeJS.ArrayBufferView,
      offset: number,
      length: number,
      position: number | null,
    ) => {
      const count = read(descriptor, buffer, offset, length, position);
      if (!grown) {
        grown = true;
        fs.appendFileSync(manifestPath(), " ".repeat(16));
      }
      return count;
    },
  );
  try {
    const response = await get("/typescript");
    assert.equal(response.status, 422);
    assert.match(await response.text(), /limite/);
    assert.equal(fs.statSync(manifestPath()).size, MAX_MANIFEST_BYTES + 16);
  } finally {
    hook.mock.restore();
    fs.writeFileSync(manifestPath(), encoded(legacy));
  }
});

test("symlinked, non-regular and unreadable manifests stay refused and release authoring locks", async () => {
  const outside = join(root, "outside.json");
  const original = encoded(legacy);
  fs.writeFileSync(outside, original);
  function restore() {
    try {
      const stat = fs.lstatSync(manifestPath());
      if (stat.isDirectory()) fs.rmdirSync(manifestPath());
      else if (stat.isSymbolicLink()) fs.unlinkSync(manifestPath());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    fs.writeFileSync(manifestPath(), original);
  }
  try {
    fs.rmSync(manifestPath());
    fs.symlinkSync(outside, manifestPath());
    assert.equal((await get("/typescript")).status, 422);
    assert.equal((await post("symlink")).status, 422);
    assert.deepEqual(fs.readFileSync(outside), original);
    assert.equal(fs.existsSync(join(typescript(), ".lesson-new.lock")), false);
    assert.equal(fs.existsSync(join(typescript(), "lessons/symlink")), false);
    fs.unlinkSync(manifestPath());
    fs.mkdirSync(manifestPath());
    assert.equal((await get("/typescript")).status, 422);
    assert.equal((await post("directory")).status, 422);
    assert.equal(fs.existsSync(join(typescript(), ".lesson-new.lock")), false);
    assert.equal(fs.existsSync(join(typescript(), "lessons/directory")), false);
  } finally {
    restore();
  }
});

test("canonical course manifests remain accepted", () => {
  const canonical = resolve(__dirname, "../../../content/courses");
  const summaries = listCourses(canonical);
  assert.ok(summaries.length > 0);
  const loaded = summaries.map((summary) =>
    loadCourse(summary.id, canonical),
  );
  assert.deepEqual(
    loaded.map((course) => course.id),
    summaries.map((summary) => summary.id),
  );
});
