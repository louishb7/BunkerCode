import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import type { Course } from "../src/courses/api";

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`course introduction and connected lessons share one column at ${viewport.width}x${viewport.height}`, async ({
    page,
    request,
  }, info) => {
    await page.setViewportSize(viewport);
    const response = await request.get("/api/content/courses/nodejs");
    expect(response.ok()).toBe(true);
    const course = (await response.json()) as Course;
    await page.goto("/courses");
    await page.getByRole("link", { name: course.title, exact: true }).click();
    await expect(page).toHaveURL("/courses/nodejs");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      course.title,
    );
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    await expect(page.locator(".global-sidebar")).toHaveCount(1);
    await expect(page.locator(".site-header")).toHaveCount(0);
    const navigation = page.getByRole("navigation", {
      name: "Navegação principal",
    });
    await expect(navigation).toHaveCount(1);
    await expect(
      navigation.getByRole("link", { name: "Cursos", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".course-full-description")).toHaveText(
      course.description,
    );
    await expect(page.locator(".course-metadata")).toHaveText(
      `${course.lessons.length} lições`,
    );
    for (const removed of [
      /Percurso de estudo/i,
      /No seu ritmo/,
      /Começar curso/,
      /Do primeiro conceito à próxima descoberta/i,
      /Siga a sequência ou entre no tema/,
    ])
      await expect(page.getByText(removed)).toHaveCount(0);
    await expect(page.locator(".lesson-action")).toHaveCount(0);
    await expect(page.locator(".course-lessons h2")).toHaveText("Lições");
    const lessons = page.locator(".lesson-list a");
    await expect(lessons).toHaveCount(course.lessons.length);
    for (const [index, lesson] of course.lessons.entries()) {
      await expect(lessons.nth(index)).toHaveAccessibleName(
        `${String(index + 1).padStart(2, "0")} ${lesson.title}`,
      );
      await expect(lessons.nth(index)).toHaveAttribute(
        "href",
        `/courses/nodejs/lessons/${lesson.slug}`,
      );
      await expect(lessons.nth(index).locator("a, button, svg")).toHaveCount(0);
    }
    const metrics = await page.evaluate(() => {
      const bounds = (selector: string) => {
        const rect = document.querySelector(selector)!.getBoundingClientRect();
        return {
          left: rect.left,
          width: rect.width,
          height: rect.height,
          top: rect.top,
        };
      };
      const introduction = document.querySelector(".course-introduction")!;
      const connector = getComputedStyle(
        document.querySelector(".lesson-list li")!,
        "::after",
      );
      return {
        introduction: bounds(".course-introduction"),
        description: bounds(".course-full-description"),
        metadata: bounds(".course-metadata"),
        heading: bounds(".course-lessons h2"),
        timeline: bounds(".lesson-list"),
        lesson: bounds(".course-lesson"),
        logo: bounds(".course-identity .technology-logo"),
        number: bounds(".lesson-number"),
        numberRadius: getComputedStyle(
          document.querySelector(".lesson-number")!,
        ).borderRadius,
        headerBorder: getComputedStyle(introduction).borderTopWidth,
        headerBackground: getComputedStyle(introduction).backgroundColor,
        connector: {
          content: connector.content,
          width: connector.width,
          left: connector.left,
        },
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(metrics.overflow).toBe(false);
    expect(
      new Set([
        metrics.introduction.left,
        metrics.description.left,
        metrics.metadata.left,
        metrics.heading.left,
        metrics.timeline.left,
      ]).size,
    ).toBe(1);
    expect(metrics.introduction.width).toBe(metrics.timeline.width);
    expect(metrics.timeline.width).toBeLessThanOrEqual(960);
    expect(metrics.logo.width).toBe(52);
    expect(metrics.logo.height).toBe(52);
    expect(metrics.number.height).toBe(metrics.number.width);
    expect(metrics.numberRadius).toBe("50%");
    expect(metrics.connector.content).toBe('""');
    expect(metrics.connector.width).toBe("1px");
    expect(metrics.headerBorder).toBe("0px");
    expect(metrics.headerBackground).toBe("rgba(0, 0, 0, 0)");
    expect(metrics.lesson.height).toBeGreaterThanOrEqual(44);
    if (viewport.width >= 1280) {
      expect(metrics.introduction.height).toBeLessThan(210);
      expect(metrics.timeline.width).toBeGreaterThan(850);
      expect(metrics.lesson.top).toBeLessThan(330);
    }
    const first = lessons.first();
    const normalBorder = await first.evaluate(
      (node) => getComputedStyle(node).borderTopColor,
    );
    await first.hover();
    await expect
      .poll(() =>
        first.evaluate((node) => getComputedStyle(node).borderTopColor),
      )
      .not.toBe(normalBorder);
    expect(await first.evaluate((node) => getComputedStyle(node).cursor)).toBe(
      "pointer",
    );
    await page.mouse.move(1, 1);
    await first.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(first).toBeFocused();
    expect(
      await first.evaluate((node) => getComputedStyle(node).outlineStyle),
    ).toBe("solid");
    await page.screenshot({
      path: info.outputPath(`course-nodejs-${viewport.width}.png`),
      fullPage: true,
    });
    await writeFile(
      info.outputPath(`course-metrics-${viewport.width}.json`),
      JSON.stringify(metrics, null, 2),
    );
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(
      `/courses/nodejs/lessons/${course.lessons[0]!.slug}`,
    );
    await expect(page.locator(".learning-shell .site-header")).toBeVisible();
    await expect(page.locator(".global-sidebar")).toHaveCount(0);
    await page
      .getByRole("link", {
        name: "Abrir curso Node.js",
        exact: true,
      })
      .click();
    await expect(page.locator(".global-sidebar")).toHaveCount(1);
    await navigation.getByRole("link", { name: "Cursos", exact: true }).click();
    await expect(page).toHaveURL("/courses");
  });
}

test("another course retains its full description and reader keeps its contextual desktop workspace", async ({
  page,
  request,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const response = await request.get("/api/content/courses/nestjs");
  const course = (await response.json()) as Course;
  await page.goto("/courses/nestjs");
  await expect(page.locator(".course-full-description")).toHaveText(
    course.description,
  );
  await expect(page.locator(".course-identity img")).toHaveAttribute(
    "src",
    "/technologies/nestjs.svg",
  );
  await page.screenshot({
    path: info.outputPath("course-nestjs-1440.png"),
    fullPage: true,
  });
  await page.goto("/courses/typescript/lessons/values-and-types");
  await expect(page.locator(".lesson-heading h1")).toHaveText(
    "Valores e tipos",
  );
  await expect(page.locator(".global-sidebar, .global-layout")).toHaveCount(0);
  await expect(page.locator(".learning-shell .site-header")).toHaveCount(1);
  await expect(
    page.getByRole("navigation", { name: "Navegação entre lições" }),
  ).toBeVisible();
  await expect(page.locator(".study-explanation")).toBeVisible();
  await expect(page.locator(".cm-editor")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("reader-1440.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Próxima lição", exact: true }).click();
  await expect(page).toHaveURL("/courses/typescript/lessons/union-types");
  await page
    .getByRole("link", { name: "Abrir curso TypeScript", exact: true })
    .click();
  await page.reload();
  await expect(page.locator(".global-sidebar")).toHaveCount(1);
  await expect(page.locator(".lesson-list a").nth(1)).toHaveAttribute(
    "href",
    "/courses/typescript/lessons/union-types",
  );
  // The existing real last-access convenience remains available on Home.
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Início", exact: true })
    .click();
  await expect(page.locator(".continue-link")).toHaveAttribute(
    "href",
    "/courses/typescript/lessons/union-types",
  );
});
