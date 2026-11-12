import { authenticatedFetch as fetch, authEnvironment } from "./auth-fixture";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { setTimeout as deadlineTimer, clearTimeout } from "node:timers";
import { test } from "node:test";
import type { Lesson } from "../src/content/courses";
import {
  StartupError,
  databaseStartupError,
  startupDiagnostic,
} from "../src/startup-error";

test(
  "compiled entry point loads local files with shell precedence and serves protected content without inherited Node settings",
  { timeout: 20000 },
  async () => {
    const root = await mkdtemp(join(tmpdir(), "bunkercode-startup-"));
    const content = join(root, "content");
    const lessonFile = join(content, "courses/smoke/lessons/first/lesson.md");
    await mkdir(join(content, "courses/smoke/lessons/first"), {
      recursive: true,
    });
    await writeFile(
      join(content, "courses/smoke/course.json"),
      JSON.stringify({
        id: "smoke",
        title: "Smoke",
        description: "Isolated startup fixture",
        lessons: [{ slug: "first", title: "First" }],
      }),
    );
    await writeFile(lessonFile, "# First\n\nCompiled startup.");
    const reservation = createServer();
    reservation.listen(0, "127.0.0.1");
    await once(reservation, "listening");
    const port = (reservation.address() as AddressInfo).port;
    await new Promise<void>((resolve, reject) =>
      reservation.close((error) => (error ? reject(error) : resolve())),
    );
    const origin = "http://127.0.0.1:5173";
    const envFile = join(root, ".env");
    const localFile = join(root, ".env.local");
    await writeFile(
      envFile,
      Object.entries({
        ...authEnvironment(),
        DATABASE_URL: "postgresql://wrong:wrong@127.0.0.1:1/wrong",
        BUNKERCODE_PROFILE: "authoring",
        PORT: "invalid-must-be-overridden",
        BUNKERCODE_CONTENT_DIR: content,
        BUNKERCODE_STUDIO_ORIGIN: origin,
      })
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join("\n"),
      { mode: 0o600 },
    );
    await writeFile(localFile, `PORT=${port}\n`, { mode: 0o600 });
    const child = spawn(
      process.execPath,
      [
        `--env-file-if-exists=${envFile}`,
        `--env-file-if-exists=${localFile}`,
        resolve("dist/main.js"),
      ],
      {
        cwd: root,
        // Deliberately do not inherit NODE_PATH, NODE_OPTIONS or package-manager settings.
        env: {
          PATH: process.env.PATH,
          DATABASE_URL: process.env.DATABASE_URL,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const exited = once(child, "exit");
    let output = "",
      lastFailure = "";
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    const base = `http://127.0.0.1:${port}`;
    try {
      let ready = false;
      const deadline = Date.now() + 10000;
      while (!ready && Date.now() < deadline) {
        assert.equal(child.exitCode, null, output);
        try {
          ready = (
            await globalThis.fetch(base + "/content/courses", {
              signal: AbortSignal.timeout(500),
            })
          ).ok;
        } catch (error) {
          lastFailure = String(error);
        }
        if (!ready) await setTimeout(50);
      }
      assert.ok(ready, output + lastFailure);
      const courses = await fetch(base + "/content/courses");
      assert.equal(courses.headers.get("cache-control"), "no-store");
      assert.deepEqual(await courses.json(), [
        {
          id: "smoke",
          title: "Smoke",
          description: "Isolated startup fixture",
          lessonCount: 1,
        },
      ]);
      assert.equal((await fetch(base + "/content/courses/smoke")).status, 200);
      const url = base + "/content/courses/smoke/lessons/first";
      const lesson = (await (await fetch(url)).json()) as Lesson;
      assert.equal(lesson.markdown, "# First\n\nCompiled startup.");
      assert.equal(
        (await fetch(base + "/content/courses/missing")).status,
        404,
      );
      assert.equal((await fetch(base + "/learning/activities")).status, 404);
      const request = JSON.stringify({
        markdown: "# First\n\nSaved by smoke.",
        version: lesson.version,
      });
      assert.equal(
        (
          await fetch(url + "/markdown", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: request,
          })
        ).status,
        403,
      );
      const saved = await fetch(url + "/markdown", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-bunkercode-client": "local",
          origin,
          "sec-fetch-site": "same-origin",
        },
        body: request,
      });
      assert.equal(saved.status, 200);
      assert.equal(
        await readFile(lessonFile, "utf8"),
        "# First\n\nSaved by smoke.",
      );
    } finally {
      child.kill("SIGTERM");
      await Promise.race([exited, setTimeout(3000, undefined, { ref: false })]);
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
        await exited;
      }
      await rm(root, { recursive: true, force: true });
    }
  },
);

test("startup diagnostics classify driver failures without exposing secret-bearing errors", () => {
  const sensitive =
    "postgresql://private-user:private-password@private-host/private-db JWT-private-token";
  for (const [code, expected] of [
    ["ECONNREFUSED", /Cannot reach PostgreSQL/],
    ["28P01", /rejected authentication/],
    ["3D000", /does not exist/],
    ["42501", /denied access/],
    ["42P01", /tables\/columns are missing/],
    ["P2022", /tables\/columns are missing/],
  ] as const) {
    const nested = {
      message: sensitive,
      meta: {
        driverAdapterError: {
          cause: { originalCode: code, message: sensitive },
        },
      },
    };
    const message = startupDiagnostic(databaseStartupError(nested));
    assert.match(message, expected);
    assert.doesNotMatch(message, /private-|postgresql:\/\//);
  }
  const cyclic: { cause?: unknown } = {};
  cyclic.cause = cyclic;
  assert.match(
    startupDiagnostic(databaseStartupError(cyclic)),
    /readiness failed/,
  );
  assert.match(
    startupDiagnostic({ code: "EADDRINUSE", message: sensitive }),
    /PORT is already in use/,
  );
  assert.doesNotMatch(
    startupDiagnostic(new Error(sensitive)),
    /private-|postgresql:\/\//,
  );
  assert.doesNotMatch(
    startupDiagnostic(
      new StartupError(
        "content/profile configuration",
        "Check publication configuration.",
        { cause: new Error(sensitive) },
      ),
    ),
    /private-|postgresql:\/\//,
  );
});

test(
  "direct production and test entry points ignore local files and fail safely with a nonzero exit",
  { timeout: 15000 },
  async () => {
    const root = await mkdtemp(join(tmpdir(), "bunkercode-startup-failure-"));
    try {
      await writeFile(
        join(root, ".env"),
        Object.entries(authEnvironment())
          .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
          .join("\n"),
        { mode: 0o600 },
      );
      for (const mode of ["production", "test"]) {
        const child = spawn(process.execPath, [resolve("dist/main.js")], {
          cwd: root,
          env: {
            PATH: process.env.PATH,
            NODE_ENV: mode,
            BUNKERCODE_PROFILE: "authoring",
            PORT: "0",
          },
          stdio: ["ignore", "pipe", "pipe"],
        });
        let output = "";
        child.stdout.on("data", (chunk: Buffer) => {
          output += chunk.toString();
        });
        child.stderr.on("data", (chunk: Buffer) => {
          output += chunk.toString();
        });
        const timer = deadlineTimer(() => child.kill("SIGKILL"), 5000);
        const [code, signal] = await once(child, "exit");
        clearTimeout(timer);
        assert.equal(signal, null, output);
        assert.equal(code, 1, output);
        assert.match(
          output,
          /Missing required variables: DATABASE_URL, BUNKERCODE_JWT_SECRET/,
        );
        assert.match(output, /\.env\.example/);
        assert.doesNotMatch(output, /successfully started|postgresql:\/\//);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);

for (const development of [false, true]) {
  const mode = development ? "development" : "deployment";
  const args = development ? ["--dev"] : [];
  test(
    `${mode} entry gates concurrent HTTP startup on idempotent migrations`,
    { timeout: 60000 },
    async () => {
      const root = await mkdtemp(join(tmpdir(), "bunkercode-deploy-"));
      const path = join(root, "courses/demo/lessons/first");
      await mkdir(path, { recursive: true });
      await writeFile(
        join(root, "courses/demo/course.json"),
        JSON.stringify({
          id: "demo",
          title: "Deploy",
          description: "Fixture",
          lessons: [{ slug: "first", title: "First" }],
        }),
      );
      await writeFile(join(path, "lesson.md"), "# Deployment fixture");
      const selection = join(root, "selection.json");
      await writeFile(selection, JSON.stringify({ courses: ["demo"] }));
      const ports = await Promise.all([deploymentPort(), deploymentPort()]);
      const children = ports.map((port) =>
        deploymentProcess(
          {
            PORT: String(port),
            BUNKERCODE_PROFILE: "authoring",
            BUNKERCODE_CONTENT_DIR: root,
            BUNKERCODE_PUBLICATION_FILE: selection,
            DIRECT_URL: process.env.DATABASE_URL!,
          },
          args,
        ),
      );
      try {
        await Promise.all(
          children.map(async (entry, index) => {
            const deadline = Date.now() + 25000;
            let ready = false;
            while (!ready && Date.now() < deadline) {
              assert.equal(entry.child.exitCode, null, entry.output());
              ready = await globalThis
                .fetch(`http://127.0.0.1:${ports[index]}/content/courses`)
                .then((r) => r.ok)
                .catch(() => false);
              if (!ready) await setTimeout(50);
            }
            assert.ok(ready, entry.output());
            assert.match(entry.output(), /migrations ready; starting backend/);
            assert.ok(
              entry.output().indexOf("migrations ready") <
                entry.output().indexOf("Starting Nest application"),
              entry.output(),
            );
            assert.ok(
              !entry.output().includes(process.env.DATABASE_URL!),
              "Connection URL must not reach startup logs",
            );
          }),
        );
      } finally {
        await Promise.all(children.map((entry) => stopDeployment(entry.child)));
        for (const port of ports)
          await assert.rejects(
            globalThis.fetch(`http://127.0.0.1:${port}/content/courses`),
          );
        await rm(root, { recursive: true, force: true });
      }
    },
  );

  test(
    `${mode} migration failure never opens HTTP or exposes raw CLI secrets`,
    { timeout: 20000 },
    async () => {
      const port = await deploymentPort();
      const marker = "private-deploy-engine-marker";
      const entry = deploymentProcess(
        {
          PORT: String(port),
          BUNKERCODE_PROFILE: development ? "authoring" : "public",
          PRISMA_SCHEMA_ENGINE_BINARY: join(tmpdir(), marker, "missing-engine"),
        },
        args,
      );
      const [code] = await once(entry.child, "exit");
      assert.notEqual(code, 0);
      assert.match(entry.output(), /migration failed/);
      assert.ok(!entry.output().includes(marker));
      assert.ok(!entry.output().includes(process.env.DATABASE_URL!));
      assert.ok(!entry.output().includes("starting backend"));
      await assert.rejects(
        globalThis.fetch(`http://127.0.0.1:${port}/content/courses`),
      );
    },
  );
}

test(
  "development watcher refuses public or production mode before migrating",
  { timeout: 10000 },
  async () => {
    const configurations: Record<string, string>[] = [
      { BUNKERCODE_PROFILE: "public" },
      { BUNKERCODE_PROFILE: "authoring", NODE_ENV: "production" },
    ];
    for (const extra of configurations) {
      const entry = deploymentProcess(extra, ["--dev"]);
      const [code] = await once(entry.child, "exit");
      assert.notEqual(code, 0);
      assert.match(entry.output(), /configuration failed/);
      assert.ok(!entry.output().includes("applying versioned"));
    }
  },
);

test(
  "deployment configuration refuses absent database URL without loading local files",
  { timeout: 10000 },
  async () => {
    const child = spawn(
      process.execPath,
      [resolve("../../scripts/deploy-backend.mjs")],
      {
        env: { PATH: process.env.PATH, BUNKERCODE_PROFILE: "public" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    child.stdout.on("data", (data: Buffer) => {
      output += data.toString();
    });
    child.stderr.on("data", (data: Buffer) => {
      output += data.toString();
    });
    const [code] = await once(child, "exit");
    assert.notEqual(code, 0);
    assert.match(output, /configuration failed/);
    assert.ok(!output.includes("applying versioned"));
  },
);

async function deploymentPort() {
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const port = (reservation.address() as AddressInfo).port;
  await new Promise<void>((resolve, reject) =>
    reservation.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}
function deploymentProcess(extra: Record<string, string>, args: string[] = []) {
  const child = spawn(
    process.execPath,
    [resolve("../../scripts/deploy-backend.mjs"), ...args],
    {
      env: { PATH: process.env.PATH, ...authEnvironment(), ...extra },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  child.stdout.on("data", (data: Buffer) => {
    output += data.toString();
  });
  child.stderr.on("data", (data: Buffer) => {
    output += data.toString();
  });
  return { child, output: () => output };
}
async function stopDeployment(child: ReturnType<typeof spawn>) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  const timer = deadlineTimer(() => child.kill("SIGKILL"), 5000);
  try {
    await exited;
  } finally {
    clearTimeout(timer);
  }
}
