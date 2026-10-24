import { defineConfig } from "@playwright/test";
import { resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { realpathSync } from "node:fs";

// Stable environment is inherited by the server and every worker. No filesystem
// side effects during config loading (including direct Playwright --list).
if (!process.env.BUNKERCODE_BROWSER_CONTENT_DIR) {
  const temporaryRoot = realpathSync(tmpdir());
  const checkout = realpathSync(resolve("../.."));
  if (temporaryRoot === checkout || temporaryRoot.startsWith(checkout + sep))
    throw new Error(
      "O diretório temporário do navegador deve ficar fora do checkout.",
    );
  const path = resolve(
    temporaryRoot,
    `bunkercode-browser-content-${randomUUID()}`,
  );
  process.env.BUNKERCODE_BROWSER_CONTENT_DIR = path;
  process.env.BUNKERCODE_BROWSER_OWNED_CONTENT_DIR = path;
} else if (
  process.env.BUNKERCODE_BROWSER_OWNED_CONTENT_DIR !==
  process.env.BUNKERCODE_BROWSER_CONTENT_DIR
) {
  delete process.env.BUNKERCODE_BROWSER_OWNED_CONTENT_DIR;
}
// An explicit output directory is a parent, never a directory Playwright may wipe.
process.env.BUNKERCODE_BROWSER_RUN_OUTPUT_DIR ??= resolve(
  process.env.BUNKERCODE_BROWSER_OUTPUT_DIR ?? "../../.bunkercode",
  `browser-results-${randomUUID()}`,
);
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  workers: 1,
  timeout: 45000,
  outputDir: process.env.BUNKERCODE_BROWSER_RUN_OUTPUT_DIR,
  use: {
    baseURL: "http://127.0.0.1:5184",
    viewport: { width: 1280, height: 960 },
    trace: "retain-on-failure",
    launchOptions: process.env.BROWSER_PATH
      ? { executablePath: process.env.BROWSER_PATH }
      : {},
  },
  webServer: [
    {
      command: "node scripts/browser-backend.mjs",
      gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
      cwd: "../..",
      url: "http://127.0.0.1:3012/content/courses",
      reuseExistingServer: false,
      env: {
        PORT: "3012",
        BUNKERCODE_PROFILE: "authoring",
        NODE_PATH: "",
        BUNKERCODE_STUDIO_ORIGIN: "http://127.0.0.1:5184",
        BUNKERCODE_CONTENT_DIR: process.env.BUNKERCODE_BROWSER_CONTENT_DIR,
      },
    },
    {
      command:
        "pnpm exec vite preview --host 127.0.0.1 --port 5184 --strictPort",
      url: "http://127.0.0.1:5184",
      reuseExistingServer: false,
      env: {
        BUNKERCODE_API_URL: "http://127.0.0.1:3012",
        BUNKERCODE_PROFILE: "authoring",
      },
    },
  ],
});
