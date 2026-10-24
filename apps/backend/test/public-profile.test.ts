import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createHash } from "node:crypto";
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { preparePublication } from "../src/publication-preparation";
import { publicationSelection } from "../src/publication";

function writable(path: string) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) return;
  chmodSync(path, stat.isDirectory() ? 0o700 : 0o600);
  if (stat.isDirectory())
    for (const name of readdirSync(path)) writable(join(path, name));
}
function digest(root: string): string {
  const hash = createHash("sha256");
  function walk(path: string) {
    const stat = lstatSync(path);
    hash.update(path + String(stat.mode));
    if (stat.isDirectory())
      for (const name of readdirSync(path).sort()) walk(join(path, name));
    else hash.update(readFileSync(path));
  }
  walk(root);
  return hash.digest("hex");
}
function fixture(root: string) {
  const source = join(root, "source");
  for (const id of ["open", "private"]) {
    const path = join(source, "courses", id);
    mkdirSync(join(path, "lessons/first"), { recursive: true });
    writeFileSync(
      join(path, "course.json"),
      JSON.stringify({
        id,
        title: id === "private" ? "CONFIDENTIAL COURSE" : "Open course",
        description: "Fixture",
        lessons: [{ slug: "first", title: "First" }],
      }),
    );
    writeFileSync(
      join(path, "lessons/first/lesson.md"),
      `# First\n\n${id === "private" ? "CONFIDENTIAL LESSON" : "Published lesson"}\n`,
    );
    writeFileSync(
      join(path, "internal-notes.txt"),
      "CONFIDENTIAL INTERNAL FILE",
    );
  }
  return source;
}
async function stop(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  const timer = setTimeout(() => child.kill("SIGKILL"), 3000);
  await exited;
  clearTimeout(timer);
}
async function start(directory: string) {
  const child = spawn(
    process.execPath,
    [
      "-e",
      `
    (async () => {
      const app = await require(${JSON.stringify(resolve("dist/application.js"))}).createApplication(true);
      await app.listen(0, '127.0.0.1');
      console.log(JSON.stringify({ url: await app.getUrl(), privateModules: Object.keys(require.cache).filter(p => /(?:practice\\/|authoring|content\\/studio|publication-preparation)/.test(p)) }));
    })().catch(e => { console.error(e); process.exitCode = 1; });
  `,
    ],
    {
      env: {
        PATH: process.env.PATH,
        BUNKERCODE_PROFILE: "public",
        BUNKERCODE_CONTENT_DIR: directory,
        BUNKERCODE_RUNNER_ENABLED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  try {
    const ready = await new Promise<{ url: string; privateModules: string[] }>(
      (accept, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Startup timed out: " + output)),
          10000,
        );
        child.stderr.on("data", (data: Buffer) => {
          output += data.toString();
        });
        child.stdout.on("data", (data: Buffer) => {
          output += data.toString();
          for (const line of output.split("\n"))
            if (line.startsWith('{"url":')) {
              clearTimeout(timer);
              accept(JSON.parse(line));
            }
        });
        child.once("exit", (code) => {
          clearTimeout(timer);
          reject(new Error(`Startup exit ${code}: ${output}`));
        });
        child.once("error", reject);
      },
    );
    assert.deepEqual(
      ready.privateModules,
      [],
      "Public bootstrap must not load runner or authoring modules",
    );
    return { child, url: ready.url };
  } catch (error) {
    await stop(child);
    throw error;
  }
}

test(
  "public server enforces publication and immutable capabilities despite forged local headers",
  { timeout: 20000 },
  async (t) => {
    const root = mkdtempSync(join(tmpdir(), "bunkercode-public-security-"));
    const source = fixture(root);
    const snapshot = join(root, "public");
    const sourceBefore = digest(source);
    preparePublication(source, { courses: ["open"] }, snapshot);
    const before = digest(snapshot);
    const { child, url } = await start(snapshot);
    const observations: {
      method: string;
      path: string;
      status: number;
      forgedLocalHeaders: boolean;
    }[] = [];
    const observedFetch = async (input: string, init?: RequestInit) => {
      const response = await fetch(input, init);
      observations.push({
        method: init?.method ?? "GET",
        path: new URL(input).pathname,
        status: response.status,
        forgedLocalHeaders: new Headers(init?.headers).has(
          "x-bunkercode-client",
        ),
      });
      return response;
    };
    try {
      const list = await observedFetch(url + "/content/courses");
      assert.equal(list.status, 200);
      assert.deepEqual(
        ((await list.json()) as { id: string }[]).map((c) => c.id),
        ["open"],
      );
      for (const suffix of [
        "/open",
        "/open/lessons/first",
        "/open/lessons/first/exercise",
      ]) {
        const response = await observedFetch(url + "/content/courses" + suffix);
        assert.equal(response.status, 200);
        assert.doesNotMatch(await response.text(), /CONFIDENTIAL/);
      }
      for (const path of [
        "/content/courses/private",
        "/content/courses/private/lessons/first",
        "/content/courses/private/lessons/first/exercise",
        "/content/courses/open/internal-notes.txt",
        "/publication.json",
        "/.env",
        "/practice/runtime",
        "/learning/activities",
        "/content/courses/open/lessons/first/markdown",
      ]) {
        const response = await observedFetch(url + path);
        assert.equal(response.status, 404, path);
        assert.doesNotMatch(await response.text(), /CONFIDENTIAL/);
      }
      const local = {
        host: new URL(url).host,
        origin: "http://127.0.0.1:5173",
        "sec-fetch-site": "same-origin",
        "x-bunkercode-client": "local",
        "x-bunkercode-profile": "authoring",
        "x-forwarded-host": "localhost",
        "content-type": "application/json",
      };
      for (const [method, path] of [
        ["POST", "/content/courses/open/lessons"],
        ["PUT", "/content/courses/open/lessons/first/markdown"],
        ["POST", "/practice/runs"],
        ["DELETE", "/practice/runs/00000000-0000-4000-8000-000000000000"],
        ["PATCH", "/content/courses/open"],
        ["DELETE", "/content/courses/open/lessons/first"],
        ["POST", "/Content/Courses/open/lessons/?profile=authoring"],
      ])
        for (const headers of [{ "content-type": "application/json" }, local]) {
          const response = await observedFetch(url + path, {
            method,
            headers,
            body: JSON.stringify({
              slug: "new",
              title: "New",
              markdown: "Changed",
              version: "forged",
              profile: "authoring",
            }),
          });
          assert.equal(response.status, 403, `${method} ${path}`);
        }
      for (const path of [
        "/content/courses/open/lessons/first/edit",
        "/studio",
        "/practice/runs/alternate",
      ]) {
        assert.equal((await observedFetch(url + path)).status, 404);
      }
      assert.equal(
        digest(snapshot),
        before,
        "Denied attempts must not modify public files",
      );
      assert.equal(
        digest(source),
        sourceBefore,
        "Authoring source must remain unchanged",
      );
      t.diagnostic(
        JSON.stringify({
          evidence: "public-profile",
          privateModules: [],
          observations,
          snapshotBefore: before,
          snapshotAfter: digest(snapshot),
          sourceBefore,
          sourceAfter: digest(source),
        }),
      );
    } finally {
      await stop(child);
      writable(root);
      rmSync(root, { recursive: true });
    }
  },
);

test("empty explicit publication serves an empty catalog and denies direct IDs", async () => {
  const root = mkdtempSync(join(tmpdir(), "bunkercode-empty-public-"));
  const source = fixture(root);
  const snapshot = join(root, "public");
  preparePublication(source, { courses: [] }, snapshot);
  const { child, url } = await start(snapshot);
  try {
    assert.deepEqual(await (await fetch(url + "/content/courses")).json(), []);
    assert.equal((await fetch(url + "/content/courses/open")).status, 404);
  } finally {
    await stop(child);
    writable(root);
    rmSync(root, { recursive: true });
  }
});

test(
  "invalid and incomplete public configuration fails before opening a server",
  { timeout: 30000 },
  async (t) => {
    const root = mkdtempSync(join(tmpdir(), "bunkercode-invalid-profile-"));
    const source = fixture(root);
    try {
      const snapshots: Record<string, string> = {};
      for (const name of [
        "writable",
        "extra",
        "symlink",
        "invalid-selection",
        "invalid-utf8",
      ]) {
        const path = join(root, name);
        preparePublication(source, { courses: ["open"] }, path);
        snapshots[name] = path;
        if (name === "writable")
          chmodSync(join(path, "courses/open/course.json"), 0o644);
        else {
          chmodSync(path, 0o755);
          if (name === "extra")
            writeFileSync(join(path, "private.txt"), "CONFIDENTIAL", {
              mode: 0o444,
            });
          if (name === "symlink")
            symlinkSync(join(source, "courses/private"), join(path, "private"));
          if (name.startsWith("invalid")) {
            chmodSync(join(path, "publication.json"), 0o644);
            writeFileSync(
              join(path, "publication.json"),
              name === "invalid-utf8"
                ? Buffer.from([0xff])
                : '{"courses":["open","open"]}',
            );
            chmodSync(join(path, "publication.json"), 0o444);
          }
          chmodSync(path, 0o555);
        }
      }
      const cases: [string, NodeJS.ProcessEnv][] = [
        ["missing profile", {}],
        ["invalid profile", { BUNKERCODE_PROFILE: "PUBLIC" }],
        ["public without directory", { BUNKERCODE_PROFILE: "public" }],
        [
          "authoring tree instead of snapshot",
          { BUNKERCODE_PROFILE: "public", BUNKERCODE_CONTENT_DIR: source },
        ],
        ...Object.entries(snapshots).map(
          ([name, path]): [string, NodeJS.ProcessEnv] => [
            name,
            { BUNKERCODE_PROFILE: "public", BUNKERCODE_CONTENT_DIR: path },
          ],
        ),
      ];
      for (const [name, env] of cases)
        await t.test(name, async () => {
          const child = spawn(process.execPath, [resolve("dist/main.js")], {
            env: {
              PATH: process.env.PATH,
              NODE_ENV: "production",
              PORT: "0",
              ...env,
            },
            stdio: ["ignore", "pipe", "pipe"],
          });
          let output = "";
          child.stdout.on("data", (data: Buffer) => {
            output += data.toString();
          });
          child.stderr.on("data", (data: Buffer) => {
            output += data.toString();
          });
          const timer = setTimeout(() => child.kill("SIGKILL"), 8000);
          const [code, signal] = await once(child, "exit");
          clearTimeout(timer);
          assert.equal(signal, null, output);
          assert.notEqual(code, 0, output);
          assert.doesNotMatch(output, /Nest application successfully started/);
          assert.match(output, /Error:/);
        });
    } finally {
      writable(root);
      rmSync(root, { recursive: true });
    }
  },
);

test("publication selection rejects broad, ambiguous or invalid values and never overwrites", () => {
  for (const value of [
    undefined,
    null,
    {},
    [],
    { courses: "all" },
    { courses: ["*"] },
    { courses: ["../private"] },
    { courses: ["open", "open"] },
    { courses: ["open"], all: true },
  ])
    assert.throws(() => publicationSelection(value));
  const root = mkdtempSync(join(tmpdir(), "bunkercode-public-prepare-"));
  const source = fixture(root);
  try {
    assert.throws(() =>
      preparePublication(
        source,
        { courses: ["missing"] },
        join(root, "invalid"),
      ),
    );
    assert.throws(() =>
      preparePublication(source, { courses: ["open"] }, source),
    );
    const snapshot = join(root, "public");
    preparePublication(source, { courses: ["open"] }, snapshot);
    assert.throws(() => preparePublication(source, { courses: [] }, snapshot));
    assert.equal(
      readdirSync(join(snapshot, "courses/open")).includes(
        "internal-notes.txt",
      ),
      false,
    );
    assert.deepEqual(readdirSync(join(snapshot, "courses")), ["open"]);
  } finally {
    writable(root);
    rmSync(root, { recursive: true });
  }
});
