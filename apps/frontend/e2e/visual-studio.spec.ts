import { parseQuiz } from "@bunkercode/content";
import { expandReadingSettings } from "./reading-theme-checks";
import { selectReadingTone } from "./reading-theme-checks";
import { expectRenderedContrast } from "./reading-theme-checks";
import { studioView, studioTools } from "./studio-controls";
import { test, expect } from "./auth-fixture";
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
  await expect(page.getByText("Feedback legado", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("textbox", { name: "Feedback correto", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Feedback da alternativa 2", exact: true })
    .fill("Você identificou a segunda.");
  await page
    .getByRole("textbox", { name: "Feedback da alternativa 1", exact: true })
    .fill("Observe a segunda alternativa.");
  await page.getByRole("button", { name: "Testar como estudante" }).click();
  await page.getByRole("radio", { name: "Primeira", exact: true }).check();
  await page.getByRole("button", { name: "Verificar resposta" }).click();
  await expect(
    page.getByText("Observe a segunda alternativa.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Editar quiz" }).click();
  await page
    .getByRole("button", { name: "Ações do bloco", exact: true })
    .click();
  await page.getByRole("button", { name: "Continuar abaixo" }).click();
  await page.keyboard.type("Texto depois do quiz.");
  await studioTools(page);
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await studioTools(page);
  await page.getByRole("button", { name: "Refazer", exact: true }).click();
  await page.reload();
  await expect(page.getByText(/Rascunho recuperado/)).toBeVisible();
  await page.locator(".quiz-author").click();
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
  await page
    .getByRole("button", { name: "Ações do bloco", exact: true })
    .click();
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
  await studioView(page, "Editar fonte Markdown");
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
    await page
      .getByRole("button", { name: "Ajustar lição", exact: true })
      .click();
    await selectReadingTone(page, 2);
    await expandReadingSettings(page);
    await page.getByLabel("Tamanho do texto", { exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.reload();
    await expect(page.locator(".study-explanation")).toHaveClass(
      /reading-tone-2/,
    );
    await expect(page.getByRole("separator")).toHaveCount(0);
    await expect(page.locator(".study-explanation > .prose")).toHaveCSS(
      "font-size",
      "19px",
    );
    const hierarchy = await page
      .locator(".study-explanation")
      .evaluate((node) => {
        const prose = node.querySelector(".prose")!;
        const size = (element: Element) =>
          parseFloat(getComputedStyle(element).fontSize);
        const body = size(prose);
        return {
          title: size(node.querySelector(".lesson-heading h1")!) / body,
          section: size(prose.querySelector("h2")!) / body,
          titles: node.querySelectorAll("h1").length,
        };
      });
    expect(hierarchy.title).toBeGreaterThanOrEqual(1.6);
    expect(hierarchy.title).toBeLessThanOrEqual(1.9);
    expect(hierarchy.section).toBeGreaterThanOrEqual(1.25);
    expect(hierarchy.section).toBeLessThanOrEqual(1.45);
    expect(hierarchy.titles).toBe(1);
    const heading = (await page.locator(".lesson-heading").boundingBox())!;
    const prose = (await page
      .locator(".study-explanation > .prose")
      .boundingBox())!;
    expect(heading.x).toBeCloseTo(prose.x, 1);
    expect(heading.width).toBeCloseTo(prose.width, 1);
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
    await studioView(page, "Prévia");
    const preview = page.getByRole("region", { name: "Prévia da lição" });
    await expect(preview.getByRole("heading", { level: 2 })).toHaveCount(2);
    const previewRatio = await preview.evaluate((node) => {
      const size = (element: Element) =>
        parseFloat(getComputedStyle(element).fontSize);
      return (
        size(node.querySelector(".reading-title")!) /
        size(node.querySelector(".prose")!)
      );
    });
    expect(previewRatio).toBeGreaterThanOrEqual(1.6);
    expect(previewRatio).toBeLessThanOrEqual(1.9);
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
      page.getByText(
        "Testes aprovados · prévia editorial, sem progresso na conta.",
        { exact: true },
      ),
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
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Histórico do código", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Soluções registradas", exact: true })
      .locator("details"),
  ).toHaveCount(2);
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
  await page
    .getByRole("button", { name: "Ações do bloco", exact: true })
    .click();
  await page.getByRole("button", { name: "Mover bloco para cima" }).click();
  await expect(note).toHaveValue("Uma observação autoral.");
  await page
    .getByRole("button", { name: "Ações do bloco", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Excluir bloco", exact: true })
    .click();
  await expect(note).toHaveCount(0);
  await studioTools(page);
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await page.locator(".visual-document .editorial-note").first().click();
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
  await expect(first.getByRole("status")).toContainText("Reveja primeiro");
  await expect(
    first.getByRole("button", { name: "Tentar novamente" }),
  ).toHaveCount(0);
  await first.getByRole("radio", { name: "Sim", exact: true }).check();
  await first.getByRole("button", { name: "Verificar resposta" }).click();
  await second.getByRole("radio", { name: "Sim", exact: true }).check();
  await second.getByRole("button", { name: "Verificar resposta" }).click();
  await expect(first.getByRole("status")).toContainText("Correto primeiro");
  await expect(second.getByRole("status")).toContainText("Correto segundo");
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
    await expect(page.locator(".lesson-heading h1")).toHaveText(
      "Autoria visual",
    );
    await expect(page.locator(".study-divider, .study-outline")).toHaveCount(0);
    await expect(page.locator(".study-explanation h2[id]")).toHaveText(
      "Continuação",
    );
    release();
    await expect(
      page.getByRole("textbox", { name: "Código da solução", exact: true }),
    ).toBeVisible();
    const divider = page.getByRole("separator", {
      name: "Largura do artigo e editor",
    });
    await expect(divider).toHaveAttribute("aria-valuenow", "55");
    await divider.focus();
    await page.keyboard.press("ArrowRight");
    await expect(divider).toHaveAttribute("aria-valuenow", "57");
    await page.reload();
    await expect(divider).toHaveAttribute("aria-valuenow", "57");
  } finally {
    release();
  }
});

test("editorial text preserves paragraphs and emphasis while keeping HTML inert", async ({
  page,
}) => {
  const note =
    "First paragraph.\n\nAsk *which rule* and **why**.\n\n<script>window.__noteExecuted=true</script>\n\n<img src=x onerror=alert(1)>Last paragraph.";
  const quiz = {
    id: "paragraph-feedback",
    question: "Which rule?",
    options: [
      { id: "a", text: "Investigate" },
      { id: "b", text: "Guess" },
    ],
    correct: "a",
    feedbackCorrect: "Correct.\n\nKeep **investigating**.",
    feedbackIncorrect: "Try again.\n\nCheck *the evidence*.",
    retry: true,
  };
  await writeFile(
    file,
    "# Autoria visual\n\n```bunker-note\n" +
      JSON.stringify({ kind: "info", text: note }) +
      "\n```\n\n```bunker-quiz\n" +
      JSON.stringify(quiz) +
      "\n```\n",
  );
  await page.goto(url + "/edit");
  await page.locator(".visual-document .editorial-note").first().click();
  const input = page.getByRole("textbox", {
    name: "Texto da nota",
    exact: true,
  });
  await expect(input).toHaveValue(note);
  const revised = note.replace("First paragraph.", "Revised first paragraph.");
  await input.fill(revised);
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(
    page.getByText("Salvo no arquivo.", { exact: true }),
  ).toBeVisible();
  expect(await readFile(file, "utf8")).toContain(JSON.stringify(revised));
  await page.getByRole("link", { name: "Voltar à lição", exact: true }).click();
  const rendered = page.locator("article .editorial-note");
  await expect(rendered.locator("p")).toHaveCount(3);
  await expect(rendered.locator("em")).toHaveText("which rule");
  await expect(rendered.locator("strong").last()).toHaveText("why");
  await expect(rendered.locator("script, img")).toHaveCount(0);
  expect(await page.evaluate(() => "__noteExecuted" in window)).toBe(false);
  const interaction = page.locator(".inline-quiz");
  await interaction.getByRole("radio", { name: "Guess", exact: true }).check();
  await interaction.getByRole("button", { name: "Verificar resposta" }).click();
  await expect(interaction.locator(".quiz-feedback-text p")).toHaveCount(2);
  await expect(interaction.getByRole("status").locator("em")).toHaveText(
    "the evidence",
  );
  await expect(
    interaction.getByRole("button", { name: "Tentar novamente" }),
  ).toHaveCount(0);
  await interaction
    .getByRole("radio", { name: "Investigate", exact: true })
    .check();
  await interaction.getByRole("button", { name: "Verificar resposta" }).click();
  await expect(interaction.locator(".quiz-feedback-text p")).toHaveCount(2);
  await expect(interaction.locator(".quiz-feedback-text strong")).toHaveText(
    "investigating",
  );
  await page.reload();
  await expect(rendered.locator("p").first()).toHaveText(
    "Revised first paragraph.",
  );
});

test("reading themes keep links, quotes and lists legible without changing Studio preview", async ({
  page,
}, info) => {
  await writeFile(
    file,
    source +
      "\n[Referência](https://example.com) com `inline`.\n\n> Uma citação.\n\n- Uma lista.\n",
  );
  await page.goto(url);
  const article = page.locator(".study-explanation");
  const samples: unknown[] = [];
  for (let tone = 0; tone < 6; tone++) {
    await page
      .getByRole("button", { name: "Ajustar lição", exact: true })
      .click();
    await selectReadingTone(page, tone);
    await page.keyboard.press("Escape");
    const link = article.getByRole("link", { name: "Referência", exact: true });
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await link.focus();
    const text = await expectRenderedContrast(
      article.locator("a, blockquote, li, :not(pre) > code"),
    );
    const focus = await expectRenderedContrast(link, {
      foreground: "outlineColor",
      minimum: 3,
    });
    await link.hover();
    await expect(link).toHaveCSS("text-decoration-thickness", "2px");
    samples.push({ tone, text, focus });
  }
  await info.attach("rendered-links-contrast.json", {
    body: JSON.stringify(samples, null, 2),
    contentType: "application/json",
  });
  await page.getByRole("link", { name: "Editar lição", exact: true }).click();
  await studioView(page, "Prévia");
  await expect(page.locator(".studio-preview")).toBeVisible();
  await expect(page.locator(".reading-theme")).toHaveCount(0);
  await expect(page.locator(".studio-preview a")).toHaveCSS(
    "color",
    "rgb(232, 189, 104)",
  );
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
});

test("Otto signature uses the same safe avatar in Studio preview and reader", async ({
  page,
}, info) => {
  const note = JSON.stringify({
    kind: "info",
    text: "**Otto**\n\nUm comentário com **ênfase**. <script>window.ottoUnsafe = true</script>",
  });
  const generic = JSON.stringify({
    kind: "tip",
    text: "Uma nota comum menciona Otto sem atribuir sua voz.",
  });
  await writeFile(
    file,
    source +
      "\n```bunker-note\n" +
      note +
      "\n```\n\n```bunker-note\n" +
      generic +
      "\n```\n",
  );
  await page.goto(url + "/edit");
  await studioView(page, "Prévia");
  await expect(
    page
      .getByRole("complementary", { name: "Otto", exact: true })
      .locator(".otto-avatar"),
  ).toBeVisible();
  await expect(
    page
      .getByRole("complementary", { name: "Nota", exact: true })
      .locator(".otto-avatar"),
  ).toHaveCount(0);
  expect(await page.evaluate(() => "ottoUnsafe" in window)).toBe(false);
  await page.getByRole("link", { name: "Voltar à lição" }).click();
  await expect(
    page
      .getByRole("complementary", { name: "Otto", exact: true })
      .locator(".otto-avatar"),
  ).toBeVisible();
  expect(await page.evaluate(() => "ottoUnsafe" in window)).toBe(false);
  const comment = page.getByRole("complementary", {
    name: "Otto",
    exact: true,
  });
  const geometry = await page.evaluate(async () => {
    const source = await (await fetch("/characters/otto.svg")).text();
    const svg = new DOMParser().parseFromString(
      source,
      "image/svg+xml",
    ).documentElement;
    if (!(svg instanceof SVGSVGElement)) throw new Error("Expected Otto SVG");
    svg.style.position = "absolute";
    svg.style.left = "-10000px";
    document.body.append(svg);
    try {
      const bounds = svg.getBBox();
      const view = svg.viewBox.baseVal;
      return {
        viewBox: {
          x: view.x,
          y: view.y,
          width: view.width,
          height: view.height,
        },
        artwork: {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        },
      };
    } finally {
      svg.remove();
    }
  });
  await writeFile(
    info.outputPath("otto-svg-geometry.json"),
    JSON.stringify(geometry, null, 2),
  );
  await info.attach("otto-svg-geometry.json", {
    body: JSON.stringify(geometry, null, 2),
    contentType: "application/json",
  });
  expect(geometry.viewBox.width).toBeCloseTo(498.4, 1);

  for (const width of [1280, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(comment).not.toContainText("Otto");
    await expect(comment.locator(".otto-avatar")).toHaveCSS(
      "border-radius",
      "50%",
    );
    await expect(comment.locator(".otto-avatar")).toHaveCSS(
      "overflow",
      "hidden",
    );
    await expect(comment.locator(".otto-avatar img")).toHaveAttribute(
      "src",
      "/characters/otto.svg",
    );
    const avatar = await comment.locator(".otto-avatar").boundingBox();
    const portrait = await comment.locator(".otto-avatar img").boundingBox();
    expect(portrait!.width).toBeGreaterThan(avatar!.width * 1.4);
    expect(portrait!.width / portrait!.height).toBeCloseTo(1, 2);
    const text = await comment.locator(".editorial-note-content").boundingBox();
    expect(
      Math.abs(avatar!.y + avatar!.height / 2 - text!.y - text!.height / 2),
    ).toBeLessThan(2);
    expect(
      await comment.evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
    if (width !== 375)
      await comment.screenshot({
        path: info.outputPath(`otto-note-${width}.png`),
      });
  }
});

test("Portuguese composition keeps quiz and note fields focused and saves accented text", async ({
  page,
}) => {
  await writeFile(
    file,
    source +
      "\n```bunker-quiz\n" +
      JSON.stringify({
        id: "accents",
        question: "Pergunta",
        options: [
          { id: "a", text: "Um" },
          { id: "b", text: "Dois" },
        ],
        correct: "a",
        feedbackCorrect: "Sim",
        feedbackIncorrect: "Reveja",
        retry: true,
      }) +
      "\n```\n\n```bunker-note\n" +
      JSON.stringify({ kind: "info", text: "Nota" }) +
      "\n```",
  );
  await page.goto(url + "/edit");
  await page.locator(".quiz-author").click();
  const session = await page.context().newCDPSession(page);
  for (const label of [
    "Pergunta",
    "Alternativa 1",
    "Feedback da alternativa 1",
    "Feedback correto",
    "Feedback incorreto",
    "Texto da nota",
  ]) {
    if (label === "Feedback correto")
      await page.getByText("Feedback legado", { exact: true }).click();
    if (label === "Texto da nota")
      await page.locator(".visual-document .editorial-note").first().click();
    const field = page.getByRole("textbox", { name: label, exact: true });
    await field.fill("");
    for (const part of ["é", " já", " não"]) {
      await session.send("Input.imeSetComposition", {
        text: part,
        selectionStart: part.length,
        selectionEnd: part.length,
      });
      await expect(field).toBeFocused();
      await session.send("Input.insertText", { text: part });
    }
    await expect(field).toHaveValue("é já não");
    await expect(field).toBeFocused();
  }
  await page
    .locator(".visual-document p")
    .filter({ hasText: "Antes do bloco." })
    .click();
  await page.keyboard.press("End");
  await session.send("Input.imeSetComposition", {
    text: " é já não",
    selectionStart: 9,
    selectionEnd: 9,
  });
  await session.send("Input.insertText", { text: " é já não" });
  await expect(page.locator(".visual-document")).toContainText(
    "Antes do bloco. é já não",
  );
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(page.locator(".studio-status")).toHaveText("Salvo no arquivo.");
  expect(await readFile(file, "utf8")).toContain("é já não");
  await page.reload();
  await page.locator(".quiz-author").click();
  await expect(
    page.getByRole("textbox", { name: "Pergunta", exact: true }),
  ).toHaveValue("é já não");
  await studioView(page, "Editar fonte Markdown");
  const markdown = page.locator("#lesson-markdown");
  await markdown.focus();
  await page.keyboard.press("ControlOrMeta+End");
  await session.send("Input.imeSetComposition", {
    text: "\n\né já não",
    selectionStart: 10,
    selectionEnd: 10,
  });
  await session.send("Input.insertText", { text: "\n\né já não" });
  await expect(markdown).toHaveValue(/é já não$/);
});

test("authors save per-option feedback and learners retry directly with keyboard and legacy fallback", async ({
  page,
}, info) => {
  const quiz = {
    id: "option-feedback",
    question: "Qual alternativa?",
    options: [
      { id: "a", text: "Correta" },
      { id: "b", text: "Incorreta" },
      { id: "c", text: "Legada" },
    ],
    correct: "a",
    feedbackCorrect: "Correto geral",
    feedbackIncorrect: "Incorreto geral",
    retry: true,
  };
  await writeFile(
    file,
    source + "\n```bunker-quiz\n" + JSON.stringify(quiz) + "\n```\n",
  );
  await page.goto(url + "/edit");
  await page.locator(".quiz-author").click();
  const correctFeedback = "Já está **correta**.\n\nVocê identificou a regra.";
  const incorrectFeedback =
    "Não é essa. Reveja *este caso*. <script>window.optionUnsafe = true</script>";
  await page
    .getByRole("textbox", { name: "Feedback da alternativa 1", exact: true })
    .fill(correctFeedback);
  await page
    .getByRole("textbox", { name: "Feedback da alternativa 2", exact: true })
    .fill(incorrectFeedback);
  const optionalFeedback = page.getByRole("textbox", {
    name: "Feedback da alternativa 3",
    exact: true,
  });
  await optionalFeedback.fill("Texto temporário");
  await optionalFeedback.fill("");
  for (const width of [1280, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page
        .locator(".quiz-author")
        .evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
  }
  await page
    .locator(".quiz-author")
    .screenshot({ path: info.outputPath("studio-option-feedback-320.png") });
  await page.setViewportSize({ width: 1280, height: 960 });
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(page.locator(".studio-status")).toHaveText("Salvo no arquivo.");
  const saved = await readFile(file, "utf8");
  expect(saved).toContain(JSON.stringify(correctFeedback));
  expect(saved).toContain(JSON.stringify(incorrectFeedback));
  expect(saved).toContain('"id": "c"');
  expect(saved).not.toContain('"feedback": ""');
  expect(saved).not.toContain("Texto temporário");
  await page.reload();
  await page.locator(".quiz-author").click();
  await expect(
    page.getByRole("textbox", {
      name: "Feedback da alternativa 1",
      exact: true,
    }),
  ).toHaveValue(correctFeedback);
  await page.getByRole("button", { name: "Testar como estudante" }).click();
  await page.getByRole("radio", { name: "Incorreta", exact: true }).check();
  await page.getByRole("button", { name: "Verificar resposta" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Resposta incorreta" }),
  ).toContainText("Não é essa.");
  await page.getByRole("link", { name: "Voltar à lição" }).click();
  const interaction = page.locator(".inline-quiz");
  const verify = interaction.getByRole("button", {
    name: "Verificar resposta",
  });
  const wrong = interaction.getByRole("radio", {
    name: "Incorreta",
    exact: true,
  });
  await wrong.check();
  await verify.click();
  await expect(interaction.getByRole("status")).toContainText("Não é essa.");
  await expect(interaction.locator("em")).toHaveText("este caso");
  await expect(interaction.locator("script")).toHaveCount(0);
  expect(await page.evaluate(() => "optionUnsafe" in window)).toBe(false);
  await expect(wrong).toBeEnabled();
  await expect(
    interaction.getByRole("button", { name: "Tentar novamente" }),
  ).toHaveCount(0);
  await verify.click(); // Same wrong choice is a valid explicit new attempt.
  await expect(interaction.getByRole("status")).toContainText("Não é essa.");
  const submittedWrong = await interaction.getByRole("status").innerHTML();
  await wrong.focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    interaction.getByRole("radio", { name: "Legada", exact: true }),
  ).toBeFocused();
  expect(await interaction.getByRole("status").innerHTML()).toBe(
    submittedWrong,
  );
  await expect(
    interaction.locator('.quiz-option[data-result="incorrect"] input'),
  ).toHaveValue("b");
  await verify.focus();
  await page.keyboard.press("Enter");
  await expect(interaction.getByRole("status")).toContainText(
    "Incorreto geral",
  );
  const submittedLegacy = await interaction.getByRole("status").innerHTML();
  await interaction
    .getByRole("radio", { name: "Correta", exact: true })
    .check();
  expect(await interaction.getByRole("status").innerHTML()).toBe(
    submittedLegacy,
  );
  await verify.click();
  await expect(interaction.getByRole("status")).toContainText(
    "Já está correta.",
  );
  await expect(interaction.locator(".quiz-feedback strong").last()).toHaveText(
    "correta",
  );
  await expect(interaction.locator(".quiz-feedback-text p")).toHaveCount(2);
  await interaction.screenshot({
    path: info.outputPath("quiz-option-feedback.png"),
  });
});

test("quizzes with retry disabled retain the confirmed incorrect answer", async ({
  page,
}, info) => {
  await writeFile(
    file,
    source +
      "\n```bunker-quiz\n" +
      JSON.stringify({
        id: "single-attempt",
        question: "Uma tentativa",
        options: [
          { id: "a", text: "Sim" },
          { id: "b", text: "Não" },
        ],
        correct: "a",
        feedbackCorrect: "Certo",
        feedbackIncorrect: "Reveja a regra",
        retry: false,
      }) +
      "\n```\n",
  );
  await page.goto(url);
  const interaction = page.locator(".inline-quiz");
  await interaction.getByRole("radio", { name: "Não", exact: true }).check();
  await interaction.getByRole("button", { name: "Verificar resposta" }).click();
  await expect(interaction.getByRole("status")).toContainText("Reveja a regra");
  for (const radio of await interaction.getByRole("radio").all())
    await expect(radio).toBeDisabled();
  await expect(
    interaction.getByRole("radio", { name: "Não", exact: true }),
  ).toBeChecked();
  await expect(interaction.getByRole("button")).toHaveCount(0);
  await interaction.evaluate((node) =>
    node.scrollIntoView({ block: "center" }),
  );
  await interaction.screenshot({
    path: info.outputPath("retry-05-disabled.png"),
  });
});

test("new quizzes group correctness and feedback while preserving option identity across editing", async ({
  page,
}, info) => {
  await page.goto(url + "/edit");
  await page.locator(".visual-document p").first().click();
  await page
    .getByRole("button", { name: "Inserir após o bloco selecionado" })
    .click();
  await page.getByRole("button", { name: "Quiz", exact: true }).click();
  const author = page.locator(".quiz-author");
  await expect(
    author.getByText("Feedback e tentativas", { exact: true }),
  ).toHaveCount(0);
  await expect(
    author.getByText("Feedback legado", { exact: true }),
  ).toHaveCount(0);
  await expect(
    author.getByRole("textbox", { name: "Feedback correto", exact: true }),
  ).toHaveCount(0);
  const correctness = author.getByRole("radio");
  await expect(author.locator('input[type="radio"]:checked')).toHaveCount(1);
  await expect(correctness.first()).toBeChecked();
  await correctness.first().focus();
  await page.keyboard.press("ArrowDown");
  await expect(correctness.nth(1)).toBeChecked();
  await expect(author.locator('input[type="radio"]:checked')).toHaveCount(1);
  await expect(
    author.locator('[data-correct="true"] .quiz-option-correct'),
  ).toHaveText("Correta");
  await author
    .getByRole("textbox", { name: "Alternativa 1", exact: true })
    .fill("Primeira");
  await author
    .getByRole("textbox", { name: "Alternativa 2", exact: true })
    .fill("Segunda");
  await author
    .getByRole("textbox", { name: "Feedback da alternativa 1", exact: true })
    .fill("Feedback da primeira.");
  await author
    .getByRole("textbox", { name: "Feedback da alternativa 2", exact: true })
    .fill("Feedback da segunda.");
  await author.getByRole("button", { name: "Adicionar alternativa" }).click();
  await author
    .getByRole("textbox", { name: "Alternativa 3", exact: true })
    .fill("Terceira");
  await author
    .getByRole("textbox", { name: "Feedback da alternativa 3", exact: true })
    .fill("Feedback da terceira.");
  await author
    .getByRole("button", { name: "Remover alternativa 1", exact: true })
    .click();
  await expect(
    author.getByRole("textbox", { name: "Alternativa 1", exact: true }),
  ).toHaveValue("Segunda");
  await expect(
    author.getByRole("textbox", {
      name: "Feedback da alternativa 1",
      exact: true,
    }),
  ).toHaveValue("Feedback da segunda.");
  await expect(
    author.getByRole("radio", { name: "Alternativa correta 1", exact: true }),
  ).toBeChecked();
  await author.getByText("Configurações do quiz", { exact: true }).click();
  await author
    .getByRole("checkbox", { name: "Permitir nova tentativa" })
    .uncheck();
  for (const width of [1280, 375, 320]) {
    await page.setViewportSize({ width, height: 960 });
    expect(
      await author.evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: info.outputPath("quiz-authoring-options.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(page.locator(".studio-status")).toHaveText("Salvo no arquivo.");
  const saved = await readFile(file, "utf8");
  const match = /```bunker-quiz\n([\s\S]*?)\n```/.exec(saved);
  expect(match).not.toBeNull();
  const quiz = parseQuiz(JSON.parse(match![1]!));
  expect(
    quiz.options.map((option) => [option.id, option.text, option.feedback]),
  ).toEqual([
    ["b", "Segunda", "Feedback da segunda."],
    [quiz.options[1]!.id, "Terceira", "Feedback da terceira."],
  ]);
  expect(quiz.correct).toBe("b");
  expect(quiz.retry).toBe(false);
  // Reordering in the existing Markdown source keeps correctness/feedback tied to IDs.
  await studioView(page, "Editar fonte Markdown");
  await page
    .locator("#lesson-markdown")
    .fill(
      saved.replace(
        match![0],
        "```bunker-quiz\n" +
          JSON.stringify(
            { ...quiz, options: [...quiz.options].reverse() },
            null,
            2,
          ) +
          "\n```",
      ),
    );
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(page.locator(".studio-status")).toHaveText("Salvo no arquivo.");
  await page.reload();
  await studioView(page, "Editor visual");
  await author.click();
  await expect(
    author.getByRole("textbox", { name: "Alternativa 1", exact: true }),
  ).toHaveValue("Terceira");
  await expect(
    author.getByRole("textbox", {
      name: "Feedback da alternativa 1",
      exact: true,
    }),
  ).toHaveValue("Feedback da terceira.");
  await expect(
    author.getByRole("radio", { name: "Alternativa correta 2", exact: true }),
  ).toBeChecked();
  await author.getByText("Configurações do quiz", { exact: true }).click();
  await expect(
    author.getByRole("checkbox", { name: "Permitir nova tentativa" }),
  ).not.toBeChecked();
  // Deleting the correct option selects one surviving option without changing its feedback.
  await author.getByRole("button", { name: "Adicionar alternativa" }).click();
  await author
    .getByRole("button", { name: "Remover alternativa 2", exact: true })
    .click();
  await expect(author.locator('input[type="radio"]:checked')).toHaveCount(1);
  await expect(author.getByRole("radio").first()).toBeChecked();
  await expect(
    author.getByRole("textbox", {
      name: "Feedback da alternativa 1",
      exact: true,
    }),
  ).toHaveValue("Feedback da terceira.");
});

test("legacy feedback survives hidden controls and becomes editable only when an option needs it", async ({
  page,
}) => {
  const original = {
    id: "legacy-preservation",
    question: "Pergunta legada",
    options: [
      { id: "a", text: "Primeira", feedback: "Feedback A" },
      { id: "b", text: "Segunda", feedback: "Feedback B" },
    ],
    correct: "a",
    feedbackCorrect: "Já estava correto no legado.",
    feedbackIncorrect: "Não era a resposta esperada no legado.",
    retry: false,
  };
  await writeFile(
    file,
    source + "\n```bunker-quiz\n" + JSON.stringify(original) + "\n```\n",
  );
  await page.goto(url + "/edit");
  const author = page.locator(".quiz-author");
  await author.click();
  await expect(
    author.getByText("Feedback legado", { exact: true }),
  ).toHaveCount(0);
  await author
    .getByRole("textbox", { name: "Pergunta", exact: true })
    .fill("Pergunta revisada");
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(page.locator(".studio-status")).toHaveText("Salvo no arquivo.");
  const saved = await readFile(file, "utf8");
  const parsed = parseQuiz(
    JSON.parse(/```bunker-quiz\n([\s\S]*?)\n```/.exec(saved)![1]!),
  );
  expect(parsed).toEqual({ ...original, question: "Pergunta revisada" });
  await author
    .getByRole("textbox", { name: "Feedback da alternativa 2", exact: true })
    .fill("");
  await expect(
    author.getByText("Feedback legado", { exact: true }),
  ).toBeVisible();
  await author
    .getByRole("radio", { name: "Alternativa correta 2", exact: true })
    .check();
  await expect(
    author.getByRole("textbox", {
      name: "Feedback da alternativa 2",
      exact: true,
    }),
  ).toHaveAttribute("placeholder", "Usa o feedback legado correto.");
  await author.getByText("Feedback legado", { exact: true }).click();
  await expect(
    author.getByRole("textbox", { name: "Feedback correto", exact: true }),
  ).toHaveValue(original.feedbackCorrect);
  await expect(
    author.getByRole("textbox", { name: "Feedback incorreto", exact: true }),
  ).toHaveValue(original.feedbackIncorrect);
  await author
    .getByRole("textbox", { name: "Feedback correto", exact: true })
    .fill("Já está correto após a revisão.");
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(page.locator(".studio-status")).toHaveText("Salvo no arquivo.");
  await page.reload();
  await page.getByRole("link", { name: "Voltar à lição" }).click();
  const interaction = page.locator(".inline-quiz");
  await interaction
    .getByRole("radio", { name: "Segunda", exact: true })
    .check();
  await interaction.getByRole("button", { name: "Verificar resposta" }).click();
  await expect(interaction.getByRole("status")).toContainText(
    "Já está correto após a revisão.",
  );
  await expect(interaction.getByRole("button")).toHaveCount(0);
});

test("learner retry keeps submitted feedback until explicit verification across multiple wrong answers", async ({
  page,
}, info) => {
  const quiz = {
    id: "explicit-retry",
    question: "Qual regra explica o resultado?",
    options: [
      {
        id: "a",
        text: "Alternativa A",
        feedback: "Feedback A: investigue o registro inicial.",
      },
      {
        id: "b",
        text: "Alternativa B",
        feedback: "Feedback B: investigue a recuperação dos dados.",
      },
      {
        id: "c",
        text: "Alternativa C",
        feedback: "Feedback C: a informação precisa sobreviver à atualização.",
      },
    ],
    correct: "c",
    feedbackCorrect: "Correto legado",
    feedbackIncorrect: "Incorreto legado",
    retry: true,
  };
  await writeFile(
    file,
    source + "\n```bunker-quiz\n" + JSON.stringify(quiz) + "\n```\n",
  );
  await page.goto(url);
  const interaction = page.locator(".inline-quiz");
  const radios = interaction.getByRole("radio");
  const status = interaction.getByRole("status");
  const verify = interaction.getByRole("button", {
    name: "Verificar resposta",
  });
  const reset = interaction.getByRole("button", { name: "Tentar novamente" });
  await radios.nth(0).check();
  await verify.click();
  await expect(status).toContainText(quiz.options[0]!.feedback);
  await expect(status).toContainText("Resposta incorreta");
  for (const radio of await radios.all()) await expect(radio).toBeEnabled();
  await expect(reset).toHaveCount(0);
  const submittedA = await status.innerHTML();
  await interaction.evaluate((node) =>
    node.scrollIntoView({ block: "center" }),
  );
  await interaction.screenshot({
    path: info.outputPath("retry-01-submitted-a.png"),
  });
  await radios.nth(0).focus();
  await page.keyboard.press("ArrowDown");
  await expect(radios.nth(1)).toBeChecked();
  await expect(radios.nth(1)).toBeFocused();
  await interaction.screenshot({
    path: info.outputPath("retry-02-b-selected-feedback-a.png"),
  });
  expect(await status.innerHTML()).toBe(submittedA);
  await expect(status).not.toContainText(quiz.options[1]!.feedback);
  await expect(
    interaction.locator('.quiz-option[data-result="incorrect"] input'),
  ).toHaveValue("a");
  await verify.focus();
  await page.keyboard.press("Enter");
  await expect(status).toContainText(quiz.options[1]!.feedback);
  await expect(status).not.toContainText(quiz.options[0]!.feedback);
  await expect(
    interaction.locator('.quiz-option[data-result="incorrect"] input'),
  ).toHaveValue("b");
  await interaction.screenshot({
    path: info.outputPath("retry-03-submitted-b.png"),
  });
  // Repeat an already evaluated wrong choice without a reset.
  await verify.click();
  await expect(status).toContainText(quiz.options[1]!.feedback);
  await expect(reset).toHaveCount(0);
  await radios.nth(0).check();
  await expect(status).toContainText(quiz.options[1]!.feedback);
  await verify.click();
  await expect(status).toContainText(quiz.options[0]!.feedback);
  await radios.nth(2).check();
  await expect(status).toContainText(quiz.options[0]!.feedback);
  await expect(status).not.toContainText("Resposta correta");
  await verify.click();
  await expect(status).toContainText(quiz.options[2]!.feedback);
  await expect(status).toContainText("Resposta correta");
  for (const radio of await radios.all()) await expect(radio).toBeDisabled();
  await expect(verify).toHaveCount(0);
  await expect(reset).toBeVisible();
  await expect(radios.nth(2)).toBeChecked();
  await interaction.screenshot({
    path: info.outputPath("retry-04-correct-c.png"),
  });
  await expect(status).toContainText(quiz.options[2]!.feedback);
  // Quiz answers remain ephemeral, without rewriting the lesson file.
  expect(await readFile(file, "utf8")).toContain(JSON.stringify(quiz));
  await page.reload();
  await expect(status).toBeEmpty();
  await expect(interaction.locator("input:checked")).toHaveCount(0);
});
