import { expect, test } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { studioView, studioTools } from "./studio-controls";
const root = join(
  process.env.BUNKERCODE_BROWSER_CONTENT_DIR!,
  "courses/studio-authoring-flow",
);
const file = join(root, "lessons/first/lesson.md");
const route = "/courses/studio-authoring-flow/lessons/first/edit";
const original = "# Primeira\n\nExplicação original.\n";
test.beforeEach(async () => {
  for (const slug of ["first", "second"]) {
    await mkdir(join(root, "lessons", slug), { recursive: true });
    await writeFile(
      join(root, "lessons", slug, "lesson.md"),
      slug === "first" ? original : "# Segunda\n",
    );
  }
  await writeFile(
    join(root, "course.json"),
    JSON.stringify({
      id: "studio-authoring-flow",
      title: "Curso de autoria",
      description: "Fixture isolada",
      lessons: [
        { slug: "first", title: "Primeira" },
        { slug: "second", title: "Segunda" },
      ],
    }),
  );
});
for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1280, 720],
  [390, 844],
])
  test(`complete authoring journey and responsive controls at ${width}x${height}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: width!, height: height! });
    await page.goto(route);
    const lessons = page.getByRole("combobox", { name: "Lições do curso" });
    await expect(lessons.locator("option")).toHaveText(["Primeira", "Segunda"]);
    await page.getByRole("button", { name: "Nova lição", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Nova lição" });
    await dialog
      .getByLabel("Título", { exact: true })
      .fill(`Minha aula ${width}`);
    await expect(dialog.getByLabel("Slug", { exact: true })).toHaveValue(
      `minha-aula-${width}`,
    );
    await dialog.getByLabel("Slug", { exact: true }).fill(`journey-${width}`);
    await page.screenshot({ path: info.outputPath(`creation-${width}.png`) });
    await dialog
      .getByRole("button", { name: "Criar lição", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/journey-${width}/edit$`));
    await expect(lessons.locator("option")).toHaveText([
      "Primeira",
      "Segunda",
      `Minha aula ${width}`,
    ]);
    const doc = page.locator(".visual-document");
    await doc.click();
    await page.keyboard.type("Minha explicacao autoral.");
    await page
      .getByRole("button", {
        name: "Inserir após o bloco selecionado",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Bloco de código", exact: true })
      .click();
    const code = page.getByRole("textbox", {
      name: "Código do exemplo",
      exact: true,
    });
    await code.fill("const answer: number = 42;");
    // Enter inside CodeMirror must edit code, never start a document paragraph.
    await code.press("End");
    await code.press("Enter");
    await expect(code).toContainText("42;");
    await page
      .getByRole("button", { name: "Escrever após o último bloco" })
      .click();
    await page.keyboard.type("Primeiro caractere e conclusao.");
    await expect(doc.locator("p").last()).toHaveText(
      "Primeiro caractere e conclusao.",
    );
    await studioView(page, "Prévia");
    await expect(
      page.getByRole("button", { name: "Prévia", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".studio-preview")).toContainText(
      "Primeiro caractere e conclusao.",
    );
    await page.screenshot({ path: info.outputPath(`preview-${width}.png`) });
    await page
      .getByRole("button", { name: "Salvar alterações", exact: true })
      .click();
    await expect(page.locator(".studio-status")).toHaveText(
      "Salvo no arquivo.",
    );
    const savedFile = join(root, `lessons/journey-${width}/lesson.md`);
    const saved = await readFile(savedFile, "utf8");
    expect(saved).toContain("const answer: number = 42;");
    expect(saved).toContain("Primeiro caractere e conclusao.");
    await page.reload();
    await expect(doc).toContainText("Primeiro caractere e conclusao.");
    await lessons.selectOption("second");
    await expect(lessons).toHaveValue("second");
    await lessons.selectOption(`journey-${width}`);
    await expect(doc).toContainText("Primeiro caractere e conclusao.");
    expect(await readFile(savedFile, "utf8")).toBe(saved);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: info.outputPath(`studio-${width}.png`) });
    await page.getByRole("link", { name: "Voltar à lição" }).click();
    await expect(page.locator("article")).toContainText(
      "Primeiro caractere e conclusao.",
    );
    await expect(page.locator("article pre code")).toContainText(
      "const answer: number = 42;",
    );
  });

test("drafts survive immediate navigation, creation, modes and reload without claiming a canonical save", async ({
  page,
}) => {
  await page.goto(route);
  await studioView(page, "Editar fonte Markdown");
  const draft = original + "\nÚltima alteração ainda não salva.";
  await page.locator("#lesson-markdown").fill(draft);
  await page
    .getByRole("combobox", { name: "Lições do curso" })
    .selectOption("second");
  await page
    .getByRole("combobox", { name: "Lições do curso" })
    .selectOption("first");
  await expect(page.getByText(/Rascunho recuperado/)).toBeVisible();
  await studioView(page, "Editar fonte Markdown");
  await expect(page.locator("#lesson-markdown")).toHaveValue(draft);
  await studioView(page, "Prévia");
  await studioView(page, "Editor visual");
  await page.getByRole("button", { name: "Nova lição", exact: true }).click();
  await page.getByLabel("Título", { exact: true }).fill("Lição do rascunho");
  await page.getByRole("button", { name: "Criar lição", exact: true }).click();
  await expect(page).toHaveURL(/licao-do-rascunho\/edit$/);
  await page
    .getByRole("combobox", { name: "Lições do curso" })
    .selectOption("first");
  await page.reload();
  await expect(page.locator(".studio-status")).toHaveText(
    "Alterações não salvas.",
  );
  await studioView(page, "Editar fonte Markdown");
  await expect(page.locator("#lesson-markdown")).toHaveValue(draft);
  expect(await readFile(file, "utf8")).toBe(original);
});

test("failed tab storage retains the last edit during SPA navigation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("Quota denied");
    };
  });
  await page.goto(route);
  await studioView(page, "Editar fonte Markdown");
  await page.locator("#lesson-markdown").fill("Último caractere preservado!");
  await expect(page.getByRole("alert")).toContainText("rascunho");
  const lessons = page.getByRole("combobox", { name: "Lições do curso" });
  await lessons.selectOption("second");
  await lessons.selectOption("first");
  await studioView(page, "Editar fonte Markdown");
  await expect(page.locator("#lesson-markdown")).toHaveValue(
    "Último caractere preservado!",
  );
  await expect(page.getByRole("alert")).toContainText("rascunho");
});

test("creation preserves form after duplicate, invalid and network failures and cancel writes nothing", async ({
  page,
}) => {
  await page.goto(route);
  await page.getByRole("button", { name: "Nova lição", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Nova lição" });
  await dialog.getByLabel("Título", { exact: true }).fill("Título preservado");
  await dialog.getByLabel("Slug", { exact: true }).fill("first");
  await dialog
    .getByRole("button", { name: "Criar lição", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("Slug já existe");
  await expect(dialog.getByLabel("Título", { exact: true })).toHaveValue(
    "Título preservado",
  );
  await dialog.getByLabel("Slug", { exact: true }).fill("../escape");
  await dialog
    .getByRole("button", { name: "Criar lição", exact: true })
    .click();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Slug", { exact: true }).fill("network-failure");
  await page.route(
    "**/api/content/courses/studio-authoring-flow/lessons",
    (r) => r.abort(),
  );
  await dialog
    .getByRole("button", { name: "Criar lição", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("confirmar");
  await expect(dialog.getByLabel("Slug", { exact: true })).toHaveValue(
    "network-failure",
  );
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(
    JSON.parse(await readFile(join(root, "course.json"), "utf8")).lessons,
  ).toHaveLength(2);
  expect(await readFile(file, "utf8")).toBe(original);
});

const endings = {
  code: "```typescript\nconst count = 1;\n```",
  note: '```bunker-note\n{"kind":"tip","text":"Nota final"}\n```',
  quiz:
    "```bunker-quiz\n" +
    JSON.stringify({
      id: "final-quiz",
      question: "Pergunta final",
      options: [
        { id: "a", text: "Um" },
        { id: "b", text: "Dois" },
      ],
      correct: "a",
      feedbackCorrect: "Sim",
      feedbackIncorrect: "Reveja",
      retry: true,
    }) +
    "\n```",
};
for (const [kind, ending] of Object.entries(endings))
  for (const action of ["click", "keyboard", "type", "bottom"])
    test(`continue after loaded final ${kind} by ${action}, preserving first character, undo and reload`, async ({
      page,
    }) => {
      const source = "# Primeira\n\nAntes.\n\n" + ending;
      await writeFile(file, source);
      await page.goto(route);
      const doc = page.locator(".visual-document");
      await expect(doc).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Salvar alterações", exact: true }),
      ).toBeDisabled();
      expect(await readFile(file, "utf8")).toBe(source);
      if (action === "click")
        await page
          .getByRole("button", { name: "Escrever após o último bloco" })
          .click();
      else if (action === "bottom") {
        const box = await doc.boundingBox();
        await doc.click({
          position: { x: box!.width / 2, y: box!.height - 8 },
        });
      } else {
        const block = doc.getByRole("group", {
          name:
            kind === "code"
              ? "Bloco de código"
              : kind === "note"
                ? "Nota editorial"
                : "Quiz editorial",
          exact: true,
        });
        await block.click({ position: { x: 5, y: 5 } });
        await block.focus();
        await page.keyboard.press(action === "keyboard" ? "Enter" : "P");
      }
      await page.keyboard.type(
        action === "type" ? "rimeira letra." : "Primeira letra.",
      );
      await expect(doc.locator("p").last()).toHaveText("Primeira letra.");
      await page.keyboard.press("ControlOrMeta+z");
      await expect(doc).not.toContainText("Primeira letra.");
      await page.keyboard.press("ControlOrMeta+Shift+z");
      await expect(doc.locator("p").last()).toHaveText("Primeira letra.");
      await page
        .getByRole("button", { name: "Salvar alterações", exact: true })
        .click();
      await expect(page.locator(".studio-status")).toHaveText(
        "Salvo no arquivo.",
      );
      await page.reload();
      await expect(doc.locator("p").last()).toHaveText("Primeira letra.");
      await studioView(page, "Editar fonte Markdown");
      await expect(page.locator("#lesson-markdown")).toContainText(
        "Primeira letra.",
      );
    });

test("moving a block to the end and deleting the final paragraph both expose continuation", async ({
  page,
}) => {
  await writeFile(file, "# Primeira\n\n" + endings.note + "\n\nDepois.");
  await page.goto(route);
  const doc = page.locator(".visual-document");
  await doc.locator(".editorial-note").first().click();
  await page
    .getByRole("button", { name: "Ações do bloco", exact: true })
    .click();
  await page.getByRole("button", { name: "Mover bloco para baixo" }).click();
  await page
    .getByRole("button", { name: "Escrever após o último bloco" })
    .click();
  await page.keyboard.type("Remover este parágrafo.");
  await expect(doc.locator("p").last()).toHaveText("Remover este parágrafo.");
  await doc.locator("p").last().click();
  await expect(doc.locator(".ProseMirror-selectednode")).toHaveCount(0);
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+End");
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toBe("Remover este parágrafo.");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  await expect(
    page.getByRole("button", { name: "Escrever após o último bloco" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Escrever após o último bloco" })
    .click();
  await page.keyboard.type("Continuação recuperada.");
  await expect(doc.locator("p").last()).toHaveText("Continuação recuperada.");
  await studioTools(page);
});

test("pending creation locks the form and sends exactly one command", async ({
  page,
}) => {
  await page.goto(route);
  await page.getByRole("button", { name: "Nova lição", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Nova lição" });
  await dialog.getByLabel("Título", { exact: true }).fill("Pending creation");
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await page.route(
    "**/api/content/courses/studio-authoring-flow/lessons",
    async (route) => {
      requests++;
      await gate;
      await route.continue();
    },
  );
  await dialog
    .getByRole("button", { name: "Criar lição", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Criando…", exact: true }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: "Cancelar", exact: true }),
  ).toBeDisabled();
  await expect(dialog.getByLabel("Título", { exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  release();
  await expect(page).toHaveURL(/pending-creation\/edit$/);
  expect(requests).toBe(1);
});
