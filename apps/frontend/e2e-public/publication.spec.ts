import { expect, test } from "@playwright/test";
import { choices, createRound, executeRound } from "../src/tactics/session";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

const lesson = "/courses/typescript/lessons/values-and-types";

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
  { width: 320, height: 800 },
  { width: 720, height: 450 },
])
  test(`public calendar consultation and panel presets remain local at ${viewport.width}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    if (viewport.width === 720) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        ...viewport,
        deviceScaleFactor: 2,
        mobile: false,
      });
    }
    const mutations: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/") && request.method() !== "GET")
        mutations.push(request.url());
    });
    await page.goto("/");
    const date = page.getByLabel("Consultar dia de atividade", { exact: true });
    await expect(date).toBeVisible();
    await date.focus();
    await expect(page.locator(".activity-selected-day")).toContainText(
      "0 atividades em",
    );
    await date.fill((await date.getAttribute("min"))!);
    await expect(page.locator('.heatmap-day[tabindex="0"]')).toHaveAttribute(
      "data-day",
      await date.inputValue(),
    );
    await page.screenshot({
      path: info.outputPath(`public-calendar-${viewport.width}.png`),
      fullPage: true,
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(viewport.width);
    await page.goto(lesson);
    await expect(page.locator(".cm-editor")).toHaveCount(1);
    const switcher = page.getByRole("button", { name: "Código", exact: true });
    if (await switcher.isVisible()) await switcher.click();
    await page
      .getByRole("button", { name: "Ajustar painéis", exact: true })
      .click();
    const settings = page.getByRole("group", {
      name: "Proporções dos painéis",
      exact: true,
    });
    await settings
      .getByRole("group", { name: "Altura", exact: true })
      .getByRole("button", { name: "Mais código", exact: true })
      .click();
    const divider = page.getByRole("separator", {
      name: "Altura do editor e resultados",
      exact: true,
    });
    const value = await divider.getAttribute("aria-valuenow");
    if (viewport.width >= 1000)
      await settings
        .getByRole("group", { name: "Largura", exact: true })
        .getByRole("button", { name: "Mais leitura", exact: true })
        .click();
    else
      await expect(
        settings.getByRole("group", { name: "Largura", exact: true }),
      ).not.toBeVisible();
    const popup = (await settings.boundingBox())!;
    expect(popup.x).toBeGreaterThanOrEqual(0);
    expect(popup.x + popup.width).toBeLessThanOrEqual(viewport.width);
    expect(popup.y + popup.height).toBeLessThanOrEqual(viewport.height);
    await page.screenshot({
      path: info.outputPath(`public-panels-${viewport.width}.png`),
    });
    await page.keyboard.press("Escape");
    await page.reload();
    await expect(page.locator(".cm-editor")).toHaveCount(1);
    if (await switcher.isVisible()) await switcher.click();
    await expect(divider).toHaveAttribute("aria-valuenow", value!);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(viewport.width);
    expect(mutations).toEqual([]);
  });

for (const [width, height] of [
  [1440, 900],
  [1280, 800],
  [390, 844],
  [360, 800],
])
  test(`public practice explains local-only editing at ${width}x${height}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: width!, height: height! });
    await page.goto(lesson);
    await expect(
      page.getByRole("heading", { name: "Valores e tipos", exact: true }),
    ).toBeVisible();
    if (width! < 1000)
      await page.getByRole("button", { name: "Código", exact: true }).click();
    await expect(
      page.getByText(
        "O código não é executado, enviado nem avaliado no ambiente público.",
        { exact: false },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Run", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Submit", exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    await page.screenshot({
      path: info.outputPath(`public-reader-${width}.png`),
    });
  });

test("published course opens its reader and previous/next navigation survives reload", async ({
  page,
}) => {
  await page.goto("/courses/typescript");
  await expect(
    page.getByRole("heading", { name: "TypeScript", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Valores e tipos/ }).click();
  await expect(page).toHaveURL(lesson);
  await expect(
    page.getByRole("heading", { name: "Valores e tipos", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Próxima lição", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Union types", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("link", { name: "Lição anterior", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Valores e tipos", exact: true }),
  ).toBeVisible();
  await expect(page.locator('a[href$="/edit"]')).toHaveCount(0);
});

test("public home and catalog include only explicitly selected fixture courses", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: /TypeScript/ }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /PostgreSQL/ }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /JavaScript Essencial/ }),
  ).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("home-publica.png") });
  await page.goto("/courses");
  const courses = page.locator('a[href^="/courses/"]');
  await expect(courses).toHaveCount(4);
  await expect(page.getByRole("link", { name: /PostgreSQL/ })).toBeVisible();
  await page.reload();
  await expect(courses).toHaveCount(4);
  await page.screenshot({ path: info.outputPath("catalogo-publico.png") });
});

for (const width of [1280, 390])
  test(`published reader, direct access, navigation and local drafts at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 960 });
    const remote: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/practice/")) remote.push(request.url());
    });
    await page.goto(lesson);
    await expect(
      page.getByRole("heading", { name: "Valores e tipos", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Editar lição" })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: "Run", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Submit", exact: true }),
    ).toHaveCount(0);
    if (width < 600)
      await page.getByRole("button", { name: "Código", exact: true }).click();
    const editor = page.locator('.cm-content[contenteditable="true"]').first();
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.type("\n// PUBLIC_LOCAL_DRAFT");
    await page.reload();
    if (width < 600)
      await page.getByRole("button", { name: "Código", exact: true }).click();
    await expect(editor).toContainText("PUBLIC_LOCAL_DRAFT");
    await expect(
      page.getByRole("button", { name: "Formatar código" }),
    ).toBeVisible();
    await expect(
      page.getByText(/Prática local: escreva e formate/),
    ).toBeAttached();
    await page.screenshot({
      path: info.outputPath(`leitor-publico-${width}.png`),
    });
    expect(remote).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    // Both lessons remain public and order/navigation come from the course manifest.
    const course = await page.request.get("/api/content/courses/typescript");
    const data = (await course.json()) as { lessons: { slug: string }[] };
    expect(data.lessons.map((item) => item.slug)).toEqual([
      "values-and-types",
      "union-types",
    ]);
    await page.goto("/courses/typescript/lessons/union-types");
    await expect(
      page.getByRole("heading", { name: "Union types", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator('a[href="' + lesson + '"]').first(),
    ).toBeAttached();
  });

test("private IDs and authoring routes cannot be opened directly or after reload", async ({
  page,
}) => {
  for (const url of [
    "/courses/javascript",
    "/courses/javascript/lessons/values",
    lesson + "/edit",
  ]) {
    await page.goto(url);
    if (url.endsWith("/edit"))
      await expect(
        page.getByRole("heading", { name: "Página não encontrada" }),
      ).toBeVisible();
    else await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.locator(".visual-document")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Salvar alterações" }),
    ).toHaveCount(0);
    await page.reload();
    await expect(page.locator(".visual-document")).toHaveCount(0);
  }
});

test("public HTTP denies forged local mutations without modifying snapshot or authoring fixture", async ({
  request,
}) => {
  const root = process.env.BUNKERCODE_BROWSER_CONTENT_DIR!;
  async function digest(path: string): Promise<string> {
    const hash = createHash("sha256");
    for (const entry of (await readdir(path, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const file = join(path, entry.name);
      hash.update(entry.name);
      hash.update(
        entry.isDirectory() ? await digest(file) : await readFile(file),
      );
    }
    return hash.digest("hex");
  }
  const before = await digest(root);
  const headers = {
    host: "127.0.0.1:3014",
    origin: "http://127.0.0.1:5173",
    "sec-fetch-site": "same-origin",
    "x-bunkercode-client": "local",
    "x-bunkercode-profile": "authoring",
  };
  for (const [method, url] of [
    ["POST", "/api/content/courses/typescript/lessons"],
    [
      "PUT",
      "/api/content/courses/typescript/lessons/values-and-types/markdown",
    ],
    ["POST", "/api/practice/runs"],
    ["DELETE", "/api/practice/runs/00000000-0000-4000-8000-000000000000"],
  ]) {
    const result = await request.fetch(url!, {
      method,
      headers,
      data: {
        markdown: "changed",
        slug: "intruder",
        title: "Intruder",
        profile: "authoring",
      },
    });
    expect(result.status()).toBe(403);
  }
  for (const path of [
    "/api/content/courses/javascript",
    "/api/content/courses/javascript/lessons/values",
    "/api/content/courses/javascript/lessons/values/exercise",
    "/api/practice/runtime",
  ]) {
    expect((await request.get(path)).status()).toBe(404);
  }
  expect(await digest(root)).toBe(before);
});

test("public build has no Studio, source content, maps or unlisted static files", async ({
  request,
}) => {
  const root = join(process.cwd(), "dist-public");
  const manifest = JSON.parse(
    await readFile(join(root, ".vite/manifest.json"), "utf8"),
  ) as Record<string, { file: string }>;
  expect(Object.keys(manifest).join("\n")).not.toMatch(
    /Studio|VisualEditor|NewLesson|studio-api/,
  );
  expect(
    (await readdir(join(root, "assets"))).filter((file) =>
      /Studio|VisualEditor|\.map$/.test(file),
    ),
  ).toEqual([]);
  expect(await readdir(root)).not.toContain("content");
  for (const path of [
    "/content/courses/javascript/course.json",
    "/.env",
    "/src/courses/Studio.tsx",
    "/technologies/README.md",
  ]) {
    const response = await request.get(path);
    // Static SPA fallback may answer index.html; it must never serve the requested internal payload.
    const body = await response.text();
    expect(body).not.toMatch(
      /export |"lessons"|VITE_|BUNKERCODE_|Tecnologias|Source/,
    );
    expect(response.status() === 404 || body.includes('<div id="root">')).toBe(
      true,
    );
  }
});

test("public tactics remain browser-only", async ({ page }) => {
  const privateCalls: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/")) privateCalls.push(request.url());
  });
  const round = createRound(4812, 0, 1);
  const correct = choices(round).findIndex(
    (_choice, index) => executeRound(round, index).value.achieved,
  );
  expect(correct).toBeGreaterThanOrEqual(0);
  await page.goto("/tactics?seed=4812&version=1");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("body")).toContainText(/Táticas/);
  await page
    .getByRole("combobox", { name: /Operação no programa/ })
    .selectOption(String(correct));
  await page.getByRole("button", { name: "Executar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Próxima", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("main")).toBeVisible();
  expect(privateCalls).toEqual([]);
});

test("partial fixture course exposes only the selected lesson through reader and direct HTTP", async ({
  page,
  request,
}) => {
  await page.goto("/courses/linux");
  await expect(
    page.getByRole("link", { name: /Pipes e fluxo de texto/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Diretórios e caminhos/ }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: /Pipes e fluxo de texto/ }).click();
  await expect(
    page.getByRole("heading", { name: "Pipes e fluxo de texto", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Lição anterior", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Próxima lição", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Pipes e fluxo de texto", exact: true }),
  ).toBeVisible();
  for (const suffix of ["", "/exercise"])
    expect(
      (
        await request.get("/api/content/courses/linux/lessons/paths" + suffix)
      ).status(),
    ).toBe(404);
  await page.goto("/courses/linux/lessons/paths");
  await expect(page.getByRole("alert")).toBeVisible();
});
