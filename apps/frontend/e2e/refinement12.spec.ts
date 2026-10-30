import { expect, test, type Page } from "@playwright/test";
import { choices, createRound, executeRound } from "../src/tactics/session";

const course = "fundamentos-programacao-javascript";
const slug = "o-que-significa-programar";
const lesson = `/courses/${course}/lessons/${slug}`;
const historyKey = "bunkercode:last-lesson:v1";

async function history(page: Page, value: string) {
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
    key: historyKey,
    value,
  });
  await page.reload();
}
async function noPageOverflow(page: Page, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    width,
  );
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
]) {
  test(`home first access, valid resume and missing lesson at ${viewport.width}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator(".heatmap-day").first()).toBeAttached();
    await page.screenshot({
      path: info.outputPath("home-empty.png"),
      fullPage: true,
    });
    const start = page.getByRole("link", { name: /Começar a estudar/ });
    await expect(start).toBeInViewport();
    await expect(start).toHaveAttribute("href", `/courses/${course}`);
    await expect(page.locator(".heatmap-day:not(.heat-0)")).toHaveCount(0);
    await expect(
      page.getByText(/Não indicam conclusão de lições/),
    ).toBeVisible();
    expect(
      await page
        .locator(".home-courses")
        .evaluate((node) => node.getBoundingClientRect().bottom),
    ).toBeLessThan(
      await page
        .locator(".activity-dashboard")
        .evaluate((node) => node.getBoundingClientRect().top),
    );
    await noPageOverflow(page, viewport.width);
    await start.click();
    await expect(
      page.getByRole("link", { name: /O que significa programar/ }),
    ).toHaveAttribute("href", lesson);
    await page.goto(lesson);
    await expect(page.locator(".lesson-heading h1")).toHaveText(
      "O que significa programar?",
    );
    await page.goto("/");
    const resume = page.getByRole("link", { name: /Continuar estudando/ });
    await expect(resume).toHaveAttribute("href", lesson);
    await expect(resume).toBeInViewport();
    await page.screenshot({
      path: info.outputPath("home-valid-resume.png"),
      fullPage: true,
    });
    await page.reload();
    await expect(resume).toHaveAttribute("href", lesson);
    await history(page, JSON.stringify({ course, slug: "missing-lesson" }));
    await expect(resume).toHaveCount(0);
    await expect(start).toHaveAttribute("href", `/courses/${course}`);
    await expect(page.locator('a[href*="missing-lesson"]')).toHaveCount(0);
    await noPageOverflow(page, viewport.width);
    await page.screenshot({
      path: info.outputPath("home-invalid-resume.png"),
      fullPage: true,
    });
    expect(
      await page.evaluate((key) => localStorage.getItem(key), historyKey),
    ).toBe(JSON.stringify({ course, slug: "missing-lesson" }));
  });

  test(`tactics v3 seed 42 explicit choices across point families at ${viewport.width}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport);
    await page.goto("/tactics?seed=42&version=3");
    const kinds = new Set<string>();
    let captured = false;
    for (let index = 0; index < 36 && kinds.size < 6; index++) {
      const round = createRound(42, index, 3);
      await expect(page.locator(".tactic-round")).toHaveAttribute(
        "data-index",
        String(index),
      );
      if (round.family === "collection" || round.family === "iteration") {
        await page.getByRole("button", { name: "Pular", exact: true }).click();
        if (round.family === "iteration")
          await page
            .getByRole("button", { name: /^(Próxima|Continuar praticando)$/ })
            .click();
        continue;
      }
      kinds.add(round.view.identity.kind);
      const select = page.getByRole("combobox", {
        name: /Operação no programa/,
      });
      const run = page.getByRole("button", { name: "Executar", exact: true });
      const repair = round.view.identity.kind.startsWith("repair-");
      const capture = repair && !captured;
      if (capture)
        await page.screenshot({
          path: info.outputPath("tactics-before.png"),
          fullPage: true,
        });
      await expect(select).toHaveValue("");
      await expect(select.locator("option:checked")).toHaveText("Selecione…");
      await expect(page.locator(".tactic-instruction")).toBeVisible();
      if (repair)
        await expect(page.locator(".tactic-instruction")).toContainText(
          "Operação original:",
        );
      await expect(run).toBeDisabled();
      const correct = choices(round).findIndex(
        (_, selection) => executeRound(round, selection).value.achieved,
      );
      expect(correct).toBeGreaterThanOrEqual(0);
      await select.focus();
      await page.keyboard.press("Home");
      for (let step = 0; step < correct; step++)
        await page.keyboard.press("ArrowDown");
      await expect(select).toHaveValue(String(correct));
      await expect(run).toBeEnabled();
      await expect(page.locator(".tactic-execution")).toHaveCount(0);
      if (capture)
        await page.screenshot({
          path: info.outputPath("tactics-selected.png"),
          fullPage: true,
        });
      await run.click();
      await expect(page.locator(".tactic-verdict")).toHaveText(
        "Objetivo atingido.",
      );
      await expect(select).toBeDisabled();
      await noPageOverflow(page, viewport.width);
      if (capture) {
        await page.screenshot({
          path: info.outputPath("tactics-executed.png"),
          fullPage: true,
        });
        captured = true;
      }
      await page
        .getByRole("button", { name: /^(Próxima|Continuar praticando)$/ })
        .click();
    }
    expect(kinds.size).toBe(6);
    expect(captured).toBe(true);
  });
}

test("home preserves malformed and unavailable history without offering a dead resume", async ({
  page,
}) => {
  await page.goto("/");
  for (const value of [
    "{",
    "null",
    JSON.stringify({ course: "../private", slug }),
    JSON.stringify({ course: "missing-course", slug }),
  ]) {
    await history(page, value);
    await expect(
      page.getByRole("link", { name: /Começar a estudar/ }),
    ).toHaveAttribute("href", `/courses/${course}`);
    await expect(
      page.getByRole("link", { name: /Continuar estudando/ }),
    ).toHaveCount(0);
    expect(
      await page.evaluate((key) => localStorage.getItem(key), historyKey),
    ).toBe(value);
  }
});

test("home falls back when a listed lesson is unavailable", async ({
  page,
}) => {
  await page.goto("/");
  await page.route(
    `**/api/content/courses/${course}/lessons/${slug}`,
    (route) =>
      route.fulfill({
        status: 422,
        json: { message: "Arquivo de lição indisponível" },
      }),
  );
  const response = page.waitForResponse(
    `**/api/content/courses/${course}/lessons/${slug}`,
  );
  await history(page, JSON.stringify({ course, slug }));
  expect((await response).status()).toBe(422);
  await expect(
    page.getByRole("link", { name: /Começar a estudar/ }),
  ).toHaveAttribute("href", `/courses/${course}`);
  await expect(
    page.getByRole("link", { name: /Continuar estudando/ }),
  ).toHaveCount(0);
});

test("home never offers a start action for an empty or unavailable catalog", async ({
  page,
}) => {
  await page.route("**/api/content/courses", (route) =>
    route.fulfill({
      json: [
        {
          id: course,
          title: "Curso vazio",
          description: "Fixture",
          lessonCount: 0,
        },
      ],
    }),
  );
  await page.goto("/");
  await expect(page.locator(".course-card")).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: /Começar a estudar/ }),
  ).toHaveCount(0);
  await page.route("**/api/content/courses", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.reload();
  await expect(
    page.getByText("Nenhum curso disponível nesta seleção."),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Começar a estudar/ }),
  ).toHaveCount(0);
  await page.route("**/api/content/courses", (route) =>
    route.fulfill({ status: 503, json: { message: "Conteúdo indisponível" } }),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Conteúdo indisponível");
  await expect(
    page.getByRole("link", { name: /Começar a estudar/ }),
  ).toHaveCount(0);
});
