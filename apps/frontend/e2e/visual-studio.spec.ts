import { test, expect } from "@playwright/test";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
const root = join(
  process.env.BUNKERCODE_BROWSER_CONTENT_DIR!,
  "courses/visual-studio",
);
const directory = join(root, "lessons/visual");
const file = join(directory, "lesson.md");
const url = "/courses/visual-studio/lessons/visual";
const source =
  "# Autoria visual\n\nAntes do bloco.\n\n## Continuação\n\nDepois do bloco.\n";
test.beforeAll(async () => {
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(root, "course.json"),
    JSON.stringify({
      id: "visual-studio",
      title: "Studio visual",
      description: "Fixture",
      lessons: [{ slug: "visual", title: "Autoria visual" }],
    }),
  );
});
test.beforeEach(async () => {
  await writeFile(file, source);
  await rm(join(directory, "exercise.json"), { force: true });
});
test("open/close is byte preserving and visual quiz saves between paragraphs with undo and recovery", async ({
  page,
}, info) => {
  await page.goto(url + "/edit");
  await expect(page.locator(".visual-document")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Salvar alterações", exact: true }),
  ).toBeDisabled();
  expect(await readFile(file, "utf8")).toBe(source);
  await page
    .locator(".visual-document p")
    .filter({ hasText: "Antes do bloco." })
    .click();
  await page
    .getByRole("button", { name: "Inserir após o bloco selecionado" })
    .click();
  await page.getByRole("button", { name: "Quiz", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Pergunta", exact: true })
    .fill("Qual alternativa está correta?");
  await page.getByLabel("Alternativa 1", { exact: true }).fill("Primeira");
  await page.getByLabel("Alternativa 2", { exact: true }).fill("Segunda");
  await page.getByLabel("Alternativa correta 2", { exact: true }).check();
  await page
    .getByRole("textbox", { name: "Feedback correto", exact: true })
    .fill("Você identificou a segunda.");
  await page
    .getByRole("textbox", { name: "Feedback incorreto", exact: true })
    .fill("Observe a segunda alternativa.");
  await page.getByRole("button", { name: "Testar como estudante" }).click();
  await page.getByRole("radio", { name: "Primeira", exact: true }).check();
  await page.getByRole("button", { name: "Verificar resposta" }).click();
  await expect(
    page.getByText("Observe a segunda alternativa.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Editar quiz" }).click();
  await page.getByRole("button", { name: "Continuar abaixo" }).click();
  await page.keyboard.type("Texto depois do quiz.");
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await page.getByRole("button", { name: "Refazer", exact: true }).click();
  await page.reload();
  await expect(page.getByText(/Rascunho recuperado/)).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Pergunta", exact: true }),
  ).toHaveValue("Qual alternativa está correta?");
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(
    page.getByText("Salvo no arquivo.", { exact: true }),
  ).toBeVisible();
  const saved = await readFile(file, "utf8");
  expect(saved.indexOf("Antes do bloco.")).toBeLessThan(
    saved.indexOf("```bunker-quiz"),
  );
  expect(saved.indexOf("```bunker-quiz")).toBeLessThan(
    saved.indexOf("Depois do bloco."),
  );
  await page.screenshot({
    path: info.outputPath("studio-quiz.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Voltar à lição" }).click();
  await page.getByRole("radio", { name: "Segunda", exact: true }).check();
  await page.getByRole("button", { name: "Verificar resposta" }).click();
  await expect(
    page.getByText("Você identificou a segunda.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Depois do bloco.", { exact: true }),
  ).toBeVisible();
});
test("code insertion preserves indentation, highlighting, escape and text after block", async ({
  page,
}) => {
  await page.goto(url + "/edit");
  await page.locator(".visual-document p").first().click();
  await page
    .getByRole("button", { name: "Inserir após o bloco selecionado" })
    .click();
  await page
    .getByRole("button", { name: "Bloco de código", exact: true })
    .click();
  const code = page.getByRole("textbox", {
    name: "Código do exemplo",
    exact: true,
  });
  await code.click();
  await page.keyboard.insertText(
    'const text: string = "<>&";\n  console.log(text);',
  );
  await expect(code).toContainText("console.log(text);");
  await page
    .getByRole("combobox", { name: "Linguagem", exact: true })
    .selectOption("javascript");
  await expect(code).toContainText("console.log(text);");
  await page
    .getByRole("combobox", { name: "Linguagem", exact: true })
    .selectOption("typescript");
  await expect(code).toContainText("console.log(text);");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Tab");
  await page.getByRole("button", { name: "Continuar abaixo" }).click();
  await page.keyboard.type("Continua após o código.");
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(
    page.getByText("Salvo no arquivo.", { exact: true }),
  ).toBeVisible();
  expect(await readFile(file, "utf8")).toContain("  console.log(text);");
  await page.reload();
  await expect(page.locator(".visual-document")).toContainText(
    "Continua após o código.",
  );
});
test("unsupported markdown remains source-only without automatic save", async ({
  page,
}) => {
  const raw = source + '\n<div data-original="keep">Original</div>\n';
  await writeFile(file, raw);
  await page.goto(url + "/edit");
  await expect(page.getByRole("alert")).toContainText(
    "original foi preservado",
  );
  await page
    .getByRole("button", { name: "Editar fonte Markdown", exact: true })
    .click();
  await expect(page.getByLabel("Markdown completo")).toHaveValue(raw);
  await expect(
    page.getByRole("button", { name: "Salvar alterações", exact: true }),
  ).toBeDisabled();
  expect(await readFile(file, "utf8")).toBe(raw);
});
for (const width of [390, 1280, 1440, 1920])
  test(`reader and visual studio reflow at ${width}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto(url);
    await expect(page.locator(".study-explanation")).toBeVisible();
    await page.getByText("Aa", { exact: true }).click();
    await page
      .getByRole("combobox", { name: "Tonalidade", exact: true })
      .selectOption("2");
    await page.getByLabel("Tamanho do texto", { exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.reload();
    await expect(page.locator(".study-explanation")).toHaveClass(
      /reading-tone-2/,
    );
    const separator = page.getByRole("separator");
    if (width >= 1000) {
      await separator.focus();
      await page.keyboard.press("ArrowLeft");
      await expect(separator).toHaveAttribute("aria-valuenow", "72");
      await page.reload();
      await expect(separator).toHaveAttribute("aria-valuenow", "72");
      await separator.dblclick();
      await expect(separator).toHaveAttribute("aria-valuenow", "74");
    } else await expect(separator).not.toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`reader-${width}.png`),
      fullPage: true,
    });
    await page.getByRole("link", { name: "Editar lição", exact: true }).click();
    await expect(page.locator(".visual-document")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`studio-${width}.png`),
      fullPage: true,
    });
  });
test("public test is read-only and Submit assesses each exact snapshot without prior Run", async ({
  page,
  request,
}) => {
  const definition = {
    id: "print-answer",
    title: "Print answer",
    objective: "Print 42",
    instructions: "Use console.log to print 42.",
    language: "typescript",
    starterCode: "",
    expected: "42 followed by a line break.",
    tests: { kind: "stdout", expected: "42\n" },
  };
  await writeFile(join(directory, "exercise.json"), JSON.stringify(definition));
  await page.goto(url);
  const solution = page.getByRole("textbox", {
    name: "Código da solução",
    exact: true,
  });
  await expect(solution).toBeVisible();
  await solution.click();
  await page.keyboard.insertText("console.log(42);");
  await page.getByRole("button", { name: "testes.json", exact: true }).click();
  const tests = page.getByRole("textbox", {
    name: "Testes públicos, somente leitura",
    exact: true,
  });
  await expect(tests).toHaveAttribute("contenteditable", "false");
  await expect(tests).toContainText("stdout");
  await page.getByRole("button", { name: "solucao.ts", exact: true }).click();
  await expect(solution).toHaveText("console.log(42);");
  const runtime = (await (
    await request.get("/api/practice/runtime")
  ).json()) as { available: boolean };
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByText(/Solução registrada em/)).toBeVisible({
    timeout: 20000,
  });
  if (runtime.available)
    await expect(
      page.getByText("Testes aprovados · progresso local.", { exact: true }),
    ).toBeVisible();
  else
    await expect(page.getByText(/Não avaliada automaticamente/)).toBeVisible();
  await solution.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText("console.log(41);");
  await expect(
    page.getByText(/O código foi editado após esta análise/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  if (runtime.available)
    await expect(
      page.getByText("Testes falharam.", { exact: true }),
    ).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByText("Envios locais (2)", { exact: true }),
  ).toBeVisible({ timeout: 20000 });
});

test("notes move, delete and undo without losing surrounding text", async ({
  page,
}) => {
  await page.goto(url + "/edit");
  await page.locator(".visual-document p").first().click();
  await page
    .getByRole("button", { name: "Inserir após o bloco selecionado" })
    .click();
  await page.getByRole("button", { name: "Nota", exact: true }).click();
  const note = page.getByRole("textbox", {
    name: "Texto da nota",
    exact: true,
  });
  await note.fill("Uma observação autoral.");
  await page.getByRole("button", { name: "Mover bloco para cima" }).click();
  await expect(note).toHaveValue("Uma observação autoral.");
  await page
    .getByRole("button", { name: "Excluir bloco", exact: true })
    .click();
  await expect(note).toHaveCount(0);
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await expect(note).toHaveValue("Uma observação autoral.");
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(
    page.getByText("Salvo no arquivo.", { exact: true }),
  ).toBeVisible();
  const saved = await readFile(file, "utf8");
  expect(saved.indexOf("bunker-note")).toBeLessThan(
    saved.indexOf("Antes do bloco."),
  );
  expect(saved).toContain("Depois do bloco.");
});

test("multiple quizzes retain independent answers, retry and an inline exercise position", async ({
  page,
}) => {
  const quiz = (id: string, retry: boolean) =>
    "```bunker-quiz\n" +
    JSON.stringify({
      id,
      question: id,
      options: [
        { id: "a", text: "Sim" },
        { id: "b", text: "Não" },
      ],
      correct: "a",
      feedbackCorrect: "Correto " + id,
      feedbackIncorrect: "Reveja " + id,
      retry,
    }) +
    "\n```\n";
  await writeFile(
    file,
    source +
      quiz("primeiro", true) +
      '\n```bunker-exercise\n{"kind":"exercise"}\n```\n\nContinua depois do exercício.\n\n' +
      quiz("segundo", false),
  );
  await writeFile(
    join(directory, "exercise.json"),
    JSON.stringify({
      id: "example",
      title: "Enunciado intercalado",
      objective: "Observar",
      instructions: "Escreva fora dos exemplos.",
      language: "typescript",
      starterCode: "",
      expected: "Reflexão autoral",
    }),
  );
  await page.goto(url);
  const first = page.getByRole("group", { name: "primeiro", exact: true });
  const second = page.getByRole("group", { name: "segundo", exact: true });
  await first.getByRole("radio", { name: "Não", exact: true }).check();
  await first.getByRole("button", { name: "Verificar resposta" }).click();
  await expect(first.getByRole("status")).toHaveText("Reveja primeiro");
  await first.getByRole("button", { name: "Tentar novamente" }).click();
  await first.getByRole("radio", { name: "Sim", exact: true }).check();
  await first.getByRole("button", { name: "Verificar resposta" }).click();
  await second.getByRole("radio", { name: "Sim", exact: true }).check();
  await second.getByRole("button", { name: "Verificar resposta" }).click();
  await expect(first.getByRole("status")).toHaveText("Correto primeiro");
  await expect(second.getByRole("status")).toHaveText("Correto segundo");
  await expect(
    second.getByRole("button", { name: "Tentar novamente" }),
  ).toHaveCount(0);
  await expect(page.locator(".inline-exercise")).toHaveCount(1);
  expect(
    await page
      .locator(".inline-exercise")
      .evaluate((node) => node.nextElementSibling?.textContent),
  ).toBe("Continua depois do exercício.");
});

test("visual drafts survive network failure and a real external version conflict", async ({
  page,
}) => {
  await page.goto(url + "/edit");
  const paragraph = page
    .locator(".visual-document p")
    .filter({ hasText: "Antes do bloco." });
  await paragraph.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Minha revisão visual.");
  const putPath =
    "**/api/content/courses/visual-studio/lessons/visual/markdown";
  await page.route(putPath, (route) => route.abort("failed"));
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Seu texto foi preservado",
  );
  expect(await readFile(file, "utf8")).toBe(source);
  await page.unroute(putPath);
  await writeFile(file, source + "\nAlteração externa.\n");
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Conflito de edição" }),
  ).toBeVisible();
  await expect(paragraph).toContainText("Minha revisão visual.");
  await page.getByRole("button", { name: "Revisar arquivo atual" }).click();
  await page
    .getByRole("button", {
      name: "Manter meu texto e usar esta versão como base",
    })
    .click();
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(
    page.getByText("Salvo no arquivo.", { exact: true }),
  ).toBeVisible();
  expect(await readFile(file, "utf8")).toContain("Minha revisão visual.");
});

test("late exercise loading initializes the practice split with its own persisted width", async ({
  page,
}) => {
  await writeFile(
    join(directory, "exercise.json"),
    JSON.stringify({
      id: "late",
      title: "Prática",
      objective: "Observar",
      instructions: "Escreva seu exemplo.",
      language: "typescript",
      starterCode: "",
      expected: "Reflexão",
    }),
  );
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    "**/api/content/courses/visual-studio/lessons/visual/exercise",
    async (route) => {
      await gate;
      await route.continue();
    },
  );
  try {
    await page.goto(url);
    await expect(
      page.getByRole("separator", { name: "Largura do artigo e sumário" }),
    ).toHaveAttribute("aria-valuenow", "74");
    release();
    await expect(
      page.getByRole("textbox", { name: "Código da solução", exact: true }),
    ).toBeVisible();
    const divider = page.getByRole("separator", {
      name: "Largura do artigo e editor",
    });
    await expect(divider).toHaveAttribute("aria-valuenow", "46");
    await divider.focus();
    await page.keyboard.press("ArrowRight");
    await expect(divider).toHaveAttribute("aria-valuenow", "48");
    await page.reload();
    await expect(divider).toHaveAttribute("aria-valuenow", "48");
  } finally {
    release();
  }
});
