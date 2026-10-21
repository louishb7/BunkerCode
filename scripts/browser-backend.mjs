import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { withBrowserFixture } from "./browser-fixture.mjs";

await withBrowserFixture(
  process.env,
  resolve("content"),
  (content) =>
    new Promise((resolveRun, reject) => {
      const child = spawn(process.execPath, ["apps/backend/dist/main.js"], {
        stdio: "inherit",
        env: { ...process.env, BUNKERCODE_CONTENT_DIR: content },
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
    }),
);
