import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { test } from "node:test";

const frontend = resolve("apps/frontend");
const require = createRequire(resolve(frontend, "package.json"));
const vite = resolve(dirname(require.resolve("vite/package.json")), "bin/vite.js");

test("Vite refuses missing/invalid profiles and public development before listening", async (t) => {
  for (const [name, profile, args, message] of [
    ["missing profile", undefined, [], /must explicitly be authoring or public/],
    ["invalid profile", "PUBLIC", [], /must explicitly be authoring or public/],
    ["empty profile", "", ["preview"], /must explicitly be authoring or public/],
    ["public dev server", "public", [], /requires a production build/],
  ]) {
    await t.test(name, () => {
      // NODE_ENV and the VITE_ namespace must never select private capabilities.
      const env = {
        ...process.env,
        NODE_ENV: "production",
        VITE_BUNKERCODE_PROFILE: "authoring",
      };
      delete env.BUNKERCODE_PROFILE;
      if (profile !== undefined) env.BUNKERCODE_PROFILE = profile;
      const result = spawnSync(
        process.execPath,
        [vite, ...args, "--host", "127.0.0.1", "--port", "0"],
        { cwd: frontend, env, encoding: "utf8", timeout: 15000 },
      );
      assert.ifError(result.error);
      assert.equal(result.signal, null);
      assert.notEqual(result.status, 0);
      assert.match(result.stdout + result.stderr, message);
      assert.doesNotMatch(result.stdout, /Local:|ready in/);
    });
  }
});
