import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
]) {
  test(`public real reading, quiz and local editor at ${viewport.width}x${viewport.height}`, async ({
    page,
  }, info) => {
    const mutations: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/") && request.method() !== "GET")
        mutations.push(request.url());
    });
    await page.setViewportSize(viewport);
    await page.goto(
      "/courses/fundamentos-programacao-javascript/lessons/o-que-significa-programar",
    );
    await expect(page.locator(".lesson-heading .eyebrow")).toHaveText(
      "Módulo 00 · Lição 01",
    );
    await expect(page.locator(".study-outline, .study-divider")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Editar lição", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole("complementary", { name: "Nota" })).toHaveCount(
      2,
    );
    await expect(page.locator(".footer-position")).toHaveText("01/01");
    await expect(
      page.getByRole("button", { name: "Próxima lição", exact: true }),
    ).toBeDisabled();
    await page.screenshot({
      path: info.outputPath(`public-reading-${viewport.width}.png`),
    });
    const quiz = page.locator(".inline-quiz");
    await expect(quiz.locator("[data-result]")).toHaveCount(0);
    await quiz.getByRole("radio").first().check();
    await quiz.getByRole("button", { name: "Verificar resposta" }).click();
    await expect(quiz.getByRole("status")).toContainText("Resposta incorreta");
    await quiz.getByRole("button", { name: "Tentar novamente" }).click();
    await quiz.getByRole("radio").last().check();
    await quiz.getByRole("button", { name: "Verificar resposta" }).click();
    await expect(quiz.getByRole("status")).toContainText("Resposta correta");
    expect(
      await quiz
        .locator(".quiz-option[data-result]")
        .evaluate((node) => getComputedStyle(node).borderColor),
    ).toBe(
      await quiz
        .locator(".quiz-feedback")
        .evaluate((node) => getComputedStyle(node).borderColor),
    );
    await expect(quiz.locator(".quiz-feedback-text p")).toHaveCount(4);
    await quiz.locator(".quiz-feedback").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: info.outputPath(`public-quiz-${viewport.width}.png`),
    });
    await page.reload();
    await expect(quiz.locator(".quiz-feedback")).toHaveCount(0);

    await page.goto("/courses/typescript/lessons/values-and-types");
    await expect(page.locator(".lesson-heading h1")).toHaveText(
      "Valores e tipos",
    );
    if (viewport.width < 1000)
      await page.getByRole("button", { name: "Código", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "Código da solução", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Run", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Submit", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Editar lição", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".learning-footer")).toBeInViewport();
    const measure = await page.evaluate(() => {
      const panel = document
        .querySelector(".study-code")!
        .getBoundingClientRect();
      const footer = document
        .querySelector(".learning-footer")!
        .getBoundingClientRect();
      return {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        panelBottom: panel.bottom,
        footerTop: footer.top,
      };
    });
    expect(measure.width).toBe(viewport.width);
    expect(measure.height).toBe(viewport.height);
    expect(measure.panelBottom).toBeLessThanOrEqual(measure.footerTop);
    await page.screenshot({
      path: info.outputPath(`public-editor-${viewport.width}.png`),
    });
    await page.getByRole("button", { name: "Lições", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("link", { name: /Union types/ })
      .click();
    await expect(page.locator(".lesson-heading h1")).toHaveText("Union types");
    await page
      .getByRole("link", { name: "Lição anterior", exact: true })
      .click();
    await expect(page.locator(".lesson-heading h1")).toHaveText(
      "Valores e tipos",
    );
    expect(mutations).toEqual([]);
  });
}
