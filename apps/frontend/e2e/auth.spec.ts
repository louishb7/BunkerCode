// Intentionally uses anonymous contexts: no default identity fixture.
import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import {
  checkPublicShell,
  expectRenderedContrast,
  selectSiteTheme,
} from "./reading-theme-checks";
const lesson = "/courses/typescript/lessons/values-and-types";
const password = () => randomUUID();
const registrationUsername = () =>
  `student_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
async function register(
  page: Page,
  email: string,
  secret: string,
  username = registrationUsername(),
) {
  await page.goto("/register?next=" + encodeURIComponent(lesson));
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Usuário", { exact: true }).fill(username);
  await page.getByLabel("Senha", { exact: true }).fill(secret);
  await page.getByLabel("Confirmar senha", { exact: true }).fill(secret);
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(lesson + "$"));
  if ((page.viewportSize()?.width ?? 1280) < 1000)
    await page.getByRole("button", { name: "Código", exact: true }).click();
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
    if (/\/api\/(practice|learning)(\/|$)/.test(r.url()))
      privateRequests.push(r.url());
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Início");
  await page.screenshot({
    path: info.outputPath("visitor-home-light.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: /^Explorar cursos/ }).click();
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
  await page
    .locator(".site-header")
    .getByRole("link", { name: "Entrar", exact: true })
    .click();
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
  await page
    .getByLabel("Usuário", { exact: true })
    .fill(registrationUsername());
  await page.getByLabel("Senha", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page.getByLabel("Senha", { exact: true })).toBeFocused();
  await expect(page.locator("#password-error")).toContainText(
    "6 caracteres, 1 letra e 1 número",
  );
  await page.setViewportSize({ width: 1280, height: 960 });
  await page
    .locator(".auth-switch")
    .getByRole("link", { name: "Entrar", exact: true })
    .click();
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

test("registration has four fields, independent password checks, matching confirmation and one real submission", async ({
  page,
}, info) => {
  await page.goto("/register");
  const form = page.locator(".auth-form-area form");
  await expect(form.locator("input")).toHaveCount(4);
  expect(await form.locator("label").allTextContents()).toEqual([
    "E-mail",
    "Usuário",
    "Senha",
    "Confirmar senha",
  ]);
  const input = page.getByLabel("Senha", { exact: true });
  const confirmation = page.getByLabel("Confirmar senha", { exact: true });
  await expect(input).toHaveAttribute("type", "password");
  await expect(confirmation).toHaveAttribute("type", "password");
  await expect(page.locator("#password-guidance")).toHaveCount(0);
  const requirements = page.getByRole("list", { name: "Requisitos da senha" });
  expect(
    await requirements.locator("li > span:last-child").allTextContents(),
  ).toEqual([
    "Pelo menos 6 caracteres",
    "Pelo menos 1 letra",
    "Pelo menos 1 número",
  ]);
  const items = requirements.getByRole("listitem");
  const assertChecks = async (states: boolean[]) => {
    for (const [index, met] of states.entries())
      await expect(items.nth(index)).toContainText(
        met ? "Cumprido:" : "Pendente:",
      );
  };
  await assertChecks([false, false, false]);
  await selectSiteTheme(page, "light");
  await page.screenshot({
    path: info.outputPath("registration-four-fields-light.png"),
    fullPage: true,
  });
  for (const [value, states] of [
    ["123456", [true, false, true]],
    ["abcdef", [true, true, false]],
    ["ab12", [false, true, true]],
    ["abc123", [true, true, true]],
    ["a12345", [true, true, true]],
    ["ABC123", [true, true, true]],
    ["abc123!", [true, true, true]],
    ["ééééé1", [true, false, true]],
    ["abc１２３", [true, true, false]],
  ] as const) {
    await input.fill(value);
    await assertChecks([...states]);
  }
  await input.fill("abc123");
  await input.press("End");
  await input.press("Backspace");
  await assertChecks([false, true, true]);
  await input.fill("abc123");
  await input.press("Home");
  for (let i = 0; i < 3; i++) await input.press("Delete");
  await assertChecks([false, false, true]);
  await input.fill("abc123");
  await input.press("End");
  for (let i = 0; i < 3; i++) await input.press("Backspace");
  await assertChecks([false, true, false]);
  await expectRenderedContrast(items);
  const email = `four-${randomUUID()}@example.test`,
    username = registrationUsername();
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page
    .getByLabel("Usuário", { exact: true })
    .fill(username.toUpperCase());
  await input.fill("abc123");
  const payloads: unknown[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/auth/register"))
      payloads.push(request.postDataJSON());
  });
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(confirmation).toBeFocused();
  await expect(page.locator("#confirmation-error")).toContainText(
    "Confirme sua senha",
  );
  await confirmation.fill("ABC123");
  await expect(page.locator("#confirmation-error")).toContainText(
    "As senhas não coincidem",
  );
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  expect(payloads).toHaveLength(0);
  await confirmation.fill("abc123");
  await expect(page.locator("#confirmation-error")).toHaveCount(0);
  await input.fill("abc124");
  await expect(page.locator("#confirmation-error")).toContainText(
    "As senhas não coincidem",
  );
  await input.fill("abc123");
  await expect(page.locator("#confirmation-error")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Mostrar confirmação de senha", exact: true })
    .click();
  await expect(confirmation).toHaveAttribute("type", "text");
  await page
    .getByRole("button", { name: "Ocultar confirmação de senha", exact: true })
    .click();
  await selectSiteTheme(page, "bunkercode");
  await expectRenderedContrast(items);
  await page.screenshot({
    path: info.outputPath("registration-checks-dark.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    375,
  );
  await page.screenshot({
    path: info.outputPath("registration-four-fields-mobile.png"),
    fullPage: true,
  });
  await form.evaluate((element) => {
    (element as HTMLFormElement).requestSubmit();
    (element as HTMLFormElement).requestSubmit();
  });
  await expect(page).toHaveURL(/\/courses$/);
  expect(payloads).toEqual([{ email, username, password: "abc123" }]);
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  const loginPayloads: unknown[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/auth/login"))
      loginPayloads.push(request.postDataJSON());
  });
  await expect(
    page.getByLabel("E-mail ou usuário", { exact: true }),
  ).toHaveAttribute("autocomplete", "username");
  await expect(page.locator(".auth-form-area input")).toHaveCount(2);
  await expect(requirements).toHaveCount(0);
  await page
    .getByLabel("E-mail ou usuário", { exact: true })
    .fill(username.toUpperCase());
  await input.fill("abc123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/courses$/);
  expect(loginPayloads).toEqual([
    { identifier: username.toUpperCase(), password: "abc123" },
  ]);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Sair", exact: true }),
  ).toBeVisible();
});

test("username duplicates ignore case and recover through the corresponding field", async ({
  page,
}, info) => {
  const username = registrationUsername();
  await register(
    page,
    `username-${randomUUID()}@example.test`,
    "abc123",
    username,
  );
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await page.goto("/register");
  await page
    .getByLabel("E-mail", { exact: true })
    .fill(`duplicate-${randomUUID()}@example.test`);
  await page
    .getByLabel("Usuário", { exact: true })
    .fill(username.toUpperCase());
  await page.getByLabel("Senha", { exact: true }).fill("abc123");
  await page.getByLabel("Confirmar senha", { exact: true }).fill("abc123");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page.locator("#username-error")).toContainText(
    "Este usuário já está em uso.",
  );
  await expect(page.getByLabel("Usuário", { exact: true })).toBeFocused();
  await page.screenshot({
    path: info.outputPath("registration-username-unavailable.png"),
    fullPage: true,
  });
  await page
    .getByLabel("Usuário", { exact: true })
    .fill(registrationUsername());
  await expect(page.locator("#username-error")).toHaveCount(0);
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page).toHaveURL(/\/courses$/);
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
  await page
    .getByLabel("Usuário", { exact: true })
    .fill(registrationUsername());
  await page.getByLabel("Senha", { exact: true }).fill(secret);
  await page.getByLabel("Confirmar senha", { exact: true }).fill(secret);
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("já está cadastrado");
  await page.goto("/login");
  await page.getByLabel("E-mail ou usuário", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password());
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Confira seus dados");
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
  await page.getByLabel("E-mail ou usuário", { exact: true }).fill(email);
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
  const returnPassword = password();
  await page
    .getByLabel("Usuário", { exact: true })
    .fill(registrationUsername());
  await page.getByLabel("Senha", { exact: true }).fill(returnPassword);
  await page
    .getByLabel("Confirmar senha", { exact: true })
    .fill(returnPassword);
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page).toHaveURL(/\/courses$/);
  await expect(
    page.getByRole("heading", { name: "Cursos", exact: true }),
  ).toBeVisible();
});

test("shared public shell, anonymous theme persistence and responsive authentication", async ({
  page,
}, info) => {
  await checkPublicShell(page, info);
});

test("real login throttling gives a retry delay without exposing identifiers or repeating requests", async ({
  page,
}, info) => {
  const identifier = `throttle_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  for (let i = 0; i < 10; i++) {
    const response = await page.request.post("/api/auth/login", {
      headers: { Origin: "http://127.0.0.1:5184" },
      data: { identifier, password: "wrong123" },
    });
    expect(response.status()).toBe(401);
    expect((await response.json()).message).toBe(
      "Não foi possível entrar. Confira seus dados.",
    );
  }
  await page.goto("/login");
  await page.getByLabel("E-mail ou usuário", { exact: true }).fill(identifier);
  await page.getByLabel("Senha", { exact: true }).fill("wrong123");
  const response = page.waitForResponse((r) =>
    r.url().endsWith("/api/auth/login"),
  );
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  expect((await response).status()).toBe(429);
  await expect(page.getByRole("alert")).toContainText(
    /Tente novamente em [0-9]+ segundos/,
  );
  await expect(page.getByRole("alert")).not.toContainText(identifier);
  await expect(
    page.getByRole("button", { name: "Entrar", exact: true }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 375, height: 844 });
  await page.screenshot({
    path: info.outputPath("login-rate-limit-mobile.png"),
    fullPage: true,
  });
});

test("student journey persists completion, continuation and preferences across devices", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(150000);
  const reading =
    "/courses/fundamentos-programacao-javascript/lessons/o-que-significa-programar";
  const email = `journey-${randomUUID()}@example.test`,
    secret = password();
  await page.goto("/");
  await selectSiteTheme(page, "light"); // Guest context remains independent of account edits.
  await register(page, email, secret);
  await page.goto(reading);
  const complete = page.getByRole("button", {
    name: "Marcar como concluída",
    exact: true,
  });
  await expect(complete).toBeVisible();
  await expect(page.getByText("Lição concluída", { exact: true })).toHaveCount(
    0,
  );
  await complete.click();
  await expect(
    page.getByText("Lição concluída", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Lição concluída", { exact: true }),
  ).toBeVisible();
  await selectSiteTheme(page, "bunkercode");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-site-theme",
    "bunkercode",
  );
  await page
    .getByRole("button", { name: "Ajustar lição", exact: true })
    .click();
  for (const tone of [
    "BunkerCode",
    "Azul profundo",
    "Alto contraste",
    "Claro suave",
    "Neutro",
    "Névoa azul",
  ]) {
    await page.getByRole("button", { name: tone, exact: true }).click();
  }
  const saved = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/learning/preferences") &&
      r.request().method() === "PUT" &&
      r.request().postDataJSON().readingSize === 20,
  );
  await page.getByLabel("Tamanho do texto").fill("20");
  expect((await saved).ok()).toBeTruthy();
  await page.keyboard.press("Escape");
  await page
    .getByText("Lição concluída", { exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath("sprint2-conclusao-dark.png"),
  });
  const visits: string[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/visit")) visits.push(r.url());
  });
  await page.goto(lesson);
  await expect(page.locator(".lesson-progress")).toContainText("Em andamento");
  await expect.poll(() => visits.length).toBe(1);
  await page
    .getByRole("link", { name: "BunkerCode — início", exact: true })
    .count()
    .then(async (count) => {
      if (count)
        await page
          .getByRole("link", { name: "BunkerCode — início", exact: true })
          .click();
      else await page.goto("/");
    });
  await expect(
    page.getByRole("link", { name: "Continuar estudando →", exact: true }),
  ).toHaveAttribute("href", lesson);
  await page.screenshot({ path: info.outputPath("sprint2-retomada-dark.png") });
  const device = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const other = await device.newPage();
  const login = async (target: Page) => {
    await target.goto("/login?next=" + encodeURIComponent(reading));
    await target.getByLabel("E-mail ou usuário", { exact: true }).fill(email);
    await target.getByLabel("Senha", { exact: true }).fill(secret);
    await target.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(target).toHaveURL(new RegExp(reading + "$"));
  };
  try {
    await other.goto("/login");
    // The new device starts with no browser history or local preferences.
    await other.getByLabel("E-mail ou usuário", { exact: true }).fill(email);
    await other.getByLabel("Senha", { exact: true }).fill(secret);
    await other.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(other).toHaveURL(/\/courses$/);
    await other.goto("/");
    await expect(
      other.getByRole("link", { name: "Continuar estudando →", exact: true }),
    ).toHaveAttribute("href", lesson);
    await other.goto(reading);
    await expect(
      other.getByText("Lição concluída", { exact: true }),
    ).toBeVisible();
    await expect(other.locator("html")).toHaveAttribute(
      "data-site-theme",
      "bunkercode",
    );
    await expect(other.locator(".reading-theme")).toHaveClass(/reading-tone-5/);
    await other
      .getByRole("button", { name: "Ajustar lição", exact: true })
      .click();
    await expect(other.getByLabel("Tamanho do texto")).toHaveValue("20");
    await other.screenshot({
      path: info.outputPath("sprint2-segundo-dispositivo-mobile.png"),
    });
    await other.keyboard.press("Escape");
    await other.getByRole("button", { name: "Sair", exact: true }).click();
    await register(
      other,
      `independent-${randomUUID()}@example.test`,
      password(),
    );
    await other.goto(reading);
    await expect(
      other.getByRole("button", { name: "Marcar como concluída", exact: true }),
    ).toBeVisible();
    await expect(other.locator("html")).toHaveAttribute(
      "data-site-theme",
      "bunkercode",
    );
    await expect(other.locator(".reading-theme")).toHaveClass(/reading-tone-0/);
    await other.screenshot({
      path: info.outputPath("sprint2-conta-independente-mobile.png"),
    });
    await other.getByRole("button", { name: "Sair", exact: true }).click();
    await login(other);
    await expect(
      other.getByText("Lição concluída", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Sair", exact: true }).click();
    await page.goto(reading);
    await expect(page.locator("html")).toHaveAttribute(
      "data-site-theme",
      "light",
    );
    await expect(page.locator(".reading-theme")).toHaveClass(/reading-tone-3/);
    await page.screenshot({
      path: info.outputPath("sprint2-visitante-light.png"),
    });
  } finally {
    await device.close();
  }
});

test("approved Submit restores exact source across devices without replacing unfinished drafts", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(120000);
  const email = `solution-${randomUUID()}@example.test`,
    secret = password();
  await register(page, email, secret);
  const personal = async (target: Page, path: string) => {
    const session = await target.request.post("/api/auth/refresh", {
      data: {},
      headers: { Origin: new URL(target.url()).origin },
    });
    expect(session.ok()).toBeTruthy();
    const value = (await session.json()) as { accessToken: string };
    return target.request.get("/api/" + path, {
      headers: { Authorization: "Bearer " + value.accessToken },
    });
  };
  const runtime = (await (await personal(page, "practice/runtime")).json()) as {
    available: boolean;
    reason: string;
  };
  test.skip(!runtime.available, runtime.reason);
  const solutionPath = "learning" + lesson + "/solution";
  const editor = (target: Page) =>
    target.getByRole("textbox", { name: "Código da solução", exact: true });
  const results = page.getByRole("region", { name: "Compilação e resultados" });
  const code =
    "function isAvailable(stock: number): boolean { return stock > 0; }";
  await editor(page).fill(code);
  expect(await (await personal(page, solutionPath)).json()).toEqual({
    solution: null,
  });
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(results).toContainText("Testes aprovados no Run", {
    timeout: 30000,
  });
  expect(await (await personal(page, solutionPath)).json()).toEqual({
    solution: null,
  });
  await editor(page).fill(
    "function isAvailable(stock: number): boolean { return false; }",
  );
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(results).toContainText("Testes falharam", { timeout: 30000 });
  expect(await (await personal(page, solutionPath)).json()).toEqual({
    solution: null,
  });
  await editor(page).fill(code);
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(results).toContainText("solução salva na conta", {
    timeout: 30000,
  });
  expect(await (await personal(page, solutionPath)).json()).toMatchObject({
    solution: { source: code },
  });
  const unfinished = code + " // Novo rascunho ainda não enviado";
  await editor(page).fill(unfinished);
  await page.reload();
  await expect(editor(page)).toHaveText(unfinished);
  await expect(
    page.getByRole("button", {
      name: "Restaurar solução aprovada",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("sprint2-rascunho-preservado.png"),
  });
  const device = await browser.newContext();
  const other = await device.newPage();
  try {
    await other.goto("/login?next=" + encodeURIComponent(lesson));
    await other.getByLabel("E-mail ou usuário", { exact: true }).fill(email);
    await other.getByLabel("Senha", { exact: true }).fill(secret);
    await other.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(editor(other)).toBeVisible();
    await expect(
      other.getByRole("button", {
        name: "Restaurar solução aprovada",
        exact: true,
      }),
    ).toBeVisible();
    await other
      .getByRole("button", { name: "Restaurar solução aprovada", exact: true })
      .click();
    await expect(other.getByRole("alertdialog")).toBeVisible();
    await other.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(editor(other)).not.toHaveText(code);
    await other
      .getByRole("button", { name: "Restaurar solução aprovada", exact: true })
      .click();
    await other
      .getByRole("button", { name: "Restaurar solução", exact: true })
      .click();
    await expect(editor(other)).toHaveText(code);
    await other.screenshot({
      path: info.outputPath("sprint2-solucao-restaurada.png"),
    });
    await other.getByRole("button", { name: "Sair", exact: true }).click();
    await other.goto(lesson);
    await expect(
      other.getByRole("region", {
        name: "Solução aprovada da conta",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(editor(other)).not.toHaveText(code);
    await register(
      other,
      `solution-other-${randomUUID()}@example.test`,
      password(),
    );
    await expect(editor(other)).not.toHaveText(code);
    await expect(
      other.getByRole("region", {
        name: "Solução aprovada da conta",
        exact: true,
      }),
    ).toHaveCount(0);
  } finally {
    await device.close();
  }
});

test("delayed account preferences cannot populate a new identity", async ({
  page,
}) => {
  test.setTimeout(60000);
  await register(page, `stale-${randomUUID()}@example.test`, password());
  await selectSiteTheme(page, "light");
  await page
    .getByRole("button", { name: "Ajustar lição", exact: true })
    .click();
  await page.getByRole("button", { name: "Névoa azul", exact: true }).click();
  const saved = page.waitForResponse(
    (r) =>
      r.url().endsWith("/learning/preferences") &&
      r.request().method() === "PUT" &&
      r.request().postDataJSON().readingSize === 21,
  );
  await page.getByLabel("Tamanho do texto").fill("21");
  expect((await saved).ok()).toBeTruthy();
  let release: () => void = () => undefined,
    received: () => void = () => undefined,
    delivered: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const ready = new Promise<void>((resolve) => {
    received = resolve;
  });
  const done = new Promise<void>((resolve) => {
    delivered = resolve;
  });
  let first = true;
  await page.route("**/api/learning/preferences", async (route) => {
    if (!first || route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    first = false;
    const response = await route.fetch();
    received();
    await gate;
    await route.fulfill({ response });
    delivered();
  });
  try {
    await page.reload();
    await ready;
    await page.getByRole("button", { name: "Sair", exact: true }).click();
    await register(page, `fresh-${randomUUID()}@example.test`, password());
    await expect(page.locator("html")).toHaveAttribute(
      "data-site-theme",
      "bunkercode",
    );
    release();
    await done;
    await expect(page.locator(".reading-theme")).toHaveClass(/reading-tone-0/);
    await expect(page.locator("html")).toHaveAttribute(
      "data-site-theme",
      "bunkercode",
    );
    await page
      .getByRole("button", { name: "Ajustar lição", exact: true })
      .click();
    await expect(page.getByLabel("Tamanho do texto")).toHaveValue("17");
  } finally {
    release();
  }
});
