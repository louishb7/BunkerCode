import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { studioView } from "./studio-controls";

const content = process.env.BUNKERCODE_BROWSER_CONTENT_DIR!;
const course = "fundamentos-programacao-javascript";
const slug = "o-que-significa-programar";
const path = `/courses/${course}/lessons/${slug}`;
const file = join(content, "courses", course, "lessons", slug, "lesson.md");
const studioCourse = "refinement11-studio";
const studioRoot = join(content, "courses", studioCourse);

function blocks(markdown: string, language: string): unknown[] {
  return [
    ...markdown.matchAll(
      new RegExp("```" + language + "\\n([\\s\\S]*?)\\n```", "g"),
    ),
  ].map((match) => JSON.parse(match[1]!) as unknown);
}

async function geometry(page: Page) {
  const result = await page.evaluate(() => {
    const bounds = (selector: string) => {
      const rect = document.querySelector(selector)!.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
      };
    };
    const article = document.querySelector<HTMLElement>(".study-explanation")!;
    return {
      viewport: { width: innerWidth, height: innerHeight },
      document: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      },
      heading: bounds(".lesson-heading"),
      prose: bounds(".study-explanation > .prose"),
      article: bounds(".study-explanation"),
      header: bounds(".site-header"),
      footer: bounds(".learning-footer"),
      home: bounds(".header-home"),
      tools: bounds(".header-reading-tools"),
      articleOverflow: article.scrollWidth > article.clientWidth,
    };
  });
  expect(result.document).toEqual(result.viewport);
  expect(result.articleOverflow).toBe(false);
  expect(result.heading.x).toBeCloseTo(result.prose.x, 1);
  expect(result.heading.width).toBeCloseTo(result.prose.width, 1);
  expect(result.article.bottom).toBeLessThanOrEqual(result.footer.y);
  expect(result.header.y).toBe(0);
  expect(result.footer.bottom).toBe(result.viewport.height);
  expect(result.footer.height).toBe(59); // 58px navigation + top border.
  expect(result.home.right).toBeLessThan(result.tools.x);
  return result;
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
]) {
  test(`real lesson, note, keyboard quiz and navigation at ${viewport.width}x${viewport.height}`, async ({
    page,
  }, info) => {
    const original = await readFile(file, "utf8");
    await page.setViewportSize(viewport);
    await page.goto(path);
    await expect(page.locator(".lesson-heading .eyebrow")).toHaveText(
      "Módulo 00 · Lição 01",
    );
    await expect(page.locator(".lesson-heading h1")).toHaveText(
      "O que significa programar?",
    );
    await expect(
      page.locator(".lesson-outline, .study-outline, .study-divider"),
    ).toHaveCount(0);
    await expect(
      page
        .locator(".site-header")
        .getByRole("link", { name: "Editar lição", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".lesson-heading a")).toHaveCount(0);
    const initial = await geometry(page);
    if (viewport.width >= 1000) expect(initial.prose.width).toBe(731);
    await info.attach("geometry-initial.json", {
      body: JSON.stringify(initial, null, 2),
      contentType: "application/json",
    });
    await page.screenshot({
      path: info.outputPath(`reader-${viewport.width}.png`),
    });

    const notes = page.getByRole("complementary", {
      name: "Nota",
      exact: true,
    });
    await expect(notes).toHaveCount(2);
    await expect(notes.getByText("Informação", { exact: true })).toHaveCount(0);
    await expect(notes.nth(1).locator("p")).toHaveCount(3);
    await expect(notes.nth(1).locator("em")).toContainText(
      "será que isso está certo mesmo?",
    );
    await notes.first().scrollIntoViewIfNeeded();
    await page.screenshot({
      path: info.outputPath(`note-${viewport.width}.png`),
    });

    const headings = await page
      .locator(".prose > :is(h2, h3)")
      .evaluateAll((nodes) =>
        nodes.map((node) => ({ text: node.textContent, id: node.id })),
      );
    expect(headings.map((h) => h.text)).toEqual(
      original
        .split("\n")
        .filter((line) => /^#{2,3} /.test(line))
        .map((line) => line.replace(/^#+ /, "")),
    );
    expect(headings.every((h) => /^section-line-\d+$/.test(h.id))).toBe(true);
    await page.evaluate((id) => {
      location.hash = id;
    }, headings[0]!.id);
    await expect(page.locator(`#${headings[0]!.id}`)).toBeInViewport();

    const quiz = page.locator(".inline-quiz");
    const radios = quiz.getByRole("radio");
    await expect(radios).toHaveCount(3);
    await expect(quiz.locator("[data-result], .quiz-feedback")).toHaveCount(0);
    await expect(
      quiz.getByRole("button", { name: "Verificar resposta" }),
    ).toBeDisabled();
    await radios.first().focus();
    await page.keyboard.press("ArrowUp");
    await expect(radios.last()).toBeChecked();
    await quiz.getByRole("button", { name: "Verificar resposta" }).focus();
    await page.keyboard.press("Enter");
    await expect(quiz.getByRole("status")).toContainText("Resposta correta");
    await expect(
      quiz.locator('.quiz-option[data-result="correct"]'),
    ).toHaveCount(1);
    await expect(quiz.locator(".quiz-option[data-result] svg")).toHaveCount(1);
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
    await expect(quiz.locator(".quiz-feedback-text")).toContainText(
      "Já temos algumas hipóteses para investigar.",
    );
    await quiz.locator(".quiz-feedback").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: info.outputPath(`quiz-correct-${viewport.width}.png`),
    });
    await quiz.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(quiz.locator("[data-result], .quiz-feedback")).toHaveCount(0);
    await radios.first().check();
    await quiz.getByRole("button", { name: "Verificar resposta" }).click();
    await expect(quiz.getByRole("status")).toContainText("Resposta incorreta");
    await expect(
      quiz.locator('.quiz-option[data-result="incorrect"]'),
    ).toHaveCount(1);
    expect(
      await radios
        .first()
        .locator("..")
        .evaluate((node) => getComputedStyle(node).textDecorationLine),
    ).toBe("none");
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
      path: info.outputPath(`quiz-incorrect-${viewport.width}.png`),
    });
    await geometry(page);

    const footer = page.locator(".learning-footer");
    await expect(footer.locator(".footer-position")).toHaveText("01/01");
    for (const name of ["Lição anterior", "Próxima lição"])
      await expect(
        footer.getByRole("button", { name, exact: true }),
      ).toBeDisabled();
    const menu = footer.getByRole("button", { name: "Lições", exact: true });
    await menu.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("link")).toHaveCount(1);
    await expect(dialog.getByRole("link")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();
    await menu.click();
    await dialog.getByRole("link").click();
    await expect(dialog).not.toBeVisible();

    const appearance = page.getByRole("button", {
      name: "Aparência da leitura",
    });
    await appearance.click();
    await page.getByLabel("Tamanho do texto", { exact: true }).focus();
    await page.keyboard.press("End");
    await page.keyboard.press("Escape");
    await expect(appearance).toBeFocused();
    await expect(page.locator(".study-explanation > .prose")).toHaveCSS(
      "font-size",
      "21px",
    );
    await page.reload();
    await expect(page.locator(".study-explanation > .prose")).toHaveCSS(
      "font-size",
      "21px",
    );
    await geometry(page);
    await footer.getByRole("link", { name: /Abrir curso/ }).click();
    await expect(page).toHaveURL(`/courses/${course}`);
    expect(await readFile(file, "utf8")).toBe(original);
  });

  test(`private workspace keeps its editor and footer at ${viewport.width}x${viewport.height}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport);
    await page.goto("/courses/typescript/lessons/values-and-types");
    await expect(page.locator(".lesson-heading .eyebrow")).toHaveText(
      "Lição 01",
    );
    await expect(page.locator(".cm-editor")).toHaveCount(1);
    await geometry(page);
    if (viewport.width >= 1000) {
      const divider = page.getByRole("separator", {
        name: "Largura do artigo e editor",
      });
      await divider.focus();
      await page.keyboard.press("Home");
      await geometry(page);
      await page.keyboard.press("End");
      await geometry(page);
      await page.keyboard.press("Enter");
    } else
      await page.getByRole("button", { name: "Código", exact: true }).click();
    const editor = page.getByRole("textbox", {
      name: "Código da solução",
      exact: true,
    });
    await expect(editor).toBeVisible();
    const frame = await page.locator(".study-code").boundingBox();
    const footer = await page.locator(".learning-footer").boundingBox();
    expect(frame!.y + frame!.height).toBeLessThanOrEqual(footer!.y);
    await page.screenshot({
      path: info.outputPath(`workspace-${viewport.width}.png`),
    });
    await page.getByRole("button", { name: "Lições", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("link", { name: /Union types/ })
      .click();
    await expect(page.locator(".lesson-heading h1")).toHaveText("Union types");
    await expect(page.locator(".study-divider")).toHaveCount(0);
    await page
      .getByRole("link", { name: "Lição anterior", exact: true })
      .click();
    await expect(editor).toBeVisible({ visible: viewport.width >= 1000 });
  });
}

test("Studio previews the real editorial blocks and physically saves a separate copy without changing structured properties", async ({
  page,
}, info) => {
  const original = await readFile(file, "utf8");
  const directory = join(studioRoot, "lessons", slug);
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(studioRoot, "course.json"),
    JSON.stringify({
      id: studioCourse,
      title: "Test-only editorial copy",
      description: "Isolated Studio fixture",
      lessons: [{ slug, title: "O que significa programar?" }],
    }),
  );
  const copy = join(directory, "lesson.md");
  await writeFile(copy, original);
  const url = `/courses/${studioCourse}/lessons/${slug}`;
  await page.goto(url + "/edit");
  await expect(page.locator(".visual-document .editorial-comment")).toHaveCount(
    2,
  );
  await studioView(page, "Prévia");
  const preview = page.locator(".studio-preview");
  await expect(
    preview.getByRole("complementary", { name: "Nota" }),
  ).toHaveCount(2);
  await expect(preview.locator(".code-language")).toHaveText("javascript");
  await preview.getByRole("radio").last().check();
  await preview.getByRole("button", { name: "Verificar resposta" }).click();
  await expect(preview.getByRole("status")).toContainText("Resposta correta");
  await preview.locator(".quiz-feedback").scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("studio-preview.png") });
  await studioView(page, "Editar fonte Markdown");
  await page
    .getByRole("textbox", { name: "Markdown completo", exact: true })
    .fill(original + "\n\nTest-only save verification.\n");
  await studioView(page, "Editor visual");
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(
    page.getByText("Salvo no arquivo.", { exact: true }),
  ).toBeVisible();
  const saved = await readFile(copy, "utf8");
  expect(saved).toContain("Test-only save verification.");
  for (const language of ["bunker-note", "bunker-quiz"])
    expect(blocks(saved, language)).toEqual(blocks(original, language));
  await page.reload();
  await expect(page.locator(".visual-document")).toContainText(
    "Test-only save verification.",
  );
  await page.getByRole("link", { name: "Voltar à lição", exact: true }).click();
  await expect(page.locator("article")).toContainText(
    "Test-only save verification.",
  );
  await expect(page.getByRole("complementary", { name: "Nota" })).toHaveCount(
    2,
  );
  expect(await readFile(file, "utf8")).toBe(original);
});
