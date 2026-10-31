import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

export const readingViewports = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
  { width: 320, height: 800 },
];
const lesson =
  "/courses/fundamentos-programacao-javascript/lessons/o-que-significa-programar";

// Measure rendered colors, including translucent note/quiz surfaces composed
// over their actual ancestors. These checks cover sampled text, not WCAG in full.
export async function expectRenderedContrast(
  locator: Locator,
  options: {
    pseudo?: string;
    foreground?: "outlineColor";
    minimum?: number;
  } = {},
) {
  const ratios = await locator.evaluateAll((nodes, options) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    function rgba(value: string) {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const parts = context.getImageData(0, 0, 1, 1).data;
      return [parts[0]!, parts[1]!, parts[2]!, parts[3]! / 255];
    }
    function over(front: number[], back: number[]) {
      const alpha = front[3]!;
      return front
        .slice(0, 3)
        .map((part, i) => part * alpha + back[i]! * (1 - alpha));
    }
    function luminance(rgb: number[]) {
      const linear = rgb.slice(0, 3).map((value) => {
        const s = value / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
    }
    return nodes.map((node) => {
      const ancestors: Element[] = [];
      for (
        let current: Element | null = node;
        current;
        current = current.parentElement
      )
        ancestors.unshift(current);
      let background = [255, 255, 255];
      for (const ancestor of ancestors)
        background = over(
          rgba(getComputedStyle(ancestor).backgroundColor),
          background,
        );
      const style = getComputedStyle(node, options.pseudo);
      if (options.pseudo)
        background = over(rgba(style.backgroundColor), background);
      const foreground = over(
        rgba(style[options.foreground ?? "color"]),
        background,
      );
      const values = [luminance(foreground), luminance(background)].sort(
        (a, b) => a - b,
      );
      return {
        text: node.textContent?.slice(0, 60),
        ratio: (values[1]! + 0.05) / (values[0]! + 0.05),
      };
    });
  }, options);
  expect(ratios.length).toBeGreaterThan(0);
  for (const sample of ratios)
    expect(sample.ratio, JSON.stringify(sample)).toBeGreaterThanOrEqual(
      options.minimum ?? 4.5,
    );
  return ratios;
}

export async function checkReadingThemes(page: Page, info: TestInfo) {
  await page.goto(lesson);
  const article = page.locator(".study-explanation");
  await expect(article).toHaveClass(/reading-tone-0/);
  const appearance = page.getByRole("button", {
    name: "Aparência da leitura",
    exact: true,
  });
  const backgrounds = new Set<string>();
  const samples: unknown[] = [];
  const width = page.viewportSize()!.width;
  const original = await article.innerText();
  for (let tone = 0; tone < 6; tone++) {
    await appearance.click();
    const select = page.getByLabel("Tonalidade", { exact: true });
    await expect(select.locator("option")).toHaveText([
      "Padrão BunkerCode",
      "Azul profundo",
      "Alto contraste",
      "Claro suave",
      "Neutro",
      "Névoa azul",
    ]);
    await select.selectOption(String(tone));
    await page.getByLabel("Tamanho do texto", { exact: true }).focus();
    await page.keyboard.press("End");
    await expectRenderedContrast(
      page.locator(
        "#reading-appearance label, #reading-appearance select, #reading-appearance button",
      ),
    );
    await page.keyboard.press("Escape");
    await expect(appearance).toBeFocused();
    await page.reload();
    await expect(article).toHaveClass(new RegExp(`reading-tone-${tone}\\b`));
    await expect(article.locator(":scope > .prose")).toHaveCSS(
      "font-size",
      "21px",
    );
    expect(await article.innerText()).toBe(original);
    const background = await article.evaluate(
      (node) => getComputedStyle(node).backgroundColor,
    );
    backgrounds.add(background);
    await appearance.click();
    await expect(page.getByLabel("Tonalidade", { exact: true })).toHaveValue(
      String(tone),
    );
    if (tone === 3 && (width === 1440 || width === 320)) {
      await page.screenshot({
        path: info.outputPath(`theme-3-appearance-${width}.png`),
      });
    }
    await page.keyboard.press("Escape");
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    if (width === 1440 || tone === 3) {
      await article.evaluate((node) => {
        node.scrollTop = 0;
      });
      await page.screenshot({
        path: info.outputPath(`theme-${tone}-reading-${width}.png`),
      });
    }
    if (tone === 3 && (width === 1440 || width === 320)) {
      await article.locator(".editorial-note").first().scrollIntoViewIfNeeded();
      await page.screenshot({
        path: info.outputPath(`theme-3-note-${width}.png`),
      });
    }
    const ratios = await expectRenderedContrast(
      article.locator(
        ".lesson-heading h1, .eyebrow, .prose > p, .prose > h2, .editorial-note p, .prose :not(pre) > code, .code-block code, .code-block code span",
      ),
    );
    const selection = await expectRenderedContrast(
      article.locator(".prose > p").first(),
      { pseudo: "::selection" },
    );
    const quiz = article.locator(".inline-quiz");
    await expect(
      quiz.getByRole("button", { name: "Verificar resposta" }),
    ).toBeDisabled();
    const radio = quiz.getByRole("radio").first();
    await radio.focus();
    await expect(quiz.locator(".quiz-option").first()).toHaveCSS(
      "outline-style",
      "solid",
    );
    const focus = await expectRenderedContrast(
      quiz.locator(".quiz-option").first(),
      { foreground: "outlineColor", minimum: 3 },
    );
    await page.keyboard.press("Space");
    await expect(radio).toBeChecked();
    await quiz.getByRole("button", { name: "Verificar resposta" }).click();
    await expect(quiz.getByRole("status")).toContainText("Resposta incorreta");
    const incorrect = await expectRenderedContrast(
      quiz.locator(".quiz-result, .quiz-feedback-text p, .quiz-option > span"),
    );
    if (tone === 3 && width === 320) {
      await quiz
        .locator(".quiz-feedback")
        .evaluate((node) => node.scrollIntoView({ block: "start" }));
      await page.screenshot({
        path: info.outputPath("theme-3-incorrect-320.png"),
      });
    }
    await quiz.getByRole("button", { name: "Tentar novamente" }).click();
    await quiz.getByRole("radio").last().check();
    await quiz.getByRole("button", { name: "Verificar resposta" }).click();
    await expect(quiz.getByRole("status")).toContainText("Resposta correta");
    const feedback = await expectRenderedContrast(
      quiz.locator(".quiz-result, .quiz-feedback-text p"),
    );
    await expect(quiz.locator(".quiz-feedback-text p")).toHaveCount(4);
    if ((width === 1440 && tone >= 3) || (width === 320 && tone === 3)) {
      await quiz
        .locator(".quiz-feedback")
        .evaluate((node) => node.scrollIntoView({ block: "start" }));
      await page.screenshot({
        path: info.outputPath(`theme-${tone}-feedback-${width}.png`),
      });
      await article.locator(".code-block").first().scrollIntoViewIfNeeded();
      await page.screenshot({
        path: info.outputPath(`theme-${tone}-code-${width}.png`),
      });
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    expect(
      await article.evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "Próxima lição", exact: true }),
    ).toBeDisabled();
    if (tone === 3) {
      await appearance.click();
      await page.getByLabel("Tonalidade", { exact: true }).selectOption("4");
      await expect(quiz.getByRole("status")).toContainText("Resposta correta");
      await page.getByLabel("Tonalidade", { exact: true }).selectOption("3");
      await page.keyboard.press("Escape");
    }
    samples.push({
      tone,
      background,
      ratios,
      selection,
      focus,
      incorrect,
      feedback,
    });
    await page.reload();
    await expect(quiz.locator(".quiz-feedback")).toHaveCount(0);
  }
  expect(backgrounds.size).toBe(6);
  await info.attach("rendered-contrast.json", {
    body: JSON.stringify(samples, null, 2),
    contentType: "application/json",
  });
  await page.goto("/courses/typescript/lessons/values-and-types");
  await expect(article).toHaveClass(/reading-tone-5/);
  await page.getByRole("link", { name: "Próxima lição", exact: true }).click();
  await expect(page.locator(".lesson-heading h1")).toHaveText("Union types");
  await expect(article).toHaveClass(/reading-tone-5/);
  await appearance.click();
  await page
    .getByRole("button", { name: "Restaurar padrões", exact: true })
    .click();
  await page.reload();
  await expect(article).toHaveClass(/reading-tone-0/);
  await expect(article.locator(":scope > .prose")).toHaveCSS(
    "font-size",
    "17px",
  );
  await page.goto("/");
  await expect(page.locator(".reading-theme")).toHaveCount(0);
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
}
