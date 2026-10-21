import { expect, test, type APIRequestContext } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import type { Course, CourseSummary } from "../src/courses/api";

const ids = ["javascript", "typescript", "nodejs", "nestjs"];
async function metadata(request: APIRequestContext) {
  const response = await request.get("/api/content/courses");
  expect(response.ok()).toBe(true);
  const courses = (await response.json()) as CourseSummary[];
  return ids.map((id) => {
    const course = courses.find((entry) => entry.id === id);
    expect(course).toBeDefined();
    expect(course!.shortDescription).toBeTruthy();
    expect(course!.shortDescription).not.toBe(course!.description);
    return course!;
  });
}
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`catalog shows complete editorial summaries at ${viewport.width}x${viewport.height}`, async ({
    page,
    request,
  }, info) => {
    await page.setViewportSize(viewport);
    const courses = await metadata(request);
    await page.goto("/courses");
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1 })).toHaveText("Cursos");
    await expect(main.getByText("Cursos", { exact: true })).toHaveCount(1);
    await expect(main.getByRole("heading", { level: 2 })).toHaveText(
      courses.map((course) => course.title),
    );
    for (const removed of [
      /Explore o acervo/,
      /Um conceito de cada vez/,
      /^Disponíveis$/,
      /^4 cursos$/,
      /As lições iniciais são exemplos demonstrativos/,
    ])
      await expect(main.getByText(removed)).toHaveCount(0);
    for (const course of courses) {
      const card = main.getByRole("link", { name: course.title, exact: true });
      await expect(card).toHaveAttribute("href", `/courses/${course.id}`);
      await expect(card.locator(".course-description")).toHaveText(
        course.shortDescription!,
      );
      await expect(card).toHaveAccessibleDescription(
        `${course.shortDescription} ${course.lessonCount} ${course.lessonCount === 1 ? "lição" : "lições"}`,
      );
      await expect(card.locator(".course-card-arrow")).toHaveCount(1);
      await expect(card.locator("a, button")).toHaveCount(0);
    }
    const metrics = await main.locator(".course-card").evaluateAll((nodes) =>
      nodes.map((card) => {
        const description = card.querySelector<HTMLElement>(
          ".course-description",
        )!;
        const details = card.querySelector<HTMLElement>(
          ".course-card-details",
        )!;
        const rect = card.getBoundingClientRect();
        const style = getComputedStyle(description);
        return {
          title: card.querySelector(".course-card-title")!.textContent,
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height,
          metadataBottom: details.getBoundingClientRect().bottom,
          descriptionLines: Math.round(
            description.getBoundingClientRect().height /
              Number.parseFloat(style.lineHeight),
          ),
          lineClamp: style.webkitLineClamp,
          clipped:
            description.scrollHeight > description.clientHeight ||
            description.scrollWidth > description.clientWidth,
        };
      }),
    );
    for (const card of metrics) {
      expect(card.clipped).toBe(false);
      expect(card.lineClamp).toBe("none");
      if (viewport.width >= 1280) {
        expect(card.descriptionLines).toBeLessThanOrEqual(3);
        expect(card.height).toBeLessThanOrEqual(240);
        expect(card.bottom).toBeLessThan(viewport.height);
      }
    }
    if (viewport.width >= 1280) {
      expect(new Set(metrics.map((card) => card.top)).size).toBe(1);
      expect(new Set(metrics.map((card) => card.metadataBottom)).size).toBe(1);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const focused = main.getByRole("link", { name: "TypeScript", exact: true });
    await focused.focus();
    expect(
      await focused.evaluate((node) => getComputedStyle(node).outlineStyle),
    ).toBe("solid");
    await page.screenshot({
      path: info.outputPath(`catalog-${viewport.width}.png`),
      fullPage: true,
    });
    await writeFile(
      info.outputPath(`catalog-metrics-${viewport.width}.json`),
      JSON.stringify(metrics, null, 2),
    );
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/courses/typescript");
    const detailResponse = await request.get("/api/content/courses/typescript");
    const detail = (await detailResponse.json()) as Course;
    await expect(
      page.getByRole("main").getByText(detail.description, { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .locator(".course-page header")
        .getByText(detail.shortDescription!, { exact: true }),
    ).toHaveCount(0);
  });
}

test("Home uses the same editorial summaries and course details retain all full descriptions", async ({
  page,
  request,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const courses = await metadata(request);
  await page.goto("/");
  await expect(page.locator(".course-description")).toHaveText(
    courses.map((course) => course.shortDescription!),
  );
  await expect(page.locator(".course-card h3")).toHaveText(
    courses.map((course) => course.title),
  );
  await expect(page.locator(".heatmap-day").last()).toBeVisible();
  await page.screenshot({
    path: info.outputPath("home-1440.png"),
    fullPage: true,
  });
  for (const course of courses) {
    await page.getByRole("link", { name: course.title, exact: true }).click();
    await expect(page).toHaveURL(`/courses/${course.id}`);
    await expect(
      page
        .locator(".course-page header")
        .getByText(course.description, { exact: true }),
    ).toBeVisible();
    await page.goto("/");
  }
});

test("legacy catalog metadata falls back to the full description without clipping or generated excerpts", async ({
  page,
}) => {
  const description =
    "Descrição integral legada que permanece disponível sem cortes. "
      .repeat(5)
      .trim();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/content/courses", async (route) => {
    const response = await route.fetch();
    const courses = (await response.json()) as CourseSummary[];
    await route.fulfill({
      json: courses.map((course) => {
        const legacy = { ...course };
        delete legacy.shortDescription;
        if (legacy.id === "typescript") legacy.description = description;
        return legacy;
      }),
    });
  });
  await page.goto("/courses");
  const card = page.getByRole("link", { name: "TypeScript", exact: true });
  const summary = card.locator(".course-description");
  await expect(summary).toHaveText(description);
  expect(
    await summary.evaluate((node) => node.scrollHeight <= node.clientHeight),
  ).toBe(true);
  expect(
    await summary.evaluate((node) => getComputedStyle(node).webkitLineClamp),
  ).toBe("none");
  await expect(card).toHaveAttribute("href", "/courses/typescript");
});

for (const [label, shortDescription] of [
  ["null", null],
  ["empty", ""],
  ["oversized", "x".repeat(161)],
] as const)
  test(`catalog refuses ${label} summaries received from an incompatible API`, async ({
    page,
  }) => {
    await page.route("**/api/content/courses", async (route) => {
      const response = await route.fetch();
      const courses = (await response.json()) as CourseSummary[];
      await route.fulfill({
        json: courses.map((course) =>
          course.id === "typescript" ? { ...course, shortDescription } : course,
        ),
      });
    });
    await page.goto("/courses");
    await expect(page.getByRole("alert")).toContainText(
      "resposta de conteúdo incompatível",
    );
    await expect(page.locator(".course-card")).toHaveCount(0);
  });
