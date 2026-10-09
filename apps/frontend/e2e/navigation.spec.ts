import { expect, test, type Locator } from "@playwright/test";
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
  title: `Lição de teste ${i + 1}`,
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

test("thirty-lesson modal supports keyboard, inert background, active order and selection", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(lesson(1));
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toBeFocused();
  const trigger = page.getByRole("button", { name: "Lições", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Lições · Curso de leitura",
  });
  await expect(dialog).toBeVisible();
  await expect(page.locator(".lesson-index-trigger")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(
    dialog.getByRole("button", { name: "Fechar", exact: true }),
  ).toBeFocused();
  await expect(dialog.locator("nav a")).toHaveCount(30);
  await expect(dialog.locator('a[aria-current="page"]')).toHaveText(
    "01Lição de teste 1",
  );
  await expect(dialog.locator("nav a").last()).toHaveText(
    "30Lição de teste 30",
  );
  await page
    .getByRole("link", { name: "BunkerCode — Início", exact: true })
    .evaluate((node: HTMLElement) => node.focus());
  expect(
    await page.evaluate(() => !!document.activeElement?.closest("dialog")),
  ).toBe(true);
  // A scrollable native dialog is also a keyboard stop; verify the lesson order
  // directly rather than assuming a custom first/last focus loop.
  for (let index = 0; index < entries.length; index++) {
    await page.keyboard.press("Tab");
    await expect(dialog.locator("nav a").nth(index)).toBeFocused();
  }
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.locator("nav a").nth(28)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(lesson(2));
  await expect(dialog).not.toBeVisible();
  await expect(heading).toHaveText("Lição de teste 2");
  await expect(heading).toBeFocused();
  await page.getByRole("button", { name: "Lições", exact: true }).click();
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(trigger).toBeFocused();
  await page
    .getByRole("link", { name: "Próxima → Lição de teste 3", exact: true })
    .click();
  await expect(heading).toHaveText("Lição de teste 3");
  await page
    .getByRole("link", { name: "← Anterior Lição de teste 2", exact: true })
    .click();
  await expect(heading).toHaveText("Lição de teste 2");
  await page.reload();
  await expect(heading).toHaveText("Lição de teste 2");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
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
  await page.evaluate(() => window.scrollTo(0, 640));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(640);
  await page
    .getByRole("link", { name: "Próxima → Lição de teste 2", exact: true })
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
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(640);
  await page.goForward();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Lição de teste 2",
  );
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Lição de teste 1",
  );
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(640);
  // Start at the first document control and activate the skip link by keyboard.
  await page.locator(".skip-link").focus();
  await expect(
    page.getByRole("link", { name: "Pular para o conteúdo" }),
  ).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await expect(page).toHaveURL(lesson(1));
  await page.getByRole("link", { name: "Editar lição", exact: true }).click();
  await expect(page).toHaveTitle(
    "Studio · Lição de teste 1 · Curso de leitura · BunkerCode",
  );
  await expect(
    page.getByRole("navigation", { name: "Caminho da página" }),
  ).toContainText("Studio");
  const editor = page.getByRole("textbox", { name: "Markdown completo" });
  const draft =
    (await editor.inputValue()) + "\nRascunho preservado na navegação.\n";
  await editor.fill(draft);
  await page.keyboard.type("Ainda editando.");
  await expect(editor).toBeFocused();
  await page.getByRole("button", { name: "Prévia", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Prévia", exact: true }),
  ).toBeFocused();
  await page.getByRole("link", { name: "Voltar à lição", exact: true }).click();
  await page.goBack();
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
  return prose.evaluate((node) => ({
    width: node.getBoundingClientRect().width,
    fontSize: getComputedStyle(node).fontSize,
    lineHeight: getComputedStyle(node).lineHeight,
  }));
}
for (const width of [390, 768, 1024, 1440])
  test(`reader and preview share effective measure at ${width}px with an overlay index`, async ({
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
    expect(reader.width).toBeCloseTo(
      Math.min(750, width - (width <= 700 ? 40 : 56)),
      0,
    );
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
    await page.getByRole("button", { name: "Prévia", exact: true }).click();
    expect(await measure(page.locator(".studio-preview .prose"))).toEqual(
      reader,
    );
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
