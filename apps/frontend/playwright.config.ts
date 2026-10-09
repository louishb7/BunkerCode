import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
import { cpSync, mkdirSync, mkdtempSync } from "node:fs";

mkdirSync(resolve("../../.bunkercode"), { recursive: true });
if (!process.env.BUNKERCODE_BROWSER_CONTENT_DIR) {
  process.env.BUNKERCODE_BROWSER_CONTENT_DIR = mkdtempSync(
    resolve("../../.bunkercode/browser-content-"),
  );
  cpSync(resolve("../../content"), process.env.BUNKERCODE_BROWSER_CONTENT_DIR, {
    recursive: true,
  });
}
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 45000,
  outputDir: mkdtempSync(resolve("../../.bunkercode/browser-results-")),
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
      command: "pnpm --filter @bunkercode/backend start",
      cwd: "../..",
      url: "http://127.0.0.1:3012/content/courses",
      reuseExistingServer: false,
      env: {
        PORT: "3012",
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
      env: { BUNKERCODE_API_URL: "http://127.0.0.1:3012" },
    },
  ],
});
