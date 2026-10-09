import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import fs from "node:fs";
import { request as httpRequest } from "node:http";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
  symlink,
  rename,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import { createHash } from "node:crypto";
import { createApplication } from "../src/application";
import type { Lesson } from "../src/content/courses";
import type { MarkdownRevision } from "../src/content/markdown-file";

let root: string,
  base: string,
  file: string,
  directory: string,
  app: INestApplication;
const original =
  '# Notes\r\n\r\n~~~typescript\r\nconst name = "ação";\r\n~~~\r\n';
const headers = {
  "content-type": "application/json",
  "x-bunkercode-client": "local",
  origin: "http://127.0.0.1:5173",
};
const path = "/typescript/lessons/notes";
const version = (text: string) =>
  createHash("sha256").update(text).digest("hex");
async function lesson() {
  const response = await fetch(base + path);
  assert.equal(response.status, 200);
  return (await response.json()) as Lesson;
}
function put(
  body: unknown,
  suffix = path,
  changes: Record<string, string> = {},
) {
  return fetch(base + suffix + "/markdown", {
    method: "PUT",
    headers: { ...headers, ...changes },
    body: JSON.stringify(body),
  });
}
async function cleanTemporaryFiles() {
  assert.deepEqual(
    (await readdir(directory)).filter((name) => name.startsWith(".studio-")),
    [],
  );
}
before(async () => {
  root = await mkdtemp(join(tmpdir(), "bunkercode-studio-"));
  directory = join(root, "content/courses/typescript/lessons/notes");
  file = join(directory, "lesson.md");
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(root, "content/courses/typescript/course.json"),
    JSON.stringify({
      id: "typescript",
      title: "TypeScript",
      description: "Test",
      lessons: [{ slug: "notes", title: "Notes" }],
    }),
  );
  await writeFile(file, original);
  // Disposable Git index proves ordinary file diffs; no commit or production Git.
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  execFileSync("git", ["add", "content"], { cwd: root });
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

test("Studio reads an opaque version, preserves UTF-8/CRLF/fences, writes the physical file and produces a normal Git diff", async () => {
  const loaded = await lesson();
  assert.equal(loaded.markdown, original);
  assert.equal(loaded.version, version(original));
  const edited =
    original +
    "\r\n## New explanation\r\n\r\n~~~javascript\r\nthrow new Error('must remain text');\r\n~~~\r\n";
  const response = await put({ markdown: edited, version: loaded.version });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const saved = (await response.json()) as MarkdownRevision;
  assert.deepEqual(saved, { markdown: edited, version: version(edited) });
  assert.equal(await readFile(file, "utf8"), edited);
  assert.equal((await lesson()).markdown, edited);
  const diff = execFileSync(
    "git",
    ["diff", "--", "content/courses/typescript/lessons/notes/lesson.md"],
    { cwd: root, encoding: "utf8" },
  );
  assert.match(diff, /New explanation/);
  await cleanTemporaryFiles();
  await writeFile(file, original);
});

test("Studio validates the whole request, identifiers, traversal, missing scope and the 256 KiB byte boundary", async () => {
  const request = { markdown: original, version: version(original) };
  for (const body of [
    null,
    [],
    {},
    { ...request, path: file },
    { ...request, markdown: 5 },
    { ...request, version: "bad" },
    { ...request, markdown: "\u0000" },
    { ...request, markdown: "\ud800" },
  ])
    assert.equal((await put(body)).status, 400);
  assert.equal(
    (await put(request, "/%2e%2e%2fprivate/lessons/notes")).status,
    400,
  );
  assert.equal(
    (await put(request, "/typescript/lessons/%2e%2e%2fprivate")).status,
    400,
  );
  assert.equal((await put(request, "/unknown/lessons/notes")).status, 404);
  assert.equal((await put(request, "/typescript/lessons/unknown")).status, 404);
  assert.equal(
    (await put({ ...request, markdown: "é".repeat(131073) })).status,
    413,
  );
  // The JSON parser must not reject valid Markdown larger than its old 100 KiB default.
  const maximum = "\\".repeat(262144);
  assert.equal((await put({ ...request, markdown: maximum })).status, 200);
  assert.equal(await readFile(file, "utf8"), maximum);
  assert.equal(
    (await put({ markdown: "", version: version(maximum) })).status,
    200,
  );
  assert.equal(await readFile(file, "utf8"), "");
  await writeFile(file, original);
  await cleanTemporaryFiles();
});

test("Studio refuses symlink files, lesson directories and an ancestor of the content root without changing outside bytes", async () => {
  const request = { markdown: "replacement", version: version(original) };
  const outside = join(root, "outside.md");
  await writeFile(outside, "outside sentinel");
  await rm(file);
  await symlink(outside, file);
  assert.equal((await put(request)).status, 422);
  assert.equal(await readFile(outside, "utf8"), "outside sentinel");
  await rm(file);
  await writeFile(file, original);
  const moved = directory + "-backup";
  await rename(directory, moved);
  await symlink(moved, directory);
  assert.equal((await put(request)).status, 422);
  await rm(directory);
  await rename(moved, directory);
  const content = join(root, "content"),
    alternate = join(root, "content-backup");
  await rename(content, alternate);
  await symlink(alternate, content);
  assert.equal((await put(request)).status, 422);
  await rm(content);
  await rename(alternate, content);
  assert.equal(await readFile(file, "utf8"), original);
});

test("stale and simultaneous Studio saves cannot silently overwrite the winning revision", async () => {
  const loaded = await lesson();
  await writeFile(file, "VS Code revision");
  assert.equal(
    (await put({ markdown: "stale tab", version: loaded.version })).status,
    409,
  );
  assert.equal(await readFile(file, "utf8"), "VS Code revision");
  await writeFile(file, original);
  const replies = await Promise.all([
    put({ markdown: "first tab", version: loaded.version }),
    put({ markdown: "second tab", version: loaded.version }),
  ]);
  assert.deepEqual(
    replies.map((response) => response.status).sort(),
    [200, 409],
  );
  const winner = (await replies
    .find((response) => response.status === 200)!
    .json()) as MarkdownRevision;
  assert.equal(await readFile(file, "utf8"), winner.markdown);
  assert.equal((await lesson()).version, winner.version);
  await cleanTemporaryFiles();
  await writeFile(file, original);
});

test("an existing write lock blocks another process without deleting its lock or touching the lesson", async () => {
  const lock = join(directory, ".studio-save.lock");
  await writeFile(lock, "other process");
  try {
    assert.equal(
      (await put({ markdown: "new", version: version(original) })).status,
      409,
    );
    assert.equal(await readFile(lock, "utf8"), "other process");
    assert.equal(await readFile(file, "utf8"), original);
  } finally {
    await rm(lock);
  }
});

test("a flush failure never replaces the original, cleans up, and permits a later save", async (context) => {
  const permissions = fs.statSync(directory).mode & 0o777;
  fs.chmodSync(directory, 0o500);
  try {
    assert.equal(
      (await put({ markdown: "unwritable", version: version(original) }))
        .status,
      500,
    );
    assert.equal(await readFile(file, "utf8"), original);
  } finally {
    fs.chmodSync(directory, permissions);
  }
  const flush = context.mock.method(fs, "fsyncSync", () => {
    throw new Error("Injected disk flush failure");
  });
  assert.equal(
    (await put({ markdown: "partial new bytes", version: version(original) }))
      .status,
    500,
  );
  flush.mock.restore();
  assert.equal(await readFile(file, "utf8"), original);
  await cleanTemporaryFiles();
  assert.equal(
    (await put({ markdown: "successful retry", version: version(original) }))
      .status,
    200,
  );
  await writeFile(file, original);
});

test("an external edit while the temporary file is flushed is detected before replacement", async (context) => {
  const flush = fs.fsyncSync;
  const hook = context.mock.method(fs, "fsyncSync", (descriptor: number) => {
    flush(descriptor);
    fs.writeFileSync(file, "External edit during save");
  });
  assert.equal(
    (await put({ markdown: "Studio text", version: version(original) })).status,
    409,
  );
  hook.mock.restore();
  assert.equal(await readFile(file, "utf8"), "External edit during save");
  await cleanTemporaryFiles();
  await writeFile(file, original);
});

test("Studio requires the exact local origin, local Host, JSON and same-origin metadata; a static client header is insufficient", async () => {
  const request = { markdown: "forbidden", version: version(original) };
  const invalidHeaders: Record<string, string>[] = [
    { origin: "" },
    { origin: "null" },
    { origin: "https://attacker.example" },
    { origin: "http://127.0.0.1:5173.attacker.example" },
    { "sec-fetch-site": "cross-site" },
    { "sec-fetch-site": "same-site" },
    { "x-bunkercode-client": "" },
  ];
  for (const changes of invalidHeaders)
    assert.equal(
      (await put(request, path, changes)).status,
      403,
      JSON.stringify(changes),
    );
  // Express routes are case-insensitive; protection must cover the same scope.
  const uppercase = await fetch(
    base.replace("/content/courses", "/CONTENT/COURSES") + path + "/markdown",
    {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-bunkercode-client": "local",
      },
      body: JSON.stringify(request),
    },
  );
  assert.equal(uppercase.status, 403);
  // Node fetch normalizes Host; send raw HTTP to exercise DNS-rebinding rejection.
  const hostStatus = await new Promise<number>((resolve, reject) => {
    const command = httpRequest(
      base + path + "/markdown",
      {
        method: "PUT",
        headers: { ...headers, host: "attacker.example" },
      },
      (response) => {
        response.resume();
        response.on("end", () => resolve(response.statusCode ?? 0));
      },
    );
    command.on("error", reject);
    command.end(JSON.stringify(request));
  });
  assert.equal(hostStatus, 403);
  assert.equal(
    (await put(request, path, { "content-type": "text/plain" })).status,
    415,
  );
  assert.equal(await readFile(file, "utf8"), original);
  const options = await fetch(base + path + "/markdown", {
    method: "OPTIONS",
    headers: {
      origin: "https://attacker.example",
      "access-control-request-method": "PUT",
    },
  });
  assert.equal(options.headers.get("access-control-allow-origin"), null);
});

test("editorial JSON parsing rejects malformed and oversized requests while accepting escaped Markdown at the byte limit", async () => {
  const loaded = await lesson();
  for (const [body, status] of [
    ['{"markdown":', 400],
    [
      JSON.stringify({
        markdown: "x".repeat(1600 * 1024),
        version: loaded.version,
      }),
      413,
    ],
  ] as const) {
    const response = await fetch(base + path + "/markdown", {
      method: "PUT",
      headers,
      body,
    });
    assert.equal(response.status, status);
    assert.equal(await readFile(file, "utf8"), original);
  }
  // Each ASCII control character expands to six bytes in JSON, but is one decoded byte.
  const escaped = "\u0001".repeat(256 * 1024);
  try {
    assert.equal(
      (await put({ markdown: escaped, version: loaded.version })).status,
      200,
    );
    assert.equal(await readFile(file, "utf8"), escaped);
  } finally {
    await writeFile(file, original);
  }
  await cleanTemporaryFiles();
});
