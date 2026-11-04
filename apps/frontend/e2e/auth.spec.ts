// Intentionally uses anonymous contexts: no default identity fixture.
import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import {
  expectRenderedContrast,
  selectSiteTheme,
} from "./reading-theme-checks";
const lesson = "/courses/typescript/lessons/values-and-types";
const password = () => randomUUID();
async function register(page: Page, email: string, secret: string) {
  await page.goto("/register?next=" + encodeURIComponent(lesson));
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(secret);
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(lesson + "$"));
  await expect(page.locator(".cm-editor")).toBeVisible();
}

test("anonymous discovery, published reading and voluntary login preserve context without private APIs", async ({
  page,
  request,
}, info) => {
  await page.addInitScript(() =>
    localStorage.setItem("bunkercode:site-theme", "light"),
  );
  const privateRequests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/practice/")) privateRequests.push(r.url());
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Aprenda programação",
  );
  await page.screenshot({
    path: info.outputPath("visitor-home-light.png"),
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Explorar cursos", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cursos", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("anonymous-catalog-light.png"),
    fullPage: true,
  });
  expect(
    (
      await request.get("/api/content/courses/typescript/lessons/functions")
    ).status(),
  ).toBe(404);
  expect((await request.get("/api/practice/runtime")).status()).toBe(401);
  await page.goto(lesson);
  await expect(page.locator(".cm-editor")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(lesson + "$"));
  await expect(
    page.getByRole("button", { name: "Run", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Submit", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Editar/ })).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".cm-editor")).toBeVisible();
  expect(privateRequests).toEqual([]);
  await page.goto(
    "/courses/fundamentos-programacao-javascript/lessons/o-que-significa-programar",
  );
  await expect(page.locator(".lesson-heading h1")).toContainText(
    "O que significa programar?",
  );
  await page.screenshot({
    path: info.outputPath("anonymous-published-lesson.png"),
  });
  await page.goto(lesson);
  await expect(page.locator(".cm-editor")).toBeVisible();
  await page.getByRole("link", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page.getByLabel("Senha", { exact: true })).toHaveAttribute(
    "autocomplete",
    "current-password",
  );
  await expect(page.locator("#password-help")).toHaveCount(0);
  await expectRenderedContrast(
    page.locator(
      ".auth-form-area :is(h1, label, .auth-description, .auth-hint, .auth-storage-note), .auth-submit",
    ),
  );
  await page.screenshot({
    path: info.outputPath("login-desktop-light.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Mostrar senha", exact: true })
    .click();
  await expect(page.getByLabel("Senha", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page
    .getByRole("link", { name: "Criar uma conta", exact: true })
    .click();
  await expect(page).toHaveURL(/\/register\?next=/);
  await page.screenshot({
    path: info.outputPath("register-desktop-light.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: info.outputPath("register-mobile-light.png"),
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page.getByLabel("E-mail", { exact: true })).toBeFocused();
  await expect(page.locator("#email-error")).toContainText("válido");
  await page.getByLabel("E-mail", { exact: true }).fill("valid@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page.getByLabel("Senha", { exact: true })).toBeFocused();
  await expect(page.locator("#password-error")).toContainText("12 a 128");
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.getByRole("link", { name: "Entrar", exact: true }).click();
  await selectSiteTheme(page, "bunkercode");
  await page.screenshot({
    path: info.outputPath("login-desktop-dark.png"),
    fullPage: true,
  });
  await expectRenderedContrast(
    page.locator(
      ".auth-form-area :is(h1, label, .auth-description, .auth-storage-note), .auth-submit",
    ),
  );
  for (const width of [320, 390, 800]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
  }
  await page.goto(lesson + "/edit");
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("student registers, survives reload and concurrent tabs, cannot use Studio, and logout revokes the cookie", async ({
  page,
  context,
  request,
}, info) => {
  const email = `browser-${randomUUID()}@example.test`;
  await register(page, email, password());
  await expect(page.getByRole("link", { name: /Editar/ })).toHaveCount(0);
  const cookies = await context.cookies();
  const refresh = cookies.find(
    (cookie) => cookie.name === "bunkercode_refresh",
  )!;
  expect(refresh.httpOnly).toBe(true);
  expect(refresh.sameSite).toBe("Strict");
  expect(refresh.path).toBe("/api/auth");
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    "bunkercode_refresh",
  );
  expect(
    await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    ),
  ).not.toMatch(/accessToken|refreshToken|eyJhbG/);
  await page.reload();
  await expect(page.locator(".cm-editor")).toBeVisible();
  const other = await context.newPage();
  await Promise.all([page.reload(), other.goto(lesson)]);
  await expect(page.locator(".cm-editor")).toBeVisible();
  await expect(other.locator(".cm-editor")).toBeVisible();
  await page.goto(lesson + "/edit");
  await expect(
    page.getByRole("heading", { name: "Acesso restrito", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("student-studio-denied.png"),
    fullPage: true,
  });
  const beforeLogout = (await context.cookies()).find(
    (c) => c.name === "bunkercode_refresh",
  )!;
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Entrar", exact: true }),
  ).toBeVisible();
  await expect(other.locator(".cm-editor")).toBeVisible();
  await expect(
    other.getByRole("button", { name: "Run", exact: true }),
  ).toHaveCount(0);
  await expect(
    other.getByRole("link", { name: "Entrar", exact: true }),
  ).toBeVisible();
  expect(
    (await context.cookies()).find((c) => c.name === "bunkercode_refresh"),
  ).toBeUndefined();
  const response = await request.post("/api/auth/refresh", {
    headers: {
      Origin: "http://127.0.0.1:5184",
      Cookie: "bunkercode_refresh=" + beforeLogout.value,
    },
    data: {},
  });
  expect(response.status()).toBe(401);
});

test("distinct accounts, duplicate email, wrong password and lost refresh resolve predictably without a loop", async ({
  page,
  context,
}) => {
  const email = `account-${randomUUID()}@example.test`,
    secret = password();
  await register(page, email, secret);
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Entrar", exact: true }),
  ).toBeVisible();
  await page.goto("/register");
  await page.getByLabel("E-mail", { exact: true }).fill(email.toUpperCase());
  await page.getByLabel("Senha", { exact: true }).fill(secret);
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("já está cadastrado");
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password());
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Confira e-mail e senha");
  await register(page, `second-${randomUUID()}@example.test`, password());
  await context.clearCookies();
  let refreshes = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/auth/refresh")) refreshes++;
  });
  await page.reload();
  await expect(page.locator(".cm-editor")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Entrar", exact: true }),
  ).toBeVisible();
  expect(refreshes).toBe(1);
});

test("controlled administrator fixture accesses Studio through real refresh authentication", async ({
  page,
  context,
}, info) => {
  const result = JSON.parse(
    execFileSync(
      process.execPath,
      [resolve("../../scripts/browser-identity.mjs"), "ADMIN"],
      { encoding: "utf8" },
    ),
  ) as { token: string; expiresAt: string };
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
  await page.goto(lesson + "/edit");
  await expect(
    page.getByRole("button", { name: "Salvar alterações", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("administrator-studio.png"),
    fullPage: true,
  });
});

test("switching accounts isolates persisted drafts and failed-write recovery buffers", async ({
  page,
}) => {
  page.on("dialog", (dialog) => void dialog.accept());
  const email = `owner-${randomUUID()}@example.test`,
    secret = password();
  await register(page, email, secret);
  const editor = page.getByRole("textbox", {
    name: "Código da solução",
    exact: true,
  });
  await editor.fill("// private draft belonging to account A");
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const databases = await indexedDB.databases();
        const name = databases.find((db) =>
          db.name?.startsWith("bunkercode-practice:"),
        )?.name;
        if (!name) return false;
        return new Promise<boolean>((resolve, reject) => {
          const request = indexedDB.open(name);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction("drafts");
            const read = tx.objectStore("drafts").getAll();
            tx.oncomplete = () => {
              db.close();
              resolve(
                read.result.some(
                  (draft: { code: string }) =>
                    draft.code === "// private draft belonging to account A",
                ),
              );
            };
            tx.onerror = () => {
              db.close();
              reject(tx.error);
            };
          };
        });
      }),
    )
    .toBe(true);
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "drafts")
        throw new DOMException("Quota test", "QuotaExceededError");
      return put.apply(this, args);
    };
  });
  await editor.fill("// private pending recovery belonging to account A");
  await expect(page.locator(".save-status")).toContainText("Quota test");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Entrar", exact: true }),
  ).toBeVisible();
  await register(page, `different-${randomUUID()}@example.test`, password());
  await expect(editor).not.toContainText("account A");
  await page.reload();
  await expect(page.locator(".cm-editor")).toBeVisible();
  await expect(editor).not.toContainText("account A");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Entrar", exact: true }),
  ).toBeVisible();
  await page.goto("/login?next=" + encodeURIComponent(lesson));
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(secret);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(editor).toHaveText(
    "// private pending recovery belonging to account A",
  );
  await expect(page.locator(".save-status")).toContainText("recuperada");
});

test("authentication rejects return paths that could escape courses or loop back to login", async ({
  page,
}) => {
  for (const next of [
    "https://example.test",
    "//example.test",
    "/courses/../login",
    "/courses/%2e%2e/login",
    "/courses/../../register",
  ]) {
    await page.goto("/login?next=" + encodeURIComponent(next));
    await expect(
      page.getByRole("link", { name: "Criar uma conta", exact: true }),
    ).toHaveAttribute("href", "/register?next=%2Fcourses");
  }
  await page
    .getByRole("link", { name: "Criar uma conta", exact: true })
    .click();
  await page
    .getByLabel("E-mail", { exact: true })
    .fill(`return-${randomUUID()}@example.test`);
  await page.getByLabel("Senha", { exact: true }).fill(password());
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page).toHaveURL(/\/courses$/);
  await expect(
    page.getByRole("heading", { name: "Cursos", exact: true }),
  ).toBeVisible();
});
