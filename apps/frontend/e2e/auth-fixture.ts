import { test as base, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

export * from "@playwright/test";
export { expect };
export const test = base.extend<{
  identity: { id: string; accessToken: string };
}>({
  identity: [
    async ({ context, baseURL }, use) => {
      const result = JSON.parse(
        execFileSync(
          process.execPath,
          [
            resolve("../../scripts/browser-identity.mjs"),
            baseURL?.endsWith("5186") ? "STUDENT" : "ADMIN",
          ],
          { encoding: "utf8" },
        ),
      ) as {
        accessToken: string;
        token: string;
        user: { id: string };
        expiresAt: string;
      };
      await context.addCookies([
        {
          name: "bunkercode_refresh",
          value: result.token,
          domain: "127.0.0.1",
          path: "/api/auth",
          httpOnly: true,
          secure: false,
          sameSite: "Strict",
          expires: new Date(result.expiresAt).getTime() / 1000,
        },
      ]);
      // Only API requests get this fixture token; the page recovers through HttpOnly cookie.
      await context.addInitScript((id) => {
        Object.defineProperty(window, "__testIdentity", { value: id });
      }, result.user.id);
      await use({ id: result.user.id, accessToken: result.accessToken });
    },
    { auto: true },
  ],
  request: async ({ playwright, baseURL, identity }, use) => {
    const request = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { Authorization: "Bearer " + identity.accessToken },
    });
    await use(request);
    await request.dispose();
  },
});

export async function authenticatedGet(
  page: import("@playwright/test").Page,
  url: string,
) {
  const response = await page.request.post("/api/auth/refresh", {
    data: {},
    headers: { Origin: new URL(page.url()).origin },
  });
  expect(response.ok()).toBeTruthy();
  const value = (await response.json()) as { accessToken: string };
  return page.request.get(url, {
    headers: { Authorization: "Bearer " + value.accessToken },
  });
}

declare global {
  interface Window {
    __testIdentity: string;
  }
}
