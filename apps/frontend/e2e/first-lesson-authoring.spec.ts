import { expect, test } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { studioView } from "./studio-controls";

const id = "first-lesson-authoring";
const root = join(process.env.BUNKERCODE_BROWSER_CONTENT_DIR!, "courses", id);
test.beforeAll(async () => {
  await mkdir(root, { recursive: true });
  await writeFile(
    join(root, "course.json"),
    JSON.stringify({
      id,
      title: "Empty authoring fixture",
      description: "Test-only course",
      lessons: [],
      modules: [{ id: "intro", number: 0, title: "Initial module" }],
    }),
  );
});

test("an empty private course creates its first lesson through Studio and reopens physically saved content", async ({
  page,
}, info) => {
  await page.goto(`/courses/${id}`);
  const create = page.getByRole("button", {
    name: "Criar primeira lição",
    exact: true,
  });
  await expect(create).toBeVisible();
  await expect(page.locator(".course-module-heading")).toHaveText(
    "Módulo 00 Initial module",
  );
  await create.click();
  const dialog = page.getByRole("dialog", { name: "Nova lição" });
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(
    JSON.parse(await readFile(join(root, "course.json"), "utf8")),
  ).toMatchObject({ lessons: [] });
  await create.click();
  await dialog
    .getByLabel("Título", { exact: true })
    .fill("First fixture lesson");
  await dialog.getByLabel("Slug", { exact: true }).fill("first");
  await dialog
    .getByRole("button", { name: "Criar lição", exact: true })
    .click();
  await expect(page).toHaveURL(`/courses/${id}/lessons/first/edit`);
  const document = page.locator(".visual-document");
  await expect(document).toBeVisible();
  await document.click();
  await page.keyboard.insertText(
    "This is explicit test-only content, never the author's lesson.",
  );
  await studioView(page, "Prévia");
  await expect(page.locator(".studio-preview")).toContainText(
    "explicit test-only content",
  );
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(
    page.getByText("Salvo no arquivo.", { exact: true }),
  ).toBeVisible();
  const saved = await readFile(join(root, "lessons/first/lesson.md"), "utf8");
  expect(saved).toContain("explicit test-only content");
  const manifest = JSON.parse(
    await readFile(join(root, "course.json"), "utf8"),
  );
  expect(manifest.modules).toEqual([
    { id: "intro", number: 0, title: "Initial module" },
  ]);
  expect(manifest.lessons).toEqual([
    { slug: "first", title: "First fixture lesson", moduleId: "intro" },
  ]);
  await page.goto(`/courses/${id}`);
  await expect(
    page.getByRole("button", { name: "Criar primeira lição", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "01 First fixture lesson", exact: true })
    .click();
  await expect(page.locator("article")).toContainText(
    "explicit test-only content",
  );
  await page.getByRole("link", { name: "Editar lição", exact: true }).click();
  await expect(document).toContainText("explicit test-only content");
  await page.reload();
  await expect(document).toContainText("explicit test-only content");
  expect(await readFile(join(root, "lessons/first/lesson.md"), "utf8")).toBe(
    saved,
  );
  await page.screenshot({
    path: info.outputPath("fixture-first-lesson-studio.png"),
  });
});
