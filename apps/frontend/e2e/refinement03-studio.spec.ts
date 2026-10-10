import { expect, test } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { studioView } from "./studio-controls";
const root = join(
  process.env.BUNKERCODE_BROWSER_CONTENT_DIR!,
  "courses/document-workspace",
);
const file = join(root, "lessons/document/lesson.md");
const source =
  "# Documento central\n\nUma explicação para editar diretamente.\n\n## Continuação\n\nTexto de apoio.\n";
test.beforeAll(async () => {
  await mkdir(join(root, "lessons/document"), { recursive: true });
  await writeFile(
    join(root, "course.json"),
    JSON.stringify({
      id: "document-workspace",
      title: "Autoria",
      description: "Fixture",
      lessons: [{ slug: "document", title: "Documento central" }],
    }),
  );
});
for (const width of [390, 1280, 1440, 1920])
  test(`minimal document Studio, keyboard tools and physical Markdown save at ${width}`, async ({
    page,
  }, info) => {
    await writeFile(file, source);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/courses/document-workspace/lessons/document/edit");
    const doc = page.locator(".visual-document");
    await expect(doc).toBeVisible();
    await expect(
      page.locator(".studio-breadcrumb,.studio-heading"),
    ).toHaveCount(0);
    await expect(
      page.getByRole("group", { name: "Formatação do conteúdo" }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Editar fonte Markdown", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Abrir curso Autoria" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Estrutura do documento", exact: true })
      .click();
    const outline = page.getByRole("complementary", {
      name: "Estrutura do documento",
    });
    await expect(
      outline.getByRole("button", { name: "Continuação", exact: true }),
    ).toBeVisible();
    await outline
      .getByRole("button", { name: "Continuação", exact: true })
      .click();
    await expect(outline).toHaveCount(0);
    await doc.locator("p").first().click();
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");
    await expect(
      page.getByRole("group", { name: "Formatação do conteúdo" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Negrito", exact: true }).click();
    await expect(doc.locator("strong")).toContainText("Uma explicação");
    await page
      .getByRole("button", {
        name: "Inserir após o bloco selecionado",
        exact: true,
      })
      .click();
    await page.getByRole("button", { name: "Nota", exact: true }).click();
    await page
      .getByRole("button", { name: "Salvar alterações", exact: true })
      .click();
    await expect(
      page.getByText("Salvo no arquivo.", { exact: true }),
    ).toBeVisible();
    expect(await readFile(file, "utf8")).toContain("bunker-note");
    expect(await readFile(file, "utf8")).toContain("**Uma explicação");
    await studioView(page, "Editar fonte Markdown");
    await expect(page.locator("#lesson-markdown")).toContainText("bunker-note");
    await studioView(page, "Prévia");
    await expect(
      page.getByRole("region", { name: "Prévia da lição" }),
    ).toBeVisible();
    await studioView(page, "Editor visual");
    await expect(doc).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`phase-d-${width}.png`),
      fullPage: true,
    });
  });
