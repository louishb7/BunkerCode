import { expect, test, type Page } from "@playwright/test";

const titles = ["JavaScript Essencial", "TypeScript", "Node.js", "NestJS"];
const ids = ["javascript", "typescript", "nodejs", "nestjs"];
const hidden = ["postgresql", "git", "linux", "docker"];
const lesson = "/courses/typescript/lessons/values-and-types";
test.use({ timezoneId: "America/Recife" });

async function localRecords(page: Page) {
  return page.evaluate(
    () =>
      new Promise<Record<string, unknown[]>>((resolve, reject) => {
        const open = indexedDB.open("bunkercode-practice", 2);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(["activity", "drafts", "submissions"]);
          const result: Record<string, unknown[]> = {};
          for (const name of ["activity", "drafts", "submissions"]) {
            const read = tx.objectStore(name).getAll();
            read.onsuccess = () => {
              result[name] = read.result;
            };
          }
          tx.oncomplete = () => {
            db.close();
            resolve(result);
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
  );
}

async function visibleCourses(page: Page) {
  await expect(page.locator(".course-card h3")).toHaveText(titles);
  await expect(page.locator(".course-card")).toHaveCount(4);
  for (let i = 0; i < ids.length; i++)
    await expect(page.locator(".course-card").nth(i)).toHaveAttribute(
      "href",
      "/courses/" + ids[i],
    );
}

test("Home starts with a compact empty calendar, one real total, keyboard access and four ordered courses", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#activity-title")).toHaveText(
    "0 atividades no último ano",
  );
  await visibleCourses(page);
  await expect(page.locator(".heatmap-day")).toHaveCount(365);
  await expect(page.locator(".heatmap-day.heat-0")).toHaveCount(365);
  await expect(
    page.locator(".activity-stats, .activity-dashboard dl"),
  ).toHaveCount(0);
  for (const text of [
    "BunkerCode · seu espaço de estudo",
    "Aprenda. Escreva. Explore.",
    "Sua atividade e seus cursos, em um só lugar.",
    "Seu ritmo de estudo",
    "Dias com atividade",
    "Lições acessadas",
    "Exercícios editados",
    "Soluções enviadas",
  ])
    await expect(page.getByText(text, { exact: true })).toHaveCount(0);
  const geometry = await page
    .locator(".heatmap-day")
    .first()
    .evaluate((node) => {
      const { width, height } = node.getBoundingClientRect();
      return { width, height };
    });
  expect(geometry.width).toBeGreaterThanOrEqual(10);
  expect(geometry.width).toBeLessThanOrEqual(12);
  expect(geometry.width).toBe(geometry.height);
  expect(
    await page
      .locator(".activity-dashboard")
      .evaluate((n) => n.getBoundingClientRect().height),
  ).toBeLessThan(230);
  expect(
    await page
      .locator(".heatmap-grid")
      .evaluate((n) => n.getBoundingClientRect().width),
  ).toBeLessThan(850);
  expect(
    await page
      .locator(".activity-dashboard")
      .evaluate((n) => n.getBoundingClientRect().bottom),
  ).toBeLessThan(
    await page
      .locator("#home-courses")
      .evaluate((n) => n.getBoundingClientRect().top),
  );
  await expect(page.locator(".heatmap-day[tabindex='0']")).toHaveCount(1);
  const current = page.locator(".heatmap-day[tabindex='0']");
  await expect(current).toHaveAttribute("title", /0 atividades/);
  await current.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".heatmap-day:focus")).toHaveAttribute(
    "aria-label",
    /0 atividades/,
  );
  await expect(page.locator(".heatmap-day[tabindex='0']")).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "Explorar cursos →" }),
  ).toBeVisible();
  expect((await localRecords(page)).activity).toEqual([]);
});

test("the header sums only represented events across New Year, with five levels and unchanged historical records", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-01-02T12:00:00-03:00"));
  await page.goto("/");
  await expect(page.locator("#activity-title")).toContainText("0 atividades");
  // Explicit persisted-data fixtures, not generated activity in the product.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("bunkercode-practice", 2);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("activity", "readwrite");
          for (const [day, count] of [
            ["2025-12-29", 1],
            ["2025-12-30", 2],
            ["2025-12-31", 3],
            ["2026-01-01", 4],
            ["2026-01-02", 5],
            ["2025-01-02", 1],
            ["2026-01-03", 1],
          ] as const)
            for (let index = 0; index < count; index++) {
              const kind =
                index === 0 ? "visit" : index === 1 ? "edit" : "submit";
              tx.objectStore("activity").add({
                schema: 1,
                key: JSON.stringify([
                  day,
                  kind,
                  "typescript/values-and-types",
                  String(index),
                ]),
                kind,
                scope: "typescript/values-and-types",
                day,
                at: new Date(day + "T12:00:00-03:00").getTime(),
                timezone: "America/Recife",
              });
            }
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
  );
  const before = await localRecords(page);
  await page.reload();
  await expect(page.locator("#activity-title")).toHaveText(
    "15 atividades no último ano",
  );
  await expect(page.locator(".heatmap-day")).toHaveCount(365);
  await expect(page.locator('.heatmap-day[data-day="2025-01-03"]')).toHaveCount(
    1,
  );
  await expect(
    page.locator(
      '.heatmap-day[data-day="2025-01-02"], .heatmap-day[data-day="2026-01-03"]',
    ),
  ).toHaveCount(0);
  await expect(
    page.locator('.heatmap-day[data-day="2026-01-01"]'),
  ).toHaveAttribute("title", /4 atividades/);
  const represented = await page
    .locator(".heatmap-day")
    .evaluateAll((nodes) =>
      nodes.reduce(
        (sum, node) =>
          sum +
          Number(
            node.getAttribute("aria-label")?.match(/^(\d+) atividade/)?.[1] ??
              0,
          ),
        0,
      ),
    );
  expect(represented).toBe(15);
  const colors = await page
    .locator(".heatmap-legend")
    .evaluateAll((nodes) =>
      nodes.map((node) => getComputedStyle(node).backgroundColor),
    );
  expect(new Set(colors).size).toBe(5);
  for (const value of colors.slice(1)) {
    const [red, green, blue] = value.match(/\d+/g)!.map(Number);
    expect(green!).toBeGreaterThan(red!);
    expect(green!).toBeGreaterThan(blue!);
  }
  expect(await page.locator(".heatmap-months span").allTextContents()).toEqual(
    expect.arrayContaining(["Dez", "Jan"]),
  );
  expect(await localRecords(page)).toEqual(before);
  await page.goto("/courses");
  await page.goto("/");
  await expect(page.locator("#activity-title")).toContainText("15 atividades");
  expect(await localRecords(page)).toEqual(before);
});

test("one editorial selection controls both pages while hidden courses remain available through API, routes and resume", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await visibleCourses(page);
  await page.goto("/courses");
  await visibleCourses(page);
  await expect(page.getByText("4 cursos", { exact: true })).toBeVisible();
  const response = await request.get("/api/content/courses");
  const courses = (await response.json()) as { id: string; title: string }[];
  expect(courses.map((item) => item.id)).toEqual(
    expect.arrayContaining([...ids, ...hidden]),
  );
  for (const id of hidden) {
    await expect(
      page.locator(`.course-card[href='/courses/${id}']`),
    ).toHaveCount(0);
    const result = await request.get("/api/content/courses/" + id);
    expect(result.ok()).toBe(true);
    const course = (await result.json()) as {
      title: string;
      lessons: { slug: string; title: string }[];
    };
    await page.goto("/courses/" + id);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      course.title,
    );
    await expect(page.locator(".lesson-list a")).toHaveCount(
      course.lessons.length,
    );
    await page.goto(`/courses/${id}/lessons/${course.lessons[0]!.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      course.lessons[0]!.title,
    );
  }
  await page.goto("/");
  await visibleCourses(page);
  await expect(
    page.getByRole("link", { name: "Continuar estudando →" }),
  ).toHaveAttribute("href", /^\/courses\/docker\/lessons\//);
  await page.route("**/api/content/courses", (route) =>
    route.fulfill({
      json: courses
        .filter((item) => hidden.includes(item.id))
        .map((item) => ({ ...item, description: "Preserved", lessonCount: 2 })),
    }),
  );
  await page.reload();
  await expect(page.locator(".course-card")).toHaveCount(0);
  await expect(
    page.getByText("Nenhum curso disponível nesta seleção."),
  ).toBeVisible();
});

test("unavailable local activity never masquerades as a zero total", async ({
  page,
}) => {
  await page.addInitScript(() => {
    indexedDB.open = () => {
      throw new DOMException("Local database unavailable", "InvalidStateError");
    };
  });
  await page.goto("/");
  await expect(
    page.locator(".activity-dashboard [role='alert']"),
  ).toBeVisible();
  await expect(page.locator("#activity-title")).toHaveText("Atividade");
  await expect(page.locator(".heatmap-day")).toHaveCount(0);
  await expect(page.getByText("0 atividades no último ano")).toHaveCount(0);
  await visibleCourses(page);
});

for (const width of [390, 768, 1280, 1440, 1920])
  test(`compact Home visual evidence at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto("/");
    await visibleCourses(page);
    await expect(page.locator("#activity-title")).toHaveText(
      "0 atividades no último ano",
    );
    await page.screenshot({
      path: info.outputPath(`after-home-empty-${width}.png`),
      fullPage: true,
    });
    await page.goto(lesson);
    await expect(page.locator(".cm-editor")).toHaveCount(1, { timeout: 15000 });
    const editor = page.getByRole("textbox", {
      name: "Código da solução",
      exact: true,
    });
    const switcher = page.getByRole("button", { name: "Código", exact: true });
    if (await switcher.isVisible()) await switcher.click();
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.insertText('const produto = "Livro";');
    await expect
      .poll(async () =>
        ((await localRecords(page)).activity ?? []).some(
          (value) => (value as { kind: string }).kind === "edit",
        ),
      )
      .toBe(true);
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(page.getByText(/Solução registrada em/)).toBeVisible({
      timeout: 30000,
    });
    await page.goto("/");
    await visibleCourses(page);
    await expect(page.locator("#activity-title")).toHaveText(
      "3 atividades no último ano",
    );
    await expect(
      page.getByRole("link", { name: "Continuar estudando →" }),
    ).toHaveAttribute("href", lesson);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`after-home-activity-${width}.png`),
      fullPage: true,
    });
    await page.goto("/courses");
    await visibleCourses(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`after-catalog-${width}.png`),
      fullPage: true,
    });
  });
