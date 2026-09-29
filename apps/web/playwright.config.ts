import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 90000,
  outputDir: "../../.bunkerlab/browser-results",
  use: {
    baseURL: "http://127.0.0.1:5174",
    viewport: { width: 1440, height: 1000 },
    launchOptions: process.env.BROWSER_PATH
      ? { executablePath: process.env.BROWSER_PATH }
      : {},
  },
  webServer: [
    {
      command: "pnpm --filter @backendlab/api start",
      cwd: "../..",
      url: "http://127.0.0.1:3002/workspaces/local/systems/orderdesk",
      env: {
        PORT: "3002",
        BUNKERLAB_DATA_DIR: resolve(
          process.env.BUNKERLAB_BROWSER_DATA_DIR ??
            "../../.bunkerlab/browser-system-first",
        ),
      },
      reuseExistingServer: false,
    },
    {
      command: "pnpm dev --port 5174 --strictPort",
      url: "http://127.0.0.1:5174",
      env: { BUNKERLAB_API_URL: "http://127.0.0.1:3002" },
      reuseExistingServer: false,
    },
  ],
});
