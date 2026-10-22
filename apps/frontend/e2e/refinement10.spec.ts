import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const content = process.env.BUNKERCODE_BROWSER_CONTENT_DIR!;
const courseId = "module-refinement";
const courseTitle = "Curso modular de teste";
const modules = [
  {
    id: "fundamentos",
    title: "Fundamentos",
    description: "Os conceitos usados no restante do percurso.",
  },
  { id: "aplicacao", title: "Aplicação" },
];
const lessons = [
  { slug: "primeira", title: "Primeira lição", moduleId: "fundamentos" },
  { slug: "segunda", title: "Segunda lição", moduleId: "fundamentos" },
  { slug: "terceira", title: "Terceira lição", moduleId: "aplicacao" },
  { slug: "quarta", title: "Quarta lição", moduleId: "aplicacao" },
];

test.beforeAll(async () => {
  for (const lesson of lessons) {
    const directory = join(
      content,
      "courses",
      courseId,
      "lessons",
      lesson.slug,
    );
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, "lesson.md"),
      `# ${lesson.title}\n\nFixture sintética de módulos.`,
    );
  }
  await writeFile(
    join(content, "courses", courseId, "course.json"),
    JSON.stringify({
      id: courseId,
      title: courseTitle,
      description:
        "Fixture sintética para revisar agrupamentos modulares e a navegação entre lições.",
      modules,
      lessons,
    }),
  );
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`course modules keep the approved timeline at ${viewport.width}x${viewport.height}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport);
    await page.goto(`/courses/${courseId}`);
    await expect(
      page.getByRole("heading", { name: courseTitle, exact: true }),
    ).toBeFocused();
    await expect(page.locator(".global-sidebar")).toHaveCount(1);
    await expect(page.locator(".site-header")).toHaveCount(0);
    await expect(page.locator(".course-metadata")).toHaveText("4 lições");
    await expect(page.locator(".course-module")).toHaveCount(2);
    const headings = page.getByRole("heading", { level: 3 });
    await expect(headings).toHaveCount(2);
    await expect(headings.nth(0)).toHaveText("Módulo 01 Fundamentos");
    await expect(headings.nth(1)).toHaveText("Módulo 02 Aplicação");
    await expect(
      page.locator(".course-module-description").first(),
    ).toHaveText(modules[0]!.description!);
    await expect(page.locator(".course-module-description")).toHaveCount(1);
    await expect(page.getByText("Módulo único")).toHaveCount(0);
    await expect(page.getByText("Módulo padrão")).toHaveCount(0);
    const links = page.locator(".course-module .lesson-list a");
    await expect(links).toHaveCount(4);
    for (const [index, lesson] of lessons.entries()) {
      await expect(links.nth(index)).toHaveAccessibleName(
        `${String(index + 1).padStart(2, "0")} ${lesson.title}`,
      );
      await expect(links.nth(index)).toHaveAttribute(
        "href",
        `/courses/${courseId}/lessons/${lesson.slug}`,
      );
    }
    const metrics = await page.evaluate(() => {
      const bounds = (selector: string) => {
        const rect = document.querySelector(selector)!.getBoundingClientRect();
        return {
          left: rect.left,
          width: rect.width,
          top: rect.top,
          height: rect.height,
        };
      };
      const connector = (selector: string) =>
        getComputedStyle(document.querySelector(selector)!, "::after");
      const lists = [...document.querySelectorAll(".course-module .lesson-list")];
      return {
        introduction: bounds(".course-introduction"),
        heading: bounds(".course-module-heading"),
        lessonsTitle: bounds(".course-lessons h2"),
        module: bounds(".course-module"),
        list: bounds(".course-module .lesson-list"),
        headerConnector: {
          content: connector(".course-module-header").content,
          width: connector(".course-module-header").width,
          left: connector(".course-module-header").left,
        },
        firstConnector: {
          content: connector(".course-module .lesson-list > li:first-child")
            .content,
          width: connector(".course-module .lesson-list > li:first-child").width,
        },
        lastConnector: [
          ...document.querySelectorAll(
            ".course-module .lesson-list > li:last-child",
          ),
        ].map((node) => getComputedStyle(node, "::after").content),
        listCounts: lists.map((node) => node.children.length),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(metrics.overflow).toBe(false);
    expect(metrics.heading.left).toBe(metrics.introduction.left);
    expect(metrics.lessonsTitle.left).toBe(metrics.introduction.left);
    expect(metrics.module.width).toBe(metrics.list.width);
    expect(metrics.list.width).toBeLessThanOrEqual(960);
    expect(metrics.headerConnector.content).toBe('""');
    expect(metrics.headerConnector.width).toBe("1px");
    expect(metrics.headerConnector.left).toBe("35px");
    expect(metrics.firstConnector.content).toBe('""');
    expect(metrics.firstConnector.width).toBe("1px");
    expect(metrics.lastConnector).toEqual(["none", "none"]);
    expect(metrics.listCounts).toEqual([2, 2]);
    await page.screenshot({
      path: info.outputPath(`modules-${viewport.width}.png`),
      fullPage: true,
    });

    await links.first().click();
    await expect(page).toHaveURL(`/courses/${courseId}/lessons/primeira`);
    await expect(page.locator(".learning-shell .site-header")).toBeVisible();
    await expect(page.locator(".global-sidebar")).toHaveCount(0);
    await expect(page.locator(".lesson-heading h1")).toHaveText(
      "Primeira lição",
    );
    if (viewport.width === 1440)
      await page.screenshot({
        path: info.outputPath("reader-modules-1440.png"),
        fullPage: true,
      });
    for (const [index, lesson] of lessons.entries()) {
      if (index === 0) continue;
      await page.getByRole("link", { name: "Próxima lição" }).click();
      await expect(page).toHaveURL(
        `/courses/${courseId}/lessons/${lesson.slug}`,
      );
      await expect(page.locator(".lesson-heading h1")).toHaveText(lesson.title);
    }
    await expect(
      page.getByRole("button", { name: "Próxima lição" }),
    ).toBeDisabled();
    await page
      .getByRole("link", { name: `Abrir curso ${courseTitle}`, exact: true })
      .click();
    await expect(page).toHaveURL(`/courses/${courseId}`);
    await page.reload();
    await expect(page.locator(".course-module")).toHaveCount(2);
    await page
      .getByRole("navigation", { name: "Navegação principal" })
      .getByRole("link", { name: "Início", exact: true })
      .click();
    await expect(page.locator(".continue-link")).toHaveAttribute(
      "href",
      `/courses/${courseId}/lessons/quarta`,
    );
    await page.goto(`/courses/${courseId}/lessons/terceira`);
    await page.reload();
    await expect(page.locator(".lesson-heading h1")).toHaveText(
      "Terceira lição",
    );
  });
}

test("a course without modules keeps the original flat timeline", async ({
  page,
  request,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const response = await request.get("/api/content/courses/javascript");
  const course = (await response.json()) as {
    title: string;
    lessons: { slug: string; title: string }[];
  };
  await page.goto("/courses/javascript");
  await expect(page.locator(".course-module, .course-modules")).toHaveCount(0);
  await expect(page.locator(".course-lessons > .lesson-list")).toHaveCount(1);
  await expect(page.locator(".course-lesson")).toHaveCount(
    course.lessons.length,
  );
  await expect(page.locator(".lesson-list a").nth(1)).toHaveAttribute(
    "href",
    `/courses/javascript/lessons/${course.lessons[1]!.slug}`,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("legacy-course-1440.png"),
    fullPage: true,
  });
});
