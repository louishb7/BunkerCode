import { request as httpRequest } from "node:http";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes, randomUUID, createHash, createHmac } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SignJWT, decodeJwt } from "jose";
import { HttpException } from "@nestjs/common";
import type { Lesson, CourseSummary } from "../src/content/courses";
import { createApplication } from "../src/application";
import { PrismaService } from "../src/auth/prisma.service";
import { authConfig } from "../src/auth/config";
import { credentials, hashPassword } from "../src/auth/credentials";

const origin = "http://127.0.0.1:5173";
const headers = { "Content-Type": "application/json", Origin: origin };
interface Result {
  accessToken: string;
  user: { id: string; email: string; role: string };
}
const cookie = (response: Response) =>
  response.headers.get("set-cookie")!.split(";")[0]!;

test(
  "identity, content and administration use real PostgreSQL sessions over HTTP",
  { timeout: 60000 },
  async (t) => {
    const root = mkdtempSync(join(tmpdir(), "bunkercode-identity-"));
    const folder = join(root, "courses/demo/lessons/first");
    mkdirSync(folder, { recursive: true });
    writeFileSync(
      join(root, "courses/demo/course.json"),
      JSON.stringify({
        id: "demo",
        title: "Demo",
        description: "Fixture",
        modules: [
          { id: "open", title: "Open" },
          { id: "private", title: "Private module" },
        ],
        lessons: [
          { slug: "first", title: "First", moduleId: "open" },
          { slug: "draft", title: "Secret draft", moduleId: "private" },
        ],
      }),
    );
    writeFileSync(join(folder, "lesson.md"), "# Protected lesson");
    mkdirSync(join(root, "courses/demo/lessons/draft"));
    writeFileSync(
      join(root, "courses/demo/lessons/draft/lesson.md"),
      "# Private editorial text",
    );
    const selection = join(root, "publication.json");
    writeFileSync(
      selection,
      JSON.stringify({ courses: [{ id: "demo", lessons: ["first"] }] }),
    );
    const previousSelection = process.env.BUNKERCODE_PUBLICATION_FILE;
    process.env.BUNKERCODE_PUBLICATION_FILE = selection;
    process.env.BUNKERCODE_CONTENT_DIR = root;
    const app = await createApplication(true);
    const db = app.get(PrismaService);
    await app.listen(0, "127.0.0.1");
    const base = await app.getUrl();
    const email = `student-${randomUUID()}@example.test`,
      password = "abc123";
    const username = `student_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
    const post = (
      path: string,
      body: unknown = {},
      extra: Record<string, string> = {},
    ) =>
      fetch(base + path, {
        method: "POST",
        headers: { ...headers, ...extra },
        body: JSON.stringify(body),
      });
    const get = (path: string, token?: string, method = "GET") =>
      fetch(base + path, {
        method,
        headers: token ? { Authorization: "Bearer " + token } : {},
      });
    const lesson = "/content/courses/demo/lessons/first";
    let a: Result, b: Result, firstCookie: string, currentCookie: string;
    try {
      await t.test(
        "registration enforces six characters, an ASCII letter and digit while login preserves legacy passwords",
        async () => {
          for (const invalid of [
            "abcdef",
            "123456",
            "ab12",
            "ééééé1",
            "😀😀😀😀😀1",
          ]) {
            const response = await post("/auth/register", {
              email: `invalid-${randomUUID()}@example.test`,
              username: `invalid_${randomUUID().replaceAll("-", "").slice(0, 16)}`,
              password: invalid,
            });
            assert.equal(response.status, 400);
            assert.equal(
              ((await response.json()) as { code: string }).code,
              "INVALID_PASSWORD",
            );
          }
          for (const valid of ["a12345", "ABC123", "abc123!"]) {
            const response = await post("/auth/register", {
              email: `valid-${randomUUID()}@example.test`,
              username: `valid_${randomUUID().replaceAll("-", "").slice(0, 16)}`,
              password: valid,
            });
            assert.equal(response.status, 201);
          }
          const legacyEmail = `legacy-${randomUUID()}@example.test`;
          const legacyPassword = "legacy-password-without-digits";
          await db.user.create({
            data: {
              email: legacyEmail,
              passwordHash: await hashPassword(legacyPassword),
            },
          });
          const response = await post("/auth/login", {
            email: legacyEmail,
            password: legacyPassword,
          });
          assert.equal(response.status, 200);
          assert.equal(
            ((await response.json()) as Result).user.email,
            legacyEmail,
          );
        },
      );
      await t.test(
        "two normalized students register; duplicate and role injection are rejected; only safe identity fields leave API",
        async () => {
          const response = await post("/auth/register", {
            email: " " + email.toUpperCase() + " ",
            username: " " + username.toUpperCase() + " ",
            password,
          });
          assert.equal(response.status, 201);
          firstCookie = cookie(response);
          currentCookie = firstCookie;
          assert.match(response.headers.get("set-cookie")!, /HttpOnly/);
          assert.match(response.headers.get("set-cookie")!, /Path=\/api\/auth/);
          assert.match(response.headers.get("set-cookie")!, /SameSite=Strict/);
          assert.doesNotMatch(response.headers.get("set-cookie")!, /Domain=/);
          assert.equal(response.headers.get("cache-control"), "no-store");
          a = (await response.json()) as Result;
          assert.equal(a.user.email, email);
          assert.equal(a.user.role, "STUDENT");
          assert.deepEqual(Object.keys(a).sort(), ["accessToken", "user"]);
          assert.deepEqual(Object.keys(a.user).sort(), ["email", "id", "role"]);
          const second = await post("/auth/register", {
            email: `second-${randomUUID()}@example.test`,
            username: `second_${randomUUID().replaceAll("-", "").slice(0, 16)}`,
            password,
          });
          assert.equal(second.status, 201);
          b = (await second.json()) as Result;
          assert.notEqual(a.user.id, b.user.id);
          assert.equal(
            (
              await post("/auth/register", {
                email: email.toUpperCase(),
                username: `other_${randomUUID().replaceAll("-", "").slice(0, 16)}`,
                password,
              })
            ).status,
            409,
          );
          assert.equal(
            (
              await post("/auth/register", {
                email: `admin-${randomUUID()}@example.test`,
                username: `admin_${randomUUID().replaceAll("-", "").slice(0, 16)}`,
                password,
                role: "ADMIN",
              })
            ).status,
            400,
          );
          const stored = await db.user.findUniqueOrThrow({
            where: { id: a.user.id },
          });
          assert.equal(stored.username, username);
          const duplicate = await post("/auth/register", {
            email: `duplicate-${randomUUID()}@example.test`,
            username: username.toUpperCase(),
            password,
          });
          assert.equal(duplicate.status, 409);
          assert.equal(
            ((await duplicate.json()) as { code: string }).code,
            "USERNAME_TAKEN",
          );
          await assert.rejects(
            db.user.create({
              data: {
                email: `direct-${randomUUID()}@example.test`,
                username,
                passwordHash: stored.passwordHash,
              },
            }),
            (error: unknown) =>
              !!error &&
              typeof error === "object" &&
              "code" in error &&
              error.code === "P2002",
          );
          await assert.rejects(
            db.user.create({
              data: {
                email: `uppercase-${randomUUID()}@example.test`,
                username: username.toUpperCase(),
                passwordHash: stored.passwordHash,
              },
            }),
          );
          assert.match(stored.passwordHash, /^scrypt\$131072\$8\$1\$/);
          assert.ok(!stored.passwordHash.includes(password));
          const session = await db.session.findFirstOrThrow({
            where: { userId: a.user.id },
          });
          assert.notEqual(session.tokenHash, firstCookie.split("=")[1]);
          assert.equal(
            session.tokenHash,
            createHash("sha256")
              .update(firstCookie.split("=")[1]!)
              .digest("hex"),
          );
        },
      );
      await t.test(
        "login uses uniform failures and JWT checks signature, expiry, issuer and audience",
        async () => {
          const invalid = await post("/auth/login", {
            email,
            password: "wrong-password-123",
          });
          const unknown = await post("/auth/login", {
            email: `missing-${randomUUID()}@example.test`,
            password,
          });
          assert.equal(invalid.status, 401);
          assert.equal(unknown.status, 401);
          assert.deepEqual(await invalid.json(), await unknown.json());
          for (const identifier of [
            email.toUpperCase(),
            username,
            " " + username.toUpperCase() + " ",
          ]) {
            const response = await post("/auth/login", {
              identifier,
              password,
            });
            assert.equal(response.status, 200);
            const value = (await response.json()) as Result;
            assert.equal(value.user.id, a.user.id);
            assert.equal(
              (await post("/auth/refresh", {}, { Cookie: cookie(response) }))
                .status,
              200,
            );
          }
          const absent = await post("/auth/login", {
            identifier: `missing_${randomUUID().slice(0, 8)}`,
            password,
          });
          assert.equal(absent.status, 401);
          assert.deepEqual(await absent.json(), {
            statusCode: 401,
            message: "Não foi possível entrar. Confira seus dados.",
            error: "Unauthorized",
          });
          const login = await post("/auth/login", { email, password });
          assert.equal(login.status, 200);
          const payload = decodeJwt(a.accessToken);
          assert.equal(payload.exp! - payload.iat!, 600);
          assert.equal(payload.sub, a.user.id);
          assert.equal(payload.role, undefined);
          assert.equal((await get("/auth/me", a.accessToken)).status, 200);
          assert.equal(
            (await get("/auth/me", a.accessToken + "corrupt")).status,
            401,
          );
          const config = authConfig();
          for (const variant of ["expired", "issuer", "audience"]) {
            const token = await new SignJWT({ sid: payload.sid })
              .setProtectedHeader({ alg: "HS256" })
              .setSubject(a.user.id)
              .setIssuedAt()
              .setExpirationTime(
                variant === "expired"
                  ? Math.floor(Date.now() / 1000) - 1
                  : "10m",
              )
              .setIssuer(variant === "issuer" ? "wrong" : config.issuer)
              .setAudience(variant === "audience" ? "wrong" : config.audience)
              .sign(config.secret);
            assert.equal((await get(lesson, token)).status, 401);
          }
        },
      );
      await t.test(
        "anonymous and student reads expose only published lessons, modules and navigation",
        async () => {
          assert.equal((await get("/content/courses")).status, 200);
          assert.equal((await get("/content/courses/demo")).status, 200);
          const catalog = (await (
            await get("/content/courses")
          ).json()) as CourseSummary[];
          assert.deepEqual(
            catalog.map((c: { id: string; lessonCount: number }) => [
              c.id,
              c.lessonCount,
            ]),
            [["demo", 1]],
          );
          for (const token of [undefined, a.accessToken, b.accessToken]) {
            for (const path of [lesson, lesson + "/exercise"]) {
              assert.equal((await get(path, token)).status, 200);
              assert.equal((await get(path, token, "HEAD")).status, 200);
            }
            const page = (await (await get(lesson, token)).json()) as Lesson;
            assert.equal(page.previous, null);
            assert.equal(page.next, null);
            assert.deepEqual(
              page.course.lessons.map((l: { slug: string }) => l.slug),
              ["first"],
            );
            assert.deepEqual(
              page.course.modules?.map((m: { id: string }) => m.id),
              ["open"],
            );
            for (const path of [
              "/content/courses/demo/lessons/draft",
              "/content/courses/demo/lessons/draft/exercise",
            ]) {
              assert.equal((await get(path, token)).status, 404);
              assert.equal((await get(path, token, "HEAD")).status, 404);
            }
          }
          for (const method of ["GET", "HEAD"])
            assert.equal(
              (await get(lesson.toUpperCase(), undefined, method)).status,
              400,
            );
          assert.equal((await get("/practice/runtime")).status, 401);
          const run = {
            id: randomUUID(),
            course: "demo",
            lesson: "draft",
            exercise: "secret",
            revision: "v1",
            source: "",
            javascript: "",
          };
          assert.equal(
            (
              await post("/practice/runs", run, {
                "X-Bunkercode-Client": "local",
              })
            ).status,
            401,
          );
          assert.equal(
            (
              await post("/practice/runs", run, {
                "X-Bunkercode-Client": "local",
                Authorization: "Bearer " + a.accessToken,
              })
            ).status,
            404,
          );
          for (const path of [
            "/content/courses/demo/lessons/first/lesson.md",
            "/courses/demo/lessons/first/lesson.md",
            "/content/courses/demo/course.json",
            "/.env",
            "/learning/activities",
          ])
            assert.equal((await get(path)).status, 404);
          assert.equal((await get(lesson, a.accessToken)).status, 200);
          assert.equal((await get(lesson, b.accessToken)).status, 200);
        },
      );
      await t.test(
        "cookie CSRF and CORS reject untrusted origins, missing origin and non-JSON",
        async () => {
          assert.equal(
            (
              await post(
                "/auth/refresh",
                {},
                { Cookie: currentCookie, Origin: "https://evil.example" },
              )
            ).status,
            403,
          );
          assert.equal(
            (
              await post(
                "/auth/refresh",
                {},
                { Cookie: currentCookie, Origin: "null" },
              )
            ).status,
            403,
          );
          assert.equal(
            (
              await fetch(base + "/auth/refresh", {
                method: "POST",
                headers: {
                  Cookie: currentCookie,
                  "Content-Type": "application/json",
                },
                body: "{}",
              })
            ).status,
            403,
          );
          assert.equal(
            (await post("/auth/refresh", {}, { "Content-Type": "text/plain" }))
              .status,
            415,
          );
          assert.equal(
            (
              await post(
                "/auth/refresh",
                {},
                { "Sec-Fetch-Site": "cross-site" },
              )
            ).status,
            403,
          );
          const malformed = await fetch(base + "/auth/login", {
            method: "POST",
            headers,
            body: '{"password":"MUST_NOT_APPEAR"',
          });
          assert.equal(malformed.status, 400);
          assert.doesNotMatch(
            await malformed.text(),
            /MUST_NOT_APPEAR|SyntaxError|stack/,
          );
          const oversized = await fetch(base + "/auth/login", {
            method: "POST",
            headers,
            body: JSON.stringify({ password: "x".repeat(5000) }),
          });
          assert.equal(oversized.status, 413);
          const cors = await fetch(base + "/auth/me", {
            headers: { Origin: "https://evil.example" },
          });
          assert.equal(cors.headers.get("access-control-allow-origin"), null);
          const allowed = await fetch(base + "/auth/me", {
            headers: { Origin: origin },
          });
          assert.equal(
            allowed.headers.get("access-control-allow-origin"),
            origin,
          );
        },
      );
      await t.test(
        "student cannot write; local provisioning permits admin; demotion takes effect with the same JWT",
        async () => {
          const edit = () =>
            fetch(base + lesson + "/markdown", {
              method: "PUT",
              headers: {
                ...headers,
                "X-Bunkercode-Client": "local",
                Authorization: "Bearer " + a.accessToken,
              },
              body: JSON.stringify({
                markdown: "# Admin",
                version: "0".repeat(64),
              }),
            });
          assert.equal((await edit()).status, 403);
          assert.equal(
            (
              await post(
                "/content/courses/demo/lessons",
                { title: "New", slug: "new" },
                {
                  Authorization: "Bearer " + a.accessToken,
                  "X-Bunkercode-Client": "local",
                },
              )
            ).status,
            403,
          );
          execFileSync(
            process.execPath,
            [
              createRequire(__filename).resolve("tsx/cli"),
              "src/auth/provision-admin.ts",
              email,
            ],
            { stdio: "pipe" },
          );
          assert.equal(
            (await get("/content/courses/demo/lessons/draft", a.accessToken))
              .status,
            200,
          );
          const editorial = (await (
            await get(lesson, a.accessToken)
          ).json()) as Lesson;
          assert.equal(editorial.next?.slug, "draft");
          assert.equal((await edit()).status, 409); // Reaches physical revision validation.
          assert.equal(
            (
              await post(
                "/content/courses/demo/lessons",
                { title: "New", slug: "new" },
                {
                  Authorization: "Bearer " + a.accessToken,
                  "X-Bunkercode-Client": "local",
                },
              )
            ).status,
            201,
          );
          await db.user.update({
            where: { id: a.user.id },
            data: { role: "STUDENT" },
          });
          assert.equal((await edit()).status, 403);
          assert.equal(
            (await get("/content/courses/demo/lessons/draft", a.accessToken))
              .status,
            404,
          );
        },
      );
      await t.test(
        "rotation serializes competing requests without revoking legitimate sessions; stale reuse revokes",
        async () => {
          const results = await Promise.all([
            post("/auth/refresh", {}, { Cookie: firstCookie }),
            post("/auth/refresh", {}, { Cookie: firstCookie }),
          ]);
          assert.deepEqual(results.map((r) => r.status).sort(), [200, 200]);
          const success = results.find((r) => r.status === 200)!;
          currentCookie = cookie(success);
          assert.notEqual(currentCookie, firstCookie);
          assert.equal(cookie(results[0]!), cookie(results[1]!));
          // Recover a response lost after rotation committed but before Set-Cookie arrived.
          const recovered = await post(
            "/auth/refresh",
            {},
            { Cookie: firstCookie },
          );
          assert.equal(recovered.status, 200);
          assert.equal(cookie(recovered), currentCookie);
          assert.equal((await get(lesson, a.accessToken)).status, 200);
          const old = createHash("sha256")
            .update(firstCookie.split("=")[1]!)
            .digest("hex");
          await db.session.updateMany({
            where: { previousHash: old },
            data: { rotatedAt: new Date(Date.now() - 11000) },
          });
          assert.equal(
            (await post("/auth/refresh", {}, { Cookie: firstCookie })).status,
            401,
          );
          assert.equal(
            (await post("/auth/refresh", {}, { Cookie: currentCookie })).status,
            401,
          );
          assert.equal((await get(lesson, a.accessToken)).status, 401);
        },
      );
      await t.test(
        "logout and expiration revoke the corresponding session and preserve another student",
        async () => {
          const login = await post("/auth/login", { email, password });
          const token = (await login.json()) as Result;
          const logout = await post(
            "/auth/logout",
            {},
            { Cookie: cookie(login) },
          );
          assert.equal(logout.status, 204);
          assert.match(
            logout.headers.get("set-cookie")!,
            /Expires=Thu, 01 Jan 1970/,
          );
          assert.equal(
            (await post("/auth/refresh", {}, { Cookie: cookie(login) })).status,
            401,
          );
          assert.equal((await get(lesson, token.accessToken)).status, 401);
          assert.equal((await get(lesson, b.accessToken)).status, 200);
          const next = await post("/auth/login", { email, password });
          const hash = createHash("sha256")
            .update(cookie(next).split("=")[1]!)
            .digest("hex");
          await db.session.updateMany({
            where: { tokenHash: hash },
            data: {
              createdAt: new Date(Date.now() - 20000),
              expiresAt: new Date(Date.now() - 10000),
            },
          });
          assert.equal(
            (await post("/auth/refresh", {}, { Cookie: cookie(next) })).status,
            401,
          );
          assert.equal(
            (
              await post(
                "/auth/refresh",
                {},
                {
                  Cookie:
                    "bunkercode_refresh=" +
                    randomBytes(32).toString("base64url"),
                },
              )
            ).status,
            401,
          );
        },
      );
      await t.test(
        "password endpoints enforce brute-force limits including trailing slash variants",
        async () => {
          const missing = `limit-${randomUUID()}@example.test`;
          const statuses: number[] = [];
          for (let i = 0; i < 12; i++)
            statuses.push(
              (await post("/auth/login/", { email: missing, password })).status,
            );
          assert.ok(statuses.includes(429));
        },
      );
    } finally {
      if (previousSelection === undefined)
        delete process.env.BUNKERCODE_PUBLICATION_FILE;
      else process.env.BUNKERCODE_PUBLICATION_FILE = previousSelection;
      await app.close();
      delete process.env.BUNKERCODE_CONTENT_DIR;
    }
  },
);

test("strict credentials and production configuration fail closed", () => {
  const valid = {
    email: "x@y.test",
    username: "valid_user",
    password: "abc123",
  };
  for (const body of [
    null,
    [],
    {},
    { ...valid, email: "bad" },
    { ...valid, email: "x..y@example.test" },
    { ...valid, email: ".x@example.test" },
    { ...valid, email: "x@" + "a".repeat(64) + ".test" },
    { ...valid, password: "a".repeat(128) + "1" },
    { ...valid, password: "abcdef" },
    { ...valid, password: "123456" },
    { ...valid, password: "ab12" },
    { ...valid, password: "ééééé1" },
    { ...valid, password: "abc１２３" },
    { ...valid, username: "ab" },
    { ...valid, username: "x".repeat(31) },
    { ...valid, username: "invalid-name" },
    { email: valid.email, password: valid.password },
    { ...valid, confirmation: valid.password },
    { ...valid, role: "ADMIN" },
  ])
    assert.throws(() => credentials(body));
  for (const password of [
    "abc123",
    "a12345",
    "ABC123",
    "abc123!",
    "passwordpassword1",
    "a".repeat(127) + "1",
    "😀".repeat(126) + "a1",
  ])
    assert.equal(credentials({ ...valid, password }).password, password);
  assert.equal(
    credentials({ ...valid, username: "  Mixed_User  " }).username,
    "mixed_user",
  );
  assert.equal(
    credentials(
      { email: valid.email, password: "legacy-without-digits" },
      "login",
    ).password,
    "legacy-without-digits",
  );
  for (const body of [
    { identifier: "valid_user", email: valid.email, password: valid.password },
    { identifier: "valid_user", password: valid.password, role: "ADMIN" },
    { identifier: 123, password: valid.password },
    { password: valid.password },
    { identifier: "x".repeat(255), password: valid.password },
  ])
    assert.throws(() => credentials(body, "login"));
  assert.equal(
    credentials({ identifier: "  Mixed_User  ", password: "legacy" }, "login")
      .identifier,
    "mixed_user",
  );
  const original = process.env.NODE_ENV,
    origins = process.env.BUNKERCODE_AUTH_ORIGINS,
    secret = process.env.BUNKERCODE_JWT_SECRET;
  try {
    process.env.NODE_ENV = "production";
    process.env.BUNKERCODE_AUTH_ORIGINS = origin;
    assert.throws(() => authConfig());
    process.env.BUNKERCODE_AUTH_ORIGINS = "https://study.example.test";
    assert.equal(authConfig().secure, true);
    delete process.env.BUNKERCODE_JWT_SECRET;
    assert.throws(() => authConfig());
  } finally {
    for (const [key, value] of [
      ["NODE_ENV", original],
      ["BUNKERCODE_AUTH_ORIGINS", origins],
      ["BUNKERCODE_JWT_SECRET", secret],
    ]) {
      if (value === undefined) delete process.env[key!];
      else process.env[key!] = value;
    }
  }
});

test(
  "application refuses to listen when the database is unavailable",
  { timeout: 15000 },
  async () => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL =
      "postgresql://unavailable:unavailable@127.0.0.1:1/unavailable";
    const app = await createApplication(true);
    try {
      await assert.rejects(app.listen(0, "127.0.0.1"));
      assert.equal(app.getHttpServer().listening, false);
    } finally {
      await app.close();
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  },
);

test(
  "production cookies are Secure and a persisted session survives backend restart",
  { timeout: 20000 },
  async () => {
    const previousNode = process.env.NODE_ENV;
    const previousOrigins = process.env.BUNKERCODE_AUTH_ORIGINS;
    process.env.NODE_ENV = "production";
    process.env.BUNKERCODE_AUTH_ORIGINS = "https://study.example.test";
    let app = await createApplication(true);
    try {
      await app.listen(0, "127.0.0.1");
      const response = await fetch((await app.getUrl()) + "/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://study.example.test",
        },
        body: JSON.stringify({
          email: `restart-${randomUUID()}@example.test`,
          username: `restart_${randomUUID().replaceAll("-", "").slice(0, 16)}`,
          password: randomUUID(),
        }),
      });
      assert.equal(response.status, 201);
      assert.match(response.headers.get("set-cookie")!, /; Secure;/);
      const savedCookie = cookie(response),
        user = ((await response.json()) as Result).user;
      await app.close();
      app = await createApplication(true);
      await app.listen(0, "127.0.0.1");
      const renewed = await fetch((await app.getUrl()) + "/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://study.example.test",
          Cookie: savedCookie,
        },
        body: "{}",
      });
      assert.equal(renewed.status, 200);
      assert.equal(((await renewed.json()) as Result).user.id, user.id);
    } finally {
      await app.close();
      if (previousNode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNode;
      if (previousOrigins === undefined)
        delete process.env.BUNKERCODE_AUTH_ORIGINS;
      else process.env.BUNKERCODE_AUTH_ORIGINS = previousOrigins;
    }
  },
);

// Hash capacity belongs to the actual operation, not to a response/socket lifetime.
test("password hashing holds its concurrency budget until computation completes", async () => {
  const pending = Array.from({ length: 5 }, () => hashPassword(randomUUID()));
  const results = await Promise.allSettled(pending);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    4,
  );
  assert.equal(
    results.filter((result) => result.status === "rejected").length,
    1,
  );
  const refused = results[4];
  assert.equal(refused?.status, "rejected");
  if (refused?.status === "rejected") {
    const error: unknown = refused.reason;
    assert.ok(error instanceof HttpException);
    assert.equal(error.getStatus(), 429);
  }
  assert.match(await hashPassword(randomUUID()), /^scrypt\$/);
});

test(
  "shared authentication defenses use real HTTP and PostgreSQL across two instances",
  { timeout: 90000 },
  async (t) => {
    const keys = [
      "BUNKERCODE_TRUSTED_PROXIES",
      "BUNKERCODE_AUTH_LOGIN_IP_LIMIT",
      "BUNKERCODE_AUTH_REGISTER_IP_LIMIT",
    ] as const;
    const saved = keys.map((key) => process.env[key]);
    process.env.BUNKERCODE_TRUSTED_PROXIES = "127.0.0.1/32";
    process.env.BUNKERCODE_AUTH_LOGIN_IP_LIMIT = "4";
    process.env.BUNKERCODE_AUTH_REGISTER_IP_LIMIT = "4";
    // Unique client range per run; retained limiter data from earlier tests stays intact.
    const network = `198.18.${randomBytes(1)[0]}`;
    const directIp = `127.1.${randomBytes(1)[0]}.${1 + (randomBytes(1)[0]! % 253)}`;
    const apps = [await createApplication(true), await createApplication(true)];
    const db = apps[0]!.get(PrismaService);
    const secret = authConfig().secret;
    const digest = (key: string) =>
      createHmac("sha256", secret)
        .update("bunkercode-auth-limit-v1\0")
        .update(key)
        .digest("hex");
    const expire = async (values: string[]) =>
      db.authThrottle.updateMany({
        where: { key: { in: values.map(digest) } },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
    const uid = randomUUID().replaceAll("-", "").slice(0, 12);
    const email = `security-${uid}@example.test`,
      username = `security_${uid}`,
      password = "abc123";
    const storedHash = await hashPassword(password);
    const user = await db.user.create({
      data: { email, username, passwordHash: storedHash },
    });
    try {
      await Promise.all(apps.map((app) => app.listen(0, "127.0.0.1")));
      const bases = await Promise.all(apps.map((app) => app.getUrl()));
      const post = (
        index: number,
        path: string,
        body: unknown,
        ip: string,
        extra: Record<string, string> = {},
      ) =>
        fetch(bases[index]! + path, {
          method: "POST",
          headers: { ...headers, "X-Forwarded-For": ip, ...extra },
          body: JSON.stringify(body),
        });
      await t.test(
        "account quota survives aliases, independent trusted IPs and backend instances; cooldown recovers",
        async () => {
          for (let i = 0; i < 10; i++) {
            const response = await post(
              i % 2,
              "/auth/login/",
              {
                identifier:
                  i % 2 ? username.toUpperCase() : email.toUpperCase(),
                password: "wrong123",
              },
              `${network}.${10 + i}`,
            );
            assert.equal(response.status, 401);
            assert.equal(
              ((await response.json()) as { message: string }).message,
              "Não foi possível entrar. Confira seus dados.",
            );
          }
          for (const identifier of [email, username]) {
            const response = await post(
              1,
              "/auth/login",
              { identifier, password },
              `${network}.30`,
            );
            assert.equal(response.status, 429);
            assert.ok(Number(response.headers.get("retry-after")) > 0);
            assert.deepEqual(await response.json(), {
              statusCode: 429,
              message: "Muitas tentativas. Aguarde antes de tentar novamente.",
            });
          }
          const require = createRequire(__filename);
          const child = execFileSync(
            process.execPath,
            [
              require.resolve("tsx/cli"),
              "-e",
              `
            import {PrismaService} from "./src/auth/prisma.service";
            import {AuthService} from "./src/auth/auth.service";
            const db=new PrismaService();
            new AuthService(db).login(${JSON.stringify({ identifier: username, password })})
              .then(()=>process.stdout.write("200"),error=>process.stdout.write(String(error.status)))
              .finally(()=>db.$disconnect());
          `,
            ],
            {
              cwd: join(__dirname, ".."),
              env: process.env,
              encoding: "utf8",
              timeout: 15000,
            },
          );
          assert.equal(
            child,
            "429",
            "a separate process must retain the shared account quota",
          );
          await expire([
            `login:account:${user.id}`,
            `login:identifier:${email}`,
            `login:identifier:${username}`,
          ]);
          const response = await post(
            1,
            "/auth/login",
            { identifier: username, password },
            `${network}.31`,
          );
          assert.equal(response.status, 200);
          assert.equal(((await response.json()) as Result).user.id, user.id);
          assert.equal(
            (await db.user.findUniqueOrThrow({ where: { id: user.id } }))
              .username,
            username,
          );
        },
      );
      await t.test(
        "unknown identifiers are independently bounded across IPs and both instances",
        async () => {
          const identifier = `unknown_${uid}`;
          for (let i = 0; i < 10; i++)
            assert.equal(
              (
                await post(
                  i % 2,
                  "/auth/login",
                  { identifier, password },
                  `${network}.${40 + i}`,
                )
              ).status,
              401,
            );
          assert.equal(
            (
              await post(
                1,
                "/auth/login",
                { identifier, password },
                `${network}.51`,
              )
            ).status,
            429,
          );
        },
      );
      await t.test(
        "one trusted IP spraying different accounts reaches a shared endpoint limit and recovers",
        async () => {
          for (let i = 0; i < 4; i++)
            assert.equal(
              (
                await post(
                  i % 2,
                  "/auth/login",
                  { identifier: `spray_${uid}_${i}`, password },
                  `${network}.60`,
                )
              ).status,
              401,
            );
          const response = await post(
            1,
            "/auth/login",
            { identifier: username, password },
            `${network}.60`,
          );
          assert.equal(response.status, 429);
          assert.ok(Number(response.headers.get("retry-after")) > 0);
          assert.equal(
            (
              await post(
                1,
                "/auth/login",
                { identifier: username, password },
                `203.0.113.99, ${network}.60`,
              )
            ).status,
            429,
            "prepending a forged address cannot bypass the first untrusted client hop",
          );
          await expire([`ip:${network}.60:/login`]);
          assert.equal(
            (
              await post(
                0,
                "/auth/login",
                { identifier: email, password },
                `${network}.60`,
              )
            ).status,
            200,
          );
        },
      );
      await t.test(
        "untrusted forwarding headers do not bypass limits",
        async () => {
          delete process.env.BUNKERCODE_TRUSTED_PROXIES;
          const direct = await createApplication(true);
          try {
            await direct.listen(0, "127.0.0.1");
            const target = (await direct.getUrl()) + "/auth/login";
            const attempt = (forwarded: string) =>
              new Promise<number>((resolve, reject) => {
                const request = httpRequest(
                  target,
                  {
                    method: "POST",
                    localAddress: directIp,
                    headers: { ...headers, "X-Forwarded-For": forwarded },
                  },
                  (response) => {
                    response.resume();
                    response.on("end", () => resolve(response.statusCode!));
                  },
                );
                request.on("error", reject);
                request.end(
                  JSON.stringify({
                    identifier: `forged_${uid}_${forwarded}`,
                    password,
                  }),
                );
              });
            for (let i = 0; i < 4; i++)
              assert.equal(await attempt(`203.0.113.${i + 1}`), 401);
            assert.equal(await attempt("203.0.113.99"), 429);
          } finally {
            await direct.close();
            process.env.BUNKERCODE_TRUSTED_PROXIES = "127.0.0.1/32";
          }
        },
      );
      await t.test(
        "registration IP quotas include invalid requests, preserve records and expire",
        async () => {
          const before = await db.user.count();
          for (let i = 0; i < 4; i++)
            assert.equal(
              (
                await post(
                  i % 2,
                  "/auth/register",
                  {
                    email: `invalid-${uid}-${i}@example.test`,
                    username: `invalid_${uid}`,
                    password: "123456",
                  },
                  `${network}.70`,
                )
              ).status,
              400,
            );
          assert.equal(
            (await post(1, "/auth/register", {}, `${network}.70`)).status,
            429,
          );
          assert.equal(await db.user.count(), before);
          await expire([`ip:${network}.70:/register`]);
          assert.equal(
            (
              await post(
                1,
                "/auth/register",
                {
                  email: `valid-${uid}@example.test`,
                  username: `valid_${uid}`,
                  password,
                },
                `${network}.70`,
              )
            ).status,
            201,
          );
        },
      );
      await t.test(
        "concurrent duplicate registration creates one user and safe conflicts",
        async () => {
          const data = {
            email: `race-${uid}@example.test`,
            username: `race_${uid}`,
            password,
          };
          const responses = await Promise.all(
            Array.from({ length: 3 }, (_, i) =>
              post(i % 2, "/auth/register", data, `${network}.${80 + i}`),
            ),
          );
          assert.deepEqual(
            responses.map((r) => r.status).sort(),
            [201, 409, 409],
          );
          assert.equal(
            await db.user.count({ where: { email: data.email } }),
            1,
          );
          for (const response of responses.filter((r) => r.status === 409))
            assert.equal(
              ((await response.json()) as { code: string }).code,
              "USERNAME_TAKEN",
            );
        },
      );
      await t.test(
        "repeated registration target cannot evade its quota by changing trusted IP",
        async () => {
          const data = {
            email: `repeat-${uid}@example.test`,
            username: `repeat_${uid}`,
            password,
          };
          for (let i = 0; i < 5; i++)
            assert.equal(
              (
                await post(
                  i % 2,
                  "/auth/register",
                  data,
                  `${network}.${90 + i}`,
                )
              ).status,
              i === 0 ? 201 : 409,
            );
          assert.equal(
            (await post(1, "/auth/register", data, `${network}.95`)).status,
            429,
          );
        },
      );
      await t.test(
        "refresh is session-limited even with changing tokens, IPs and instances",
        async () => {
          const response = await post(
            0,
            "/auth/login",
            { identifier: email, password },
            `${network}.100`,
          );
          assert.equal(response.status, 200);
          const result = (await response.json()) as Result;
          const sid = decodeJwt(result.accessToken).sid as string;
          await db.authThrottle.create({
            data: {
              key: digest(`refresh:session:${sid}`),
              count: 120,
              expiresAt: new Date(Date.now() + 60000),
            },
          });
          assert.equal(
            (
              await post(1, "/auth/refresh", {}, `${network}.101`, {
                Cookie: cookie(response),
              })
            ).status,
            429,
          );
          await expire([`refresh:session:${sid}`]);
          assert.equal(
            (
              await post(1, "/auth/refresh", {}, `${network}.102`, {
                Cookie: cookie(response),
              })
            ).status,
            200,
          );
        },
      );
      await t.test(
        "oversized and malformed payloads fail before identity queries or expensive work",
        async () => {
          assert.equal(
            (
              await post(
                0,
                "/auth/login",
                { identifier: email, password: "x".repeat(5000) },
                `${network}.110`,
              )
            ).status,
            413,
          );
          for (const body of [
            { identifier: username, email, password },
            { identifier: username, password, role: "ADMIN" },
          ])
            assert.equal(
              (await post(0, "/auth/login", body, `${network}.110`)).status,
              400,
            );
        },
      );
      await t.test(
        "bounded failed-login concurrency returns controlled responses and subsequently recovers",
        async () => {
          const responses = await Promise.all(
            Array.from({ length: 12 }, (_, i) =>
              post(
                i % 2,
                "/auth/login",
                { identifier: `load_${uid}_${i}`, password: "wrong123" },
                `${network}.${120 + i}`,
              ),
            ),
          );
          assert.ok(responses.some((response) => response.status === 429));
          assert.ok(
            responses.every((response) => [401, 429].includes(response.status)),
          );
          assert.equal(
            (
              await post(
                0,
                "/auth/login",
                { identifier: username, password },
                `${network}.140`,
              )
            ).status,
            200,
          );
          assert.match(
            (await db.user.findUniqueOrThrow({ where: { id: user.id } }))
              .passwordHash,
            /^scrypt\$131072\$8\$1\$/,
          );
        },
      );
    } finally {
      await Promise.all(apps.map((app) => app.close()));
      keys.forEach((key, i) => {
        const value = saved[i];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      });
    }
  },
);

test("proxy trust and quota configuration reject broad or malformed values", () => {
  const keys = [
    "BUNKERCODE_TRUSTED_PROXIES",
    "BUNKERCODE_AUTH_LOGIN_IP_LIMIT",
    "BUNKERCODE_AUTH_REGISTER_IP_LIMIT",
  ] as const;
  const saved = keys.map((key) => process.env[key]);
  try {
    for (const value of [
      "true",
      "1",
      "*",
      "0.0.0.0/0",
      "::/0",
      "127.0.0.1/33",
      "::1/129",
      "127.0.0.1/",
      "127.0.0.1/32/extra",
    ]) {
      process.env.BUNKERCODE_TRUSTED_PROXIES = value;
      assert.throws(() => authConfig());
    }
    process.env.BUNKERCODE_TRUSTED_PROXIES = "127.0.0.1/32,::1/128";
    assert.deepEqual(authConfig().trustedProxies, ["127.0.0.1/32", "::1/128"]);
    for (const value of ["0", "-1", "1.5", "10001", ""]) {
      process.env.BUNKERCODE_AUTH_LOGIN_IP_LIMIT = value;
      assert.throws(() => authConfig());
    }
  } finally {
    keys.forEach((key, i) => {
      const value = saved[i];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  }
});
