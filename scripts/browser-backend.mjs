import { spawn } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { chmodSync, lstatSync, readdirSync } from "node:fs";
import { preparePublication } from "../apps/backend/dist/publication-preparation.js";
import { withBrowserFixture } from "./browser-fixture.mjs";

await withBrowserFixture(process.env, resolve("content"), async (content) => {
  let snapshot;
  if (process.env.BUNKERCODE_PROFILE === "public") {
    if (
      process.env.BUNKERCODE_BROWSER_OWNED_CONTENT_DIR !==
      process.env.BUNKERCODE_BROWSER_CONTENT_DIR
    )
      throw new Error(
        "Public browser preparation requires a supervisor-owned fixture",
      );
    snapshot = join(dirname(content), "publication");
    preparePublication(
      content,
      {
        courses: JSON.parse(
          process.env.BUNKERCODE_BROWSER_PUBLIC_COURSES ?? "[]",
        ),
      },
      snapshot,
    );
  }
  try {
    await new Promise((resolveRun, reject) => {
      const child = spawn(process.execPath, ["apps/backend/dist/main.js"], {
        stdio: "inherit",
        env: { ...process.env, BUNKERCODE_CONTENT_DIR: snapshot ?? content },
      });
      const stop = () => child.kill("SIGTERM");
      process.on("SIGINT", stop);
      process.on("SIGTERM", stop);
      child.once("error", reject);
      child.once("exit", (code, signal) => {
        process.off("SIGINT", stop);
        process.off("SIGTERM", stop);
        if (code && !signal) process.exitCode = code;
        resolveRun();
      });
    });
  } finally {
    // Only this supervisor's freshly prepared snapshot is made removable.
    // Explicit external directories never reach this branch.
    if (snapshot) {
      const restore = (path) => {
        const stat = lstatSync(path);
        if (stat.isSymbolicLink())
          throw new Error("Unexpected snapshot symlink during cleanup");
        chmodSync(path, stat.isDirectory() ? 0o700 : 0o600);
        if (stat.isDirectory())
          for (const name of readdirSync(path)) restore(join(path, name));
      };
      restore(snapshot);
    }
  }
});
