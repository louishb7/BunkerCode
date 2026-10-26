import { defineConfig } from "@playwright/test";
import local from "./playwright.config";

// Reuses only side-effect-free fixture/output allocation and browser settings.
export default defineConfig({
  ...local,
  testDir: "./e2e-public",
  use: { ...local.use, baseURL: "http://127.0.0.1:5186" },
  webServer: [
    {
      command: "node scripts/browser-backend.mjs",
      cwd: "../..",
      gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
      url: "http://127.0.0.1:3014/content/courses",
      reuseExistingServer: false,
      env: {
        PORT: "3014",
        NODE_PATH: "",
        BUNKERCODE_PROFILE: "public",
        // Test selection applies only to the supervisor's disposable copy.
        BUNKERCODE_BROWSER_PUBLIC_COURSES:
          '["typescript","postgresql",{"id":"linux","lessons":["pipes"]},"fundamentos-programacao-javascript"]',
      },
    },
    {
      command:
        "pnpm exec vite preview --host 127.0.0.1 --port 5186 --strictPort",
      url: "http://127.0.0.1:5186",
      reuseExistingServer: false,
      env: {
        BUNKERCODE_PROFILE: "public",
        BUNKERCODE_API_URL: "http://127.0.0.1:3014",
      },
    },
  ],
});
