import { studioView } from "./studio-controls";
import { expect, test, type Locator } from "./auth-fixture";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const course = "reading-fixture";
const root = join(
  process.env.BUNKERCODE_BROWSER_CONTENT_DIR!,
  "courses",
  course,
);
const lesson = (number: number) =>
  `/courses/${course}/lessons/lesson-${String(number).padStart(2, "0")}`;
const entries = Array.from({ length: 30 }, (_, i) => ({
  slug: `lesson-${String(i + 1).padStart(2, "0")}`,
  title:
    i === 29
      ? "Lição de teste 30 — Um título editorial mais longo para verificar a quebra de linhas e a navegação contextual em telas estreitas"
      : `Lição de teste ${i + 1}`,
}));
test.beforeAll(async () => {
  await mkdir(root, { recursive: true });
  await writeFile(
    join(root, "course.json"),
    JSON.stringify({
      id: course,
      title: "Curso de leitura",
      description: "Fixture isolada com trinta lições.",
      lessons: entries,
    }),
  );
  for (const entry of entries) {
    const directory = join(root, "lessons", entry.slug);
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, "lesson.md"),
      `# ${entry.title}\n\n## Entendimento\n\n` +
        Array.from(
          { length: 35 },
          (_, i) =>
            `Parágrafo ${i + 1}. Esta é uma explicação demonstrativa para verificar a medida de leitura e o retorno à posição anterior. Ela contém texto suficiente para ocupar várias linhas em diferentes telas.\n\n`,
        ).join("") +
        `~~~javascript\n// A comment stays readable.\nconst pattern = /reader[a-z]+/gi;\n${"longLine".repeat(90)}\n~~~\n`,
    );
  }
});

test("thirty-lesson dropdown supports keyboard, current order, dismissal and selection", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(lesson(1));
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toBeFocused();
  await expect(page.locator(".header-global-nav a")).toHaveText([
    "Início",
    "Cursos",
    "Táticas",
  ]);
  await expect(
    page.locator(".lesson-nav-course, footer.learning-footer"),
  ).toHaveCount(0);
  const trigger = page.getByRole("button", { name: "Lições", exact: true });
  const menu = page.getByRole("navigation", {
    name: "Lições do curso",
    exact: true,
  });
  const choices = menu.locator("[data-lesson-choice]");
  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  await expect(menu).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(choices).toHaveCount(30);
  await expect(choices.first()).toHaveAttribute("aria-current", "page");
  await expect(choices.first()).toContainText("Lição de teste 1");
  await expect(choices.last()).toContainText(entries.at(-1)!.title);
  await expect(choices.first()).toBeFocused();
  for (let index = 1; index < entries.length; index++) {
    await page.keyboard.press("ArrowDown");
    await expect(choices.nth(index)).toBeFocused();
  }
  await page.keyboard.press("Home");
  await expect(choices.first()).toBeFocused();
  await page.keyboard.press("End");
  await expect(choices.last()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await trigger.click();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(lesson(2));
  await expect(heading).toHaveText("Lição de teste 2");
  await expect(heading).toBeFocused();
  await trigger.click();
  await expect(choices.nth(1)).toBeFocused();
  // This is a contextual dropdown, not a modal: Tab and outside focus dismiss it.
  await page.keyboard.press("End");
  await page.keyboard.press("Tab");
  await expect(menu).toHaveCount(0);
  await trigger.click();
  await page
    .getByRole("link", { name: "BunkerCode — Início", exact: true })
    .focus();
  await expect(menu).toHaveCount(0);
  await trigger.click();
  await page.mouse.click(8, page.viewportSize()!.height - 16);
  await expect(menu).toHaveCount(0);
  await page.getByRole("link", { name: "Próxima lição", exact: true }).click();
  await expect(heading).toHaveText("Lição de teste 3");
  await page.getByRole("link", { name: "Lição anterior", exact: true }).click();
  await page.reload();
  await expect(heading).toHaveText("Lição de teste 2");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

for (const width of [1440, 1280, 390, 360, 320])
  test(`lesson dropdown contains long titles and restores the current choice at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(lesson(30));
    const trigger = page.getByRole("button", { name: "Lições", exact: true });
    await expect(trigger).toHaveAccessibleDescription(
      `30 · ${entries.at(-1)!.title}`,
    );
    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    const menu = page.getByRole("navigation", {
      name: "Lições do curso",
      exact: true,
    });
    const current = menu.locator('[aria-current="page"]');
    await expect(current).toBeFocused();
    await expect(current).toContainText(entries.at(-1)!.title);
    const bounds = (await menu.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(
      await menu.evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
    await expect(current).toBeInViewport();
    expect(
      await current.evaluate((node) => getComputedStyle(node).outlineStyle),
    ).toBe("solid");
    await page.screenshot({
      path: info.outputPath(`lesson-selector-long-${width}.png`),
    });
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(
      page.getByRole("button", { name: "Próxima lição", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("link", { name: "Lição anterior", exact: true })
      .focus();
    expect(
      await page
        .getByRole("link", { name: "Lição anterior", exact: true })
        .evaluate((node) => getComputedStyle(node).outlineStyle),
    ).toBe("solid");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(lesson(29));
    await page
      .getByRole("navigation", { name: "Navegação principal", exact: true })
      .getByRole("link", { name: "Cursos", exact: true })
      .click();
    await expect(page).toHaveURL("/courses");
    await page.goBack();
    await expect(page).toHaveURL(lesson(29));
    await expect(page.locator(".lesson-heading h1")).toHaveText(
      "Lição de teste 29",
    );
  });

test("route titles, skip link, scroll and browser Back preserve orientation without stealing Studio focus", async ({
  page,
}) => {
  await page.goto(`/courses/${course}`);
  await expect(page).toHaveTitle("Curso de leitura · BunkerCode");
  await page
    .getByRole("link", { name: "01 Lição de teste 1", exact: true })
    .click();
  await expect(page).toHaveTitle(
    "Lição de teste 1 · Curso de leitura · BunkerCode",
  );
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.locator(".study-explanation").evaluate((node) => {
    node.scrollTop = 640;
  });
  await expect
    .poll(() =>
      page.locator(".study-explanation").evaluate((node) => node.scrollTop),
    )
    .toBe(640);
  await page
    .getByRole("link", { name: "Próxima lição", exact: true })
    .evaluate((node: HTMLElement) => node.focus({ preventScroll: true }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Lição de teste 2",
  );
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Lição de teste 1",
  );
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await expect
    .poll(() =>
      page.locator(".study-explanation").evaluate((node) => node.scrollTop),
    )
    .toBe(640);
  await page.goForward();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Lição de teste 2",
  );
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Lição de teste 1",
  );
  await expect
    .poll(() =>
      page.locator(".study-explanation").evaluate((node) => node.scrollTop),
    )
    .toBe(640);
  // Start at the first document control and activate the skip link by keyboard.
  await page.locator(".skip-link").focus();
  await expect(
    page.getByRole("link", { name: "Pular para o conteúdo" }),
  ).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await expect(page).toHaveURL(lesson(1));
  await page.getByRole("link", { name: "Editar lição", exact: true }).click();
  await studioView(page, "Editar fonte Markdown");
  await expect(page).toHaveTitle(
    "Studio · Lição de teste 1 · Curso de leitura · BunkerCode",
  );
  await expect(
    page.getByRole("navigation", { name: "Caminho da página" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Voltar à lição", exact: true }),
  ).toHaveAttribute("href", lesson(1));
  const editor = page.getByRole("textbox", { name: "Markdown completo" });
  const draft =
    (await editor.inputValue()) + "\nRascunho preservado na navegação.\n";
  await editor.fill(draft);
  await page.keyboard.type("Ainda editando.");
  await expect(editor).toBeFocused();
  await studioView(page, "Prévia");
  await expect(
    page.getByRole("button", { name: "Prévia", exact: true }),
  ).toBeFocused();
  await page.getByRole("link", { name: "Voltar à lição", exact: true }).click();
  await expect(page.locator(".lesson-heading h1")).toHaveText(
    "Lição de teste 1",
  );
  await page.goBack();
  await studioView(page, "Editar fonte Markdown");
  await expect(editor).toHaveValue(draft + "Ainda editando.");
  await expect(page.getByText(/Rascunho recuperado nesta aba/)).toBeVisible();
});

async function titlePresentation(title: Locator) {
  return title.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
    };
  });
}
async function measure(prose: Locator) {
  return prose.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      width: node.getBoundingClientRect().width,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      measureLimit: parseFloat(style.fontSize) * 43,
    };
  });
}
for (const width of [390, 768, 1024, 1440])
  test(`reader and preview retain readable typography at ${width}px with an overlay index`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto(lesson(1));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Lição de teste 1",
    );
    const reader = await measure(page.locator(".lesson-reader .prose"));
    const readerTitle = await titlePresentation(
      page.locator(".lesson-heading h1"),
    );
    // The article uses the full panel with a centered editorial measure.
    expect(reader.width).toBeGreaterThan(width < 700 ? 300 : 600);
    // The measure still scales with the reading font size.
    expect(reader.width).toBeLessThanOrEqual(reader.measureLimit + 1);
    expect(
      await page
        .getByRole("heading", { level: 1 })
        .evaluate((node) => node.getBoundingClientRect().top),
    ).toBeLessThan(300);
    await page.screenshot({
      path: testInfo.outputPath(`reader-${width}.png`),
      fullPage: true,
    });
    const scroll = await page.evaluate(() => window.scrollY);
    await page.getByRole("button", { name: "Lições", exact: true }).click();
    await page.screenshot({ path: testInfo.outputPath(`index-${width}.png`) });
    await page.mouse.move(8, 450);
    await page.mouse.wheel(0, 500);
    expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
    await page.getByRole("link", { name: "Editar lição", exact: true }).click();
    await studioView(page, "Editar fonte Markdown");
    await studioView(page, "Prévia");
    const preview = await measure(page.locator(".studio-preview .prose"));
    expect(preview.fontSize).toBe(reader.fontSize);
    expect(preview.lineHeight).toBe(reader.lineHeight);
    expect(preview.width).toBeLessThanOrEqual(750);
    expect(
      await titlePresentation(page.locator(".studio-preview-title")),
    ).toEqual(readerTitle);
    await page.screenshot({
      path: testInfo.outputPath(`preview-${width}.png`),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const pre = page.locator(".studio-preview pre");
    expect(
      await pre.evaluate((node) => node.scrollWidth > node.clientWidth),
    ).toBe(true);
    await pre.evaluate((node) => {
      node.scrollLeft = 100;
    });
    expect(await pre.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
  });
