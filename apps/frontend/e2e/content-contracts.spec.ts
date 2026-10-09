import { expect, test } from "@playwright/test";
import type { Course, Lesson } from "../src/courses/api";
const coursePath = "/courses/typescript";
const lessonPath = coursePath + "/lessons/values-and-types";
const courses: { name: string; change: (course: Course) => unknown }[] = [
  {
    name: "missing lesson list",
    change: (course) => ({ ...course, lessons: null }),
  },
  {
    name: "duplicate lesson identity",
    change: (course) => ({
      ...course,
      lessons: [...course.lessons, course.lessons[0]],
    }),
  },
  {
    name: "course from a different route",
    change: (course) => ({ ...course, id: "another-course" }),
  },
];
for (const scenario of courses)
  test(`course contract rejects ${scenario.name} and retry recovers`, async ({
    page,
  }) => {
    let invalid = true;
    await page.route("**/api/content/courses/typescript", async (route) => {
      if (!invalid) return route.continue();
      const response = await route.fetch();
      await route.fulfill({
        json: scenario.change((await response.json()) as Course),
      });
    });
    await page.goto(coursePath);
    await expect(page.getByRole("alert")).toContainText(
      "resposta de conteúdo incompatível",
    );
    invalid = false;
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(
      page.getByRole("heading", { name: "TypeScript", exact: true }),
    ).toBeVisible();
  });
const lessons: { name: string; change: (lesson: Lesson) => unknown }[] = [
  {
    name: "non-text Markdown",
    change: (lesson) => ({ ...lesson, markdown: 42 }),
  },
  {
    name: "invalid version",
    change: (lesson) => ({ ...lesson, version: "not-a-version" }),
  },
  {
    name: "navigation outside manifest order",
    change: (lesson) => ({ ...lesson, next: null }),
  },
];
for (const scenario of lessons)
  test(`lesson contract rejects ${scenario.name} and retry recovers`, async ({
    page,
  }) => {
    let invalid = true;
    await page.route(
      "**/api/content/courses/typescript/lessons/values-and-types",
      async (route) => {
        if (!invalid) return route.continue();
        const response = await route.fetch();
        await route.fulfill({
          json: scenario.change((await response.json()) as Lesson),
        });
      },
    );
    await page.goto(lessonPath);
    await expect(page.getByRole("alert")).toContainText(
      "resposta de conteúdo incompatível",
    );
    invalid = false;
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(
      page.getByRole("heading", { name: "Valores e tipos", exact: true }),
    ).toBeVisible();
  });
test("duplicate catalog identities are rejected instead of generating conflicting cards", async ({
  page,
}) => {
  await page.route("**/api/content/courses", async (route) => {
    const response = await route.fetch();
    const value = (await response.json()) as unknown[];
    await route.fulfill({ json: [...value, value[0]] });
  });
  await page.goto("/courses");
  await expect(page.getByRole("alert")).toContainText(
    "resposta de conteúdo incompatível",
  );
  await expect(page.locator(".course-card")).toHaveCount(0);
});
test("Studio reports a lesson scope mismatch instead of remaining in loading forever", async ({
  page,
}) => {
  await page.route(
    "**/api/content/courses/typescript/lessons/values-and-types",
    async (route) => {
      const response = await route.fetch();
      const lesson = (await response.json()) as Lesson;
      await route.fulfill({ json: { ...lesson, slug: "another-lesson" } });
    },
  );
  await page.goto(lessonPath + "/edit");
  await expect(page.getByRole("alert")).toContainText(
    "resposta de conteúdo incompatível",
  );
  await expect(
    page.getByRole("button", { name: "Tentar novamente" }),
  ).toBeVisible();
  await expect(page.locator("#lesson-markdown")).toHaveCount(0);
});
