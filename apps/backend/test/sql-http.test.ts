import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, cpSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createApplication } from "../src/application";
import { PrismaService } from "../src/auth/prisma.service";
import { SqlService } from "../src/sql/sql.service";
const origin = "http://127.0.0.1:5173";
test(
  "SQL HTTP keeps private authoring, identity, version and resource boundaries server-side",
  { timeout: 90000 },
  async (t) => {
    const root = mkdtempSync(join(tmpdir(), "bunkercode-sql-http-"));
    cpSync(resolve("../../content/sql"), join(root, "sql"), {
      recursive: true,
    });
    mkdirSync(join(root, "courses/demo/lessons/first"), { recursive: true });
    writeFileSync(
      join(root, "courses/demo/course.json"),
      JSON.stringify({
        id: "demo",
        title: "Demo",
        description: "Fixture",
        lessons: [{ slug: "first", title: "First" }],
      }),
    );
    writeFileSync(
      join(root, "courses/demo/lessons/first/lesson.md"),
      '# First\n```bunker-sql\n{"kind":"sql","exerciseId":"store-select-columns","version":1}\n```',
    );
    writeFileSync(join(root, "publication.json"), '{"courses":["demo"]}');
    const oldRoot = process.env.BUNKERCODE_CONTENT_DIR,
      oldSelection = process.env.BUNKERCODE_PUBLICATION_FILE;
    process.env.BUNKERCODE_CONTENT_DIR = root;
    process.env.BUNKERCODE_PUBLICATION_FILE = join(root, "publication.json");
    const app = await createApplication(true);
    await app.listen(0, "127.0.0.1");
    const base = await app.getUrl(),
      db = app.get(PrismaService);
    const ids: string[] = [];
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
          Origin: origin,
          "Content-Type": "application/json",
          "X-Bunkercode-Client": "local",
          ...(token ? { Authorization: "Bearer " + token } : {}),
          ...extra,
        },
        ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
      });
    async function register() {
      const uid = randomUUID().replaceAll("-", "").slice(0, 16);
      const response = await send("/auth/register", undefined, {
        email: uid + "@example.test",
        username: "sql_" + uid,
        password: "abc123",
      });
      assert.equal(response.status, 201);
      const account = (await response.json()) as {
        accessToken: string;
        user: { id: string };
      };
      ids.push(account.user.id);
      return account;
    }
    try {
      const student = await register(),
        admin = await register();
      const service = app.get(SqlService);
      const valid = {
        exerciseId: "store-select-columns",
        version: 1,
        steps: ["SELECT id,name FROM customers"],
        courseId: "demo",
        lessonSlug: "first",
      };
      await assert.rejects(service.submit(student.user.id, undefined, valid), {
        status: 401,
      });
      await assert.rejects(
        service.submit(student.user.id, "Bearer " + admin.accessToken, valid),
        { status: 401 },
      );
      for (const path of ["/sql/check", "/sql/submit"])
        for (const extra of [
          {},
          { "X-Forwarded-For": "192.0.2.1", Authorization: "Bearer forged" },
        ])
          assert.equal(
            (
              await send(
                path,
                undefined,
                { ...valid, passed: true, userId: admin.user.id },
                "POST",
                extra,
              )
            ).status,
            401,
          );
      await db.user.update({
        where: { id: admin.user.id },
        data: { role: "ADMIN" },
      });
      assert.equal(
        (await send("/content/sql/authoring", undefined, {}, "GET")).status,
        401,
      );
      assert.equal(
        (await send("/content/sql/authoring", student.accessToken, {}, "GET"))
          .status,
        403,
      );
      const publicResponse = await send(
        "/content/sql/exercises",
        undefined,
        {},
        "GET",
      );
      assert.equal(publicResponse.status, 200);
      const text = await publicResponse.text();
      assert.ok(!text.includes("assessment"));
      assert.ok(!text.includes("expectedQuery"));
      assert.equal(
        (
          await send(
            "/content/sql/exercises/store-select-columns/99",
            undefined,
            {},
            "GET",
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await send("/sql/check", undefined, {
            exerciseId: "store-select-columns",
            version: 1,
            steps: ["SELECT 1"],
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await send("/sql/check", student.accessToken, {
            exerciseId: "store-select-columns",
            version: 1,
            steps: ["SELECT 1"],
            passed: true,
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await send("/sql/check", student.accessToken, {
            exerciseId: "store-select-columns",
            version: 1,
            steps: ["SELECT 1"],
            userId: admin.user.id,
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await send("/sql/check", student.accessToken, {
            exerciseId: "../outside",
            version: 1,
            steps: ["SELECT 1"],
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await send("/sql/check", student.accessToken, {
            exerciseId: "store-select-columns",
            version: 99,
            steps: ["SELECT 1"],
          })
        ).status,
        404,
      );
      assert.equal(
        (
          await send("/sql/check", student.accessToken, {
            exerciseId: "store-filter-sort",
            version: 1,
            steps: ["SELECT 1"],
            courseId: "demo",
            lessonSlug: "first",
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await send("/sql/check", student.accessToken, {
            exerciseId: "store-select-columns",
            version: 1,
            steps: Array(21).fill("SELECT 1"),
          })
        ).status,
        400,
      );
      assert.equal(
        (await send("/sql/check", student.accessToken, {})).status,
        429,
      );
      assert.equal(
        (
          await send("/sql/check", admin.accessToken, {}, "POST", {
            Origin: "https://evil.test",
          })
        ).status,
        403,
      );
      const catalog = (await (
        await send("/content/sql/authoring", admin.accessToken, {}, "GET")
      ).json()) as { published: Record<string, unknown>[] };
      assert.equal(
        (await send("/content/sql/references", undefined, {}, "GET")).status,
        401,
      );
      assert.equal(
        (await send("/content/sql/references", student.accessToken, {}, "GET"))
          .status,
        403,
      );
      assert.equal(
        (await send("/content/sql/references", admin.accessToken, {}, "GET"))
          .status,
        200,
      );
      const original = catalog.published.find(
        (d) => d.id === "store-select-columns",
      )!;
      const definition = {
        ...original,
        id: "studio-created-over-http",
        status: "draft",
      };
      const saved = await send(
        "/content/sql/authoring/drafts",
        admin.accessToken,
        { definition, revision: null },
        "PUT",
      );
      assert.equal(saved.status, 200);
      const draft = (await saved.json()) as { revision: string };
      assert.equal(
        (
          await send(
            "/content/sql/exercises/studio-created-over-http/1",
            undefined,
            {},
            "GET",
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await send(
            "/content/sql/authoring/drafts",
            admin.accessToken,
            { definition: { ...definition, title: "Stale" }, revision: null },
            "PUT",
          )
        ).status,
        409,
      );
      assert.ok(draft.revision);
      const previousRunner = process.env.BUNKERCODE_SQL_RUNNER_ENABLED;
      process.env.BUNKERCODE_SQL_RUNNER_ENABLED = "0";
      try {
        for (const path of ["/sql/check", "/sql/submit"]) {
          const unavailable = await send(path, admin.accessToken, valid);
          assert.equal(unavailable.status, 503);
          const feedback = await unavailable.text();
          assert.ok(!feedback.includes('"passed"'));
          assert.ok(!feedback.includes("SELECT id,name"));
        }
      } finally {
        if (previousRunner === undefined)
          delete process.env.BUNKERCODE_SQL_RUNNER_ENABLED;
        else process.env.BUNKERCODE_SQL_RUNNER_ENABLED = previousRunner;
      }
      assert.equal(
        (
          await send("/sql/check", admin.accessToken, {
            exerciseId: definition.id,
            version: 1,
            steps: ["SELECT 1"],
          })
        ).status,
        404,
      );
      service.content.publish(definition.id, draft.revision);
      const listed = await (
        await send("/content/sql/exercises", undefined, {}, "GET")
      ).text();
      assert.ok(!listed.includes(definition.id));
      assert.equal(
        (
          await send(
            `/content/sql/exercises/${definition.id}/1`,
            undefined,
            {},
            "GET",
          )
        ).status,
        200,
      );
      writeFileSync(
        join(root, "courses/demo/lessons/first/lesson.md"),
        `# First\n\`\`\`bunker-sql\n${JSON.stringify({ kind: "sql", exerciseId: definition.id, version: 1 })}\n\`\`\``,
      );
      assert.doesNotThrow(() =>
        service.binding("demo", "first", definition.id, 1),
      );
      assert.equal(
        (
          await send("/sql/check", admin.accessToken, {}, "POST", {
            "Content-Type": "text/plain",
          })
        ).status,
        415,
      );
      assert.equal(
        (
          await send("/sql/check", admin.accessToken, {
            steps: ["x".repeat(115000)],
          })
        ).status,
        413,
      );
      assert.equal(
        await db.lessonCompletion.count({ where: { userId: { in: ids } } }),
        0,
      );
      // Fill only the service's bounded map, without touching Docker or identities.
      for (let i = 0; i < 1022; i++)
        await assert.rejects(service.check("capacity-" + i, {}), {
          status: 400,
        });
      await assert.rejects(service.check("overflow", {}), { status: 429 });
      await assert.rejects(service.check(admin.user.id, {}), { status: 400 });
      const now = Date.now();
      const clock = t.mock.method(Date, "now", () => now + 60001);
      try {
        await assert.rejects(service.check("overflow", {}), { status: 400 });
      } finally {
        clock.mock.restore();
      }
    } finally {
      await db.user.deleteMany({ where: { id: { in: ids } } });
      await app.close();
      if (oldRoot === undefined) delete process.env.BUNKERCODE_CONTENT_DIR;
      else process.env.BUNKERCODE_CONTENT_DIR = oldRoot;
      if (oldSelection === undefined)
        delete process.env.BUNKERCODE_PUBLICATION_FILE;
      else process.env.BUNKERCODE_PUBLICATION_FILE = oldSelection;
    }
  },
);
test(
  "trusted SQL Submit persists existing learning models idempotently and isolates accounts",
  { skip: process.env.BUNKERCODE_SQL_RUNNER_ENABLED !== "1", timeout: 150000 },
  async () => {
    const root = mkdtempSync(join(tmpdir(), "bunkercode-sql-progress-"));
    cpSync(resolve("../../content/sql"), join(root, "sql"), {
      recursive: true,
    });
    mkdirSync(join(root, "courses/demo/lessons/first"), { recursive: true });
    writeFileSync(
      join(root, "courses/demo/course.json"),
      JSON.stringify({
        id: "demo",
        title: "Demo",
        description: "Fixture",
        lessons: [{ slug: "first", title: "First" }],
      }),
    );
    const markdown = join(root, "courses/demo/lessons/first/lesson.md");
    writeFileSync(
      markdown,
      '# First\n```bunker-sql\n{"kind":"sql","exerciseId":"store-select-columns","version":1}\n```',
    );
    writeFileSync(join(root, "publication.json"), '{"courses":["demo"]}');
    const oldRoot = process.env.BUNKERCODE_CONTENT_DIR,
      oldSelection = process.env.BUNKERCODE_PUBLICATION_FILE;
    process.env.BUNKERCODE_CONTENT_DIR = root;
    process.env.BUNKERCODE_PUBLICATION_FILE = join(root, "publication.json");
    const app = await createApplication(true);
    await app.listen(0, "127.0.0.1");
    const base = await app.getUrl(),
      db = app.get(PrismaService),
      ids: string[] = [];
    const send = (
      path: string,
      token?: string,
      body: unknown = {},
      method = "POST",
    ) =>
      fetch(base + path, {
        method,
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
          ...(token ? { Authorization: "Bearer " + token } : {}),
        },
        ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
      });
    const body = {
      exerciseId: "store-select-columns",
      version: 1,
      steps: ["SELECT id,name FROM customers ORDER BY id DESC"],
      courseId: "demo",
      lessonSlug: "first",
    };
    async function account() {
      const uid = randomUUID().replaceAll("-", "").slice(0, 16);
      const response = await send("/auth/register", undefined, {
        email: uid + "@example.test",
        username: "sql_" + uid,
        password: "abc123",
      });
      assert.equal(response.status, 201);
      const result = (await response.json()) as {
        accessToken: string;
        user: { id: string };
      };
      ids.push(result.user.id);
      return result;
    }
    try {
      const a = await account(),
        b = await account();
      const token = a.accessToken;
      assert.equal(
        (await send("/learning/courses/demo/lessons/first/complete", token))
          .status,
        409,
      );
      assert.equal((await send("/sql/submit", undefined, body)).status, 401);
      assert.equal(
        (await send("/sql/submit", token, { ...body, passed: true })).status,
        400,
      );
      assert.equal(
        (await send("/sql/submit", token, { ...body, userId: b.user.id }))
          .status,
        400,
      );
      const wrong = await send("/sql/submit", token, {
        ...body,
        steps: ["SELECT * FROM customers"],
      });
      assert.equal(wrong.status, 201);
      assert.deepEqual(await wrong.json(), { passed: false });
      assert.equal(
        await db.lessonCompletion.count({ where: { userId: a.user.id } }),
        0,
      );
      const check = await send("/sql/check", token, body);
      assert.equal(check.status, 201);
      assert.deepEqual(await check.json(), { passed: true });
      assert.equal(
        await db.lessonCompletion.count({ where: { userId: a.user.id } }),
        0,
      );
      for (let i = 0; i < 2; i++) {
        const correct = await send("/sql/submit", token, body);
        assert.equal(correct.status, 201);
        assert.deepEqual(await correct.json(), {
          passed: true,
          completed: true,
        });
      }
      assert.equal(
        await db.lessonCompletion.count({ where: { userId: a.user.id } }),
        1,
      );
      assert.equal(
        await db.approvedSolution.count({ where: { userId: a.user.id } }),
        1,
      );
      assert.equal(
        await db.lessonCompletion.count({ where: { userId: b.user.id } }),
        0,
      );
      const solution = (await (
        await send(
          "/learning/courses/demo/lessons/first/solution",
          token,
          {},
          "GET",
        )
      ).json()) as { solution: { source: string } };
      assert.deepEqual(JSON.parse(solution.solution.source), {
        format: 1,
        steps: body.steps,
      });
      assert.deepEqual(
        await (
          await send(
            "/learning/courses/demo/lessons/first/solution",
            b.accessToken,
            {},
            "GET",
          )
        ).json(),
        { solution: null },
      );
      assert.equal(
        (await send("/sql/submit", b.accessToken, { ...body, version: 2 }))
          .status,
        409,
      );
    } finally {
      await db.user.deleteMany({ where: { id: { in: ids } } });
      await app.close();
      if (oldRoot === undefined) delete process.env.BUNKERCODE_CONTENT_DIR;
      else process.env.BUNKERCODE_CONTENT_DIR = oldRoot;
      if (oldSelection === undefined)
        delete process.env.BUNKERCODE_PUBLICATION_FILE;
      else process.env.BUNKERCODE_PUBLICATION_FILE = oldSelection;
    }
  },
);

test(
  "SQL progress rejects stale content and revoked sessions after evaluation and rolls back a persistence failure",
  { skip: process.env.BUNKERCODE_SQL_RUNNER_ENABLED !== "1", timeout: 150000 },
  async () => {
    const root = mkdtempSync(join(tmpdir(), "bunkercode-sql-failure-"));
    cpSync(resolve("../../content/sql"), join(root, "sql"), {
      recursive: true,
    });
    mkdirSync(join(root, "courses/demo/lessons/first"), { recursive: true });
    writeFileSync(
      join(root, "courses/demo/course.json"),
      JSON.stringify({
        id: "demo",
        title: "Demo",
        description: "Fixture",
        lessons: [{ slug: "first", title: "First" }],
      }),
    );
    const markdown = join(root, "courses/demo/lessons/first/lesson.md"),
      source =
        '# First\n```bunker-sql\n{"kind":"sql","exerciseId":"store-select-columns","version":1}\n```';
    writeFileSync(markdown, source);
    writeFileSync(join(root, "publication.json"), '{"courses":["demo"]}');
    const oldRoot = process.env.BUNKERCODE_CONTENT_DIR,
      oldSelection = process.env.BUNKERCODE_PUBLICATION_FILE;
    process.env.BUNKERCODE_CONTENT_DIR = root;
    process.env.BUNKERCODE_PUBLICATION_FILE = join(root, "publication.json");
    const app = await createApplication(true);
    await app.listen(0, "127.0.0.1");
    const base = await app.getUrl(),
      db = app.get(PrismaService),
      ids: string[] = [];
    const send = (path: string, token?: string, body: unknown = {}) =>
      fetch(base + path, {
        method: "POST",
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
          ...(token ? { Authorization: "Bearer " + token } : {}),
        },
        body: JSON.stringify(body),
      });
    async function account() {
      const uid = randomUUID().replaceAll("-", "").slice(0, 16);
      const response = await send("/auth/register", undefined, {
        email: uid + "@example.test",
        username: "sql_" + uid,
        password: "abc123",
      });
      assert.equal(response.status, 201);
      const result = (await response.json()) as {
        accessToken: string;
        user: { id: string };
      };
      ids.push(result.user.id);
      return result;
    }
    const body = {
      exerciseId: "store-select-columns",
      version: 1,
      steps: ["SELECT id,name FROM customers"],
      courseId: "demo",
      lessonSlug: "first",
    };
    async function started() {
      for (let i = 0; i < 100; i++) {
        const { stdout } = await promisify(execFile)("docker", [
          "ps",
          "--filter",
          "label=bunkercode.sql.runner=1",
          "--format",
          "{{.Names}}",
        ]);
        if (stdout.trim()) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error("SQL container did not start");
    }
    const constraint = "sql04_" + randomUUID().replaceAll("-", "");
    let constrained = false;
    try {
      const a = await account();
      const stale = send("/sql/submit", a.accessToken, body);
      await started();
      writeFileSync(markdown, source.replace('"version":1', '"version":2'));
      assert.equal((await stale).status, 409);
      writeFileSync(markdown, source);
      const b = await account();
      const revoked = send("/sql/submit", b.accessToken, body);
      await started();
      await db.session.updateMany({
        where: { userId: b.user.id },
        data: { revokedAt: new Date() },
      });
      assert.equal((await revoked).status, 401);
      const c = await account();
      assert.match(c.user.id, /^[a-f0-9-]{36}$/);
      const abort = new AbortController();
      const cancelled = fetch(base + "/sql/submit", {
        method: "POST",
        signal: abort.signal,
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
          Authorization: "Bearer " + c.accessToken,
        },
        body: JSON.stringify(body),
      }).catch((error) => error);
      await started();
      abort.abort();
      await cancelled;
      for (let i = 0; i < 100; i++) {
        const { stdout } = await promisify(execFile)("docker", [
          "ps",
          "--all",
          "--filter",
          "label=bunkercode.sql.runner=1",
          "--format",
          "{{.Names}}",
        ]);
        if (!stdout.trim()) break;
        if (i === 99)
          throw new Error("Disconnected SQL container was not removed");
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // A scoped constraint on this disposable test DB forces the second transaction
      // write to fail, after ApprovedSolution would have been created.
      await db.$executeRawUnsafe(
        `ALTER TABLE "LessonCompletion" ADD CONSTRAINT "${constraint}" CHECK ("userId" <> '${c.user.id}'::uuid) NOT VALID`,
      );
      constrained = true;
      const failed = await send("/sql/submit", c.accessToken, body);
      assert.equal(failed.status, 500);
      const response = await failed.text();
      assert.ok(!response.includes("SELECT id,name"));
      assert.equal(
        await db.lessonCompletion.count({ where: { userId: { in: ids } } }),
        0,
      );
      assert.equal(
        await db.approvedSolution.count({ where: { userId: { in: ids } } }),
        0,
      );
    } finally {
      if (constrained)
        await db.$executeRawUnsafe(
          `ALTER TABLE "LessonCompletion" DROP CONSTRAINT "${constraint}"`,
        );
      await db.user.deleteMany({ where: { id: { in: ids } } });
      await app.close();
      if (oldRoot === undefined) delete process.env.BUNKERCODE_CONTENT_DIR;
      else process.env.BUNKERCODE_CONTENT_DIR = oldRoot;
      if (oldSelection === undefined)
        delete process.env.BUNKERCODE_PUBLICATION_FILE;
      else process.env.BUNKERCODE_PUBLICATION_FILE = oldSelection;
    }
  },
);
