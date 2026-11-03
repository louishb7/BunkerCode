import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SignJWT, decodeJwt } from "jose";
import { HttpException } from "@nestjs/common";
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
        lessons: [{ slug: "first", title: "First" }],
      }),
    );
    writeFileSync(join(folder, "lesson.md"), "# Protected lesson");
    process.env.BUNKERCODE_CONTENT_DIR = root;
    const app = await createApplication(true);
    const db = app.get(PrismaService);
    await app.listen(0, "127.0.0.1");
    const base = await app.getUrl();
    const email = `student-${randomUUID()}@example.test`,
      password = randomUUID();
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
        "two normalized students register; duplicate and role injection are rejected; only safe identity fields leave API",
        async () => {
          const response = await post("/auth/register", {
            email: " " + email.toUpperCase() + " ",
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
            password,
          });
          assert.equal(second.status, 201);
          b = (await second.json()) as Result;
          assert.notEqual(a.user.id, b.user.id);
          assert.equal(
            (
              await post("/auth/register", {
                email: email.toUpperCase(),
                password,
              })
            ).status,
            409,
          );
          assert.equal(
            (
              await post("/auth/register", {
                email: `admin-${randomUUID()}@example.test`,
                password,
                role: "ADMIN",
              })
            ).status,
            400,
          );
          const stored = await db.user.findUniqueOrThrow({
            where: { id: a.user.id },
          });
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
        "catalog remains public; lesson, exercise, HEAD and casing cannot bypass authentication",
        async () => {
          assert.equal((await get("/content/courses")).status, 200);
          assert.equal((await get("/content/courses/demo")).status, 200);
          for (const path of [
            lesson,
            lesson + "/exercise",
            lesson.toUpperCase(),
          ]) {
            assert.equal((await get(path)).status, 401);
            assert.equal((await get(path, undefined, "HEAD")).status, 401);
          }
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
      await app.close();
      delete process.env.BUNKERCODE_CONTENT_DIR;
    }
  },
);

test("strict credentials and production configuration fail closed", () => {
  for (const body of [
    null,
    [],
    {},
    { email: "bad", password: "short" },
    { email: "x..y@example.test", password: "a".repeat(12) },
    { email: ".x@example.test", password: "a".repeat(12) },
    { email: "x@" + "a".repeat(64) + ".test", password: "a".repeat(12) },
    { email: "x@y.test", password: "a".repeat(129) },
    { email: "x@y.test", password: "a".repeat(12), role: "ADMIN" },
  ])
    assert.throws(() => credentials(body));
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
