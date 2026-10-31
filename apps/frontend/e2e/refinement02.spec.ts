import { expectHomeWithoutActivity, expectStoredActivity } from "./home-state";
import { expect, test, type Page } from "@playwright/test";

const titles = [
  "Fundamentos de Programação com JavaScript",
  "TypeScript",
  "Node.js",
  "NestJS",
];
const ids = [
  "fundamentos-programacao-javascript",
  "typescript",
  "nodejs",
  "nestjs",
];
const hidden = ["postgresql", "git", "linux", "docker"];
const lesson = "/courses/typescript/lessons/values-and-types";
test.use({ timezoneId: "America/Recife" });

async function localRecords(page: Page) {
  return page.evaluate(async () => {
    if (
      !(await indexedDB.databases()).some(
        (db) => db.name === "bunkercode-practice",
      )
    )
      return { activity: [], drafts: [], submissions: [] };
    return new Promise<Record<string, unknown[]>>((resolve, reject) => {
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
    });
  });
}

async function visibleCourses(page: Page) {
  await expect(page.locator(".course-card-title")).toHaveText(titles);
  await expect(page.locator(".course-card")).toHaveCount(4);
  for (let i = 0; i < ids.length; i++)
    await expect(page.locator(".course-card").nth(i)).toHaveAttribute(
      "href",
      "/courses/" + ids[i],
    );
}

test("Home prioritizes study and courses without a calendar or replacement metrics", async ({
  page,
}) => {
  await page.goto("/");
  await expectHomeWithoutActivity(page);
  await visibleCourses(page);
  await expect(
    page.locator(
      ".activity-stats, .activity-dashboard dl, .global-page-heading",
    ),
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
  await expect(
    page.getByRole("link", { name: /Começar a estudar/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Explorar cursos →" }),
  ).toBeVisible();
  expect((await localRecords(page)).activity).toEqual([]);
});

test("Home preserves historical local records of all ages without displaying activity", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-01-02T12:00:00-03:00"));
  await page.goto("/");
  await expectStoredActivity(page, 0);
  // Initialize the real stores through a genuine lesson visit, then append historical fixtures.
  await page.goto(lesson);
  await expect(page.locator(".cm-editor")).toHaveCount(1);
  await expectStoredActivity(page, 1);
  const editor = page.getByRole("textbox", {
    name: "Código da solução",
    exact: true,
  });
  await editor.fill("const historicalDraft = 1;");
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByText(/Solução registrada em/)).toBeVisible({
    timeout: 30000,
  });
  await editor.fill("const currentDraft = 2;");
  await expect
    .poll(async () => (await localRecords(page)).drafts)
    .toEqual([expect.objectContaining({ code: "const currentDraft = 2;" })]);
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
            ["2025-07-02", 1],
            ["2025-07-01", 1],
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
  expect(before.activity).toHaveLength(22);
  expect(before.submissions).toHaveLength(1);
  await page.goto("/");
  await expectHomeWithoutActivity(page);
  await page.reload();
  await expectHomeWithoutActivity(page);
  expect(await localRecords(page)).toEqual(before);
  await page.goto("/courses");
  await page.goto("/");
  await expectHomeWithoutActivity(page);
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
  await expect(
    page.getByRole("main").getByRole("heading", { level: 1 }),
  ).toHaveText("Cursos");
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

test("Home works without opening unavailable local activity storage", async ({
  page,
}) => {
  await page.addInitScript(() => {
    indexedDB.open = () => {
      throw new DOMException("Local database unavailable", "InvalidStateError");
    };
  });
  await page.goto("/");
  await expectHomeWithoutActivity(page);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await visibleCourses(page);
});

for (const width of [390, 768, 1280, 1440, 1920])
  test(`compact Home visual evidence at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto("/");
    await visibleCourses(page);
    await expectStoredActivity(page, 0);
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
    await expectStoredActivity(page, 3);
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
