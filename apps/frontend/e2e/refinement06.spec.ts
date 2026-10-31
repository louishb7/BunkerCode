import { expect, test } from "@playwright/test";
import { expectHomeWithoutActivity, expectStoredActivity } from "./home-state";

const lesson = "/courses/typescript/lessons/values-and-types";
test.use({ timezoneId: "America/Recife" });

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`global navigation and real course collection fit ${viewport.width}x${viewport.height}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport);
    await page.clock.setFixedTime(new Date("2026-10-21T12:00:00-03:00"));
    await page.goto("/");
    await expect(page.locator(".course-card")).toHaveCount(4);
    await expectHomeWithoutActivity(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Início");
    await expect(page.locator(".site-header")).toHaveCount(0);
    const nav = page.getByRole("navigation", {
      name: "Navegação principal",
      exact: true,
    });
    await expect(nav).toHaveCount(1);
    await expect(nav.getByRole("link")).toHaveText([
      "Início",
      "Cursos",
      "Táticas",
    ]);
    await expect(
      nav.getByRole("link", { name: "Início", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expectStoredActivity(page, 0);
    await expect(page.locator("h1")).toHaveClass("sr-only");
    await expect(
      page.locator(
        ".global-page-heading, .activity-summary, .heatmap-scale, .global-sidebar-note",
      ),
    ).toHaveCount(0);
    await expect(
      page.locator(".course-card-art, .course-card-footer"),
    ).toHaveCount(0);
    for (const card of await page.locator(".course-card").all()) {
      await expect(card.locator(".course-card-arrow")).toHaveCount(1);
      await expect(card.locator("a, button")).toHaveCount(0);
    }
    await expect(
      page.getByRole("link", { name: "Continuar estudando →", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".course-last-visit")).toHaveCount(0);
    if (viewport.width >= 1024) {
      const sidebar = await page.locator(".global-sidebar").boundingBox();
      expect(sidebar!.width).toBe(220);
      const cards = await page.locator(".course-card").evaluateAll((nodes) =>
        nodes.map((node) => {
          const rect = node.getBoundingClientRect();
          return { top: rect.top, bottom: rect.bottom, height: rect.height };
        }),
      );
      const rows = viewport.width >= 1440 ? 1 : 2;
      expect(new Set(cards.map((card) => card.top)).size).toBe(rows);
      expect(new Set(cards.map((card) => card.bottom)).size).toBe(rows);
      for (const card of cards) {
        expect(card.bottom).toBeLessThan(viewport.height);
        expect(card.height).toBeLessThanOrEqual(240);
      }
    } else {
      expect((await nav.boundingBox())!.height).toBeLessThan(60);
      expect((await page.getByRole("main").boundingBox())!.width).toBe(390);
    }
    await page.screenshot({
      path: info.outputPath(`home-${viewport.width}.png`),
      fullPage: true,
    });
    await nav.getByRole("link", { name: "Cursos", exact: true }).focus();
    await expect(
      nav.getByRole("link", { name: "Cursos", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/courses");
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    await expect(
      nav.getByRole("link", { name: "Cursos", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".course-card")).toHaveCount(4);
    await page.reload();
    await expect(
      nav.getByRole("link", { name: "Cursos", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    const card = page.getByRole("link", { name: "TypeScript", exact: true });
    await card.focus();
    expect(
      await card.evaluate((node) => getComputedStyle(node).outlineStyle),
    ).toBe("solid");
    await card.hover();
    expect(await card.evaluate((node) => getComputedStyle(node).cursor)).toBe(
      "pointer",
    );
    await page.screenshot({
      path: info.outputPath(`catalog-focus-${viewport.width}.png`),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/courses/typescript");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "TypeScript",
    );
    await page.goto("/");
    await nav.getByRole("link", { name: "Táticas", exact: true }).click();
    await expect(page).toHaveURL("/tactics");
    await expect(page.locator(".global-sidebar")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Táticas", exact: true }),
    ).toBeVisible();
  });
}

test("real last access resumes a validated lesson without manufacturing progress; reader and Studio keep their shells", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(lesson);
  await expect(page.locator(".cm-editor")).toHaveCount(1);
  await expect(page.locator(".global-sidebar")).toHaveCount(0);
  await expect(page.locator(".learning-shell .site-header")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Navegação entre lições" }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("reader-1440.png") });
  await page.getByRole("link", { name: "Início", exact: true }).click();
  const resume = page.getByRole("link", {
    name: "Continuar estudando →",
    exact: true,
  });
  await expect(resume).toHaveAttribute("href", lesson);
  await expect(resume).toContainText("TypeScript");
  await expect(resume).toContainText("Valores e tipos");
  await expectStoredActivity(page, 1);
  await expect(page.locator(".course-last-visit")).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "TypeScript", exact: true }),
  ).toContainText("Último acesso");
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  const continuation = await page.locator(".continue-study").boundingBox();
  const courses = await page.locator(".home-courses").boundingBox();
  expect(continuation!.y + continuation!.height).toBeLessThan(courses!.y);
  await page.screenshot({
    path: info.outputPath("home-resume-1440.png"),
    fullPage: true,
  });
  await resume.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(lesson);
  await page.getByRole("link", { name: "Editar lição", exact: true }).click();
  await expect(page.locator(".global-sidebar")).toHaveCount(0);
  await expect(page.locator(".site-header")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Voltar à lição", exact: true }),
  ).toBeVisible();
});
