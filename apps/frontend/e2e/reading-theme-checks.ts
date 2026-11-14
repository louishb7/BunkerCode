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
export const readingToneLabels = [
  "BunkerCode",
  "Azul profundo",
  "Alto contraste",
  "Claro suave",
  "Neutro",
  "Névoa azul",
];
export function readingToneButton(page: Page, tone: number) {
  return page
    .getByRole("group", { name: "Tonalidade da lição", exact: true })
    .getByRole("button", { name: readingToneLabels[tone]!, exact: true });
}
export async function expandReadingSettings(page: Page) {
  const trigger = page.getByRole("button", {
    name: "Ajustar lição",
    exact: true,
  });
  if (
    (await trigger.count()) &&
    (await trigger.getAttribute("aria-expanded")) !== "true"
  )
    await trigger.click();
}
async function openSiteAppearance(page: Page) {
  const trigger = page.getByRole("button", {
    name: "Tema do site",
    exact: true,
  });
  if ((await trigger.getAttribute("aria-expanded")) !== "true")
    await trigger.click();
  return page.locator("#site-appearance-panel");
}
export async function selectSiteTheme(page: Page, theme: string) {
  const restore = await page.locator("#reading-appearance-panel").isVisible();
  await openSiteAppearance(page);
  await page
    .getByRole("group", { name: "Tema do site", exact: true })
    .getByRole("button", {
      name: theme === "light" ? "Light" : "Dark",
      exact: true,
    })
    .click();
  await page.keyboard.press("Escape");
  if (restore) await expandReadingSettings(page);
}
export async function selectReadingTone(page: Page, tone: number) {
  await expandReadingSettings(page);
  await readingToneButton(page, tone).click();
}
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
    background?: string;
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
      if (options.background)
        background = over(rgba(options.background), background);
      const foreground = over(
        rgba(style[options.foreground ?? "color"]),
        background,
      );
      const values = [luminance(foreground), luminance(background)].sort(
        (a, b) => a - b,
      );
      return {
        text: node.textContent?.slice(0, 60),
        foreground,
        background,
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
    name: "Ajustar lição",
    exact: true,
  });
  const backgrounds = new Set<string>();
  const samples: unknown[] = [];
  const width = page.viewportSize()!.width;
  // Editorial content must stay identical; account progress loads independently.
  const editorial = article.locator(
    ":scope > .lesson-heading, :scope > .prose",
  );
  const original = await editorial.allTextContents();
  for (let tone = 0; tone < 6; tone++) {
    await openAppearance(page);
    await expect(page.locator(".reading-tone-options button")).toHaveText(
      readingToneLabels,
    );
    await selectReadingTone(page, tone);
    await page.getByLabel("Tamanho do texto", { exact: true }).focus();
    await page.keyboard.press("End");
    await expectRenderedContrast(
      page.locator(
        "#reading-appearance-panel label, #reading-appearance-panel select, #reading-appearance-panel button:not(:disabled)",
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
    expect(await editorial.allTextContents()).toEqual(original);
    const background = await article.evaluate(
      (node) => getComputedStyle(node).backgroundColor,
    );
    backgrounds.add(background);
    const expectedBackgrounds = [
      "rgb(25, 30, 35)",
      "rgb(17, 27, 42)",
      "rgb(8, 12, 16)",
      "rgb(238, 241, 244)",
      "rgb(243, 243, 243)",
      "rgb(225, 232, 240)",
    ];
    const expectedText = [
      "rgb(233, 237, 241)",
      "rgb(226, 232, 240)",
      "rgb(244, 246, 248)",
      "rgb(41, 53, 66)",
      "rgb(48, 50, 52)",
      "rgb(41, 53, 66)",
    ];
    expect(background).toBe(expectedBackgrounds[tone]);
    await expect(article).toHaveCSS("color", expectedText[tone]!);
    await expectRenderedContrast(appearance);
    await openAppearance(page);
    const ownPalette = await article.evaluate((node) =>
      [
        node,
        node.querySelector("h1")!,
        node.querySelector(".eyebrow")!,
        node.querySelector(".editorial-note")!,
      ].map((element) => ({
        color: getComputedStyle(element).color,
        background: getComputedStyle(element).backgroundColor,
      })),
    );
    await selectSiteTheme(page, "light");
    expect(
      await article.evaluate((node) =>
        [
          node,
          node.querySelector("h1")!,
          node.querySelector(".eyebrow")!,
          node.querySelector(".editorial-note")!,
        ].map((element) => ({
          color: getComputedStyle(element).color,
          background: getComputedStyle(element).backgroundColor,
        })),
      ),
    ).toEqual(ownPalette);
    await selectSiteTheme(page, "bunkercode");
    await expect(readingToneButton(page, tone)).toHaveAttribute(
      "aria-pressed",
      "true",
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
    await expect(
      quiz.getByRole("button", { name: "Tentar novamente" }),
    ).toHaveCount(0);
    await quiz.getByRole("radio").last().check();
    await quiz.getByRole("button", { name: "Verificar resposta" }).click();
    await expect(quiz.getByRole("status")).toContainText("Resposta correta");
    const feedback = await expectRenderedContrast(
      quiz.locator(".quiz-result, .quiz-feedback-text p"),
    );
    await expect(quiz.locator(".quiz-feedback-text p")).toHaveCount(2);
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
      page.getByRole("link", { name: "Próxima lição", exact: true }),
    ).toHaveAttribute(
      "href",
      "/courses/fundamentos-programacao-javascript/lessons/voce-sabe-fazer-mas-sabe-explicar",
    );
    if (tone === 3) {
      await openAppearance(page);
      await selectReadingTone(page, 4);
      await expect(quiz.getByRole("status")).toContainText("Resposta correta");
      await selectReadingTone(page, 3);
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
  await openAppearance(page);
  await page
    .getByRole("button", { name: "Restaurar lição", exact: true })
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

const themeTrigger = (page: Page) =>
  page.getByRole("button", { name: "Ajustar lição", exact: true });
async function openAppearance(page: Page) {
  const trigger = themeTrigger(page);
  if ((await trigger.getAttribute("aria-expanded")) !== "true")
    await trigger.click();
  await expandReadingSettings(page);
  return page.locator("#reading-appearance-panel");
}
export async function checkGlobalAppearance(
  page: Page,
  info: TestInfo,
  authoring: boolean,
) {
  const viewport = page.viewportSize()!;
  const routes = [
    ["home", "/", ".course-card"],
    ["catalog", "/courses", ".course-card"],
    ["course", "/courses/typescript", ".course-identity h1"],
    ["reader", lesson, ".lesson-heading h1"],
    ["workspace", "/courses/typescript/lessons/values-and-types", ".cm-editor"],
    ["tactics", "/tactics?seed=42", ".tactics-lab h1"],
    ...(authoring ? [["studio", lesson + "/edit", ".visual-document"]] : []),
  ];
  const samples: unknown[] = [];
  for (const theme of ["bunkercode", "light"]) {
    await page.goto("/");
    await expect(page.locator(".course-card").first()).toBeVisible();
    await openSiteAppearance(page);
    await expect(page.locator(".site-theme-options button")).toHaveText([
      "Dark",
      "Light",
    ]);
    await page.evaluate(() => {
      document.documentElement.dataset.appearanceDocument = "same";
    });
    await selectSiteTheme(page, theme);
    await expect(page.locator("html")).toHaveAttribute(
      "data-appearance-document",
      "same",
    );
    for (const [name, path, ready] of routes) {
      await page.goto(path!);
      await expect(page.locator(ready!).first()).toBeAttached();
      await expect(page.locator("html")).toHaveCSS(
        "background-color",
        theme === "light" ? "rgb(244, 244, 245)" : "rgb(32, 35, 40)",
      );
      await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
        "content",
        theme === "light" ? "#f4f4f5" : "#202328",
      );
      const global = page.getByRole("button", {
        name: "Tema do site",
        exact: true,
      });
      await expect(global).toHaveCount(1);
      if (name === "reader" || name === "workspace") {
        await expect(page.locator(".header-global-nav a")).toHaveText([
          "Início",
          "Cursos",
          "Táticas",
        ]);
        await expect(page.locator(".lesson-nav-course")).toHaveCount(0);
        const bar = (await page
          .locator(".lesson-navigation-bar")
          .boundingBox())!;
        expect(bar.height).toBe(viewport.width < 600 ? 45 : 41);
        for (const button of await page
          .locator(".lesson-nav-neighbors > *:not(span)")
          .all()) {
          const box = (await button.boundingBox())!;
          expect(box.height).toBeGreaterThanOrEqual(
            viewport.width < 600 ? 44 : 24,
          );
          expect(box.width).toBeGreaterThanOrEqual(
            viewport.width < 600 ? 44 : 24,
          );
        }
      }
      const collisions = await page
        .locator(".appearance-trigger:visible")
        .evaluateAll((buttons) =>
          buttons.flatMap((button) => {
            const target = button.getBoundingClientRect();
            return Array.from(
              document.querySelectorAll(
                ".lesson-heading h1, .lesson-heading .eyebrow, .studio-topbar button, .studio-topbar select, .workspace-tabs button, .mobile-workspace-switch button, .catalog-heading, .tactics-heading h1, .brand-wordmark, .header-global-nav a, .header-home, .account-control button",
              ),
            )
              .filter((node) => {
                const range = document.createRange();
                range.selectNodeContents(node);
                const r = node.matches("h1, .eyebrow, .catalog-heading")
                  ? range.getBoundingClientRect()
                  : node.getBoundingClientRect();
                return (
                  r.width &&
                  r.height &&
                  target.left < r.right &&
                  target.right > r.left &&
                  target.top < r.bottom &&
                  target.bottom > r.top
                );
              })
              .map((node) => ({
                control: button.getAttribute("aria-label"),
                target: node.textContent,
              }));
          }),
        );
      expect(collisions).toEqual([]);
      if (["home", "catalog", "course"].includes(name!))
        await expect(
          page
            .locator(".site-header")
            .getByRole("button", { name: "Tema do site", exact: true }),
        ).toBeVisible();
      const sitePanel = await openSiteAppearance(page);
      await expect(
        sitePanel.getByText("Tonalidade da lição", { exact: true }),
      ).toHaveCount(0);
      const siteBounds = (await sitePanel.boundingBox())!;
      expect(siteBounds.x).toBeGreaterThanOrEqual(0);
      expect(siteBounds.y).toBeGreaterThanOrEqual(0);
      expect(siteBounds.x + siteBounds.width).toBeLessThanOrEqual(
        viewport.width,
      );
      expect(siteBounds.y + siteBounds.height).toBeLessThanOrEqual(
        viewport.height,
      );
      await page.keyboard.press("Escape");
      await expect(global).toBeFocused();
      if (name === "home" && theme === "light") {
        const surfaces = await page
          .locator(".course-card")
          .evaluateAll((nodes) =>
            nodes.map((n) =>
              [
                getComputedStyle(n).backgroundColor,
                getComputedStyle(n).backgroundImage,
              ].join(" "),
            ),
          );
        expect(new Set(surfaces).size).toBe(1);
        await expect(page.locator(".site-header")).toHaveCSS(
          "background-color",
          "rgb(244, 244, 245)",
        );
      }
      const reading = name === "reader" || name === "workspace";
      await expect(themeTrigger(page)).toHaveCount(reading ? 1 : 0);
      if (reading) {
        await expect(
          page
            .locator(".study-explanation")
            .getByRole("button", { name: "Ajustar lição", exact: true }),
        ).toBeVisible();
        await expect(
          page
            .locator(".study-code")
            .getByRole("button", { name: "Ajustar lição", exact: true }),
        ).toHaveCount(0);
        await expect(
          page.locator(".learning-footer, .appearance-bar, .panel-settings"),
        ).toHaveCount(0);
        const nav = (await page
          .locator(".lesson-navigation-bar")
          .boundingBox())!;
        const header = (await page.locator(".site-header").boundingBox())!;
        expect(nav.y).toBe(header.y + header.height);
        const article = (await page
          .locator(".study-explanation")
          .boundingBox())!;
        expect(article.y).toBeGreaterThanOrEqual(nav.y + nav.height);
        expect(article.y + article.height).toBe(viewport.height);
        const brand = (await page
          .locator(".site-header-content > a")
          .boundingBox())!;
        const home = (await page.locator(".header-home").boundingBox())!;
        if (viewport.width < 600) {
          // Account and appearance actions occupy the first row; navigation remains fully reachable below.
          expect(home.y).toBeGreaterThanOrEqual(brand.y + brand.height);
        } else {
          expect(
            Math.abs(brand.y + brand.height / 2 - home.y - home.height / 2),
          ).toBeLessThanOrEqual(1);
        }
        const panel = await openAppearance(page);
        await expect(panel.locator("details, .site-theme-options")).toHaveCount(
          0,
        );
        await expect(
          panel.getByRole("group", {
            name: "Tonalidade da lição",
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          panel.getByLabel("Tamanho do texto", { exact: true }),
        ).toBeVisible();
        await expect(
          panel.getByRole("button", { name: /^(Dark|Light)$/ }),
        ).toHaveCount(0);
        const bounds = (await panel.boundingBox())!;
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
        await page.keyboard.press("Escape");
        await expect(themeTrigger(page)).toBeFocused();
        await expect(page.locator(".study-explanation")).toHaveCSS(
          "background-color",
          theme === "light" ? "rgb(238, 241, 244)" : "rgb(25, 30, 35)",
        );
        if (name === "workspace" && viewport.width < 1000) {
          await page
            .getByRole("button", { name: "Código", exact: true })
            .click();
          await expect(themeTrigger(page)).toBeVisible();
        }
      }
      if (name === "studio")
        await expect(
          page.locator(".studio-code-block .code-language").first(),
        ).toHaveCSS("color-scheme", theme === "light" ? "light" : "dark");
      const contrast = await expectRenderedContrast(
        page.locator(
          ".appearance-trigger:visible, .brand-wordmark, .header-global-nav a, .catalog-heading, .course-card-title, .course-description, .course-full-description, .tactics-lab h1, .tactic-objective, .studio-course-title, .studio-status, .workspace-tabs button:not(:disabled), .result-heading, .lesson-context-trigger, .lesson-nav-position",
        ),
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(viewport.width);
      await page.screenshot({
        path: info.outputPath(`${theme}-${name}-${viewport.width}.png`),
      });
      samples.push({ theme, name, contrast });
    }
  }
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Cursos", exact: true })
    .click();
  await expect(page.locator("html")).toHaveCSS(
    "background-color",
    "rgb(244, 244, 245)",
  );
  await page.locator('.course-card[href="/courses/typescript"]').click();
  await expect(page.locator(".course-identity h1")).toBeVisible();
  await expect(page.locator("html")).toHaveCSS(
    "background-color",
    "rgb(244, 244, 245)",
  );
  await info.attach("global-contrast.json", {
    body: JSON.stringify(samples, null, 2),
    contentType: "application/json",
  });
}

export async function checkThemeHierarchy(
  page: Page,
  info: TestInfo,
  authoring: boolean,
) {
  await page.goto(lesson);
  const article = page.locator(".study-explanation");
  await expect(article).toHaveCSS("background-color", "rgb(25, 30, 35)");
  await openAppearance(page);
  await page.getByLabel("Tamanho do texto", { exact: true }).focus();
  await page.keyboard.press("End");
  expect(
    await page.evaluate(() => localStorage.getItem("bunkercode:reading-tone")),
  ).toBeNull();
  await selectSiteTheme(page, "light");
  await expect(article).toHaveCSS("background-color", "rgb(238, 241, 244)");
  await selectReadingTone(page, 0);
  await expect(article).toHaveCSS("background-color", "rgb(25, 30, 35)");
  await selectSiteTheme(page, "bunkercode");
  await selectSiteTheme(page, "light");
  if (await page.getByRole("button", { name: "Sair", exact: true }).count()) {
    // Authenticated changes belong to the account; the guest storage stays untouched.
    expect(
      await page.evaluate(() =>
        localStorage.getItem("bunkercode:reading-tone"),
      ),
    ).toBeNull();
  } else {
    expect(
      await page.evaluate(() =>
        localStorage.getItem("bunkercode:reading-tone"),
      ),
    ).toBe("0");
  }
  await expect(article).toHaveCSS("background-color", "rgb(25, 30, 35)");
  await selectReadingTone(page, 1);
  await page.keyboard.press("Escape");
  const quiz = article.locator(".inline-quiz");
  await quiz.getByRole("radio").first().check();
  await quiz
    .getByRole("button", { name: "Verificar resposta", exact: true })
    .click();
  await openAppearance(page);
  await selectSiteTheme(page, "bunkercode");
  await expect(article).toHaveCSS("background-color", "rgb(17, 27, 42)");
  await selectSiteTheme(page, "light");
  await expect(quiz.getByRole("status")).toContainText("Resposta incorreta");
  await page.screenshot({
    path: info.outputPath("independent-reading-preference.png"),
  });
  const savedTone = (await page
    .getByRole("button", { name: "Sair", exact: true })
    .count())
    ? page.waitForResponse((response) => {
        if (
          !response.url().endsWith("/api/learning/preferences") ||
          response.request().method() !== "PUT"
        )
          return false;
        const body: unknown = response.request().postDataJSON();
        return (
          !!body &&
          typeof body === "object" &&
          "readingTone" in body &&
          body.readingTone === null &&
          "readingSize" in body &&
          body.readingSize === 21
        );
      })
    : null;
  await page
    .getByRole("button", { name: "Usar tema do site", exact: true })
    .click();
  if (savedTone) expect((await savedTone).ok()).toBe(true);
  await expect(article).toHaveCSS("background-color", "rgb(238, 241, 244)");
  await expect(article.locator(":scope > .prose")).toHaveCSS(
    "font-size",
    "21px",
  );
  await expect(quiz.getByRole("status")).toContainText("Resposta incorreta");
  await page.reload();
  await expect(article).toHaveCSS("background-color", "rgb(238, 241, 244)");
  await expect(article.locator(":scope > .prose")).toHaveCSS(
    "font-size",
    "21px",
  );
  await expect(quiz.locator(".quiz-feedback")).toHaveCount(0);
  await openAppearance(page);
  await expect(
    page.getByRole("button", { name: "Usar tema do site", exact: true }),
  ).toBeDisabled();
  await selectReadingTone(page, 4);
  await page
    .getByRole("button", { name: "Restaurar lição", exact: true })
    .click();
  await expect(article).toHaveCSS("background-color", "rgb(238, 241, 244)");
  await expect(article.locator(":scope > .prose")).toHaveCSS(
    "font-size",
    "17px",
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-site-theme",
    "light",
  );
  await page.keyboard.press("Escape");
  await page.goto("/courses/typescript/lessons/values-and-types");
  const codeView = page.getByRole("button", { name: "Código", exact: true });
  await expect(page.locator(".cm-editor")).toHaveCount(1);
  if (page.viewportSize()!.width < 1000) await codeView.click();
  const editor = page.getByRole("textbox", {
    name: "Código da solução",
    exact: true,
  });
  await editor.fill("const preservedThemeDraft = 42;");
  await page.locator(".cm-editor").evaluate((node) => {
    (node as HTMLElement).dataset.appearanceInstance = "same";
  });
  await openSiteAppearance(page);
  await selectSiteTheme(page, "bunkercode");
  await selectSiteTheme(page, "light");
  await page.keyboard.press("Escape");
  await expect(editor).toContainText("preservedThemeDraft");
  await expect(page.locator(".cm-editor")).toHaveAttribute(
    "data-appearance-instance",
    "same",
  );
  await expect(page.locator(".cm-editor")).toHaveCSS(
    "background-color",
    "rgb(238, 241, 244)",
  );
  if ([1440, 320].includes(page.viewportSize()!.width)) {
    await editor.focus();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.press("Enter");
    await page.keyboard.insertText("pres");
    await page.keyboard.press("Control+Space");
    const completion = page.getByRole("option", {
      name: /preservedThemeDraft/,
    });
    await expect(completion).toBeVisible();
    await expect(page.locator(".cm-tooltip-autocomplete")).toHaveCSS(
      "background-color",
      "rgb(229, 234, 240)",
    );
    await expectRenderedContrast(completion);
    await page.screenshot({
      path: info.outputPath(
        `light-editor-completion-${page.viewportSize()!.width}.png`,
      ),
    });
    await page.keyboard.press("Escape");
    await page.keyboard.press("Control+f");
    const search = page.locator(".cm-search");
    await expect(search).toBeVisible();
    await expect(page.locator(".cm-panels")).toHaveCSS(
      "background-color",
      "rgb(229, 234, 240)",
    );
    await search.locator("input.cm-textfield").first().fill("preserved");
    await expectRenderedContrast(
      search.locator("label, button:not(:disabled), input.cm-textfield"),
    );
    await page.screenshot({
      path: info.outputPath(
        `light-editor-search-${page.viewportSize()!.width}.png`,
      ),
    });
    await page.keyboard.press("Escape");
    await expect(search).toHaveCount(0);
  }
  await page.reload();
  await expect(page.locator(".cm-editor")).toHaveCount(1);
  if (page.viewportSize()!.width < 1000) await codeView.click();
  await expect(editor).toContainText("preservedThemeDraft");
  await page.screenshot({
    path: info.outputPath(
      `light-workspace-code-${page.viewportSize()!.width}.png`,
    ),
  });
  if (authoring) {
    await page.goto(lesson + "/edit");
    const document = page.locator(".visual-document");
    await expect(document).toBeVisible();
    await document.locator("p").first().click();
    await page.keyboard.press("End");
    await page.keyboard.type(" Theme draft.");
    await document.evaluate((node) => {
      (node as HTMLElement).dataset.appearanceInstance = "same";
    });
    await openSiteAppearance(page);
    await selectSiteTheme(page, "bunkercode");
    await selectSiteTheme(page, "light");
    await page.keyboard.press("Escape");
    await expect(document).toContainText("Theme draft.");
    await expect(document).toHaveAttribute("data-appearance-instance", "same");
    await expect(
      page.getByRole("button", { name: "Salvar alterações", exact: true }),
    ).toBeEnabled();
    await page.reload();
    await expect(document).toContainText("Theme draft.");
    await expect(page.getByText(/Rascunho recuperado/)).toBeVisible();
  }
}

// Anonymous navigation must retain one shell and the same palette across route boundaries.
export async function checkPublicShell(page: Page, info: TestInfo) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await selectSiteTheme(page, "light");
  const routes = [
    ["home", "/", ".course-card"],
    ["courses", "/courses", ".course-card"],
    ["course", "/courses/typescript", ".course-identity h1"],
    [
      "lesson",
      "/courses/typescript/lessons/values-and-types",
      ".lesson-heading h1",
    ],
    ["tactics", "/tactics?seed=42", ".tactics-lab h1"],
    ["login", "/login", "#auth-title"],
    ["register", "/register", "#auth-title"],
  ];
  for (const [name, route, ready] of routes) {
    await page.goto(route!);
    await expect(page.locator(ready!).first()).toBeVisible();
    await expect(page.locator(".global-sidebar, .auth-topbar")).toHaveCount(0);
    await expect(page.locator(".site-header")).toHaveCount(1);
    await expect(page.locator(".header-global-nav a")).toHaveText([
      "Início",
      "Cursos",
      "Táticas",
    ]);
    await expect(
      page
        .locator(".site-header")
        .getByRole("link", { name: "Entrar", exact: true }),
    ).toHaveCount(name === "login" || name === "register" ? 0 : 1);
    await expect(page.locator(".brand-wordmark")).toHaveText("BunkerCode");
    await expect(page.locator(".brand-code")).toHaveCSS(
      "color",
      "rgb(180, 84, 18)",
    );
    await expectRenderedContrast(page.locator(".brand-code"));
    await expect(page.locator('img[src="/brand/bunker.png"]')).toHaveCount(1);
    if (name === "home") {
      await expect(page.locator(".visitor-introduction")).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: /^Explorar cursos/ }),
      ).toHaveCount(1);
      await expect(
        page.getByRole("link", { name: "Criar conta", exact: true }),
      ).toHaveCount(1);
      expect(
        (await page.locator(".home-courses").boundingBox())!.y,
      ).toBeLessThan(160);
    }
    if (name === "login" || name === "register")
      await expect(page.locator(".auth-switch a")).toHaveAttribute(
        "href",
        new RegExp(name === "login" ? "^/register\\?next=" : "^/login\\?next="),
      );
    await expect(
      page.getByRole("button", { name: "Tema do site", exact: true }),
    ).toHaveCount(1);
    await expect(page.locator(".site-header")).toHaveCSS(
      "background-color",
      "rgb(244, 244, 245)",
    );
    await expect(page.locator("html")).toHaveAttribute(
      "data-site-theme",
      "light",
    );
    await expectRenderedContrast(
      page.locator(
        ".header-global-nav a, .account-control, .auth-form-area label, .auth-submit",
      ),
    );
    await page.screenshot({
      path: info.outputPath(`${name}-light.png`),
      fullPage: true,
    });
  }
  await page.goto("/");
  await selectSiteTheme(page, "bunkercode");
  await page.reload();
  await expect(page.locator(".course-card").first()).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute(
    "data-site-theme",
    "bunkercode",
  );
  await page.screenshot({
    path: info.outputPath("home-dark.png"),
    fullPage: true,
  });
  for (const [name, route, ready] of routes.filter(([name]) =>
    ["course", "tactics", "login", "register"].includes(name!),
  )) {
    await page.goto(route!);
    await expect(page.locator(ready!).first()).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute(
      "data-site-theme",
      "bunkercode",
    );
    await expectRenderedContrast(
      page.locator(
        ".header-global-nav a, .brand-code, .auth-form-area label, .auth-submit",
      ),
    );
    await expect(page.locator(".brand-code")).toHaveCSS(
      "color",
      "rgb(234, 170, 112)",
    );
    await expect(page.locator(".site-header")).toHaveCSS(
      "background-color",
      "rgb(39, 43, 48)",
    );
    if (name === "login" || name === "register") {
      await expect(page.locator(".site-header .account-control")).toHaveCount(
        0,
      );
      await expect(page.locator(".auth-form-area")).toHaveCSS(
        "background-color",
        "rgb(43, 48, 54)",
      );
      await expect(page.locator("#auth-email")).toHaveCSS(
        "background-color",
        "rgb(32, 35, 40)",
      );
    }
    await page.screenshot({
      path: info.outputPath(`${name}-dark.png`),
      fullPage: true,
    });
  }
  await selectSiteTheme(page, "light");
  for (const width of [375, 320, 800]) {
    await page.setViewportSize({ width, height: width === 800 ? 450 : 844 });
    for (const route of ["/", "/login", "/register"]) {
      await page.goto(route);
      if (route === "/")
        await expect(page.locator(".course-card").first()).toBeVisible();
      else
        await expect(
          page.getByLabel(route === "/login" ? "E-mail ou usuário" : "E-mail", {
            exact: true,
          }),
        ).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
      await expect(page.locator(".brand-wordmark")).toBeVisible();
      await expectRenderedContrast(page.locator(".brand-code"));
      if (width === 375)
        await page.screenshot({
          path: info.outputPath(
            `${route === "/" ? "home" : route.slice(1)}-mobile.png`,
          ),
          fullPage: true,
        });
    }
  }
}

// Real lesson/editor surfaces in both profiles; no simulated execution or DOM colors.
export async function checkLessonWorkspaceThemes(page: Page, info: TestInfo) {
  await page.goto("/courses/typescript/lessons/values-and-types");
  const narrow = page.viewportSize()!.width < 1000;
  if (narrow)
    await page.getByRole("button", { name: "Código", exact: true }).click();
  const editor = page.getByRole("textbox", {
    name: "Código da solução",
    exact: true,
  });
  await expect(editor).toBeVisible();
  const code =
    '// Preserved across tones\nconst answer: number = 42;\nconst label = "Otto";\nconsole.log(answer, label);';
  await editor.fill(code);
  await editor.evaluate((node) =>
    node.setAttribute("data-preserved-editor", "true"),
  );
  const run = page.getByRole("button", { name: "Run", exact: true });
  if (await run.count()) {
    await run.click();
    await page.getByText("Detalhes da verificação", { exact: true }).click();
    await page.getByText("JavaScript gerado", { exact: true }).click();
    await expect(page.locator(".result-output").first()).toContainText(
      "answer",
    );
  }
  const samples: unknown[] = [];
  for (const site of ["light", "bunkercode"]) {
    await selectSiteTheme(page, site);
    const headerColor = await page
      .locator(".site-header")
      .evaluate((n) => getComputedStyle(n).backgroundColor);
    for (let tone = 0; tone < 6; tone++) {
      await selectReadingTone(page, tone);
      await page.keyboard.press("Escape");
      await expect(page.locator(".lesson-theme")).toHaveClass(
        new RegExp(`reading-tone-${tone}\\b`),
      );
      await expect(editor).toHaveAttribute("data-preserved-editor", "true");
      await expect.poll(() => editor.innerText()).toBe(code);
      await expect(page.locator(".site-header")).toHaveCSS(
        "background-color",
        headerColor,
      );
      const colors = await page.locator(".lesson-theme").evaluate((root) => {
        const style = getComputedStyle(root);
        return {
          background: style.backgroundColor,
          surface: style.getPropertyValue("--color-surface").trim(),
          raised: style.getPropertyValue("--color-raised").trim(),
          scheme: style.colorScheme,
        };
      });
      await expect(page.locator(".cm-editor").first()).toHaveCSS(
        "background-color",
        colors.background,
      );
      await expect(page.locator(".cm-editor").first()).toHaveCSS(
        "color-scheme",
        colors.scheme,
      );
      for (const selector of [
        ".workspace-tabs",
        ".editor-toolbar",
        ".workspace-results",
        ".cm-gutters",
      ]) {
        const matching = await page
          .locator(selector)
          .first()
          .evaluate((node, surface) => {
            const sample = document.createElement("span");
            sample.style.backgroundColor = surface;
            node.append(sample);
            const equal =
              getComputedStyle(node).backgroundColor ===
              getComputedStyle(sample).backgroundColor;
            sample.remove();
            return equal;
          }, colors.surface);
        expect(matching, selector).toBe(true);
      }
      const contrast = await expectRenderedContrast(
        page.locator(
          ".cm-line, .cm-line span, .cm-gutterElement, .result-heading, .results-panel p, .result-output:visible, .editor-files button:not(:disabled), .editor-actions button:not(:disabled)",
        ),
      );
      await editor.focus();
      await editor.press("ControlOrMeta+a");
      const selection = page.locator(".cm-selectionBackground").first();
      await expect(selection).toBeVisible();
      const selectionBackground = await selection.evaluate(
        (n) => getComputedStyle(n).backgroundColor,
      );
      const selectionContrast = await expectRenderedContrast(
        page.locator(".cm-line span"),
        { background: selectionBackground },
      );
      await editor.press("ArrowRight");
      await page
        .getByRole("button", { name: "Ajustar lição", exact: true })
        .focus();
      samples.push({ site, tone, colors, contrast, selectionContrast });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (site === "light" || tone === 3)
        await page.screenshot({
          path: info.outputPath(
            `workspace-${site}-tone-${tone}-${page.viewportSize()!.width}.png`,
          ),
        });
    }
  }
  // Reconfiguration preserves editing history, then refresh preserves the draft/tone.
  await editor.focus();
  await editor.press("ControlOrMeta+z");
  await expect(editor).not.toContainText("Preserved across tones");
  await editor.press(
    process.platform === "darwin" ? "Meta+Shift+z" : "Control+y",
  );
  await expect.poll(() => editor.innerText()).toBe(code);
  await page.reload();
  await expect(page.locator(".lesson-theme")).toHaveClass(/reading-tone-5/);
  if (narrow)
    await page.getByRole("button", { name: "Código", exact: true }).click();
  await expect.poll(() => editor.innerText()).toBe(code);
  if (narrow) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(
      page
        .locator(".study-explanation")
        .getByRole("button", { name: "Ajustar lição", exact: true }),
    ).toBeVisible();
    await expect(page.locator("#reading-appearance-panel")).toHaveCount(0);
  }
  console.log("LESSON_WORKSPACE_CONTRAST", JSON.stringify(samples));
}

export async function checkOttoNotes(page: Page, info: TestInfo) {
  await page.goto(
    "/courses/fundamentos-programacao-javascript/lessons/voce-sabe-fazer-mas-sabe-explicar",
  );
  const notes = page.getByRole("complementary", { name: "Otto", exact: true });
  await expect(notes).toHaveCount(3);
  const quiz = page.locator(".inline-quiz").first();
  await quiz.getByRole("radio").first().check();
  await quiz.getByRole("button", { name: "Verificar resposta" }).click();
  const feedback = await quiz.locator(".quiz-feedback").innerText();
  await expect(page.getByText(/nota do otto/i)).toHaveCount(0);
  for (let tone = 0; tone < 6; tone++) {
    await selectReadingTone(page, tone);
    await page.keyboard.press("Escape");
    for (const note of await notes.all()) {
      await expect(note.locator(".otto-name")).toHaveCount(0);
      const avatar = note.locator("img");
      await expect(avatar).toHaveAttribute("src", "/characters/otto.svg");
      expect(
        await avatar.evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
      ).toBe(true);
      expect(await note.evaluate((n) => n.scrollWidth <= n.clientWidth)).toBe(
        true,
      );
    }
    await expectRenderedContrast(notes.locator("p"));
    if (tone === 0 || tone === 5) {
      await notes
        .first()
        .evaluate((node) => node.scrollIntoView({ block: "center" }));
      await notes.first().screenshot({
        path: info.outputPath(
          `otto-profile-tone-${tone}-${page.viewportSize()!.width}.png`,
        ),
      });
    }
    await expect(quiz.locator(".quiz-feedback")).toHaveText(feedback, {
      useInnerText: true,
    });
  }
  await notes.first().scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath(`otto-${page.viewportSize()!.width}.png`),
  });
}
