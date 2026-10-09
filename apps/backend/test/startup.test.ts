import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { test } from "node:test";
import type { Lesson } from "../src/content/courses";

test(
  "compiled entry point starts without inherited Node resolution settings and serves protected content endpoints",
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
    const child = spawn(process.execPath, [resolve("dist/main.js")], {
      cwd: root,
      // Deliberately do not inherit NODE_PATH, NODE_OPTIONS or package-manager settings.
      env: {
        PATH: process.env.PATH,
        PORT: String(port),
        BUNKERCODE_CONTENT_DIR: content,
        BUNKERCODE_STUDIO_ORIGIN: origin,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
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
            await fetch(base + "/content/courses", {
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
