import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const content = process.env.BUNKERCODE_BROWSER_CONTENT_DIR!;
const course = "course-refinement";
const title =
  "Curso de teste com um título longo para verificar hierarquia e leitura";
const entries = [
  { slug: "second", title: "Uma lição que aparece primeiro no manifesto" },
  {
    slug: "first",
    title:
      "Uma lição que aparece depois, com um título longo para verificar a quebra visual no mobile",
  },
];
test.beforeAll(async () => {
  for (const entry of entries) {
    const directory = join(content, "courses", course, "lessons", entry.slug);
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, "lesson.md"),
      `# ${entry.title}\n\nFixture de leitura.`,
    );
  }
  await writeFile(
    join(content, "courses", course, "course.json"),
    JSON.stringify({
      id: course,
      title,
      description:
        "Um curso com poucas lições, sem números de progresso e com navegação explícita.",
      lessons: entries,
    }),
  );
  const empty = join(content, "courses/empty-refinement");
  await mkdir(empty, { recursive: true });
  await writeFile(
    join(empty, "course.json"),
    JSON.stringify({
      id: "empty-refinement",
      title: "Curso sem lições",
      description: "Fixture de estado vazio.",
      lessons: [],
    }),
  );
});
for (const width of [390, 768, 1440])
  test(`catalog and course actions stay compact, ordered and keyboard accessible at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/courses");
    await expect(
      page.getByRole("heading", { name: "Cursos", exact: true }),
    ).toBeVisible();
    const card = page.getByRole("link", { name: new RegExp("^" + title) });
    await expect(card).toContainText("Abrir curso →");
    expect(await card.locator("a, button").count()).toBe(0);
    expect(
      await page
        .locator(".course-card")
        .first()
        .evaluate((node) => node.getBoundingClientRect().top),
    ).toBeLessThan(360);
    await card.focus();
    expect(
      await card.evaluate((node) => getComputedStyle(node).outlineStyle),
    ).toBe("solid");
    await page.screenshot({
      path: info.outputPath(`catalog-${width}.png`),
      fullPage: true,
    });
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(`/courses/${course}`);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeFocused();
    const lessons = page.locator(".lesson-list a");
    await expect(lessons).toHaveCount(2);
    await expect(lessons.nth(0)).toContainText(
      "01" + entries[0]!.title + "Começar →",
    );
    await expect(lessons.nth(1)).toContainText(
      "02" + entries[1]!.title + "Ler →",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`course-${width}.png`),
      fullPage: true,
    });
    await lessons.first().focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(`/courses/${course}/lessons/second`);
    await expect(
      page.getByRole("heading", { name: entries[0]!.title, exact: true }),
    ).toBeFocused();
  });

test("empty catalog and empty course expose readable states without dead start actions", async ({
  page,
}) => {
  await page.route("**/api/content/courses", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.goto("/courses");
  await expect(page.getByText(/Nenhum curso publicado/)).toBeVisible();
  await expect(page.locator(".course-card")).toHaveCount(0);
  await page.unroute("**/api/content/courses");
  await page.goto("/courses/empty-refinement");
  await expect(
    page.getByRole("heading", { name: "Curso sem lições", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Este curso ainda não tem lições/)).toBeVisible();
  await expect(page.locator(".lesson-list a")).toHaveCount(0);
  await page
    .getByRole("link", { name: "← Todos os cursos", exact: true })
    .click();
  await expect(page.getByRole("link", { name: /^TypeScript/ })).toBeVisible();
});

test("one real course keeps the catalog useful without artificial volume", async ({
  page,
}, info) => {
  await page.route("**/api/content/courses", async (route) => {
    const response = await route.fetch();
    const value = (await response.json()) as { id: string }[];
    await route.fulfill({
      json: value.filter((course) => course.id === "typescript"),
    });
  });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/courses");
    await expect(page.locator(".course-card")).toHaveCount(1);
    await expect(page.locator(".section-heading")).toContainText("1 curso");
    await expect(page.getByRole("link", { name: /^TypeScript/ })).toContainText(
      "Abrir curso",
    );
    await page.screenshot({
      path: info.outputPath(`catalog-one-course-${width}.png`),
      fullPage: true,
    });
  }
});
