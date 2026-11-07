import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApplication } from "../src/application";
import { PrismaService } from "../src/auth/prisma.service";
import { loadExercise } from "../src/content/exercise";
interface RunResult {
  assessment?: string;
  approved?: boolean;
}

const headers = {
  "Content-Type": "application/json",
  Origin: "http://127.0.0.1:5173",
};
interface Account {
  accessToken: string;
  user: { id: string };
}
interface Summary {
  courses: { courseId: string; total: number; completed: string[] }[];
  resume: { course: string; slug: string } | null;
}
test(
  "student learning uses real PostgreSQL ownership and published content",
  { timeout: 120000 },
  async (t) => {
    const root = mkdtempSync(join(tmpdir(), "bunkercode-learning-"));
    for (const slug of ["first", "second", "code", "draft"]) {
      const folder = join(root, "courses/demo/lessons", slug);
      mkdirSync(folder, { recursive: true });
      writeFileSync(join(folder, "lesson.md"), "# " + slug);
    }
    const manifest = join(root, "courses/demo/course.json");
    const setLessons = (slugs: string[]) =>
      writeFileSync(
        manifest,
        JSON.stringify({
          id: "demo",
          title: "Demo",
          description: "Fixture",
          lessons: slugs.map((slug) => ({ slug, title: slug })),
        }),
      );
    setLessons(["first", "second", "code", "draft"]);
    const selection = join(root, "publication.json");
    writeFileSync(
      selection,
      JSON.stringify({
        courses: [{ id: "demo", lessons: ["first", "second", "code"] }],
      }),
    );
    const exerciseFile = join(root, "courses/demo/lessons/code/exercise.json");
    const exercise = {
      id: "print",
      title: "Print",
      objective: "Print",
      instructions: "Print",
      language: "javascript",
      starterCode: "",
      expected: "ok",
      tests: { kind: "stdout", expected: "ok\n" },
    };
    writeFileSync(exerciseFile, JSON.stringify(exercise));
    const previous = {
      root: process.env.BUNKERCODE_CONTENT_DIR,
      selection: process.env.BUNKERCODE_PUBLICATION_FILE,
    };
    process.env.BUNKERCODE_CONTENT_DIR = root;
    process.env.BUNKERCODE_PUBLICATION_FILE = selection;
    let app = await createApplication(true);
    await app.listen(0, "127.0.0.1");
    let base = await app.getUrl();
    let db = app.get(PrismaService);
    async function restart() {
      await app.close();
      app = await createApplication(true);
      await app.listen(0, "127.0.0.1");
      base = await app.getUrl();
      db = app.get(PrismaService);
    }
    const send = (
      path: string,
      token?: string,
      body: unknown = {},
      method = "POST",
      extra = {},
    ) =>
      fetch(base + path, {
        method,
        headers: {
          ...headers,
          ...(token ? { Authorization: "Bearer " + token } : {}),
          ...extra,
        },
        body: JSON.stringify(body),
      });
    const get = (path: string, token?: string) =>
      fetch(base + path, {
        headers: token ? { Authorization: "Bearer " + token } : {},
      });
    const register = async () => {
      const response = await send("/auth/register", undefined, {
        email: `learning-${randomUUID()}@example.test`,
        username: "learning_" + randomUUID().replaceAll("-", "").slice(0, 16),
        password: "abc123",
      });
      assert.equal(response.status, 201);
      return (await response.json()) as Account;
    };
    const a = await register(),
      b = await register();
    const path = (slug: string, action: string) =>
      `/learning/courses/demo/lessons/${slug}/${action}`;
    const summary = async (account = a) =>
      (await (await get("/learning", account.accessToken)).json()) as Summary;
    try {
      await t.test(
        "visits and explicit completion are separate, idempotent and isolated",
        async () => {
          assert.equal((await summary()).resume, null);
          assert.deepEqual((await summary()).courses[0]?.completed, []);
          assert.equal(
            (await send(path("first", "visit"), a.accessToken)).status,
            201,
          );
          assert.deepEqual((await summary()).resume, {
            course: "demo",
            slug: "first",
          });
          assert.deepEqual((await summary()).courses[0]?.completed, []);
          const responses = await Promise.all([
            send(path("first", "complete"), a.accessToken),
            send(path("first", "complete"), a.accessToken),
          ]);
          assert.ok(responses.every((r) => r.status === 201));
          assert.equal(
            await db.lessonCompletion.count({ where: { userId: a.user.id } }),
            1,
          );
          assert.equal(
            (await send(path("second", "visit"), a.accessToken)).status,
            201,
          );
          assert.deepEqual((await summary()).resume, {
            course: "demo",
            slug: "second",
          });
          assert.deepEqual((await summary()).courses[0]?.completed, ["first"]);
          assert.deepEqual((await summary(b)).courses[0]?.completed, []);
          assert.equal((await summary(b)).resume, null);
          assert.equal(
            (await send(path("code", "complete"), a.accessToken)).status,
            409,
          );
        },
      );
      await t.test(
        "forged ownership, anonymous writes, invalid identities and origins are rejected",
        async () => {
          assert.equal((await send(path("first", "complete"))).status, 401);
          assert.equal((await get("/learning")).status, 401);
          assert.equal(
            (
              await send(path("first", "visit"), a.accessToken, {
                userId: b.user.id,
              })
            ).status,
            400,
          );
          assert.equal(
            (await send(path("missing", "visit"), a.accessToken)).status,
            404,
          );
          assert.equal(
            (await send(path("draft", "complete"), a.accessToken)).status,
            404,
          );
          assert.equal(
            (await send(path("draft", "visit"), a.accessToken)).status,
            404,
          );
          assert.equal(
            (
              await send(path("first", "visit"), a.accessToken, {}, "POST", {
                Origin: "https://evil.test",
              })
            ).status,
            403,
          );
          assert.equal(
            (await get("/content/courses/demo/lessons/first")).status,
            200,
          );
          assert.equal(
            (await get("/content/courses/demo/lessons/draft", a.accessToken))
              .status,
            404,
          );
          assert.equal(
            (
              await send(
                "/content/courses/demo/lessons/first/markdown",
                a.accessToken,
                {},
                "PUT",
                { "x-bunkercode-client": "local" },
              )
            ).status,
            403,
          );
          assert.equal(
            (
              await get("/learning?userId=" + b.user.id, a.accessToken)
            ).headers.get("cache-control"),
            "no-store",
          );
        },
      );
      await t.test(
        "preferences initialize once, validate bounds and stay within their owner",
        async () => {
          const prefs = { siteTheme: "light", readingTone: 5, readingSize: 21 };
          assert.deepEqual(
            await (await get("/learning/preferences", a.accessToken)).json(),
            { preferences: null },
          );
          assert.deepEqual(
            await (
              await send("/learning/preferences", a.accessToken, prefs)
            ).json(),
            prefs,
          );
          assert.deepEqual(
            await (
              await send("/learning/preferences", a.accessToken, {
                siteTheme: "bunkercode",
                readingTone: null,
                readingSize: 17,
              })
            ).json(),
            prefs,
          );
          for (const invalid of [
            { ...prefs, userId: b.user.id },
            { ...prefs, siteTheme: "red" },
            { ...prefs, readingSize: 100 },
            { ...prefs, readingTone: 6 },
            { ...prefs, readingTone: "1" },
            { ...prefs, readingSize: 17.2 },
          ])
            assert.equal(
              (
                await send(
                  "/learning/preferences",
                  a.accessToken,
                  invalid,
                  "PUT",
                )
              ).status,
              400,
            );
          assert.deepEqual(
            await (await get("/learning/preferences", b.accessToken)).json(),
            { preferences: null },
          );
          assert.equal(
            (await send("/learning/preferences", undefined, prefs, "PUT"))
              .status,
            401,
          );
          for (let tone = 0; tone < 6; tone++)
            assert.equal(
              (
                await send(
                  "/learning/preferences",
                  a.accessToken,
                  { ...prefs, readingTone: tone },
                  "PUT",
                )
              ).status,
              200,
            );
          await assert.rejects(
            db.learningPreferences.update({
              where: { userId: a.user.id },
              data: { readingSize: 0 },
            }),
          );
        },
      );
      await t.test(
        "unpublishing preserves stored records, filters counts and resolves safe continuation",
        async () => {
          await send(path("first", "visit"), a.accessToken);
          writeFileSync(
            selection,
            JSON.stringify({
              courses: [{ id: "demo", lessons: ["second", "code"] }],
            }),
          );
          await restart();
          const value = await summary();
          assert.equal(value.courses[0]?.total, 2);
          assert.deepEqual(value.courses[0]?.completed, []);
          assert.deepEqual(value.resume, { course: "demo", slug: "second" });
          assert.equal(
            await db.lessonCompletion.count({ where: { userId: a.user.id } }),
            1,
          );
          setLessons([]);
          writeFileSync(selection, JSON.stringify({ courses: ["demo"] }));
          await restart();
          assert.equal((await summary()).courses[0]?.total, 0);
          assert.equal((await summary()).resume, null);
          setLessons(["first", "second", "code", "draft"]);
          writeFileSync(
            selection,
            JSON.stringify({
              courses: [{ id: "demo", lessons: ["first", "second", "code"] }],
            }),
          );
          await restart();
        },
      );
      await t.test(
        "only authoritative Submit saves exact source and completion; Run, failure and forged flags do not",
        async (t) => {
          const definition = loadExercise(
            "demo",
            "code",
            join(root, "courses"),
          )!;
          const payload = {
            id: randomUUID(),
            course: "demo",
            lesson: "code",
            exercise: "print",
            revision: definition.revision,
            source: 'console.log("ok");',
            javascript: 'console.log("ok");',
          };
          const local = { "x-bunkercode-client": "local" };
          assert.equal(
            (
              await send(
                "/practice/submissions",
                a.accessToken,
                { ...payload, passed: true },
                "POST",
                local,
              )
            ).status,
            400,
          );
          assert.equal(
            (
              await send(
                "/practice/submissions",
                undefined,
                payload,
                "POST",
                local,
              )
            ).status,
            401,
          );
          assert.equal(
            (
              await send(
                "/practice/submissions",
                a.accessToken,
                { ...payload, source: "x".repeat(65537) },
                "POST",
                local,
              )
            ).status,
            400,
          );
          assert.equal(
            await db.approvedSolution.count({ where: { userId: a.user.id } }),
            0,
          );
          const status = (await (
            await get("/practice/runtime", a.accessToken)
          ).json()) as { available: boolean; reason: string };
          if (!status.available) {
            t.skip("Runner indisponível: " + status.reason);
            return;
          }
          const run = await send(
            "/practice/runs",
            a.accessToken,
            payload,
            "POST",
            local,
          );
          assert.equal(run.status, 201);
          assert.equal(((await run.json()) as RunResult).assessment, "passed");
          assert.equal(
            await db.approvedSolution.count({ where: { userId: a.user.id } }),
            0,
          );
          const fail = await send(
            "/practice/submissions",
            a.accessToken,
            { ...payload, id: randomUUID(), source: 'console.log("wrong");' },
            "POST",
            local,
          );
          assert.equal(fail.status, 201);
          assert.equal(((await fail.json()) as RunResult).approved, false);
          assert.equal(
            await db.approvedSolution.count({ where: { userId: a.user.id } }),
            0,
          );
          for (let i = 0; i < 2; i++) {
            const success = await send(
              "/practice/submissions",
              a.accessToken,
              { ...payload, id: randomUUID() },
              "POST",
              local,
            );
            assert.equal(success.status, 201);
            assert.equal(((await success.json()) as RunResult).approved, true);
          }
          assert.equal(
            await db.approvedSolution.count({ where: { userId: a.user.id } }),
            1,
          );
          const restored = (await (
            await get(path("code", "solution"), a.accessToken)
          ).json()) as { solution: { source: string } };
          assert.equal(restored.solution.source, payload.source);
          assert.deepEqual(
            await (await get(path("code", "solution"), b.accessToken)).json(),
            { solution: null },
          );
          assert.ok((await summary()).courses[0]?.completed.includes("code"));
          const concurrent = await Promise.all(
            [1, 2].map((i) =>
              send(
                "/practice/submissions",
                a.accessToken,
                {
                  ...payload,
                  id: randomUUID(),
                  source: payload.source + " // " + i,
                },
                "POST",
                local,
              ),
            ),
          );
          assert.ok(concurrent.every((r) => r.status === 201));
          assert.equal(
            await db.approvedSolution.count({ where: { userId: a.user.id } }),
            1,
          );
          writeFileSync(
            exerciseFile,
            JSON.stringify({ ...exercise, instructions: "New revision" }),
          );
          assert.deepEqual(
            await (await get(path("code", "solution"), a.accessToken)).json(),
            { solution: null },
          );
          assert.equal(
            await db.approvedSolution.count({ where: { userId: a.user.id } }),
            1,
          );
          assert.equal(
            (
              await send(
                "/practice/submissions",
                a.accessToken,
                { ...payload, id: randomUUID() },
                "POST",
                local,
              )
            ).status,
            409,
          );
        },
      );
      await t.test(
        "expired and revoked sessions cannot update learning; cascade prevents orphan records",
        async () => {
          await db.session.updateMany({
            where: { userId: b.user.id },
            data: {
              createdAt: new Date(0),
              rotatedAt: new Date(0),
              expiresAt: new Date(Date.now() - 1000),
            },
          });
          assert.equal(
            (await send(path("first", "visit"), b.accessToken)).status,
            401,
          );
          await db.session.updateMany({
            where: { userId: a.user.id },
            data: { revokedAt: new Date() },
          });
          assert.equal(
            (await send(path("first", "complete"), a.accessToken)).status,
            401,
          );
          await assert.rejects(
            db.lessonCompletion.create({
              data: {
                userId: randomUUID(),
                courseId: "demo",
                lessonSlug: "first",
              },
            }),
          );
          await db.user.delete({ where: { id: a.user.id } });
          assert.equal(
            await db.lessonCompletion.count({ where: { userId: a.user.id } }),
            0,
          );
          assert.equal(
            await db.approvedSolution.count({ where: { userId: a.user.id } }),
            0,
          );
          assert.equal(
            await db.learningPreferences.count({
              where: { userId: a.user.id },
            }),
            0,
          );
          assert.equal(
            await db.lastLessonVisit.count({ where: { userId: a.user.id } }),
            0,
          );
        },
      );
    } finally {
      await app.close();
      if (previous.root === undefined)
        delete process.env.BUNKERCODE_CONTENT_DIR;
      else process.env.BUNKERCODE_CONTENT_DIR = previous.root;
      if (previous.selection === undefined)
        delete process.env.BUNKERCODE_PUBLICATION_FILE;
      else process.env.BUNKERCODE_PUBLICATION_FILE = previous.selection;
    }
  },
);
