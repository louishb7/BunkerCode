import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = join(
  process.env.BUNKERCODE_BROWSER_CONTENT_DIR!,
  "courses/uiux-studio",
);
const file = join(root, "lessons/document/lesson.md");
const url = "/courses/uiux-studio/lessons/document/edit";
const quiz = {
  id: "stable-quiz",
  question: "Qual valor representa a quantidade?",
  options: [
    { id: "first", text: "Um número" },
    { id: "second", text: "Uma string" },
  ],
  correct: "first",
  feedbackCorrect: "Correto.",
  feedbackIncorrect: "Reveja os tipos.",
  retry: true,
};
const source =
  "# Documento de teste\n\nUma explicação com referência e autoria.\n\n## Exemplos\n\n```typescript\nconst amount: number = 42;\nconsole.log(amount);\n```\n\nDepois do código.\n\n```bunker-quiz\n" +
  JSON.stringify(quiz) +
  "\n```\n\nDepois do quiz.\n";
test.beforeAll(async () => {
  await mkdir(join(root, "lessons/document"), { recursive: true });
  await writeFile(
    join(root, "course.json"),
    JSON.stringify({
      id: "uiux-studio",
      title: "Autoria",
      description: "Fixture isolada",
      lessons: [{ slug: "document", title: "Documento de teste" }],
    }),
  );
});
test.beforeEach(async () => {
  await writeFile(file, source);
});

async function selectReference(page: Page) {
  const text = page.locator(".visual-document p").first();
  await text.click();
  await page.keyboard.press("Home");
  for (let i = 0; i < 19; i++) await page.keyboard.press("ArrowRight");
  for (let i = 0; i < 10; i++) await page.keyboard.press("Shift+ArrowRight");
  await expect
    .poll(() => page.evaluate(() => getSelection()?.toString()))
    .toBe("referência");
}

test("link popover preserves selection, validates URL, edits, cancels and removes without native prompts", async ({
  page,
}) => {
  let prompts = 0;
  page.on("dialog", async (dialog) => {
    prompts++;
    await dialog.dismiss();
  });
  await page.goto(url);
  await expect(page.locator(".visual-document")).toBeVisible();
  await selectReference(page);
  await page.getByRole("button", { name: "Link", exact: true }).click();
  const form = page.getByRole("form", { name: "Editar link", exact: true });
  await form.getByLabel("URL", { exact: true }).fill("javascript:alert(1)");
  await form.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(form.getByRole("alert")).toBeVisible();
  await form
    .getByLabel("URL", { exact: true })
    .fill("https://example.com/reference");
  await form.getByRole("button", { name: "Confirmar", exact: true }).click();
  const link = page.locator(
    '.visual-document a[href="https://example.com/reference"]',
  );
  await expect(link).toHaveText("referência");
  await link.click();
  await page.getByRole("button", { name: "Link", exact: true }).click();
  await expect(form.getByLabel("URL", { exact: true })).toHaveValue(
    "https://example.com/reference",
  );
  await form
    .getByLabel("URL", { exact: true })
    .fill("https://example.com/changed");
  await page.keyboard.press("Escape");
  await expect(form).toHaveCount(0);
  await expect(link).toHaveText("referência");
  await page.getByRole("button", { name: "Link", exact: true }).focus();
  await page.keyboard.press("Enter");
  await form
    .getByLabel("URL", { exact: true })
    .fill("https://example.com/changed");
  await form.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(
    page.locator('.visual-document a[href="https://example.com/changed"]'),
  ).toHaveText("referência");
  await page.getByRole("button", { name: "Link", exact: true }).click();
  await form.getByRole("button", { name: "Remover link", exact: true }).click();
  await expect(page.locator(".visual-document a")).toHaveCount(0);
  await page.locator(".visual-document p").first().click();
  await page.keyboard.press("End");
  await page.getByRole("button", { name: "Link", exact: true }).click();
  await form
    .getByLabel("URL", { exact: true })
    .fill("https://example.com/cursor");
  await form.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(
    page.locator('.visual-document a[href="https://example.com/cursor"]'),
  ).toHaveText("https://example.com/cursor");
  expect(prompts).toBe(0);
});

for (const width of [390, 1440]) {
  test(`contextual insertion, contained multiline code, quiz and first-character continuity at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto(url);
    const doc = page.locator(".visual-document");
    await expect(doc).toBeVisible();
    if (width === 390) {
      await page.getByRole("button", { name: "Link", exact: true }).click();
      const popover = await page
        .getByRole("form", { name: "Editar link", exact: true })
        .boundingBox();
      expect(popover!.x).toBeGreaterThanOrEqual(0);
      expect(popover!.x + popover!.width).toBeLessThanOrEqual(width);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.keyboard.press("Escape");
    }
    await expect(
      page.getByRole("textbox", { name: "Pergunta", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText("Identificador da questão")).toHaveCount(0);
    const plus = page.getByRole("button", {
      name: "Inserir após o bloco selecionado",
      exact: true,
    });
    const menu = page.getByRole("group", {
      name: "Inserir bloco",
      exact: true,
    });
    await doc.locator("p").first().click();
    await expect(menu).toHaveCount(0);
    const paragraph = await doc.locator("p").first().boundingBox();
    await expect
      .poll(async () => Math.abs((await plus.boundingBox())!.y - paragraph!.y))
      .toBeLessThan(3);
    expect(
      (await plus.boundingBox())!.x + (await plus.boundingBox())!.width,
    ).toBeLessThan(paragraph!.x);
    await plus.click();
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await plus.click();
    await page.locator(".studio-heading").click();
    await doc.locator("h2").click();
    await expect(menu).toHaveCount(0);
    const code = page.getByRole("textbox", {
      name: "Código do exemplo",
      exact: true,
    });
    await code.click();
    await page.keyboard.press("ControlOrMeta+a");
    const multiline = Array.from(
      { length: 75 },
      (_, i) => `  console.log("line ${i} ${"long".repeat(35)}");`,
    ).join("\n");
    await page.keyboard.insertText(multiline);
    const node = await page.locator(".cm-editor").elementHandle();
    await page
      .getByRole("combobox", { name: "Linguagem", exact: true })
      .selectOption("javascript");
    expect(await node!.evaluate((element) => element.isConnected)).toBe(true);
    await code.focus();
    await page.keyboard.press("ControlOrMeta+z");
    await expect(code).toHaveText(
      "const amount: number = 42;console.log(amount);",
    );
    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+Shift+z" : "Control+y",
    );
    await expect(code).toContainText("line 74");
    await expect(page.locator("[data-node-view-content][hidden]")).toBeHidden();
    const scroller = page.locator(".example-code .cm-scroller");
    expect(
      await scroller.evaluate(
        (element) =>
          element.scrollHeight > element.clientHeight &&
          element.scrollWidth > element.clientWidth,
      ),
    ).toBe(true);
    const box = await page.locator(".studio-code-block").boundingBox();
    const mirror = await page.locator(".cm-editor").boundingBox();
    expect(mirror!.x).toBeGreaterThanOrEqual(box!.x);
    expect(mirror!.x + mirror!.width).toBeLessThanOrEqual(box!.x + box!.width);
    expect(mirror!.y + mirror!.height).toBeLessThanOrEqual(
      box!.y + box!.height,
    );
    await page
      .getByRole("button", { name: "Ações do bloco", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Continuar abaixo", exact: true })
      .click();
    await page.keyboard.type("Primeira letra preservada.", { delay: 0 });
    await expect(doc).toContainText("Primeira letra preservada.");
    await expect(menu).toHaveCount(0);
    // Empty paragraphs remain real insertion targets, including after special blocks.
    await page.keyboard.press("Enter");
    const empty = doc.locator("p").filter({ hasText: /^$/ }).last();
    const emptyBox = await empty.boundingBox();
    await expect
      .poll(async () => Math.abs((await plus.boundingBox())!.y - emptyBox!.y))
      .toBeLessThan(3);
    await page.evaluate(() => scrollBy(0, 80));
    await expect
      .poll(async () =>
        Math.abs(
          (await plus.boundingBox())!.y - (await empty.boundingBox())!.y,
        ),
      )
      .toBeLessThan(3);
    await plus.click();
    await menu.getByRole("button", { name: "Nota", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Texto da nota", exact: true })
      .fill("Nota inserida na posição escolhida.");
    await page
      .getByRole("button", { name: "Salvar alterações", exact: true })
      .click();
    await expect(
      page.getByText("Salvo no arquivo.", { exact: true }),
    ).toBeVisible();
    const saved = await readFile(file, "utf8");
    expect(saved.indexOf("Primeira letra preservada.")).toBeLessThan(
      saved.indexOf("Nota inserida na posição escolhida."),
    );
    expect(saved).toContain('"id": "stable-quiz"');
    await doc.locator("p").first().click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 1440) {
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: info.outputPath("studio-text-code.png"),
        fullPage: true,
      });
    }
    await page.locator(".quiz-author").click();
    await expect(
      page.getByRole("textbox", { name: "Pergunta", exact: true }),
    ).toHaveValue(quiz.question);
    await expect(
      page.getByRole("textbox", { name: "Feedback correto", exact: true }),
    ).not.toBeVisible();
    await page.getByText("Feedback e tentativas", { exact: true }).click();
    await page
      .getByRole("textbox", { name: "Feedback correto", exact: true })
      .fill("Novo feedback.");
    await page
      .getByRole("button", { name: "Testar como estudante", exact: true })
      .click();
    await page.getByRole("radio", { name: "Um número", exact: true }).check();
    await page
      .getByRole("button", { name: "Verificar resposta", exact: true })
      .click();
    await expect(
      page.getByText("Novo feedback.", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Editar quiz", exact: true })
      .click();
    await page.screenshot({
      path: info.outputPath(`studio-quiz-selected-${width}.png`),
      fullPage: true,
    });
  });
}
